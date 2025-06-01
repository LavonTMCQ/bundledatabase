-- Token Analysis Storage Tables

-- Main token analysis results
CREATE TABLE IF NOT EXISTS token_analysis (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL,
    asset_name VARCHAR(128),
    token_name VARCHAR(255),
    risk_score DECIMAL(3,1) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    top_holder_percentage DECIMAL(5,2) NOT NULL,
    stake_clusters INTEGER NOT NULL,
    coordinated_blocks INTEGER NOT NULL,
    total_holders INTEGER NOT NULL,
    regular_holders INTEGER NOT NULL,
    liquidity_pools INTEGER NOT NULL,
    infrastructure_holders INTEGER NOT NULL,
    assumed_total_supply BIGINT NOT NULL,
    observed_supply BIGINT NOT NULL,
    circulating_supply BIGINT NOT NULL,
    liquidity_supply BIGINT NOT NULL,
    infrastructure_supply BIGINT NOT NULL,
    analysis_patterns TEXT[], -- Array of detected patterns
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(policy_id, asset_name)
);

-- Token holders details
CREATE TABLE IF NOT EXISTS token_holders (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES token_analysis(id) ON DELETE CASCADE,
    address VARCHAR(103) NOT NULL,
    quantity BIGINT NOT NULL,
    percentage DECIMAL(8,4) NOT NULL,
    stake_address VARCHAR(59),
    holder_type VARCHAR(20) NOT NULL, -- 'regular', 'infrastructure', 'liquidity_pool', 'script'
    rank_position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk patterns detected
CREATE TABLE IF NOT EXISTS risk_patterns (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES token_analysis(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL, -- 'concentration', 'stake_clustering', 'coordinated_trading', 'identical_amounts'
    pattern_description TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    is_excluded BOOLEAN DEFAULT FALSE, -- true if pattern is excluded (like infrastructure)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stake address clustering analysis
CREATE TABLE IF NOT EXISTS stake_clusters (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES token_analysis(id) ON DELETE CASCADE,
    stake_address VARCHAR(59) NOT NULL,
    address_count INTEGER NOT NULL,
    total_quantity BIGINT NOT NULL,
    cluster_percentage DECIMAL(8,4) NOT NULL,
    is_suspicious BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historical analysis tracking
CREATE TABLE IF NOT EXISTS analysis_history (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL,
    asset_name VARCHAR(128),
    risk_score DECIMAL(3,1) NOT NULL,
    top_holder_percentage DECIMAL(5,2) NOT NULL,
    total_holders INTEGER NOT NULL,
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_analysis_policy_id ON token_analysis(policy_id);
CREATE INDEX IF NOT EXISTS idx_token_analysis_risk_score ON token_analysis(risk_score);
CREATE INDEX IF NOT EXISTS idx_token_analysis_risk_level ON token_analysis(risk_level);
CREATE INDEX IF NOT EXISTS idx_token_analysis_updated_at ON token_analysis(updated_at);
CREATE INDEX IF NOT EXISTS idx_token_holders_analysis_id ON token_holders(analysis_id);
CREATE INDEX IF NOT EXISTS idx_token_holders_address ON token_holders(address);
CREATE INDEX IF NOT EXISTS idx_token_holders_stake_address ON token_holders(stake_address);
CREATE INDEX IF NOT EXISTS idx_risk_patterns_analysis_id ON risk_patterns(analysis_id);
CREATE INDEX IF NOT EXISTS idx_stake_clusters_analysis_id ON stake_clusters(analysis_id);
CREATE INDEX IF NOT EXISTS idx_stake_clusters_stake_address ON stake_clusters(stake_address);
CREATE INDEX IF NOT EXISTS idx_analysis_history_policy_id_date ON analysis_history(policy_id, analysis_date);

-- Views for easy querying
CREATE OR REPLACE VIEW safe_tokens AS
SELECT
    policy_id,
    asset_name,
    token_name,
    risk_score,
    top_holder_percentage,
    total_holders,
    updated_at
FROM token_analysis
WHERE risk_level IN ('extremely safe', 'safe')
ORDER BY risk_score ASC, top_holder_percentage ASC;

CREATE OR REPLACE VIEW risky_tokens AS
SELECT
    policy_id,
    asset_name,
    token_name,
    risk_score,
    top_holder_percentage,
    total_holders,
    updated_at
FROM token_analysis
WHERE risk_level IN ('high risk', 'extreme risk')
ORDER BY risk_score DESC, top_holder_percentage DESC;

CREATE OR REPLACE VIEW token_summary AS
SELECT
    ta.policy_id,
    ta.asset_name,
    ta.token_name,
    ta.risk_score,
    ta.risk_level,
    ta.top_holder_percentage,
    ta.total_holders,
    ta.stake_clusters,
    COUNT(rp.id) as risk_pattern_count,
    ta.updated_at
FROM token_analysis ta
LEFT JOIN risk_patterns rp ON ta.id = rp.analysis_id AND rp.is_excluded = FALSE
GROUP BY ta.id, ta.policy_id, ta.asset_name, ta.token_name, ta.risk_score, ta.risk_level,
         ta.top_holder_percentage, ta.total_holders, ta.stake_clusters, ta.updated_at
ORDER BY ta.risk_score DESC;
