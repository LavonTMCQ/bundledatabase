-- Cabal Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sync cursor to track progress
CREATE TABLE sync_cursor(
  id int PRIMARY KEY DEFAULT 0, 
  max_point text
);

-- Token information
CREATE TABLE token (
  policy_id text PRIMARY KEY,
  asset_name text,
  decimals int,
  first_seen timestamptz DEFAULT now(),
  market_cap_ada numeric,
  last_refreshed timestamptz
);

-- Wallet information
CREATE TABLE wallet (
  stake_cred text PRIMARY KEY,
  first_tx bigint,
  last_tx bigint,
  flags jsonb DEFAULT '{}'  -- farmer/dev etc.
);

-- Token holdings by wallet
CREATE TABLE token_holding (
  policy_id text REFERENCES token,
  stake_cred text REFERENCES wallet,
  balance numeric,
  last_seen timestamptz DEFAULT now(),
  PRIMARY KEY (policy_id, stake_cred)
);

-- Wallet connections/edges
CREATE TABLE wallet_edge (
  src text, 
  dst text, 
  relation text, 
  weight numeric,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (src, dst, relation)
);

-- Clusters of related wallets
CREATE TABLE cluster (
  cluster_id serial PRIMARY KEY,
  risk_score numeric,
  tags text[]
);

-- Cluster membership
CREATE TABLE cluster_member (
  cluster_id int REFERENCES cluster,
  stake_cred text REFERENCES wallet,
  PRIMARY KEY (cluster_id, stake_cred)
);

-- Cluster risk score history
CREATE TABLE cluster_score_history (
  cluster_id int REFERENCES cluster,
  score numeric,
  ts timestamptz DEFAULT now(),
  PRIMARY KEY (cluster_id, ts)
);

-- Initialize sync cursor
INSERT INTO sync_cursor(id, max_point) VALUES (0, 'origin') ON CONFLICT DO NOTHING;
