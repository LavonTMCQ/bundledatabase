import { Pool } from 'pg';

interface StoredToken {
  id?: number;
  ticker: string;
  policyId: string;
  assetName?: string;
  unit?: string;
  name?: string;
  description?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  holders?: number;
  riskScore?: number;
  lastAnalyzed?: Date;
  socialLinks?: any;
  metadata?: any;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TokenStorageService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Store a token for easy access
  async storeToken(tokenData: StoredToken): Promise<number> {
    const result = await this.pool.query(`
      INSERT INTO stored_tokens (
        ticker, policy_id, asset_name, unit, name, description,
        price, market_cap, volume_24h, holders, risk_score,
        social_links, metadata, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (ticker) DO UPDATE SET
        policy_id = EXCLUDED.policy_id,
        asset_name = EXCLUDED.asset_name,
        unit = EXCLUDED.unit,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        market_cap = EXCLUDED.market_cap,
        volume_24h = EXCLUDED.volume_24h,
        holders = EXCLUDED.holders,
        risk_score = EXCLUDED.risk_score,
        social_links = EXCLUDED.social_links,
        metadata = EXCLUDED.metadata,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      tokenData.ticker,
      tokenData.policyId,
      tokenData.assetName || '',
      tokenData.unit || '',
      tokenData.name || tokenData.ticker,
      tokenData.description || '',
      tokenData.price || 0,
      tokenData.marketCap || 0,
      tokenData.volume24h || 0,
      tokenData.holders || 0,
      tokenData.riskScore || null,
      JSON.stringify(tokenData.socialLinks || {}),
      JSON.stringify(tokenData.metadata || {}),
      tokenData.isActive
    ]);

    return result.rows[0].id;
  }

  // Get all stored tokens
  async getAllTokens(): Promise<StoredToken[]> {
    const result = await this.pool.query(`
      SELECT 
        id, ticker, policy_id, asset_name, unit, name, description,
        price, market_cap, volume_24h, holders, risk_score, last_analyzed,
        social_links, metadata, is_active, created_at, updated_at
      FROM stored_tokens
      WHERE is_active = true
      ORDER BY 
        CASE 
          WHEN last_analyzed IS NOT NULL THEN 0 
          ELSE 1 
        END,
        updated_at DESC
    `);

    return result.rows.map(row => ({
      id: row.id,
      ticker: row.ticker,
      policyId: row.policy_id,
      assetName: row.asset_name,
      unit: row.unit,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price) || 0,
      marketCap: parseFloat(row.market_cap) || 0,
      volume24h: parseFloat(row.volume_24h) || 0,
      holders: row.holders,
      riskScore: row.risk_score,
      lastAnalyzed: row.last_analyzed,
      socialLinks: row.social_links,
      metadata: row.metadata,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  // Get token by ticker
  async getTokenByTicker(ticker: string): Promise<StoredToken | null> {
    const result = await this.pool.query(`
      SELECT 
        id, ticker, policy_id, asset_name, unit, name, description,
        price, market_cap, volume_24h, holders, risk_score, last_analyzed,
        social_links, metadata, is_active, created_at, updated_at
      FROM stored_tokens
      WHERE ticker = $1 AND is_active = true
    `, [ticker.toUpperCase()]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      ticker: row.ticker,
      policyId: row.policy_id,
      assetName: row.asset_name,
      unit: row.unit,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price) || 0,
      marketCap: parseFloat(row.market_cap) || 0,
      volume24h: parseFloat(row.volume_24h) || 0,
      holders: row.holders,
      riskScore: row.risk_score,
      lastAnalyzed: row.last_analyzed,
      socialLinks: row.social_links,
      metadata: row.metadata,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Update token analysis data
  async updateTokenAnalysis(ticker: string, analysisData: any): Promise<void> {
    await this.pool.query(`
      UPDATE stored_tokens 
      SET 
        holders = $2,
        risk_score = $3,
        last_analyzed = CURRENT_TIMESTAMP,
        metadata = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE ticker = $1
    `, [
      ticker.toUpperCase(),
      analysisData.totalHolders || 0,
      analysisData.metadata?.riskScore || null,
      JSON.stringify(analysisData.metadata || {})
    ]);
  }

  // Mark token as analyzed
  async markAsAnalyzed(ticker: string): Promise<void> {
    await this.pool.query(`
      UPDATE stored_tokens 
      SET last_analyzed = CURRENT_TIMESTAMP
      WHERE ticker = $1
    `, [ticker.toUpperCase()]);
  }

  // Get tokens that need analysis (never analyzed or old analysis)
  async getTokensNeedingAnalysis(maxAge: number = 24): Promise<StoredToken[]> {
    const result = await this.pool.query(`
      SELECT 
        id, ticker, policy_id, asset_name, unit, name, description,
        price, market_cap, volume_24h, holders, risk_score, last_analyzed,
        social_links, metadata, is_active, created_at, updated_at
      FROM stored_tokens
      WHERE is_active = true 
        AND (
          last_analyzed IS NULL 
          OR last_analyzed < NOW() - INTERVAL '${maxAge} hours'
        )
      ORDER BY 
        CASE 
          WHEN last_analyzed IS NULL THEN 0 
          ELSE 1 
        END,
        last_analyzed ASC
      LIMIT 50
    `);

    return result.rows.map(row => ({
      id: row.id,
      ticker: row.ticker,
      policyId: row.policy_id,
      assetName: row.asset_name,
      unit: row.unit,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price) || 0,
      marketCap: parseFloat(row.market_cap) || 0,
      volume24h: parseFloat(row.volume_24h) || 0,
      holders: row.holders,
      riskScore: row.risk_score,
      lastAnalyzed: row.last_analyzed,
      socialLinks: row.social_links,
      metadata: row.metadata,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  // Bulk store tokens from external API
  async bulkStoreTokens(tokens: any[]): Promise<number> {
    let stored = 0;
    
    for (const token of tokens) {
      try {
        await this.storeToken({
          ticker: token.ticker || token.symbol,
          policyId: token.policyId || token.policy_id,
          assetName: token.assetName || token.asset_name || '',
          unit: token.unit,
          name: token.name || token.ticker,
          description: token.description || '',
          price: token.price || 0,
          marketCap: token.marketCap || token.market_cap || 0,
          volume24h: token.volume24h || token.volume_24h || 0,
          socialLinks: token.socialLinks || token.social_links || {},
          metadata: token.metadata || {},
          isActive: true
        });
        stored++;
      } catch (error) {
        console.warn(`Failed to store token ${token.ticker}:`, error);
      }
    }
    
    return stored;
  }

  // Get token statistics
  async getTokenStats(): Promise<any> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN last_analyzed IS NOT NULL THEN 1 END) as analyzed_tokens,
        COUNT(CASE WHEN last_analyzed IS NULL THEN 1 END) as unanalyzed_tokens,
        COUNT(CASE WHEN risk_score IS NOT NULL THEN 1 END) as tokens_with_risk_score,
        AVG(risk_score) as avg_risk_score,
        COUNT(CASE WHEN risk_score >= 7 THEN 1 END) as high_risk_tokens,
        COUNT(CASE WHEN risk_score <= 3 THEN 1 END) as low_risk_tokens
      FROM stored_tokens
      WHERE is_active = true
    `);

    return result.rows[0];
  }
}
