import { Pool } from 'pg';

interface TokenInfo {
  policy_id: string;
  asset_name: string | null;
  ticker: string | null;
  name: string | null;
  decimals: number | null;
  volume_24h: number | null;
  price_usd: number | null;
  market_cap: number | null;
  total_supply: number | null;
  circulating_supply: number | null;
  last_updated: Date | null;
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: 'postgresql://postgres:jnZORZUDtetoUczuKrlvKVNYzrIfLFpc@trolley.proxy.rlwy.net:30487/railway',
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  // Get token info by policy ID
  async getTokenByPolicyId(policyId: string): Promise<TokenInfo | null> {
    try {
      const query = 'SELECT * FROM tokens WHERE policy_id = $1';
      const result = await this.pool.query(query, [policyId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as TokenInfo;
    } catch (error) {
      console.error('Error fetching token from database:', error);
      return null;
    }
  }

  // Get token info by ticker
  async getTokenByTicker(ticker: string): Promise<TokenInfo | null> {
    try {
      const query = 'SELECT * FROM tokens WHERE UPPER(ticker) = UPPER($1)';
      const result = await this.pool.query(query, [ticker]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as TokenInfo;
    } catch (error) {
      console.error('Error fetching token by ticker from database:', error);
      return null;
    }
  }

  // Search tokens by name or ticker
  async searchTokens(searchTerm: string, limit: number = 10): Promise<TokenInfo[]> {
    try {
      const query = `
        SELECT * FROM tokens
        WHERE UPPER(name) LIKE UPPER($1)
           OR UPPER(ticker) LIKE UPPER($1)
        ORDER BY volume_24h DESC NULLS LAST
        LIMIT $2
      `;
      const result = await this.pool.query(query, [`%${searchTerm}%`, limit]);

      return result.rows as TokenInfo[];
    } catch (error) {
      console.error('Error searching tokens in database:', error);
      return [];
    }
  }

  // Get top tokens by volume
  async getTopTokens(limit: number = 50): Promise<TokenInfo[]> {
    try {
      const query = `
        SELECT * FROM tokens
        WHERE volume_24h IS NOT NULL
        ORDER BY volume_24h DESC
        LIMIT $1
      `;
      const result = await this.pool.query(query, [limit]);

      return result.rows as TokenInfo[];
    } catch (error) {
      console.error('Error fetching top tokens from database:', error);
      return [];
    }
  }

  // Convert ticker to hex asset name
  tickerToHex(ticker: string): string {
    return Buffer.from(ticker, 'utf8').toString('hex');
  }

  // Convert hex asset name to ticker
  hexToTicker(hex: string): string {
    try {
      return Buffer.from(hex, 'hex').toString('utf8').replace(/[^\w\s$]/g, '');
    } catch (error) {
      return hex;
    }
  }

  // Close database connection
  async close(): Promise<void> {
    await this.pool.end();
  }
}
