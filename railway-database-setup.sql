-- 🗄️ MISTER Risk System - Railway Database Setup
-- Run this in your Railway PostgreSQL console to ensure proper schema

-- Check current database info
SELECT current_database(), current_user, version();

-- Create tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  unit VARCHAR(120) UNIQUE NOT NULL,
  ticker VARCHAR(50),
  name VARCHAR(100),
  policy_id VARCHAR(56) NOT NULL,
  asset_name_hex VARCHAR(64),
  price DECIMAL(20, 10),
  volume DECIMAL(20, 6),
  mcap DECIMAL(20, 6),
  risk_score INTEGER,
  top_holder_percentage DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_tokens_unit ON tokens(unit);
CREATE INDEX IF NOT EXISTS idx_tokens_ticker ON tokens(ticker);
CREATE INDEX IF NOT EXISTS idx_tokens_policy_id ON tokens(policy_id);
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume);
CREATE INDEX IF NOT EXISTS idx_tokens_risk_score ON tokens(risk_score);
CREATE INDEX IF NOT EXISTS idx_tokens_updated_at ON tokens(updated_at);

-- Create bubble map tables for visualization
CREATE TABLE IF NOT EXISTS bubble_map_snapshots (
  id SERIAL PRIMARY KEY,
  policy_id VARCHAR(56) NOT NULL,
  asset_name VARCHAR(64),
  total_holders INTEGER,
  risk_score INTEGER,
  top_holder_percentage DECIMAL(5, 2),
  holders JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bubble_map_policy ON bubble_map_snapshots(policy_id);
CREATE INDEX IF NOT EXISTS idx_bubble_map_created ON bubble_map_snapshots(created_at);

-- Create wallet connections table
CREATE TABLE IF NOT EXISTS wallet_connections (
  id SERIAL PRIMARY KEY,
  source_address VARCHAR(120) NOT NULL,
  target_address VARCHAR(120) NOT NULL,
  source_stake VARCHAR(120),
  target_stake VARCHAR(120),
  connection_type VARCHAR(50),
  connection_strength DECIMAL(3, 2),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_conn_source ON wallet_connections(source_address);
CREATE INDEX IF NOT EXISTS idx_wallet_conn_target ON wallet_connections(target_address);
CREATE INDEX IF NOT EXISTS idx_wallet_conn_type ON wallet_connections(connection_type);

-- Verify tables were created
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;

-- Check if any data exists
SELECT 
  'tokens' as table_name, 
  COUNT(*) as row_count 
FROM tokens
UNION ALL
SELECT 
  'bubble_map_snapshots' as table_name, 
  COUNT(*) as row_count 
FROM bubble_map_snapshots
UNION ALL
SELECT 
  'wallet_connections' as table_name, 
  COUNT(*) as row_count 
FROM wallet_connections;

-- Test connection with timestamp
SELECT 
  'Database setup complete!' as message,
  NOW() as timestamp,
  current_database() as database,
  current_user as user;
