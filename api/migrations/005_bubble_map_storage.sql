-- Bubble Map Visualization Storage Schema
-- This stores all the data needed to recreate bubble map visualizations

-- Token bubble map snapshots
CREATE TABLE IF NOT EXISTS bubble_map_snapshots (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL,
    asset_name VARCHAR(64),
    ticker VARCHAR(20),
    snapshot_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_holders INTEGER NOT NULL,
    risk_score INTEGER,
    top_holder_percentage DECIMAL(8,4),
    metadata JSONB, -- Store additional metadata like market cap, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(policy_id, asset_name, snapshot_timestamp)
);

-- Individual holder bubbles for each snapshot
CREATE TABLE IF NOT EXISTS bubble_holders (
    id SERIAL PRIMARY KEY,
    snapshot_id INTEGER REFERENCES bubble_map_snapshots(id) ON DELETE CASCADE,
    holder_rank INTEGER NOT NULL,
    address VARCHAR(103) NOT NULL,
    stake_address VARCHAR(59),
    amount BIGINT NOT NULL,
    percentage DECIMAL(8,4) NOT NULL,
    risk_category VARCHAR(20) NOT NULL, -- 'safe', 'moderate_risk', 'high_risk'
    risk_color VARCHAR(7) NOT NULL, -- hex color
    is_infrastructure BOOLEAN DEFAULT FALSE,
    bubble_size INTEGER NOT NULL, -- pre-calculated bubble size
    opacity DECIMAL(3,2) DEFAULT 0.8,
    cluster_id VARCHAR(50), -- for grouping related holders
    cluster_size INTEGER DEFAULT 1,
    position_x DECIMAL(8,4), -- store calculated position for consistency
    position_y DECIMAL(8,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet connections and relationships
CREATE TABLE IF NOT EXISTS wallet_connections (
    id SERIAL PRIMARY KEY,
    source_address VARCHAR(103) NOT NULL,
    target_address VARCHAR(103) NOT NULL,
    source_stake VARCHAR(59),
    target_stake VARCHAR(59),
    connection_type VARCHAR(30) NOT NULL, -- 'stake_cluster', 'transaction', 'funding', 'coordinated'
    connection_strength DECIMAL(5,4) DEFAULT 1.0, -- 0.0 to 1.0
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_count INTEGER DEFAULT 0,
    total_amount BIGINT DEFAULT 0,
    metadata JSONB, -- store additional connection details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_address, target_address, connection_type)
);

-- Stake address clusters for visualization
CREATE TABLE IF NOT EXISTS stake_clusters (
    id SERIAL PRIMARY KEY,
    cluster_id VARCHAR(50) UNIQUE NOT NULL,
    stake_address VARCHAR(59) NOT NULL,
    cluster_size INTEGER DEFAULT 1,
    risk_level VARCHAR(20) DEFAULT 'unknown', -- 'safe', 'moderate', 'high', 'extreme'
    cluster_type VARCHAR(30), -- 'infrastructure', 'exchange', 'whale', 'coordinated', 'normal'
    total_tokens_held BIGINT DEFAULT 0,
    unique_tokens INTEGER DEFAULT 0,
    first_activity TIMESTAMP,
    last_activity TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token holder network graph data
CREATE TABLE IF NOT EXISTS holder_network_edges (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL,
    source_holder VARCHAR(103) NOT NULL,
    target_holder VARCHAR(103) NOT NULL,
    edge_type VARCHAR(30) NOT NULL, -- 'same_stake', 'transaction', 'funding_chain', 'timing'
    weight DECIMAL(5,4) DEFAULT 1.0,
    confidence DECIMAL(3,2) DEFAULT 1.0, -- how confident we are in this connection
    evidence JSONB, -- store the evidence for this connection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(policy_id, source_holder, target_holder, edge_type)
);

-- Bubble map visualization cache
CREATE TABLE IF NOT EXISTS bubble_map_cache (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL,
    asset_name VARCHAR(64),
    cache_key VARCHAR(100) UNIQUE NOT NULL,
    visualization_data JSONB NOT NULL, -- complete bubble map data
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bubble_snapshots_policy ON bubble_map_snapshots(policy_id);
CREATE INDEX IF NOT EXISTS idx_bubble_snapshots_timestamp ON bubble_map_snapshots(snapshot_timestamp);
CREATE INDEX IF NOT EXISTS idx_bubble_holders_snapshot ON bubble_holders(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_bubble_holders_address ON bubble_holders(address);
CREATE INDEX IF NOT EXISTS idx_bubble_holders_stake ON bubble_holders(stake_address);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_source ON wallet_connections(source_address);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_target ON wallet_connections(target_address);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_stake_source ON wallet_connections(source_stake);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_stake_target ON wallet_connections(target_stake);
CREATE INDEX IF NOT EXISTS idx_stake_clusters_stake ON stake_clusters(stake_address);
CREATE INDEX IF NOT EXISTS idx_stake_clusters_cluster_id ON stake_clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_holder_network_policy ON holder_network_edges(policy_id);
CREATE INDEX IF NOT EXISTS idx_holder_network_source ON holder_network_edges(source_holder);
CREATE INDEX IF NOT EXISTS idx_holder_network_target ON holder_network_edges(target_holder);
CREATE INDEX IF NOT EXISTS idx_bubble_cache_policy ON bubble_map_cache(policy_id);
CREATE INDEX IF NOT EXISTS idx_bubble_cache_expires ON bubble_map_cache(expires_at);

-- Views for easy querying
CREATE OR REPLACE VIEW bubble_map_with_connections AS
SELECT 
    s.id as snapshot_id,
    s.policy_id,
    s.ticker,
    s.total_holders,
    s.risk_score,
    h.holder_rank,
    h.address,
    h.stake_address,
    h.percentage,
    h.risk_category,
    h.is_infrastructure,
    h.bubble_size,
    h.position_x,
    h.position_y,
    COUNT(wc.id) as connection_count,
    COALESCE(sc.cluster_size, 1) as stake_cluster_size,
    sc.cluster_type
FROM bubble_map_snapshots s
JOIN bubble_holders h ON h.snapshot_id = s.id
LEFT JOIN wallet_connections wc ON (wc.source_address = h.address OR wc.target_address = h.address)
LEFT JOIN stake_clusters sc ON sc.stake_address = h.stake_address
GROUP BY s.id, s.policy_id, s.ticker, s.total_holders, s.risk_score, 
         h.holder_rank, h.address, h.stake_address, h.percentage, h.risk_category,
         h.is_infrastructure, h.bubble_size, h.position_x, h.position_y,
         sc.cluster_size, sc.cluster_type;

-- Function to clean up old cache entries
CREATE OR REPLACE FUNCTION cleanup_bubble_cache() RETURNS void AS $$
BEGIN
    DELETE FROM bubble_map_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get or create cluster ID for stake address
CREATE OR REPLACE FUNCTION get_or_create_cluster_id(stake_addr VARCHAR(59)) RETURNS VARCHAR(50) AS $$
DECLARE
    cluster_id_result VARCHAR(50);
BEGIN
    -- Try to find existing cluster
    SELECT cluster_id INTO cluster_id_result 
    FROM stake_clusters 
    WHERE stake_address = stake_addr 
    LIMIT 1;
    
    -- If not found, create new cluster
    IF cluster_id_result IS NULL THEN
        cluster_id_result := 'cluster_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || substr(md5(stake_addr), 1, 8);
        
        INSERT INTO stake_clusters (cluster_id, stake_address, cluster_size)
        VALUES (cluster_id_result, stake_addr, 1)
        ON CONFLICT (cluster_id) DO NOTHING;
    END IF;
    
    RETURN cluster_id_result;
END;
$$ LANGUAGE plpgsql;
