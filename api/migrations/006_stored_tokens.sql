-- Stored Tokens Table for Easy Access
-- This table stores tokens for easy one-by-one bubble map visualization

CREATE TABLE IF NOT EXISTS stored_tokens (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) UNIQUE NOT NULL,
    policy_id VARCHAR(56) NOT NULL,
    asset_name VARCHAR(64) DEFAULT '',
    unit VARCHAR(120), -- full unit (policy_id + asset_name)
    name VARCHAR(100),
    description TEXT,
    price DECIMAL(20,8) DEFAULT 0,
    market_cap BIGINT DEFAULT 0,
    volume_24h BIGINT DEFAULT 0,
    holders INTEGER DEFAULT 0,
    risk_score INTEGER,
    last_analyzed TIMESTAMP,
    social_links JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stored_tokens_ticker ON stored_tokens(ticker);
CREATE INDEX IF NOT EXISTS idx_stored_tokens_policy ON stored_tokens(policy_id);
CREATE INDEX IF NOT EXISTS idx_stored_tokens_active ON stored_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_stored_tokens_last_analyzed ON stored_tokens(last_analyzed);
CREATE INDEX IF NOT EXISTS idx_stored_tokens_risk_score ON stored_tokens(risk_score);

-- Insert some popular tokens for testing
INSERT INTO stored_tokens (ticker, policy_id, asset_name, unit, name, description, is_active) VALUES
('SNEK', '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f', '534e454b', '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b', 'Snek', 'The friendly Cardano snake token', true),
('HOSKY', 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235', '484f534b59', 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235484f534b59', 'Hosky Token', 'The meme dog of Cardano', true),
('MIN', '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6', '4d494e', '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e', 'Minswap', 'Minswap DEX token', true),
('SUNDAE', '9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d77', '53554e444145', '9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d7753554e444145', 'SundaeSwap', 'SundaeSwap DEX token', true),
('WMT', '1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e', '776f726c646d6f62696c65746f6b656e', '1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e776f726c646d6f62696c65746f6b656e', 'World Mobile Token', 'World Mobile Network token', true),
('AGIX', 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535', '41474958', 'f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc53541474958', 'SingularityNET', 'AI and machine learning token', true),
('COPI', 'af2e27f580f7f08e93190a81f72462f153026d06450924726645891b', '434f5049', 'af2e27f580f7f08e93190a81f72462f153026d06450924726645891b434f5049', 'Cornucopias', 'Cornucopias metaverse token', true),
('MELD', '6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d10', '4d454c44', '6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d104d454c44', 'MELD', 'MELD DeFi protocol token', true),
('CLAY', 'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad', '434c4159', 'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad434c4159', 'Clay Nation', 'Clay Nation NFT ecosystem token', true),
('BOOK', '8bb3b343d8e404472337966a722150048c768d0a92a9813596c5338d', '424f4f4b', '8bb3b343d8e404472337966a722150048c768d0a92a9813596c5338d424f4f4b', 'Book Token', 'Book.io publishing token', true),
('GERO', '4cfd5b1e3dc8e5c8c1b7e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5', '4745524f', '4cfd5b1e3dc8e5c8c1b7e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e54745524f', 'GeroWallet', 'Gero Wallet ecosystem token', true),
('INDY', '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0', '494e4459', '533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0494e4459', 'Indigo Protocol', 'Indigo synthetic assets protocol', true),
('OPTIM', 'b6a7467ea1deb012808ef4e87b5ff371e85f7142d7b356a40d9b42a0', '4f5054494d', 'b6a7467ea1deb012808ef4e87b5ff371e85f7142d7b356a40d9b42a04f5054494d', 'Optim Finance', 'Optim yield farming protocol', true),
('VYFI', '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114', '56594649', '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d11456594649', 'VyFinance', 'VyFinance auto-compounding protocol', true),
('DJED', '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61', '446a65644d6963726f555344', '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a65644d6963726f555344', 'Djed', 'Djed algorithmic stablecoin', true)
ON CONFLICT (ticker) DO NOTHING;

-- View for easy token browsing
CREATE OR REPLACE VIEW token_dashboard AS
SELECT 
    t.ticker,
    t.name,
    t.policy_id,
    t.holders,
    t.risk_score,
    t.last_analyzed,
    t.price,
    t.market_cap,
    CASE 
        WHEN t.last_analyzed IS NULL THEN 'Never Analyzed'
        WHEN t.last_analyzed < NOW() - INTERVAL '24 hours' THEN 'Needs Update'
        ELSE 'Recent'
    END as analysis_status,
    CASE 
        WHEN t.risk_score IS NULL THEN 'Unknown'
        WHEN t.risk_score <= 3 THEN 'Low Risk'
        WHEN t.risk_score <= 6 THEN 'Medium Risk'
        ELSE 'High Risk'
    END as risk_level,
    -- Check if bubble map data exists
    (SELECT COUNT(*) FROM bubble_map_snapshots bms WHERE bms.policy_id = t.policy_id) > 0 as has_bubble_data
FROM stored_tokens t
WHERE t.is_active = true
ORDER BY 
    CASE 
        WHEN t.last_analyzed IS NOT NULL THEN 0 
        ELSE 1 
    END,
    t.updated_at DESC;

-- Function to get next token for analysis
CREATE OR REPLACE FUNCTION get_next_token_for_analysis() RETURNS TABLE(
    ticker VARCHAR(20),
    policy_id VARCHAR(56),
    asset_name VARCHAR(64)
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.ticker, t.policy_id, t.asset_name
    FROM stored_tokens t
    WHERE t.is_active = true 
      AND (
        t.last_analyzed IS NULL 
        OR t.last_analyzed < NOW() - INTERVAL '24 hours'
      )
    ORDER BY 
        CASE 
            WHEN t.last_analyzed IS NULL THEN 0 
            ELSE 1 
        END,
        t.last_analyzed ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
