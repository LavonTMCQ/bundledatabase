-- MISTER Risk System Database Schema
-- Create tables for Railway PostgreSQL

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
);

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
);

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
);

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
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tokens_unit ON tokens(unit);
CREATE INDEX IF NOT EXISTS idx_tokens_ticker ON tokens(ticker);
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume_24h);
CREATE INDEX IF NOT EXISTS idx_ticker_mapping_ticker ON ticker_mapping(ticker);
CREATE INDEX IF NOT EXISTS idx_token_holders_unit ON token_holders(unit);
CREATE INDEX IF NOT EXISTS idx_analysis_history_unit ON analysis_history(unit);

-- Insert a test record to verify the setup
INSERT INTO tokens (policy_id, unit, ticker, name, price, volume_24h, created_at) 
VALUES ('test_policy', 'test_unit', 'TEST', 'Test Token', 1.0, 1000.0, CURRENT_TIMESTAMP)
ON CONFLICT (unit) DO NOTHING;
