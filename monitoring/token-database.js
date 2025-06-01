const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class TokenDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, 'tokens.db');
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening token database:', err.message);
          reject(err);
        } else {
          console.log('🗄️ Token database connected');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const createTokensTable = `
      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        policy_id TEXT NOT NULL,
        asset_name_hex TEXT,
        unit TEXT UNIQUE NOT NULL,
        ticker TEXT,
        name TEXT,
        price REAL,
        volume_24h REAL,
        market_cap REAL,
        circulating_supply REAL,
        total_supply REAL,
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
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT 0,
        risk_score REAL,
        top_holder_percentage REAL,
        holder_count INTEGER,
        liquidity_pools INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createHoldersTable = `
      CREATE TABLE IF NOT EXISTS token_holders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit TEXT NOT NULL,
        stake_address TEXT NOT NULL,
        amount REAL NOT NULL,
        percentage REAL NOT NULL,
        rank INTEGER NOT NULL,
        ada_handle TEXT,
        is_pool BOOLEAN DEFAULT 0,
        is_exchange BOOLEAN DEFAULT 0,
        is_burn_wallet BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit) REFERENCES tokens (unit),
        UNIQUE(unit, stake_address)
      )
    `;

    const createTickerMappingTable = `
      CREATE TABLE IF NOT EXISTS ticker_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT UNIQUE NOT NULL,
        unit TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        asset_name_hex TEXT,
        confidence_score REAL DEFAULT 1.0,
        source TEXT DEFAULT 'taptools',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit) REFERENCES tokens (unit)
      )
    `;

    const createAnalysisHistoryTable = `
      CREATE TABLE IF NOT EXISTS analysis_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit TEXT NOT NULL,
        risk_score REAL,
        verdict TEXT,
        top_holder_percentage REAL,
        holder_count INTEGER,
        analysis_data TEXT, -- JSON blob
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unit) REFERENCES tokens (unit)
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createTokensTable);
        this.db.run(createHoldersTable);
        this.db.run(createTickerMappingTable);
        this.db.run(createAnalysisHistoryTable, (err) => {
          if (err) {
            console.error('❌ Error creating tables:', err.message);
            reject(err);
          } else {
            console.log('✅ Token database tables ready');
            resolve();
          }
        });
      });
    });
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
      INSERT OR REPLACE INTO tokens (
        policy_id, asset_name_hex, unit, ticker, name, price, volume_24h,
        market_cap, circulating_supply, total_supply, decimals, description,
        website, twitter, discord, telegram, github, reddit, medium,
        youtube, instagram, facebook, email, logo_url, is_verified,
        risk_score, top_holder_percentage, holder_count, liquidity_pools,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(query, [
        policyId, assetNameHex, unit, ticker, name, price, volume24h,
        marketCap, circulatingSupply, totalSupply, decimals, description,
        socialLinks.website, socialLinks.twitter, socialLinks.discord,
        socialLinks.telegram, socialLinks.github, socialLinks.reddit,
        socialLinks.medium, socialLinks.youtube, socialLinks.instagram,
        socialLinks.facebook, socialLinks.email, logoUrl, isVerified ? 1 : 0,
        riskScore, topHolderPercentage, holderCount, liquidityPools
      ], function(err) {
        if (err) {
          console.error('❌ Error saving token:', err.message);
          reject(err);
        } else {
          console.log(`✅ Saved token: ${ticker || name || 'Unknown'}`);
          resolve(this.lastID);
        }
      });
    });
  }

  // Save ticker mapping for quick lookups
  async saveTickerMapping(ticker, unit, policyId, assetNameHex = '', confidenceScore = 1.0, source = 'taptools') {
    const query = `
      INSERT OR REPLACE INTO ticker_mapping (
        ticker, unit, policy_id, asset_name_hex, confidence_score, source
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(query, [ticker, unit, policyId, assetNameHex, confidenceScore, source], function(err) {
        if (err) {
          console.error('❌ Error saving ticker mapping:', err.message);
          reject(err);
        } else {
          console.log(`✅ Mapped ticker: ${ticker} → ${unit.substring(0, 20)}...`);
          resolve(this.lastID);
        }
      });
    });
  }

  // Find token by ticker
  async findTokenByTicker(ticker) {
    const query = `
      SELECT t.*, tm.confidence_score
      FROM tokens t
      JOIN ticker_mapping tm ON t.unit = tm.unit
      WHERE tm.ticker = ? COLLATE NOCASE
      ORDER BY tm.confidence_score DESC, t.updated_at DESC
      LIMIT 1
    `;

    return new Promise((resolve, reject) => {
      this.db.get(query, [ticker], (err, row) => {
        if (err) {
          console.error('❌ Error finding token by ticker:', err.message);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  // Find token by policy ID
  async findTokenByPolicyId(policyId, assetNameHex = '') {
    const unit = policyId + assetNameHex;
    const query = `SELECT * FROM tokens WHERE unit = ? OR policy_id = ? ORDER BY updated_at DESC LIMIT 1`;

    return new Promise((resolve, reject) => {
      this.db.get(query, [unit, policyId], (err, row) => {
        if (err) {
          console.error('❌ Error finding token by policy ID:', err.message);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  // Find token by unit
  async findTokenByUnit(unit) {
    const query = `SELECT * FROM tokens WHERE unit = ?`;

    return new Promise((resolve, reject) => {
      this.db.get(query, [unit], (err, row) => {
        if (err) {
          console.error('❌ Error finding token by unit:', err.message);
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  // Search tokens by name or ticker
  async searchTokens(searchTerm, limit = 10) {
    const query = `
      SELECT t.*, tm.ticker as mapped_ticker
      FROM tokens t
      LEFT JOIN ticker_mapping tm ON t.unit = tm.unit
      WHERE t.ticker LIKE ? OR t.name LIKE ? OR tm.ticker LIKE ?
      ORDER BY
        CASE
          WHEN t.ticker = ? THEN 1
          WHEN tm.ticker = ? THEN 2
          WHEN t.name = ? THEN 3
          ELSE 4
        END,
        t.volume_24h DESC
      LIMIT ?
    `;

    const searchPattern = `%${searchTerm}%`;

    return new Promise((resolve, reject) => {
      this.db.all(query, [
        searchPattern, searchPattern, searchPattern,
        searchTerm, searchTerm, searchTerm, limit
      ], (err, rows) => {
        if (err) {
          console.error('❌ Error searching tokens:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Get all tokens with pagination
  async getAllTokens(page = 1, limit = 50, orderBy = 'volume_24h DESC') {
    const offset = (page - 1) * limit;
    const query = `
      SELECT t.*, tm.ticker as mapped_ticker
      FROM tokens t
      LEFT JOIN ticker_mapping tm ON t.unit = tm.unit
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(query, [limit, offset], (err, rows) => {
        if (err) {
          console.error('❌ Error getting tokens:', err.message);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Save analysis history
  async saveAnalysisHistory(unit, riskScore, verdict, topHolderPercentage, holderCount, analysisData) {
    const query = `
      INSERT INTO analysis_history (
        unit, risk_score, verdict, top_holder_percentage, holder_count, analysis_data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(query, [
        unit, riskScore, verdict, topHolderPercentage, holderCount, JSON.stringify(analysisData)
      ], function(err) {
        if (err) {
          console.error('❌ Error saving analysis history:', err.message);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Get database statistics
  async getStats() {
    const queries = {
      totalTokens: 'SELECT COUNT(*) as count FROM tokens',
      totalMappings: 'SELECT COUNT(*) as count FROM ticker_mapping',
      totalAnalyses: 'SELECT COUNT(*) as count FROM analysis_history',
      recentTokens: 'SELECT COUNT(*) as count FROM tokens WHERE created_at > datetime("now", "-24 hours")',
      topVolumeTokens: 'SELECT ticker, name, volume_24h FROM tokens WHERE volume_24h > 0 ORDER BY volume_24h DESC LIMIT 5'
    };

    const stats = {};

    for (const [key, query] of Object.entries(queries)) {
      try {
        if (key === 'topVolumeTokens') {
          stats[key] = await new Promise((resolve, reject) => {
            this.db.all(query, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
        } else {
          stats[key] = await new Promise((resolve, reject) => {
            this.db.get(query, (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });
        }
      } catch (error) {
        stats[key] = 0;
      }
    }

    return stats;
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('🗄️ Token database connection closed');
        }
      });
    }
  }
}

module.exports = TokenDatabase;
