const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

class TokenDatabase {
  constructor() {
    // Use environment variable for database connection, fallback to Railway connection
    const databaseUrl = process.env.DATABASE_URL ||
                       process.env.POSTGRES_URL ||
                       process.env.DATABASE_PRIVATE_URL ||
                       'postgresql://postgres:jnZORZUDtetoUczuKrlvKVNYzrIfLFpc@trolley.proxy.rlwy.net:30487/railway';

    // Railway-specific optimizations
    const isRailway = process.env.RAILWAY_ENVIRONMENT ||
                     process.env.NODE_ENV === 'production' ||
                     databaseUrl.includes('railway.internal');

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: isRailway ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      acquireTimeoutMillis: 15000,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'mister_token_api',
      ...(isRailway && {
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      })
    });

    console.log('🔗 Token Database connection config:', {
      hasUrl: !!databaseUrl,
      isRailway,
      urlHost: databaseUrl.includes('railway.internal') ? 'railway.internal' : 'other',
      environment: process.env.NODE_ENV
    });
  }

  async init() {
    try {
      // Test connection
      const client = await this.pool.connect();
      console.log('🗄️ Token database connected (PostgreSQL)');
      client.release();

      await this.createTables();
      return Promise.resolve();
    } catch (err) {
      console.error('❌ Error connecting to token database:', err.message);
      return Promise.reject(err);
    }
  }

  async createTables() {
    const createTokensTable = `
      CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        policy_id TEXT NOT NULL,
        asset_name_hex TEXT,
        unit TEXT UNIQUE NOT NULL,
        ticker TEXT,
        name TEXT,
        price DECIMAL,
        volume_24h DECIMAL,
        market_cap DECIMAL,
        circulating_supply DECIMAL,
        total_supply DECIMAL,
        decimals INTEGER DEFAULT 0,
        description TEXT,
        website TEXT,
        twitter TEXT,
        discord TEXT,
        telegram TEXT,
        github TEXT,
        reddit TEXT,
        medium TEXT,
        youtube TEXT,
        instagram TEXT,
        facebook TEXT,
        email TEXT,
        logo_url TEXT,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT FALSE,
        risk_score DECIMAL,
        top_holder_percentage DECIMAL,
        holder_count INTEGER,
        liquidity_pools INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createHoldersTable = `
      CREATE TABLE IF NOT EXISTS token_holders (
        id SERIAL PRIMARY KEY,
        unit TEXT NOT NULL,
        stake_address TEXT NOT NULL,
        amount DECIMAL NOT NULL,
        percentage DECIMAL NOT NULL,
        rank INTEGER NOT NULL,
        ada_handle TEXT,
        is_pool BOOLEAN DEFAULT FALSE,
        is_exchange BOOLEAN DEFAULT FALSE,
        is_burn_wallet BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit) REFERENCES tokens (unit),
        UNIQUE(unit, stake_address)
      )
    `;

    const createTickerMappingTable = `
      CREATE TABLE IF NOT EXISTS ticker_mapping (
        id SERIAL PRIMARY KEY,
        ticker TEXT UNIQUE NOT NULL,
        unit TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        asset_name_hex TEXT,
        confidence_score DECIMAL DEFAULT 1.0,
        source TEXT DEFAULT 'taptools',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit) REFERENCES tokens (unit)
      )
    `;

    const createAnalysisHistoryTable = `
      CREATE TABLE IF NOT EXISTS analysis_history (
        id SERIAL PRIMARY KEY,
        unit TEXT NOT NULL,
        risk_score DECIMAL,
        verdict TEXT,
        top_holder_percentage DECIMAL,
        holder_count INTEGER,
        analysis_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit) REFERENCES tokens (unit)
      )
    `;

    try {
      await this.pool.query(createTokensTable);
      await this.pool.query(createHoldersTable);
      await this.pool.query(createTickerMappingTable);
      await this.pool.query(createAnalysisHistoryTable);
      console.log('✅ Token database tables ready (PostgreSQL)');
    } catch (err) {
      console.error('❌ Error creating tables:', err.message);
      throw err;
    }
  }

  // Save or update token information
  async saveToken(tokenData) {
    const {
      policyId,
      assetNameHex = '',
      unit,
      ticker,
      name,
      price,
      volume24h,
      marketCap,
      circulatingSupply,
      totalSupply,
      decimals = 0,
      description,
      socialLinks = {},
      logoUrl,
      isVerified = false,
      riskScore,
      topHolderPercentage,
      holderCount,
      liquidityPools = 0
    } = tokenData;

    const query = `
      INSERT INTO tokens (
        policy_id, asset_name_hex, unit, ticker, name, price, volume_24h,
        market_cap, circulating_supply, total_supply, decimals, description,
        website, twitter, discord, telegram, github, reddit, medium,
        youtube, instagram, facebook, email, logo_url, is_verified,
        risk_score, top_holder_percentage, holder_count, liquidity_pools,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, CURRENT_TIMESTAMP)
      ON CONFLICT (unit) DO UPDATE SET
        policy_id = EXCLUDED.policy_id,
        asset_name_hex = EXCLUDED.asset_name_hex,
        ticker = EXCLUDED.ticker,
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        volume_24h = EXCLUDED.volume_24h,
        market_cap = EXCLUDED.market_cap,
        circulating_supply = EXCLUDED.circulating_supply,
        total_supply = EXCLUDED.total_supply,
        decimals = EXCLUDED.decimals,
        description = EXCLUDED.description,
        website = EXCLUDED.website,
        twitter = EXCLUDED.twitter,
        discord = EXCLUDED.discord,
        telegram = EXCLUDED.telegram,
        github = EXCLUDED.github,
        reddit = EXCLUDED.reddit,
        medium = EXCLUDED.medium,
        youtube = EXCLUDED.youtube,
        instagram = EXCLUDED.instagram,
        facebook = EXCLUDED.facebook,
        email = EXCLUDED.email,
        logo_url = EXCLUDED.logo_url,
        is_verified = EXCLUDED.is_verified,
        risk_score = EXCLUDED.risk_score,
        top_holder_percentage = EXCLUDED.top_holder_percentage,
        holder_count = EXCLUDED.holder_count,
        liquidity_pools = EXCLUDED.liquidity_pools,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, [
        policyId, assetNameHex, unit, ticker, name, price, volume24h,
        marketCap, circulatingSupply, totalSupply, decimals, description,
        socialLinks.website, socialLinks.twitter, socialLinks.discord,
        socialLinks.telegram, socialLinks.github, socialLinks.reddit,
        socialLinks.medium, socialLinks.youtube, socialLinks.instagram,
        socialLinks.facebook, socialLinks.email, logoUrl, isVerified,
        riskScore, topHolderPercentage, holderCount, liquidityPools
      ]);

      console.log(`✅ Saved token: ${ticker || name || 'Unknown'}`);
      return result.rows[0]?.id;
    } catch (err) {
      console.error('❌ Error saving token:', err.message);
      throw err;
    }
  }

  // Save ticker mapping for quick lookups
  async saveTickerMapping(ticker, unit, policyId, assetNameHex = '', confidenceScore = 1.0, source = 'taptools') {
    const query = `
      INSERT INTO ticker_mapping (
        ticker, unit, policy_id, asset_name_hex, confidence_score, source
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (ticker) DO UPDATE SET
        unit = EXCLUDED.unit,
        policy_id = EXCLUDED.policy_id,
        asset_name_hex = EXCLUDED.asset_name_hex,
        confidence_score = EXCLUDED.confidence_score,
        source = EXCLUDED.source
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, [ticker, unit, policyId, assetNameHex, confidenceScore, source]);
      console.log(`✅ Mapped ticker: ${ticker} → ${unit.substring(0, 20)}...`);
      return result.rows[0]?.id;
    } catch (err) {
      console.error('❌ Error saving ticker mapping:', err.message);
      throw err;
    }
  }

  // Find token by ticker
  async findTokenByTicker(ticker) {
    const query = `
      SELECT t.*, tm.confidence_score
      FROM tokens t
      JOIN ticker_mapping tm ON t.unit = tm.unit
      WHERE LOWER(tm.ticker) = LOWER($1)
      ORDER BY tm.confidence_score DESC, t.updated_at DESC
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [ticker]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ Error finding token by ticker:', err.message);
      throw err;
    }
  }

  // Find token by policy ID
  async findTokenByPolicyId(policyId, assetNameHex = '') {
    const unit = policyId + assetNameHex;
    const query = `SELECT * FROM tokens WHERE unit = $1 OR policy_id = $2 ORDER BY updated_at DESC LIMIT 1`;

    try {
      const result = await this.pool.query(query, [unit, policyId]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ Error finding token by policy ID:', err.message);
      throw err;
    }
  }

  // Find token by unit
  async findTokenByUnit(unit) {
    const query = `SELECT * FROM tokens WHERE unit = $1`;

    try {
      const result = await this.pool.query(query, [unit]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('❌ Error finding token by unit:', err.message);
      throw err;
    }
  }

  // Search tokens by name or ticker
  async searchTokens(searchTerm, limit = 10) {
    const query = `
      SELECT t.*, tm.ticker as mapped_ticker
      FROM tokens t
      LEFT JOIN ticker_mapping tm ON t.unit = tm.unit
      WHERE t.ticker ILIKE $1 OR t.name ILIKE $2 OR tm.ticker ILIKE $3
      ORDER BY
        CASE
          WHEN t.ticker = $4 THEN 1
          WHEN tm.ticker = $5 THEN 2
          WHEN t.name = $6 THEN 3
          ELSE 4
        END,
        t.volume_24h DESC NULLS LAST
      LIMIT $7
    `;

    const searchPattern = `%${searchTerm}%`;

    try {
      const result = await this.pool.query(query, [
        searchPattern, searchPattern, searchPattern,
        searchTerm, searchTerm, searchTerm, limit
      ]);
      return result.rows || [];
    } catch (err) {
      console.error('❌ Error searching tokens:', err.message);
      throw err;
    }
  }

  // Get all tokens with pagination
  async getAllTokens(page = 1, limit = 50, orderBy = 'volume_24h DESC') {
    const offset = (page - 1) * limit;
    // Sanitize orderBy to prevent SQL injection
    const allowedOrderBy = ['volume_24h DESC', 'volume_24h ASC', 'created_at DESC', 'created_at ASC', 'name ASC', 'name DESC'];
    const safeOrderBy = allowedOrderBy.includes(orderBy) ? orderBy : 'volume_24h DESC';

    const query = `
      SELECT t.*, tm.ticker as mapped_ticker
      FROM tokens t
      LEFT JOIN ticker_mapping tm ON t.unit = tm.unit
      ORDER BY ${safeOrderBy} NULLS LAST
      LIMIT $1 OFFSET $2
    `;

    try {
      const result = await this.pool.query(query, [limit, offset]);
      return result.rows || [];
    } catch (err) {
      console.error('❌ Error getting tokens:', err.message);
      throw err;
    }
  }

  // Save analysis history
  async saveAnalysisHistory(unit, riskScore, verdict, topHolderPercentage, holderCount, analysisData) {
    const query = `
      INSERT INTO analysis_history (
        unit, risk_score, verdict, top_holder_percentage, holder_count, analysis_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, [
        unit, riskScore, verdict, topHolderPercentage, holderCount, analysisData
      ]);
      return result.rows[0]?.id;
    } catch (err) {
      console.error('❌ Error saving analysis history:', err.message);
      throw err;
    }
  }

  // Get database statistics
  async getStats() {
    const queries = {
      totalTokens: 'SELECT COUNT(*) as count FROM tokens',
      totalMappings: 'SELECT COUNT(*) as count FROM ticker_mapping',
      totalAnalyses: 'SELECT COUNT(*) as count FROM analysis_history',
      recentTokens: 'SELECT COUNT(*) as count FROM tokens WHERE created_at > NOW() - INTERVAL \'24 hours\'',
      topVolumeTokens: 'SELECT ticker, name, volume_24h FROM tokens WHERE volume_24h > 0 ORDER BY volume_24h DESC LIMIT 5'
    };

    const stats = {};

    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await this.pool.query(query);
        if (key === 'topVolumeTokens') {
          stats[key] = result.rows;
        } else {
          stats[key] = parseInt(result.rows[0]?.count || 0);
        }
      } catch (error) {
        console.error(`❌ Error getting ${key} stats:`, error.message);
        stats[key] = key === 'topVolumeTokens' ? [] : 0;
      }
    }

    return stats;
  }

  // Close database connection
  async close() {
    if (this.pool) {
      try {
        await this.pool.end();
        console.log('🗄️ Token database connection closed');
      } catch (err) {
        console.error('❌ Error closing database:', err.message);
      }
    }
  }
}

module.exports = TokenDatabase;
