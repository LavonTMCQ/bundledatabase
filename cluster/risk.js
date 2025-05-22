/**
 * Cabal Risk Scoring
 * 
 * This script calculates risk scores for wallet clusters based on various heuristics.
 */

require('dotenv').config();
const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Risk scoring weights
const RISK_WEIGHTS = {
  DEV_SUPPLY_PERCENTAGE: 4,  // Dev holds > 20% supply
  LP_WITHDRAWAL: 3,          // LP pulled > 10% in 24h
  AIRDROP_PERCENTAGE: 2,     // Airdrop wallets > 30%
  SYNCED_TRADING: 1          // ≥ 3 wallets buying within same block
};

/**
 * Calculate risk score for a specific cluster
 */
async function calculateClusterRisk(client, clusterId) {
  let riskScore = 0;
  const tags = [];
  
  // Check for developer concentration (dev holds > 20% supply)
  const { rows: devSupply } = await client.query(`
    WITH cluster_wallets AS (
      SELECT stake_cred FROM cluster_member WHERE cluster_id = $1
    ),
    dev_wallets AS (
      SELECT stake_cred FROM wallet 
      WHERE stake_cred IN (SELECT stake_cred FROM cluster_wallets)
      AND flags->>'dev' = 'true'
    ),
    token_supplies AS (
      SELECT policy_id, SUM(balance) as total_supply
      FROM token_holding
      GROUP BY policy_id
    ),
    dev_holdings AS (
      SELECT th.policy_id, SUM(th.balance) as dev_balance
      FROM token_holding th
      JOIN dev_wallets dw ON th.stake_cred = dw.stake_cred
      GROUP BY th.policy_id
    )
    SELECT 
      dh.policy_id,
      dh.dev_balance / ts.total_supply as dev_percentage
    FROM dev_holdings dh
    JOIN token_supplies ts ON dh.policy_id = ts.policy_id
    WHERE dh.dev_balance / ts.total_supply > 0.2
  `);
  
  if (devSupply.length > 0) {
    riskScore += RISK_WEIGHTS.DEV_SUPPLY_PERCENTAGE;
    tags.push('high_dev_concentration');
  }
  
  // Check for LP withdrawals (> 10% in 24h)
  const { rows: lpWithdrawals } = await client.query(`
    WITH cluster_wallets AS (
      SELECT stake_cred FROM cluster_member WHERE cluster_id = $1
    ),
    lp_withdrawals AS (
      SELECT 
        w.stake_cred,
        COUNT(*) as withdrawal_count
      FROM wallet_edge we
      JOIN cluster_wallets w ON we.src = w.stake_cred
      WHERE we.relation = 'lp_withdrawal'
      AND we.weight > 0.1
      AND we.updated_at > NOW() - INTERVAL '24 hours'
      GROUP BY w.stake_cred
    )
    SELECT COUNT(*) as count FROM lp_withdrawals
  `);
  
  if (lpWithdrawals[0].count > 0) {
    riskScore += RISK_WEIGHTS.LP_WITHDRAWAL;
    tags.push('recent_lp_withdrawal');
  }
  
  // Check for airdrop percentage (> 30%)
  const { rows: airdropPercentage } = await client.query(`
    WITH cluster_wallets AS (
      SELECT stake_cred FROM cluster_member WHERE cluster_id = $1
    ),
    airdrop_wallets AS (
      SELECT stake_cred FROM wallet 
      WHERE stake_cred IN (SELECT stake_cred FROM cluster_wallets)
      AND flags->>'airdrop' = 'true'
    )
    SELECT 
      COUNT(DISTINCT aw.stake_cred)::float / COUNT(DISTINCT cw.stake_cred) as airdrop_ratio
    FROM cluster_wallets cw
    LEFT JOIN airdrop_wallets aw ON cw.stake_cred = aw.stake_cred
  `);
  
  if (airdropPercentage.length > 0 && airdropPercentage[0].airdrop_ratio > 0.3) {
    riskScore += RISK_WEIGHTS.AIRDROP_PERCENTAGE;
    tags.push('high_airdrop_ratio');
  }
  
  // Check for synchronized trading (≥ 3 wallets buying within same block)
  const { rows: syncedTrading } = await client.query(`
    WITH cluster_wallets AS (
      SELECT stake_cred FROM cluster_member WHERE cluster_id = $1
    ),
    synced_buys AS (
      SELECT 
        we.relation,
        COUNT(DISTINCT we.src) as wallet_count
      FROM wallet_edge we
      JOIN cluster_wallets cw ON we.src = cw.stake_cred
      WHERE we.relation = 'buy_same_block'
      GROUP BY we.relation
      HAVING COUNT(DISTINCT we.src) >= 3
    )
    SELECT COUNT(*) as count FROM synced_buys
  `);
  
  if (syncedTrading[0].count > 0) {
    riskScore += RISK_WEIGHTS.SYNCED_TRADING;
    tags.push('synchronized_trading');
  }
  
  return { riskScore, tags };
}

/**
 * Main risk scoring function
 */
async function performRiskScoring() {
  console.log('Starting risk scoring...');
  
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Get all clusters
    const { rows: clusters } = await client.query('SELECT cluster_id FROM cluster');
    
    console.log(`Processing ${clusters.length} clusters for risk scoring`);
    
    // Process each cluster
    for (const cluster of clusters) {
      const { riskScore, tags } = await calculateClusterRisk(client, cluster.cluster_id);
      
      // Update cluster risk score and tags
      await client.query(`
        UPDATE cluster 
        SET risk_score = $1, tags = $2
        WHERE cluster_id = $3
      `, [riskScore, tags, cluster.cluster_id]);
      
      // Add to history
      await client.query(`
        INSERT INTO cluster_score_history (cluster_id, score)
        VALUES ($1, $2)
      `, [cluster.cluster_id, riskScore]);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Risk scoring completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during risk scoring:', error);
  } finally {
    client.release();
  }
}

// Run the risk scoring
performRiskScoring()
  .then(() => {
    console.log('Risk scoring process finished');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error in risk scoring process:', err);
    process.exit(1);
  });
