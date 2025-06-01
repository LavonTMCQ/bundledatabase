import { Pool } from 'pg';

interface BubbleHolder {
  id: string;
  address: string;
  stakeAddress?: string;
  amount: number;
  percentage: number;
  riskCategory: string;
  riskColor: string;
  isInfrastructure: boolean;
  rank: number;
  clusterId?: string;
  clusterSize: number;
  bubbleSize: number;
  opacity: number;
  positionX?: number;
  positionY?: number;
}

interface BubbleMapSnapshot {
  policyId: string;
  assetName?: string;
  ticker?: string;
  totalHolders: number;
  riskScore?: number;
  topHolderPercentage?: number;
  holders: BubbleHolder[];
  metadata?: any;
}

interface WalletConnection {
  sourceAddress: string;
  targetAddress: string;
  sourceStake?: string;
  targetStake?: string;
  connectionType: string;
  connectionStrength: number;
  transactionCount?: number;
  totalAmount?: number;
  metadata?: any;
}

export class BubbleMapService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Save a complete bubble map snapshot
  async saveBubbleMapSnapshot(data: BubbleMapSnapshot): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert snapshot
      const snapshotResult = await client.query(`
        INSERT INTO bubble_map_snapshots (
          policy_id, asset_name, ticker, total_holders, 
          risk_score, top_holder_percentage, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (policy_id, asset_name, snapshot_timestamp) 
        DO UPDATE SET 
          total_holders = EXCLUDED.total_holders,
          risk_score = EXCLUDED.risk_score,
          top_holder_percentage = EXCLUDED.top_holder_percentage,
          metadata = EXCLUDED.metadata
        RETURNING id
      `, [
        data.policyId,
        data.assetName || '',
        data.ticker,
        data.totalHolders,
        data.riskScore,
        data.topHolderPercentage,
        JSON.stringify(data.metadata || {})
      ]);

      const snapshotId = snapshotResult.rows[0].id;

      // Delete existing holders for this snapshot
      await client.query('DELETE FROM bubble_holders WHERE snapshot_id = $1', [snapshotId]);

      // Insert holders
      for (const holder of data.holders) {
        await client.query(`
          INSERT INTO bubble_holders (
            snapshot_id, holder_rank, address, stake_address, amount, percentage,
            risk_category, risk_color, is_infrastructure, bubble_size, opacity,
            cluster_id, cluster_size, position_x, position_y
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          snapshotId,
          holder.rank,
          holder.address,
          holder.stakeAddress,
          holder.amount,
          holder.percentage,
          holder.riskCategory,
          holder.riskColor,
          holder.isInfrastructure,
          holder.bubbleSize,
          holder.opacity,
          holder.clusterId,
          holder.clusterSize,
          holder.positionX,
          holder.positionY
        ]);
      }

      await client.query('COMMIT');
      return snapshotId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get the latest bubble map snapshot for a token
  async getLatestBubbleMap(policyId: string, assetName?: string): Promise<BubbleMapSnapshot | null> {
    const result = await this.pool.query(`
      SELECT 
        s.*,
        json_agg(
          json_build_object(
            'id', h.id,
            'rank', h.holder_rank,
            'address', h.address,
            'stakeAddress', h.stake_address,
            'amount', h.amount,
            'percentage', h.percentage,
            'riskCategory', h.risk_category,
            'riskColor', h.risk_color,
            'isInfrastructure', h.is_infrastructure,
            'bubbleSize', h.bubble_size,
            'opacity', h.opacity,
            'clusterId', h.cluster_id,
            'clusterSize', h.cluster_size,
            'positionX', h.position_x,
            'positionY', h.position_y
          ) ORDER BY h.holder_rank
        ) as holders
      FROM bubble_map_snapshots s
      LEFT JOIN bubble_holders h ON h.snapshot_id = s.id
      WHERE s.policy_id = $1 
        AND ($2::text IS NULL OR s.asset_name = $2)
      ORDER BY s.snapshot_timestamp DESC
      LIMIT 1
      GROUP BY s.id
    `, [policyId, assetName]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      policyId: row.policy_id,
      assetName: row.asset_name,
      ticker: row.ticker,
      totalHolders: row.total_holders,
      riskScore: row.risk_score,
      topHolderPercentage: parseFloat(row.top_holder_percentage),
      holders: row.holders || [],
      metadata: row.metadata
    };
  }

  // Save wallet connections
  async saveWalletConnections(connections: WalletConnection[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const conn of connections) {
        await client.query(`
          INSERT INTO wallet_connections (
            source_address, target_address, source_stake, target_stake,
            connection_type, connection_strength, transaction_count, 
            total_amount, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (source_address, target_address, connection_type)
          DO UPDATE SET
            connection_strength = GREATEST(wallet_connections.connection_strength, EXCLUDED.connection_strength),
            transaction_count = wallet_connections.transaction_count + COALESCE(EXCLUDED.transaction_count, 0),
            total_amount = wallet_connections.total_amount + COALESCE(EXCLUDED.total_amount, 0),
            last_seen = CURRENT_TIMESTAMP,
            metadata = EXCLUDED.metadata
        `, [
          conn.sourceAddress,
          conn.targetAddress,
          conn.sourceStake,
          conn.targetStake,
          conn.connectionType,
          conn.connectionStrength,
          conn.transactionCount || 0,
          conn.totalAmount || 0,
          JSON.stringify(conn.metadata || {})
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get wallet connections for addresses
  async getWalletConnections(addresses: string[]): Promise<WalletConnection[]> {
    if (addresses.length === 0) return [];

    const result = await this.pool.query(`
      SELECT 
        source_address, target_address, source_stake, target_stake,
        connection_type, connection_strength, transaction_count,
        total_amount, metadata
      FROM wallet_connections
      WHERE source_address = ANY($1) OR target_address = ANY($1)
      ORDER BY connection_strength DESC
    `, [addresses]);

    return result.rows.map(row => ({
      sourceAddress: row.source_address,
      targetAddress: row.target_address,
      sourceStake: row.source_stake,
      targetStake: row.target_stake,
      connectionType: row.connection_type,
      connectionStrength: parseFloat(row.connection_strength),
      transactionCount: row.transaction_count,
      totalAmount: row.total_amount,
      metadata: row.metadata
    }));
  }

  // Cache bubble map visualization data
  async cacheBubbleMap(policyId: string, assetName: string, data: any, ttlMinutes: number = 60): Promise<void> {
    const cacheKey = `${policyId}_${assetName}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.pool.query(`
      INSERT INTO bubble_map_cache (policy_id, asset_name, cache_key, visualization_data, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cache_key) DO UPDATE SET
        visualization_data = EXCLUDED.visualization_data,
        expires_at = EXCLUDED.expires_at
    `, [policyId, assetName, cacheKey, JSON.stringify(data), expiresAt]);
  }

  // Get cached bubble map data
  async getCachedBubbleMap(policyId: string, assetName: string): Promise<any | null> {
    const result = await this.pool.query(`
      SELECT visualization_data
      FROM bubble_map_cache
      WHERE policy_id = $1 AND asset_name = $2 AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [policyId, assetName]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].visualization_data;
  }

  // Clean up expired cache entries
  async cleanupCache(): Promise<void> {
    await this.pool.query('SELECT cleanup_bubble_cache()');
  }

  // Get bubble map with network connections
  async getBubbleMapWithConnections(policyId: string, assetName?: string): Promise<any> {
    const bubbleMap = await this.getLatestBubbleMap(policyId, assetName);
    if (!bubbleMap) {
      return null;
    }

    const addresses = bubbleMap.holders.map(h => h.address);
    const connections = await this.getWalletConnections(addresses);

    return {
      ...bubbleMap,
      connections,
      networkStats: {
        totalConnections: connections.length,
        strongConnections: connections.filter(c => c.connectionStrength > 0.7).length,
        clusterCount: new Set(bubbleMap.holders.map(h => h.clusterId).filter(Boolean)).size
      }
    };
  }

  // Update stake cluster information
  async updateStakeCluster(stakeAddress: string, clusterData: any): Promise<void> {
    await this.pool.query(`
      INSERT INTO stake_clusters (
        cluster_id, stake_address, cluster_size, risk_level, cluster_type,
        total_tokens_held, unique_tokens, metadata, updated_at
      ) VALUES (
        get_or_create_cluster_id($1), $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
      )
      ON CONFLICT (stake_address) DO UPDATE SET
        cluster_size = EXCLUDED.cluster_size,
        risk_level = EXCLUDED.risk_level,
        cluster_type = EXCLUDED.cluster_type,
        total_tokens_held = EXCLUDED.total_tokens_held,
        unique_tokens = EXCLUDED.unique_tokens,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
    `, [
      stakeAddress,
      clusterData.clusterSize || 1,
      clusterData.riskLevel || 'unknown',
      clusterData.clusterType || 'normal',
      clusterData.totalTokensHeld || 0,
      clusterData.uniqueTokens || 0,
      JSON.stringify(clusterData.metadata || {})
    ]);
  }
}
