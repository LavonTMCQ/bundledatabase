import 'dotenv/config';
import Fastify from 'fastify';
import { Pool } from 'pg';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('postgres:5432', 'localhost:5432') || 'postgresql://postgres:cabal_password_123@localhost:5432/cabal_db'
});

// Create Fastify instance
const fastify = Fastify({
  logger: true
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ready' };
});

// Get token graph endpoint
fastify.get('/token/:policy/graph', async (request, reply) => {
  const { policy } = request.params as { policy: string };

  try {
    const { rows } = await pool.query(`
      SELECT
        w.stake_cred,
        cm.cluster_id,
        c.risk_score,
        c.tags,
        json_agg(
          json_build_object(
            'dst', e.dst,
            'relation', e.relation,
            'weight', e.weight
          )
        ) as edges
      FROM wallet w
      JOIN token_holding th ON th.stake_cred = w.stake_cred
      LEFT JOIN cluster_member cm ON cm.stake_cred = w.stake_cred
      LEFT JOIN cluster c ON c.cluster_id = cm.cluster_id
      LEFT JOIN wallet_edge e ON e.src = w.stake_cred
      WHERE th.policy_id = $1
      GROUP BY w.stake_cred, cm.cluster_id, c.risk_score, c.tags
    `, [policy]);

    return rows;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Get all tokens endpoint
fastify.get('/tokens', async (request, reply) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.policy_id,
        t.asset_name,
        t.decimals,
        t.market_cap_ada,
        COUNT(DISTINCT th.stake_cred) as holder_count,
        MAX(c.risk_score) as max_risk_score
      FROM token t
      LEFT JOIN token_holding th ON th.policy_id = t.policy_id
      LEFT JOIN cluster_member cm ON cm.stake_cred = th.stake_cred
      LEFT JOIN cluster c ON c.cluster_id = cm.cluster_id
      GROUP BY t.policy_id, t.asset_name, t.decimals, t.market_cap_ada
      ORDER BY t.first_seen DESC
    `);

    return rows;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Get cluster details endpoint
fastify.get('/cluster/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  try {
    // Get cluster details
    const { rows: clusterDetails } = await pool.query(`
      SELECT
        c.cluster_id,
        c.risk_score,
        c.tags
      FROM cluster c
      WHERE c.cluster_id = $1
    `, [id]);

    if (clusterDetails.length === 0) {
      return reply.status(404).send({ error: 'Cluster not found' });
    }

    // Get cluster members
    const { rows: members } = await pool.query(`
      SELECT
        w.stake_cred,
        w.flags,
        json_agg(
          json_build_object(
            'policy_id', th.policy_id,
            'balance', th.balance
          )
        ) as holdings
      FROM cluster_member cm
      JOIN wallet w ON w.stake_cred = cm.stake_cred
      LEFT JOIN token_holding th ON th.stake_cred = w.stake_cred
      WHERE cm.cluster_id = $1
      GROUP BY w.stake_cred, w.flags
    `, [id]);

    // Get risk score history
    const { rows: history } = await pool.query(`
      SELECT score, ts
      FROM cluster_score_history
      WHERE cluster_id = $1
      ORDER BY ts DESC
      LIMIT 30
    `, [id]);

    return {
      ...clusterDetails[0],
      members,
      history
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({
      port: parseInt(process.env.PORT || '4000', 10),
      host: '0.0.0.0'
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
