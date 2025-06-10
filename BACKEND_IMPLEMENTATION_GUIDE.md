# Backend Implementation Guide for Railway Wallet Network API

## 🎯 Objective
Fix the failing Railway endpoint: `https://risk-api-production.up.railway.app/api/wallet-network/{policyId}`

**Current Error:** `{"error":"Failed to generate stake clustering"}`
**Expected:** Return complete wallet network analysis data

## 📋 Implementation Checklist

### 1. Core API Endpoint: `/api/wallet-network/{policyId}`

#### Required Dependencies
```javascript
// Package installations needed
npm install axios @vercel/postgres @upstash/redis

// Environment variables required
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
BLOCKFROST_PROJECT_ID=mainnetKDR7gGfvHy85Mqr4nYtfjoXq7fX8R1Bu
POSTGRES_URL=postgres://neondb_owner:npg_NHAxl9hmU6WX@ep-shiny-bird-a5m5s317-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
KV_REST_API_URL=https://balanced-sole-17274.upstash.io
KV_REST_API_TOKEN=AUN6AAIjcDFlNjNiNjExZTE3M2M0ZmEwOWY4OWZmNjYzZDg5MGIzMHAxMA
```

#### Database Schema
```sql
-- Create wallet network cache table
CREATE TABLE IF NOT EXISTS wallet_network_cache (
    id SERIAL PRIMARY KEY,
    policy_id VARCHAR(56) NOT NULL UNIQUE,
    token_name VARCHAR(255),
    token_ticker VARCHAR(20),
    network_data JSONB NOT NULL,
    total_holders INTEGER NOT NULL DEFAULT 0,
    total_clusters INTEGER NOT NULL DEFAULT 0,
    total_connections INTEGER NOT NULL DEFAULT 0,
    analysis_depth INTEGER NOT NULL DEFAULT 0,
    overall_risk DECIMAL(3,2) DEFAULT 0.00,
    suspicious_clusters INTEGER DEFAULT 0,
    strong_connections INTEGER DEFAULT 0,
    network_density DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    processing_status VARCHAR(20) DEFAULT 'pending',
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    processing_duration_ms INTEGER,
    data_size_bytes INTEGER
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_network_cache_policy_id ON wallet_network_cache(policy_id);
CREATE INDEX IF NOT EXISTS idx_wallet_network_cache_status ON wallet_network_cache(processing_status);
CREATE INDEX IF NOT EXISTS idx_wallet_network_cache_expires ON wallet_network_cache(expires_at);
```

### 2. Core Functions to Implement

#### A. `fetchRealHolderData(policyId)`
```javascript
/**
 * Fetch token holder data from TapTools API
 * @param {string} policyId - Token policy ID
 * @returns {Array} Array of holder objects with stake addresses
 */
async function fetchRealHolderData(policyId) {
  const TAPTOOLS_API_KEY = process.env.TAPTOOLS_API_KEY;
  const TAPTOOLS_BASE_URL = 'https://openapi.taptools.io/api/v1';
  
  try {
    const response = await axios.get(`${TAPTOOLS_BASE_URL}/token/holders/top`, {
      headers: {
        'x-api-key': TAPTOOLS_API_KEY,
        'Content-Type': 'application/json'
      },
      params: {
        unit: policyId,
        perPage: 100,
        page: 1
      },
      timeout: 15000
    });
    
    return response.data;
  } catch (error) {
    console.error('TapTools API error:', error);
    throw new Error(`Failed to fetch holder data: ${error.message}`);
  }
}
```

#### B. `analyzeStakeClustering(policyId, holderData, startTime)`
```javascript
/**
 * Analyze stake address clustering to detect multi-wallet holders
 * @param {string} policyId - Token policy ID
 * @param {Array} holderData - Raw holder data from TapTools
 * @param {number} startTime - Processing start timestamp
 * @returns {Object} Complete network analysis object
 */
async function analyzeStakeClustering(policyId, holderData, startTime) {
  try {
    // Group wallets by stake address
    const stakeGroups = new Map();
    const processedHolders = [];
    const connections = [];
    const clusters = [];
    
    // Process each holder
    for (const holder of holderData) {
      const stakeAddress = holder.stakeAddress || holder.address;
      
      if (!stakeGroups.has(stakeAddress)) {
        stakeGroups.set(stakeAddress, []);
      }
      stakeGroups.get(stakeAddress).push(holder);
      
      // Create processed holder object
      processedHolders.push({
        address: holder.address,
        stakeAddress: stakeAddress,
        amount: holder.amount || 0,
        percentage: holder.percentage || 0,
        rank: holder.rank || 0,
        handles: holder.handles || [],
        riskScore: 0.1,
        riskFlags: [],
        clusterId: `stake_${processedHolders.length + 1}`,
        isIsolated: true, // Will be updated if multi-wallet stake found
        walletIndex: 0,
        totalWalletsInStake: 1
      });
    }
    
    // Analyze stake groups for multi-wallet detection
    let multiWalletStakes = 0;
    stakeGroups.forEach((wallets, stakeAddress) => {
      if (wallets.length > 1) {
        multiWalletStakes++;
        
        // Create connections between wallets with same stake
        for (let i = 0; i < wallets.length; i++) {
          for (let j = i + 1; j < wallets.length; j++) {
            connections.push({
              from: wallets[i].address,
              to: wallets[j].address,
              type: 'same_stake',
              strength: 1.0,
              evidence: 'Same stake address',
              stakeAddress: stakeAddress
            });
          }
        }
        
        // Update holders to mark as connected
        wallets.forEach((wallet, index) => {
          const holderIndex = processedHolders.findIndex(h => h.address === wallet.address);
          if (holderIndex >= 0) {
            processedHolders[holderIndex].isIsolated = false;
            processedHolders[holderIndex].walletIndex = index;
            processedHolders[holderIndex].totalWalletsInStake = wallets.length;
          }
        });
      }
      
      // Create cluster for this stake group
      clusters.push({
        id: `stake_${clusters.length + 1}`,
        stakeAddress: stakeAddress,
        type: wallets.length > 1 ? 'stake_group' : 'single_wallet',
        wallets: wallets.map(w => w.address),
        totalPercentage: wallets.reduce((sum, w) => sum + (w.percentage || 0), 0),
        walletCount: wallets.length,
        connectionStrength: wallets.length > 1 ? 1.0 : 0,
        riskScore: wallets.length > 1 ? 0.3 : 0.1,
        suspicious: wallets.length > 5, // Flag clusters with many wallets
        riskFactors: wallets.length > 5 ? ['Large wallet cluster'] : [],
        centerNode: wallets[0].address,
        handles: wallets.flatMap(w => w.handles || [])
      });
    });
    
    return {
      metadata: {
        token: policyId.substring(0, 8) + '...',
        totalHolders: processedHolders.length,
        totalClusters: clusters.length,
        stakeConnections: connections.length,
        isolatedWallets: processedHolders.filter(h => h.isIsolated).length,
        multiWalletStakes: multiWalletStakes,
        analysisType: 'stake_clustering_only',
        processingTime: `${Date.now() - startTime}ms`
      },
      holders: processedHolders,
      connections: connections,
      clusters: clusters,
      riskAnalysis: {
        overallRisk: multiWalletStakes > 0 ? 0.2 : 0.1,
        suspiciousClusters: clusters.filter(c => c.suspicious).length,
        totalConnections: connections.length,
        strongConnections: connections.length,
        networkDensity: connections.length / (processedHolders.length * (processedHolders.length - 1) / 2),
        concentrationRisk: Math.max(...processedHolders.map(h => h.percentage)) / 100,
        topRisks: []
      },
      visualization: {
        recommendedLayout: 'force_directed',
        nodeColors: {
          isolated: '#64748b',
          connected: '#22c55e',
          suspicious: '#ef4444',
          whale: '#f59e0b'
        },
        edgeTypes: {
          same_stake: { color: '#2196f3', width: 3 }
        }
      }
    };
    
  } catch (error) {
    console.error('Stake clustering analysis error:', error);
    throw new Error(`Failed to analyze stake clustering: ${error.message}`);
  }
}
```

### 3. Main API Handler

#### `/api/wallet-network/[policyId].js`
```javascript
export default async function handler(req, res) {
  const { policyId } = req.query;
  const { force } = req.query;
  
  if (!policyId) {
    return res.status(400).json({ error: 'Policy ID parameter is required' });
  }
  
  try {
    const startTime = Date.now();
    
    // Check cache first (unless force=true)
    if (!force) {
      const cached = await getCachedWalletNetwork(policyId);
      if (cached) {
        return res.status(200).json({
          ...cached.networkData,
          _cache: { cached: true, processed: false }
        });
      }
    }
    
    console.log(`🔄 Processing wallet network data for ${policyId}...`);
    
    // Fetch real holder data from TapTools
    const holderData = await fetchRealHolderData(policyId);
    
    if (!holderData || holderData.length === 0) {
      console.log(`❌ No holder data found for ${policyId}`);
      return res.status(200).json(generateEmptyNetworkData(policyId));
    }
    
    // Analyze stake address clustering
    const networkData = await analyzeStakeClustering(policyId, holderData, startTime);
    
    // Cache the results
    const processingTime = Date.now() - startTime;
    await setCachedWalletNetwork(policyId, networkData, {
      processingDurationMs: processingTime
    });
    
    console.log(`✅ Completed wallet network analysis for ${policyId} in ${processingTime}ms`);
    
    return res.status(200).json({
      ...networkData,
      _cache: { cached: false, processed: true, processingTime }
    });
    
  } catch (error) {
    console.error(`Error analyzing wallet network for ${policyId}:`, error);
    return res.status(500).json({
      error: 'Failed to generate stake clustering',
      details: error.message,
      policyId: policyId
    });
  }
}
```

### 4. Testing Commands

```bash
# Test the fixed endpoint
curl -v "https://risk-api-production.up.railway.app/api/wallet-network/97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec54616c6f73"

# Test with force refresh
curl -v "https://risk-api-production.up.railway.app/api/wallet-network/97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec54616c6f73?force=true"

# Test health check
curl -v "https://risk-api-production.up.railway.app/health"
```

## 🚀 Deployment Steps

1. **Deploy the fixed code** to Railway risk-api service
2. **Verify environment variables** are set correctly
3. **Run database migrations** to create required tables
4. **Test with multiple tokens** to ensure reliability
5. **Monitor logs** for any remaining errors
6. **Update frontend** to handle new response format

## ✅ Success Criteria

- Railway endpoint returns valid JSON instead of error
- Frontend network view displays wallet connections
- Database caching works properly
- Multi-wallet stake detection identifies connected wallets
- Error handling provides meaningful feedback
