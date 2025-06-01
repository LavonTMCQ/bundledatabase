# MISTER API Technical Specification
## Wallet Network Visualization & Transaction Flow Analysis

**Version:** 1.0  
**Date:** January 2025  
**Target:** Backend API Developer  
**Context:** InsightX-style network visualization with real transaction relationships

---

## 📋 **Executive Summary**

This specification defines the exact API endpoints required to transform our existing holder data (199 real MISTER token holders) into a comprehensive wallet network visualization. The goal is to create an InsightX-style bubble map where **colored nodes represent wallets connected by actual transaction flows**, not just stake address groupings.

### **Current State:**
- ✅ 199 real MISTER token holders seeded from TapTools API
- ✅ Basic holder data (addresses, amounts, percentages, ranks)
- ✅ Frontend visualization framework ready
- ❌ **Missing: Transaction flow analysis and manipulation detection**

### **Target Outcome:**
- 🎯 Colored clusters = wallets with actual money transfer relationships
- 🎯 Grey nodes = isolated wallets with no transaction connections
- 🎯 Real-time manipulation pattern detection
- 🎯 Risk scoring based on behavioral analysis

---

## 🚀 **Implementation Priority**

### **Phase 1 (Critical - Week 1)**
1. Enhanced Wallet Network Endpoint
2. Transaction Flow Analysis

### **Phase 2 (High - Week 2)**  
3. Manipulation Pattern Detection
4. Real-time Risk Scoring

### **Phase 3 (Medium - Week 3)**
5. Historical Analysis
6. Advanced Pattern Recognition

---

## 📡 **API Endpoints Specification**

### **1. Enhanced Wallet Network Endpoint** ⭐ **PRIORITY 1**

```http
GET /api/wallet-network/{unit}
```

**Parameters:**
- `unit` (required): Token unit (e.g., `7529bed52d81a20e69c6dd447dd9cc0293daf4577f08d7ed2d8ab0814d4953544552`)
- `timeRange` (optional): `7d|30d|90d|all` (default: `30d`)
- `depth` (optional): `1|2|3` - Connection degrees (default: `2`)
- `minConnection` (optional): `0.1-1.0` - Minimum connection strength (default: `0.3`)
- `includeTransactions` (optional): `true|false` (default: `true`)
- `riskThreshold` (optional): `0.0-1.0` - Filter by risk level (default: `0.0`)

**Required Analysis:**
1. **Transaction Flow Detection**: Analyze actual token transfers between holders
2. **Timing Correlation**: Identify transactions within similar time windows
3. **Amount Pattern Recognition**: Detect similar amounts, round numbers, coordinated volumes
4. **Behavioral Clustering**: Group wallets by transaction patterns, not just stake addresses

**Response Schema:**
```json
{
  "metadata": {
    "token": "MISTER",
    "unit": "7529bed52d81a20e69c6dd447dd9cc0293daf4577f08d7ed2d8ab0814d4953544552",
    "totalHolders": 199,
    "totalClusters": 15,
    "transactionConnections": 45,
    "isolatedWallets": 154,
    "analysisDepth": 2,
    "timeRange": "30d",
    "lastUpdated": "2025-01-26T10:30:00Z",
    "dataFreshness": "5m"
  },
  "holders": [
    {
      "address": "stake1uys5w63yg2jxcksfftyw7sdtyg30sh4nkw09pvnwtsp44cc0y9tln",
      "stakeAddress": "stake1uys5w63yg2jxcksfftyw7sdtyg30sh4nkw09pvnwtsp44cc0y9tln",
      "amount": 36382247,
      "percentage": 3.72,
      "rank": 2,
      "handles": ["$@stargazer6", "$@stargazer6@talos"],
      "riskScore": 0.25,
      "riskFlags": ["HIGH_CONCENTRATION"],
      "clusterId": "tx_cluster_1",
      "isIsolated": false,
      "transactionCount": 15,
      "lastActivity": "2025-01-25T14:22:00Z"
    }
  ],
  "connections": [
    {
      "from": "stake1uys5w63yg2jxcksfftyw7sdtyg30sh4nkw09pvnwtsp44cc0y9tln",
      "to": "stake1u86mwml3stxv2r0a9szpn6dzj9z574ajnejk6hshzzj5m5qh60w93",
      "type": "transaction_flow",
      "strength": 0.85,
      "evidence": "5 transactions within 24h, total volume 1.5M tokens",
      "transactionCount": 5,
      "totalVolume": 1500000,
      "avgAmount": 300000,
      "timePattern": "coordinated",
      "firstTransaction": "2025-01-20T09:15:00Z",
      "lastTransaction": "2025-01-25T16:30:00Z",
      "suspiciousFlags": ["TIMING_CORRELATION", "ROUND_AMOUNTS"]
    },
    {
      "from": "stake1uy00h7u48zgxrantvez6tad3kp5nhs7n9mm0f9cq809lfsqzxmghs",
      "to": "stake1uy0g0s955yv8xg449wjjy08yrs9kfk5qaak6hpsrhq3lwfck38ygd",
      "type": "suspicious_pattern",
      "strength": 0.95,
      "evidence": "Simultaneous purchases within 5 minutes",
      "pattern": "coordinated_buying",
      "timeWindow": "5m",
      "suspiciousFlags": ["TIMING_CORRELATION", "AMOUNT_SIMILARITY", "COORDINATED_ENTRY"]
    }
  ],
  "clusters": [
    {
      "id": "tx_cluster_1",
      "type": "transaction_network",
      "wallets": [
        "stake1uys5w63yg2jxcksfftyw7sdtyg30sh4nkw09pvnwtsp44cc0y9tln",
        "stake1u86mwml3stxv2r0a9szpn6dzj9z574ajnejk6hshzzj5m5qh60w93"
      ],
      "totalPercentage": 7.4,
      "walletCount": 2,
      "connectionStrength": 0.85,
      "riskScore": 0.6,
      "suspicious": true,
      "riskFactors": ["COORDINATED_TRADING", "HIGH_FREQUENCY", "TIMING_CORRELATION"],
      "transactionPattern": "bidirectional_flow",
      "centerNode": "stake1uys5w63yg2jxcksfftyw7sdtyg30sh4nkw09pvnwtsp44cc0y9tln",
      "handles": ["$@stargazer6"],
      "totalVolume": 2500000,
      "avgTransactionSize": 250000
    }
  ],
  "riskAnalysis": {
    "overallRisk": 0.45,
    "suspiciousClusters": 3,
    "totalConnections": 45,
    "strongConnections": 12,
    "networkDensity": 0.23,
    "manipulationScore": 0.35,
    "topRisks": [
      {
        "type": "COORDINATED_TRADING",
        "severity": "HIGH",
        "affectedWallets": 8,
        "affectedPercentage": 12.5,
        "description": "Multiple wallets showing synchronized trading patterns",
        "evidence": "5 wallets executed trades within 10-minute window"
      },
      {
        "type": "WASH_TRADING",
        "severity": "MEDIUM", 
        "affectedWallets": 4,
        "affectedPercentage": 3.2,
        "description": "Circular transaction patterns detected",
        "evidence": "A→B→C→A pattern with 500K tokens"
      }
    ]
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
      "transaction_flow": {"color": "#3b82f6", "width": 2},
      "suspicious_pattern": {"color": "#ef4444", "width": 4},
      "high_frequency": {"color": "#f59e0b", "width": 3}
    }
  }
}
```

---

### **2. Transaction Flow Analysis Endpoint** ⭐ **PRIORITY 2**

```http
GET /api/transaction-flows/{unit}
```

**Parameters:**
- `unit` (required): Token unit
- `minAmount` (optional): Minimum transaction amount (default: `1000`)
- `timeRange` (optional): Analysis window (default: `7d`)
- `pattern` (optional): `circular|hub|chain|all` (default: `all`)

**Required Analysis:**
1. **Circular Flow Detection**: A→B→C→A patterns
2. **Hub Pattern Recognition**: Many wallets → central wallet
3. **Chain Analysis**: A→B→C→D sequential flows
4. **Volume Correlation**: Similar amounts across different transactions

**Response Schema:**
```json
{
  "flows": [
    {
      "id": "flow_001",
      "pattern": "circular",
      "wallets": ["addr1", "addr2", "addr3", "addr1"],
      "totalVolume": 500000,
      "transactionCount": 3,
      "timeSpan": "2h 15m",
      "suspiciousScore": 0.9,
      "evidence": "Perfect circular flow with equal amounts"
    }
  ],
  "patterns": {
    "circular": 2,
    "hub": 5,
    "chain": 8
  }
}
```

---

### **3. Manipulation Detection Endpoint** ⭐ **PRIORITY 3**

```http
GET /api/manipulation-patterns/{unit}
```

**Required Detection:**
1. **Wash Trading**: Artificial volume through back-and-forth transactions
2. **Pump Coordination**: Synchronized buying to inflate price
3. **Sybil Attacks**: Fake decentralization through controlled wallets
4. **Liquidity Manipulation**: Artificial market depth

---

## 🔗 **Frontend Integration Requirements**

### **Data Consumption:**
```javascript
// Frontend will call:
const response = await fetch(`/api/wallet-network/${MISTER_UNIT}?timeRange=30d&includeTransactions=true`);
const networkData = await response.json();

// Expected usage:
networkData.holders.forEach(holder => {
  const isConnected = !holder.isIsolated;
  const nodeColor = isConnected ? clusterColors[holder.clusterId] : '#64748b';
});
```

### **Real-time Updates:**
- **Cache Duration**: 5 minutes for network data
- **Refresh Trigger**: New transactions detected
- **WebSocket Support**: Optional for real-time updates

---

## ⚡ **Performance Requirements**

- **Response Time**: < 2 seconds for network endpoint
- **Data Freshness**: < 5 minutes old
- **Concurrent Users**: Support 100+ simultaneous requests
- **Cache Strategy**: Redis with 5-minute TTL
- **Rate Limiting**: 60 requests/minute per IP

---

## 📊 **Real-World Example Data**

**Current MISTER Token Holders (Top 5):**
1. `stake17xe0d2lkpnx7jt4wrgh5lhm97t40vgydsukx7rje0nqskpc5zugc3` - 272,629,648 tokens (27.26%)
2. `stake1uys5w63yg2jxcksfftyw7sdtyg30sh4nkw09pvnwtsp44cc0y9tln` - 36,382,247 tokens (3.64%)
3. `stake1u86mwml3stxv2r0a9szpn6dzj9z574ajnejk6hshzzj5m5qh60w93` - 36,007,152 tokens (3.60%)
4. `stake1uy00h7u48zgxrantvez6tad3kp5nhs7n9mm0f9cq809lfsqzxmghs` - 34,865,968 tokens (3.49%)
5. `stake1uy0g0s955yv8xg449wjjy08yrs9kfk5qaak6hpsrhq3lwfck38ygd` - 30,559,790 tokens (3.06%)

**Expected Analysis:**
- Analyze transaction relationships between these 199 holders
- Identify if top holders are coordinating trades
- Detect any wash trading patterns
- Flag suspicious timing correlations

---

## 🔧 **Technical Implementation Notes**

### **Blockchain Data Sources:**
- **Cardano Blockchain**: Transaction history analysis
- **Blockfrost API**: Historical transaction data
- **TapTools API**: Current holder information (already integrated)

### **Analysis Algorithms Required:**
1. **Graph Analysis**: Build transaction graph, find connected components
2. **Time Series Analysis**: Detect coordinated timing patterns
3. **Statistical Analysis**: Identify outlier amounts and frequencies
4. **Pattern Matching**: Recognize known manipulation signatures

### **Database Schema:**
```sql
-- Store transaction relationships
CREATE TABLE wallet_transactions (
  from_address VARCHAR(128),
  to_address VARCHAR(128), 
  amount BIGINT,
  timestamp TIMESTAMP,
  tx_hash VARCHAR(64),
  block_height BIGINT
);

-- Store detected patterns
CREATE TABLE manipulation_patterns (
  pattern_id VARCHAR(64),
  pattern_type VARCHAR(32),
  wallets TEXT[],
  risk_score DECIMAL(3,2),
  evidence TEXT,
  detected_at TIMESTAMP
);
```

---

## ✅ **Acceptance Criteria**

1. **Endpoint returns data in exact schema format specified above**
2. **Response time < 2 seconds for MISTER token (199 holders)**
3. **Correctly identifies transaction-connected vs isolated wallets**
4. **Detects at least 3 types of manipulation patterns**
5. **Provides risk scores with evidence explanations**
6. **Supports real-time updates with 5-minute data freshness**

---

## 📞 **Developer Support**

**Frontend Integration Team:** Available for testing and validation  
**Database Schema:** Already implemented and ready  
**Test Data:** 199 real MISTER holders seeded and available  
**Visualization Framework:** Ready to consume API responses

**Next Steps:**
1. Implement Phase 1 endpoints
2. Test with real MISTER data
3. Validate visualization integration
4. Deploy to production environment

---

## 🧪 **Testing & Validation**

### **Test Cases:**
1. **Large Holder Analysis**: Test with top 20 MISTER holders (>1M tokens each)
2. **Small Holder Filtering**: Verify bottom 100 holders (<100K tokens) are handled correctly
3. **Connection Detection**: Validate transaction relationships are accurately identified
4. **Performance Testing**: Ensure <2s response time with full 199 holder dataset
5. **Edge Cases**: Handle wallets with zero transactions, single transactions, etc.

### **Validation Metrics:**
- **Accuracy**: >95% correct identification of transaction relationships
- **Coverage**: Analyze 100% of holders, identify all possible connections
- **Performance**: <2s response time, <5min data freshness
- **Reliability**: 99.9% uptime, graceful error handling

---

## 📋 **Implementation Checklist**

### **Phase 1 - Core Functionality**
- [ ] Set up blockchain data ingestion pipeline
- [ ] Implement transaction history analysis for MISTER token
- [ ] Build graph analysis algorithms for connection detection
- [ ] Create enhanced wallet network endpoint
- [ ] Implement caching layer with Redis
- [ ] Add comprehensive error handling and logging

### **Phase 2 - Advanced Analysis**
- [ ] Implement timing correlation detection algorithms
- [ ] Add manipulation pattern recognition
- [ ] Build risk scoring system
- [ ] Create real-time update mechanisms
- [ ] Add WebSocket support for live updates

### **Phase 3 - Production Ready**
- [ ] Implement rate limiting and security measures
- [ ] Add comprehensive monitoring and alerting
- [ ] Create API documentation and examples
- [ ] Set up automated testing and CI/CD
- [ ] Deploy to production environment

---

## 🔍 **Detailed Algorithm Specifications**

### **Transaction Flow Detection Algorithm:**
```python
def detect_transaction_flows(holders, time_range):
    """
    Analyze blockchain transactions to identify money flows between holders

    Args:
        holders: List of wallet addresses to analyze
        time_range: Time window for analysis (e.g., '30d')

    Returns:
        connections: List of transaction relationships with strength scores
    """

    # 1. Query blockchain for all transactions between holder addresses
    transactions = get_transactions_between_addresses(holders, time_range)

    # 2. Build transaction graph
    graph = build_transaction_graph(transactions)

    # 3. Calculate connection strengths based on:
    #    - Transaction frequency
    #    - Total volume
    #    - Timing patterns
    #    - Amount similarities

    # 4. Identify suspicious patterns:
    #    - Circular flows (A→B→C→A)
    #    - Hub patterns (many→one)
    #    - Coordinated timing
    #    - Round number amounts

    return analyze_connections(graph)
```

### **Risk Scoring Algorithm:**
```python
def calculate_risk_score(wallet, connections, transactions):
    """
    Calculate risk score based on multiple factors

    Factors:
    - Transaction frequency (higher = more risk)
    - Timing correlations (coordinated = high risk)
    - Amount patterns (round numbers = suspicious)
    - Network centrality (hub wallets = higher risk)
    - Historical behavior patterns
    """

    risk_factors = {
        'frequency_risk': analyze_transaction_frequency(transactions),
        'timing_risk': detect_timing_correlations(transactions),
        'amount_risk': analyze_amount_patterns(transactions),
        'network_risk': calculate_network_centrality(wallet, connections),
        'behavior_risk': analyze_historical_patterns(wallet)
    }

    # Weighted risk calculation
    weights = {
        'frequency_risk': 0.2,
        'timing_risk': 0.3,
        'amount_risk': 0.2,
        'network_risk': 0.2,
        'behavior_risk': 0.1
    }

    total_risk = sum(risk_factors[factor] * weights[factor]
                    for factor in risk_factors)

    return min(total_risk, 1.0)  # Cap at 1.0
```

---

## 🚨 **Critical Success Factors**

1. **Data Accuracy**: Transaction analysis must be 100% accurate - false positives damage trust
2. **Performance**: Sub-2-second response times are non-negotiable for user experience
3. **Real-time Updates**: Stale data (>5 minutes old) makes risk analysis ineffective
4. **Scalability**: Must handle analysis of 1000+ holders as token adoption grows
5. **Security**: API must be protected against abuse and data scraping

---

## 📈 **Success Metrics**

### **Technical Metrics:**
- API response time: <2 seconds (target: <1 second)
- Data freshness: <5 minutes (target: <2 minutes)
- Uptime: >99.9% (target: 99.99%)
- Error rate: <0.1% (target: <0.01%)

### **Business Metrics:**
- User engagement: Increased time spent on network visualization
- Risk detection: Number of manipulation patterns identified
- Community trust: Reduced complaints about suspicious activity
- Platform adoption: Increased usage of wallet connection features

This specification provides everything needed for the MISTER API developer to implement comprehensive transaction flow analysis and manipulation detection for our wallet network visualization.
