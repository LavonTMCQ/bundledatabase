import sqlite3 from 'sqlite3';
import { UserSettings, WatchlistItem, GifConfig } from '../types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    const createTables = `
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        gif_safe TEXT DEFAULT 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
        gif_moderate TEXT DEFAULT 'https://media.giphy.com/media/3o7abAHdYvw33jLjWM/giphy.gif',
        gif_risky TEXT DEFAULT 'https://media.giphy.com/media/3o7absbD7PbTFQa0c8/giphy.gif',
        alerts_enabled BOOLEAN DEFAULT 1,
        alert_threshold INTEGER DEFAULT 7,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        asset_name TEXT DEFAULT '',
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, policy_id, asset_name)
      );

      CREATE TABLE IF NOT EXISTS server_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT UNIQUE NOT NULL,
        risk_channel_id TEXT,
        auto_scan_enabled BOOLEAN DEFAULT 0,
        alert_threshold INTEGER DEFAULT 7,
        alert_role_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    this.db.exec(createTables, (err) => {
      if (err) {
        console.error('Error creating tables:', err);
      } else {
        console.log('✅ Database tables initialized');
      }
    });
  }

  async getUserSettings(userId: string, guildId: string): Promise<UserSettings | null> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT user_id, guild_id, gif_safe, gif_moderate, gif_risky, 
               alerts_enabled, alert_threshold
        FROM user_settings 
        WHERE user_id = ? AND guild_id = ?
      `;
      
      this.db.get(query, [userId, guildId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          userId: row.user_id,
          guildId: row.guild_id,
          gifConfig: {
            safe: row.gif_safe,
            moderate: row.gif_moderate,
            risky: row.gif_risky
          },
          alertsEnabled: Boolean(row.alerts_enabled),
          alertThreshold: row.alert_threshold
        });
      });
    });
  }

  async updateGifConfig(userId: string, guildId: string, gifConfig: Partial<GifConfig>): Promise<void> {
    return new Promise((resolve, reject) => {
      const updates: string[] = [];
      const values: any[] = [];

      if (gifConfig.safe) {
        updates.push('gif_safe = ?');
        values.push(gifConfig.safe);
      }
      if (gifConfig.moderate) {
        updates.push('gif_moderate = ?');
        values.push(gifConfig.moderate);
      }
      if (gifConfig.risky) {
        updates.push('gif_risky = ?');
        values.push(gifConfig.risky);
      }

      values.push(userId, guildId);

      const query = `
        INSERT INTO user_settings (user_id, guild_id, ${updates.map(u => u.split(' = ')[0]).join(', ')})
        VALUES (?, ?, ${updates.map(() => '?').join(', ')})
        ON CONFLICT(user_id, guild_id) DO UPDATE SET ${updates.join(', ')}
      `;

      this.db.run(query, values, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async addToWatchlist(userId: string, policyId: string, assetName: string = ''): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO watchlist (user_id, policy_id, asset_name)
        VALUES (?, ?, ?)
      `;
      
      this.db.run(query, [userId, policyId, assetName], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async removeFromWatchlist(userId: string, policyId: string, assetName: string = ''): Promise<void> {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM watchlist 
        WHERE user_id = ? AND policy_id = ? AND asset_name = ?
      `;
      
      this.db.run(query, [userId, policyId, assetName], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT user_id, policy_id, asset_name, added_at
        FROM watchlist 
        WHERE user_id = ?
        ORDER BY added_at DESC
      `;
      
      this.db.all(query, [userId], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const watchlist: WatchlistItem[] = rows.map(row => ({
          userId: row.user_id,
          policyId: row.policy_id,
          assetName: row.asset_name,
          addedAt: new Date(row.added_at)
        }));

        resolve(watchlist);
      });
    });
  }

  close(): void {
    this.db.close();
  }
}
