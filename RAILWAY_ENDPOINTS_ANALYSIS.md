# Railway Endpoints Analysis & Requirements

## Current Status Summary

### 🟢 Working Endpoints
- **risk-api-production.up.railway.app**
  - `/health` ✅ Returns: `{"status":"ready","database":"connected","timestamp":"2025-06-09T22:21:52.941Z"}`
  - Database connection is working

### 🔴 Failing Endpoints
- **risk-api-production.up.railway.app**
  - `/api/wallet-network/{policyId}` ❌ Returns: `{"error":"Failed to generate stake clustering"}`
  - Tested with both AGENT T and MISTER tokens - same error

- **token-api-production.up.railway.app**
  - `/health` ❌ Returns: 404 "Cannot GET /health"
  - Service appears to be running but missing endpoints

- **auto-monitor-production.up.railway.app**
  - `/health` ❌ Returns: 502 "Application failed to respond"
  - Service appears to be down

## Local Working Implementation

### ✅ Local API Structure (localhost:3000)
```
/api/wallet-network/[policyId]
├── GET - Main wallet network analysis endpoint
├── ?force=true - Force immediate processing
└── Returns: Complete network data with stake clustering
```

### ✅ Local API Success Response
```json
{
  "metadata": {
    "token": "97bbb7db...",
    "totalHolders": 100,
    "totalClusters": 100,
    "stakeConnections": 0,
    "isolatedWallets": 100,
    "multiWalletStakes": 0,
    "analysisType": "stake_clustering_only",
    "processingTime": "114566ms"
  },
  "holders": [...], // 100 wallet objects with stake addresses
  "connections": [], // Currently empty - no multi-wallet stakes detected
  "clusters": [...], // 100 cluster objects (all single-wallet)
  "riskAnalysis": {...},
  "visualization": {...}
}
```

## Required Railway Endpoints

### 1. **risk-api-production.up.railway.app** (Priority: HIGH)

#### Fix Required: `/api/wallet-network/{policyId}`
**Current Error:** "Failed to generate stake clustering"

**Expected Functionality:**
- Fetch token holder data from TapTools API
- Analyze stake address clustering
- Detect multi-wallet stakes (same stake address controlling multiple payment addresses)
- Generate network connections between related wallets
- Return comprehensive network analysis

**Required Response Format:**
```json
{
  "metadata": {
    "token": "string",
    "totalHolders": "number",
    "totalClusters": "number", 
    "stakeConnections": "number",
    "isolatedWallets": "number",
    "multiWalletStakes": "number",
    "analysisType": "stake_clustering_only",
    "processingTime": "string"
  },
  "holders": [
    {
      "address": "stake1u9z66lpc...",
      "stakeAddress": "stake1u9z66lpc...",
      "amount": 50000000,
      "percentage": 0.72,
      "rank": 1,
      "handles": ["$handle1", "$handle2"],
      "riskScore": 0.1,
      "riskFlags": [],
      "clusterId": "stake_1",
      "isIsolated": true,
      "walletIndex": 0,
      "totalWalletsInStake": 1
    }
  ],
  "connections": [
    {
      "from": "address1",
      "to": "address2", 
      "type": "same_stake",
      "strength": 1.0,
      "evidence": "Same stake address",
      "stakeAddress": "stake1..."
    }
  ],
  "clusters": [
    {
      "id": "stake_1",
      "stakeAddress": "stake1...",
      "type": "single_wallet",
      "wallets": ["address1"],
      "totalPercentage": 0.72,
      "walletCount": 1,
      "connectionStrength": 0,
      "riskScore": 0.1,
      "suspicious": false,
      "riskFactors": [],
      "centerNode": "address1",
      "handles": ["$handle1"]
    }
  ],
  "riskAnalysis": {
    "overallRisk": 0.1,
    "suspiciousClusters": 0,
    "totalConnections": 0,
    "strongConnections": 0,
    "networkDensity": 0,
    "concentrationRisk": 0.0072,
    "topRisks": []
  },
  "visualization": {
    "recommendedLayout": "force_directed",
    "nodeColors": {
      "isolated": "#64748b",
      "connected": "#22c55e", 
      "suspicious": "#ef4444",
      "whale": "#f59e0b"
    },
    "edgeTypes": {
      "same_stake": {"color": "#2196f3", "width": 3}
    }
  },
  "_cache": {
    "cached": false,
    "processed": true,
    "processingTime": 114567
  }
}
```

#### Additional Endpoints Needed:
- `GET /api/wallet-network/{policyId}/status` - Check processing status
- `POST /api/wallet-network/{policyId}/refresh` - Force refresh analysis
- `GET /api/wallet-network/cache/stats` - Cache statistics

### 2. **token-api-production.up.railway.app** (Priority: MEDIUM)

#### Missing Endpoints:
- `GET /health` - Basic health check
- `GET /api/tokens/current` - Get current token list
- `GET /api/tokens/{policyId}` - Get specific token data
- `GET /api/holders/{policyId}/top` - Get top token holders

### 3. **auto-monitor-production.up.railway.app** (Priority: LOW)

#### Service Down - Needs Investigation:
- `GET /health` - Basic health check
- Auto-monitoring functionality (unclear what this service does)

## Technical Requirements

### Database Schema (Already Implemented Locally)
```sql
-- wallet_network_cache table
CREATE TABLE wallet_network_cache (
  id SERIAL PRIMARY KEY,
  policy_id VARCHAR(56) NOT NULL UNIQUE,
  network_data JSONB NOT NULL,
  total_holders INTEGER NOT NULL DEFAULT 0,
  total_clusters INTEGER NOT NULL DEFAULT 0,
  total_connections INTEGER NOT NULL DEFAULT 0,
  processing_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### External API Dependencies
- **TapTools API**: `https://openapi.taptools.io/api/v1/token/holders/top`
- **Blockfrost API**: For ADA handle resolution
- **Environment Variables**: TAPTOOLS_API_KEY, BLOCKFROST_PROJECT_ID

### Caching Strategy
- **Redis**: Ultra-fast access (5-minute TTL)
- **PostgreSQL**: Persistent storage (1-6 hour TTL)
- **Background Jobs**: Process expensive operations asynchronously

## Immediate Action Items

1. **Fix risk-api stake clustering error** - Debug why the Railway deployment fails
2. **Deploy missing endpoints** to token-api and auto-monitor services  
3. **Implement proper error handling** and logging
4. **Add health checks** for all services
5. **Test with multiple tokens** to ensure reliability

## Local Implementation Reference

### Working Local Code Structure
```
pages/api/wallet-network/[policyId].js - Main endpoint
src/lib/walletNetworkCache.ts - Caching logic
src/components/BubbleMap/WalletNetworkVisualization.tsx - Frontend component
```

### Key Functions That Work Locally
1. **fetchRealHolderData()** - Gets data from TapTools API
2. **analyzeStakeClustering()** - Processes stake address relationships
3. **setCachedWalletNetwork()** - Stores results in database
4. **getCachedWalletNetwork()** - Retrieves cached data

### Local API Test Commands
```bash
# Test local endpoint (works)
curl "http://localhost:3000/api/wallet-network/97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec54616c6f73?force=true"

# Test Railway endpoint (fails)
curl "https://risk-api-production.up.railway.app/api/wallet-network/97bbb7db0baef89caefce61b8107ac74c7a7340166b39d906f174bec54616c6f73"
```

### Environment Variables Needed
```env
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
BLOCKFROST_PROJECT_ID=mainnetKDR7gGfvHy85Mqr4nYtfjoXq7fX8R1Bu
POSTGRES_URL=postgres://...
KV_REST_API_URL=https://balanced-sole-17274.upstash.io
KV_REST_API_TOKEN=AUN6AAIjcDE...
```

## Debugging Notes

### Railway Deployment Issues
- **Database Connection**: Health check shows "database":"connected" ✅
- **Stake Clustering Logic**: Failing with generic error ❌
- **Missing Error Details**: Need better error logging
- **Environment Variables**: May be missing or incorrect

### Frontend Integration Issues
- **API Fallback Logic**: Tries Railway first, then localhost
- **Error Display**: Shows "Error loading network data" instead of actual data
- **Caching Problems**: Local API processes but doesn't cache to database
- **Polling Logic**: Background processing detection not working

## Success Criteria

✅ **risk-api-production.up.railway.app/api/wallet-network/{policyId}** returns valid network data
✅ **Frontend network view** displays wallet connections and stake clusters
✅ **All Railway services** respond to health checks
✅ **Error handling** provides meaningful feedback to users
✅ **Database caching** works properly on both local and Railway
✅ **Multi-wallet stake detection** identifies connected wallets
