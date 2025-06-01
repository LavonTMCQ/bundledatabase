-- 🗄️ MISTER Risk System - Railway Database Schema
-- Run this in your Railway PostgreSQL console

-- Token storage table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_unit ON tokens(unit);
CREATE INDEX IF NOT EXISTS idx_tokens_ticker ON tokens(ticker);
CREATE INDEX IF NOT EXISTS idx_tokens_policy_id ON tokens(policy_id);
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume);
CREATE INDEX IF NOT EXISTS idx_tokens_risk_score ON tokens(risk_score);
CREATE INDEX IF NOT EXISTS idx_tokens_updated_at ON tokens(updated_at);

-- Verify tables created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
