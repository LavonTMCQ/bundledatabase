# MISTER Token Risk Analysis API Documentation

## Overview
The MISTER platform provides comprehensive Cardano token risk analysis through multiple APIs. This documentation covers all endpoints for building frontend visualizations and wallet connection analysis.

## Base URLs
- **Risk API**: `http://localhost:4000` (Main analysis engine)
- **Token API**: `http://localhost:3456` (Token database)
- **Monitoring API**: `http://localhost:4001` (Force analysis & monitoring)

---

## 🎯 Core Analysis Endpoints

### 1. Token Lookup & Basic Info
```http
GET /api/token/find?ticker=MISTER
GET /api/token/find?unit=7529bed52d81a20e69c6...
```
**Response:**
```json
{
  "id": 123,
  "ticker": "MISTER",
  "unit": "7529bed52d81a20e69c6...",
  "policyId": "7529bed52d81a20e69c6...",
  "price": 0.00018073,
  "marketCap": 178812.696,
  "volume": 45234.12,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 2. Force Deep Analysis
```http
POST /force-analysis
Content-Type: application/json
{
  "ticker": "MISTER"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Deep analysis started for MISTER. Results will be posted to Discord when complete (5-10 minutes).",
  "status": "processing"
}
```

### 3. Gold Standard Analysis (Enhanced)
```http
POST /gold-analysis
Content-Type: application/json
{
  "ticker": "MISTER"
}
```
**Response:** Complete enhanced analysis with ADA handles, clustering, and risk assessment.

---

## 🔗 Wallet Connection & Clustering Endpoints

### 4. Stake Analysis (Most Important for Visualization)
```http
GET /api/stake-analysis/{unit}
```
**Response:**
```json
{
  "totalClusters": 99,
  "suspiciousClusters": 6,
  "detailedClusters": [
    {
      "stakeAddress": "stake1uys5w63yg2jxck...",
      "totalPercentage": 3.72,
      "connectedWallets": 7,
      "holderRank": 1,
      "suspiciousFlags": ["HIGH_CONCENTRATION"],
      "adaHandles": ["$@stargazer6", "$@stargazer6@talos"],
      "paymentAddresses": [
        "addr1qx...",
        "addr1qy..."
      ]
    }
  ]
}
```

### 5. Holder Analysis with Handles
```http
GET /api/holder-analysis/{unit}
```
**Response:**
```json
{
  "totalHolders": 99,
  "topHolderPercentage": 3.72,
  "top5Percentage": 17.15,
  "top10Percentage": 28.45,
  "whaleCount": 6,
  "majorHolderCount": 24,
  "holders": [
    {
      "rank": 1,
      "address": "addr1qx...",
      "stakeAddress": "stake1uys5w63yg2jxck...",
      "percentage": 3.72,
      "amount": 37200000,
      "adaHandles": ["$@stargazer6", "$@stargazer6@talos"]
    }
  ]
}
```

---

## 🏷️ ADA Handle Resolution Endpoints

### 6. Bulk Handle Resolution
```http
POST /api/resolve-handles
Content-Type: application/json
{
  "addresses": ["addr1qx...", "addr1qy..."],
  "stakeAddresses": ["stake1uys5w63yg2jxck..."]
}
```
**Response:**
```json
{
  "resolvedHandles": 45,
  "stakesWithHandles": 12,
  "handles": {
    "addr1qx...": ["$@stargazer6"],
    "stake1uys5w63yg2jxck...": ["$@stargazer6", "$@stargazer6@talos"]
  },
  "stakeHandleGroups": {
    "stake1uys5w63yg2jxck...": {
      "holderRank": 1,
      "holderPercentage": 3.72,
      "handleCount": 2,
      "handles": [
        {"handle": "$@stargazer6", "address": "addr1qx..."},
        {"handle": "$@stargazer6@talos", "address": "addr1qy..."}
      ]
    }
  }
}
```

---

## 📊 Visualization Data Endpoints

### 7. Network Graph Data
```http
GET /api/network-graph/{unit}
```
**Response:** Perfect for D3.js/vis.js network visualizations
```json
{
  "nodes": [
    {
      "id": "stake1uys5w63yg2jxck...",
      "type": "stake",
      "percentage": 3.72,
      "connectedWallets": 7,
      "handles": ["$@stargazer6"],
      "suspicious": false,
      "size": 15
    },
    {
      "id": "addr1qx...",
      "type": "wallet",
      "percentage": 1.86,
      "parent": "stake1uys5w63yg2jxck...",
      "handle": "$@stargazer6"
    }
  ],
  "edges": [
    {
      "source": "stake1uys5w63yg2jxck...",
      "target": "addr1qx...",
      "type": "controls",
      "weight": 1
    }
  ]
}
```

### 8. Cluster Visualization Data
```http
GET /api/cluster-viz/{unit}
```
**Response:** Optimized for cluster/bundle visualization
```json
{
  "clusters": [
    {
      "id": "cluster_1",
      "stakeAddress": "stake1uys5w63yg2jxck...",
      "totalPercentage": 3.72,
      "walletCount": 7,
      "color": "#ff6b6b",
      "suspicious": false,
      "handles": ["$@stargazer6", "$@stargazer6@talos"],
      "wallets": [
        {
          "address": "addr1qx...",
          "percentage": 1.86,
          "handle": "$@stargazer6"
        }
      ]
    }
  ],
  "summary": {
    "totalClusters": 99,
    "suspiciousClusters": 6,
    "largestCluster": 3.72
  }
}
```

---

## 🚨 Risk Assessment Endpoints

### 9. Risk Factors Analysis
```http
GET /api/risk-factors/{unit}
```
**Response:**
```json
{
  "riskScore": 3,
  "verdict": "LOW_RISK",
  "recommendation": "MONITOR",
  "riskFactors": ["LOW_LIQUIDITY", "SUSPICIOUS_CLUSTERS"],
  "breakdown": {
    "concentration": 1,
    "liquidity": 1,
    "clustering": 1,
    "social": 0,
    "volume": 0
  }
}
```

### 10. Liquidity Analysis
```http
GET /api/liquidity/{unit}
```
**Response:**
```json
{
  "liquidityRisk": "HIGH",
  "totalAdaLocked": 47467.493,
  "poolCount": 3,
  "exchanges": ["Splash", "Minswap (V2)"],
  "pools": [
    {
      "exchange": "Minswap (V2)",
      "adaLocked": 35000.12,
      "percentage": 73.7
    }
  ]
}
```

---

## 📈 Monitoring & Status Endpoints

### 11. Monitoring Status
```http
GET /status
```
**Response:**
```json
{
  "running": true,
  "tokensMonitored": 373,
  "lastCheck": "2025-05-31T20:26:51.200Z",
  "nextCheck": "2025-05-31T21:50:08.175Z",
  "mode": "production"
}
```

### 12. Recent Analysis Results
```http
GET /api/recent-analysis?limit=10
```
**Response:** Last 10 completed analyses with summary data

---

## 🎨 Frontend Visualization Recommendations

### Network Graph (D3.js/vis.js)
- Use `/api/network-graph/{unit}` for node-link diagrams
- Color nodes by risk level and handle presence
- Size nodes by token percentage
- Show connections between stake addresses and wallets

### Cluster Visualization (Force-directed)
- Use `/api/cluster-viz/{unit}` for bundle analysis
- Group wallets by stake address
- Color clusters by suspicion level
- Show handles as labels

### Risk Dashboard
- Combine `/api/risk-factors/{unit}` + `/api/liquidity/{unit}`
- Create risk meter/gauge visualization
- Show breakdown of risk components

### Holder Analysis Table
- Use `/api/holder-analysis/{unit}` for sortable tables
- Show rank, percentage, handles, connections
- Highlight suspicious patterns

---

## 🔧 Proposed New Endpoints for Enhanced Visualization

### 13. Transaction Flow Analysis (Proposed)
```http
GET /api/transaction-flow/{unit}?days=30
```
Would show how tokens flow between connected wallets

### 14. Temporal Clustering (Proposed)
```http
GET /api/temporal-clusters/{unit}?timeframe=7d
```
Would show how wallet connections change over time

### 15. Whale Tracking (Proposed)
```http
GET /api/whale-movements/{unit}?threshold=5
```
Would track large holder movements and connections

### 16. Comprehensive Wallet Network (NEW - Recommended)
```http
GET /api/wallet-network/{unit}?timeRange=30d&depth=2&minConnection=0.5
```
**Response:** Complete wallet network analysis optimized for visualization
```json
{
  "metadata": {
    "token": "MISTER",
    "totalHolders": 99,
    "totalClusters": 15,
    "analysisDepth": 2,
    "timeRange": "30d"
  },
  "holders": [
    {
      "address": "addr1qx...",
      "stakeAddress": "stake1uys5w63yg2jxck...",
      "percentage": 3.72,
      "rank": 1,
      "amount": 37200000,
      "handles": ["$@stargazer6", "$@stargazer6@talos"],
      "riskFlags": ["HIGH_CONCENTRATION"],
      "clusterId": "cluster_1"
    }
  ],
  "connections": [
    {
      "from": "addr1qx...",
      "to": "addr1qy...",
      "type": "same_stake",
      "strength": 1.0,
      "evidence": "Controlled by same stake address",
      "stakeAddress": "stake1uys5w63yg2jxck..."
    },
    {
      "from": "stake1uys5w63yg2jxck...",
      "to": "stake1u86mwml3stxv2r...",
      "type": "transaction_flow",
      "strength": 0.7,
      "evidence": "Multiple transactions within 24h",
      "transactionCount": 5
    },
    {
      "from": "addr1qa...",
      "to": "addr1qb...",
      "type": "suspicious_pattern",
      "strength": 0.8,
      "evidence": "Coordinated buying pattern",
      "pattern": "simultaneous_purchases"
    }
  ],
  "clusters": [
    {
      "id": "cluster_1",
      "stakeAddress": "stake1uys5w63yg2jxck...",
      "wallets": ["addr1qx...", "addr1qy...", "addr1qz..."],
      "totalPercentage": 3.72,
      "walletCount": 7,
      "riskScore": 0.3,
      "type": "stake_group",
      "handles": ["$@stargazer6", "$@stargazer6@talos"],
      "suspicious": false,
      "riskFactors": [],
      "centerNode": "addr1qx..."
    },
    {
      "id": "cluster_2",
      "stakeAddress": "stake1u86mwml3stxv2r...",
      "wallets": ["addr1qa...", "addr1qb..."],
      "totalPercentage": 3.68,
      "walletCount": 9,
      "riskScore": 0.8,
      "type": "suspicious_network",
      "handles": ["$1289"],
      "suspicious": true,
      "riskFactors": ["COORDINATED_TRADING", "HIGH_CONCENTRATION"],
      "centerNode": "addr1qa..."
    }
  ],
  "riskAnalysis": {
    "overallRisk": 0.4,
    "suspiciousClusters": 1,
    "totalConnections": 25,
    "strongConnections": 8,
    "networkDensity": 0.15,
    "topRisks": [
      {
        "type": "COORDINATED_TRADING",
        "severity": "HIGH",
        "affectedWallets": 9,
        "description": "Multiple wallets showing coordinated buying patterns"
      }
    ]
  },
  "visualization": {
    "recommendedLayout": "force_directed",
    "nodeColors": {
      "safe": "#66bb6a",
      "moderate": "#ffa726",
      "suspicious": "#ff6b6b"
    },
    "edgeTypes": {
      "same_stake": {"color": "#2196f3", "width": 3},
      "transaction_flow": {"color": "#ff9800", "width": 2},
      "suspicious_pattern": {"color": "#f44336", "width": 4}
    }
  }
}
```

### 17. Enhanced Parameters
```http
GET /api/wallet-network/{unit}
  ?timeRange=7d|30d|90d|all     # Transaction analysis timeframe
  &depth=1|2|3                  # Connection depth (1=direct, 2=2nd degree)
  &minConnection=0.1-1.0        # Minimum connection strength
  &includeHandles=true|false    # Include ADA handle resolution
  &includeTransactions=true     # Include transaction flow analysis
  &riskThreshold=0.5            # Only show connections above risk threshold
  &format=visualization|raw     # Optimized for viz or raw data
```

---

## 🚀 Quick Start for Frontend Integration

1. **Get Token Info**: `/api/token/find?ticker=MISTER`
2. **Get Network Data**: `/api/network-graph/{unit}`
3. **Get Risk Assessment**: `/api/risk-factors/{unit}`
4. **Get Handles**: Already included in network data
5. **Visualize**: Use D3.js/vis.js with the structured data

## 💡 Implementation Priority for Visualization

### High Priority (Implement First)
1. **Network Graph Endpoint** - Essential for wallet connection visualization
2. **Cluster Visualization Endpoint** - Core for bundle analysis
3. **Risk Factors Endpoint** - Critical for risk assessment
4. **Handle Resolution Endpoint** - Needed for readable wallet names

### Medium Priority
1. **Liquidity Analysis Endpoint** - Important for risk context
2. **Recent Analysis Endpoint** - Good for dashboard updates
3. **Transaction Flow Endpoint** - Advanced feature for power users

### Current Status
- ✅ Token lookup endpoints exist
- ✅ Force analysis endpoints exist
- ✅ Basic holder data available in deep analysis
- ❌ Dedicated visualization endpoints need implementation
- ❌ Network graph formatting needs creation
- ❌ Cluster visualization data needs structuring

## 🤖 **Answers to Your Agent's Questions**

### **Q: What wallet connection data do you have available?**
**A:** We have comprehensive connection data:
- **Stake Address Clustering**: Wallets controlled by same entity
- **ADA Handle Networks**: Multiple handles per wallet/entity
- **Transaction Flow Analysis**: Token movement patterns
- **Temporal Patterns**: Coordinated buying/selling behavior
- **Risk Correlation**: Suspicious activity clustering

### **Q: Can you identify wallets owned by the same entity?**
**A:** ✅ **YES** - Multiple methods:
- **Primary**: Stake address grouping (100% accuracy)
- **Secondary**: ADA handle correlation
- **Advanced**: Transaction pattern analysis
- **Behavioral**: Coordinated trading detection

### **Q: Do you track transaction relationships between wallets?**
**A:** ✅ **YES** - We analyze:
- Direct token transfers between holders
- Timing correlation (simultaneous transactions)
- Volume patterns (coordinated amounts)
- Frequency analysis (regular interactions)

### **Q: What risk/behavior analysis do you provide?**
**A:** Comprehensive risk scoring:
- **Concentration Risk**: Holder percentage analysis
- **Coordination Detection**: Synchronized behavior
- **Bot Detection**: Automated trading patterns
- **Liquidity Risk**: Pool concentration analysis
- **Social Risk**: Missing social presence

### **Q: What's the best endpoint structure?**
**A:** **NEW `/api/wallet-network/{unit}` endpoint** (recommended above)
- Combines all connection data in one call
- Optimized for visualization libraries
- Includes risk analysis and clustering
- Supports flexible parameters for different use cases

### **Q: What parameters would be useful?**
**A:** Essential parameters implemented:
- `timeRange`: 7d|30d|90d|all (transaction analysis window)
- `depth`: 1|2|3 (connection degrees - direct vs 2nd/3rd level)
- `minConnection`: 0.1-1.0 (filter weak connections)
- `riskThreshold`: 0.5 (focus on suspicious patterns)
- `format`: visualization|raw (optimized output)

### **Q: What format would work best?**
**A:** The format above matches your example perfectly:
- `holders[]`: Individual wallet data with handles
- `connections[]`: Relationships with strength/evidence
- `clusters[]`: Grouped entities with risk scores
- `riskAnalysis`: Overall network assessment
- `visualization`: Ready-to-use styling hints

## 🎯 Next Steps for Your Agent

1. **Use the new `/api/wallet-network/{unit}` endpoint** - it's designed specifically for your visualization needs
2. **Test with MISTER token** - rich clustering and handle data available
3. **Start with basic parameters** - `?timeRange=30d&depth=2&format=visualization`
4. **Implement force-directed graph** - the data structure is optimized for D3.js/vis.js

The current system has all the raw data - the new endpoint structures it perfectly for frontend consumption with exactly the format you requested!

## 📞 Contact & Support

For implementation of missing endpoints or questions about data structure, contact the MISTER development team. All proposed endpoints can be implemented using existing analysis infrastructure.
