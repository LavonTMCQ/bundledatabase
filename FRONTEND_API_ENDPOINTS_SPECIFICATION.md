# 📡 MISTER Frontend API Endpoints - Technical Specification

## Base URLs
- **Risk API**: `https://risk-api-production.up.railway.app`
- **Token API**: `https://token-api-production.up.railway.app`
- **Future Visualization API**: `https://visualization-api-production.up.railway.app`

---

## 🔍 **Risk Analysis API - Frontend Endpoints**

### **1. Token Distribution Analysis**
```http
GET /api/frontend/tokens/distribution/{policyId}
```

**Parameters:**
- `policyId` (required): Token policy ID
- `includeHandles` (optional): Include ADA handles (default: true)
- `limit` (optional): Number of top holders (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenInfo": {
      "policyId": "string",
      "ticker": "string",
      "name": "string",
      "totalSupply": "number",
      "circulatingSupply": "number",
      "riskScore": "number"
    },
    "holders": [
      {
        "rank": "number",
        "stakeAddress": "string",
        "address": "string",
        "adaHandle": "string|null",
        "amount": "number",
        "percentage": "number",
        "isPool": "boolean",
        "isExchange": "boolean",
        "isBurnWallet": "boolean"
      }
    ],
    "distribution": {
      "top10Percentage": "number",
      "top20Percentage": "number",
      "top50Percentage": "number",
      "giniCoefficient": "number",
      "concentrationRisk": "string"
    },
    "chartData": {
      "pieChart": [
        {
          "label": "string",
          "value": "number",
          "color": "string",
          "count": "number"
        }
      ],
      "barChart": [
        {
          "range": "string",
          "count": "number",
          "percentage": "number"
        }
      ]
    }
  }
}
```

### **2. Risk Analytics Dashboard**
```http
GET /api/frontend/analytics/risk-distribution
```

**Parameters:**
- `timeframe` (optional): 24h, 7d, 30d, 90d (default: 30d)
- `category` (optional): Filter by token category

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalTokens": "number",
      "averageRiskScore": "number",
      "safeTokens": "number",
      "riskyTokens": "number",
      "lastUpdated": "string"
    },
    "riskDistribution": {
      "safe": { "count": "number", "percentage": "number" },
      "moderate": { "count": "number", "percentage": "number" },
      "risky": { "count": "number", "percentage": "number" }
    },
    "trendData": [
      {
        "date": "string",
        "avgRiskScore": "number",
        "tokenCount": "number",
        "safeCount": "number",
        "riskyCount": "number"
      }
    ],
    "topRiskyTokens": [
      {
        "ticker": "string",
        "policyId": "string",
        "riskScore": "number",
        "reason": "string",
        "lastAnalyzed": "string"
      }
    ]
  }
}
```

### **3. Market Health Overview**
```http
GET /api/frontend/analytics/market-health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "healthScore": "number",
    "status": "string",
    "indicators": {
      "averageRisk": "number",
      "newTokenRisk": "number",
      "concentrationTrend": "string",
      "alertFrequency": "number"
    },
    "trends": {
      "riskTrend": "string",
      "volumeTrend": "string",
      "newTokensTrend": "string"
    },
    "alerts": [
      {
        "type": "string",
        "message": "string",
        "severity": "string",
        "timestamp": "string"
      }
    ]
  }
}
```

### **4. Live Monitoring Status**
```http
GET /api/frontend/live/monitoring-status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "string",
    "isRunning": "boolean",
    "lastCheck": "string",
    "nextCheck": "string",
    "tokensMonitored": "number",
    "alertsTriggered": "number",
    "uptime": "number",
    "performance": {
      "avgAnalysisTime": "number",
      "successRate": "number",
      "errorRate": "number"
    },
    "recentActivity": [
      {
        "action": "string",
        "ticker": "string",
        "timestamp": "string",
        "result": "string"
      }
    ]
  }
}
```

---

## 🗄️ **Token Database API - Frontend Endpoints**

### **1. Advanced Token Search**
```http
GET /api/frontend/search/tokens
```

**Parameters:**
- `q` (required): Search query
- `riskMin` (optional): Minimum risk score (0-10)
- `riskMax` (optional): Maximum risk score (0-10)
- `volumeMin` (optional): Minimum 24h volume
- `marketCapMin` (optional): Minimum market cap
- `hasHandle` (optional): Filter tokens with ADA handles
- `category` (optional): Token category
- `sortBy` (optional): volume, risk, marketCap, name
- `order` (optional): asc, desc
- `limit` (optional): Results per page (default: 20)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "policyId": "string",
        "ticker": "string",
        "name": "string",
        "riskScore": "number",
        "volume24h": "number",
        "marketCap": "number",
        "price": "number",
        "holders": "number",
        "lastAnalyzed": "string",
        "socialLinks": {
          "website": "string",
          "twitter": "string",
          "discord": "string"
        }
      }
    ],
    "pagination": {
      "total": "number",
      "page": "number",
      "limit": "number",
      "hasNext": "boolean",
      "hasPrev": "boolean"
    },
    "filters": {
      "appliedFilters": "object",
      "availableCategories": "array",
      "riskRange": { "min": "number", "max": "number" }
    }
  }
}
```

### **2. Token Comparison**
```http
POST /api/frontend/compare/tokens
```

**Request Body:**
```json
{
  "tokens": [
    { "policyId": "string", "ticker": "string" },
    { "policyId": "string", "ticker": "string" }
  ],
  "metrics": ["risk", "holders", "volume", "distribution"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "token": {
          "policyId": "string",
          "ticker": "string",
          "name": "string"
        },
        "metrics": {
          "riskScore": "number",
          "holderCount": "number",
          "volume24h": "number",
          "topHolderPercentage": "number",
          "concentrationRisk": "string"
        },
        "ranking": {
          "riskRank": "number",
          "volumeRank": "number",
          "safetyRank": "number"
        }
      }
    ],
    "summary": {
      "safestToken": "string",
      "riskiestToken": "string",
      "highestVolume": "string",
      "bestDistribution": "string"
    }
  }
}
```

### **3. Portfolio Analysis**
```http
POST /api/frontend/portfolio/analyze
```

**Request Body:**
```json
{
  "tokens": [
    {
      "policyId": "string",
      "ticker": "string",
      "allocation": "number"
    }
  ],
  "totalValue": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioRisk": "number",
    "riskLevel": "string",
    "diversificationScore": "number",
    "recommendations": [
      {
        "type": "string",
        "message": "string",
        "priority": "string"
      }
    ],
    "breakdown": [
      {
        "ticker": "string",
        "allocation": "number",
        "riskContribution": "number",
        "recommendation": "string"
      }
    ],
    "riskDistribution": {
      "safe": "number",
      "moderate": "number",
      "risky": "number"
    }
  }
}
```

---

## 📊 **Visualization Data Endpoints**

### **1. Network Graph Data**
```http
GET /api/frontend/network/{policyId}
```

**Parameters:**
- `policyId` (required): Token policy ID
- `depth` (optional): Network depth (1-3, default: 2)
- `minConnection` (optional): Minimum connection strength

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "string",
        "label": "string",
        "type": "string",
        "size": "number",
        "color": "string",
        "x": "number",
        "y": "number",
        "properties": {
          "percentage": "number",
          "amount": "number",
          "riskLevel": "string",
          "adaHandle": "string"
        }
      }
    ],
    "edges": [
      {
        "id": "string",
        "source": "string",
        "target": "string",
        "weight": "number",
        "type": "string",
        "color": "string",
        "properties": {
          "transactionCount": "number",
          "volume": "number",
          "suspiciousActivity": "boolean"
        }
      }
    ],
    "clusters": [
      {
        "id": "string",
        "nodes": ["string"],
        "totalPercentage": "number",
        "riskScore": "number",
        "center": { "x": "number", "y": "number" }
      }
    ],
    "statistics": {
      "totalNodes": "number",
      "totalEdges": "number",
      "clusterCount": "number",
      "networkDensity": "number"
    }
  }
}
```

### **2. Time Series Data**
```http
GET /api/frontend/timeseries/{policyId}
```

**Parameters:**
- `metric` (required): risk, volume, holders, price
- `timeframe` (required): 1h, 24h, 7d, 30d, 90d
- `interval` (optional): 1m, 5m, 1h, 1d

**Response:**
```json
{
  "success": true,
  "data": {
    "metric": "string",
    "timeframe": "string",
    "interval": "string",
    "series": [
      {
        "timestamp": "string",
        "value": "number",
        "volume": "number",
        "change": "number"
      }
    ],
    "statistics": {
      "min": "number",
      "max": "number",
      "average": "number",
      "trend": "string",
      "volatility": "number"
    }
  }
}
```

---

## 🔄 **Real-time WebSocket API**

### **Connection**
```javascript
wss://risk-api-production.up.railway.app/api/frontend/ws/live-updates
```

### **Message Types**

**1. Subscribe to Updates**
```json
{
  "type": "subscribe",
  "channels": ["monitoring", "alerts", "analysis"],
  "filters": {
    "riskThreshold": 7,
    "tokens": ["SNEK", "MISTER"]
  }
}
```

**2. New Analysis Update**
```json
{
  "type": "new_analysis",
  "timestamp": "string",
  "data": {
    "ticker": "string",
    "policyId": "string",
    "riskScore": "number",
    "verdict": "string",
    "change": "number"
  }
}
```

**3. Risk Alert**
```json
{
  "type": "risk_alert",
  "timestamp": "string",
  "data": {
    "ticker": "string",
    "alertType": "string",
    "severity": "string",
    "message": "string",
    "oldRisk": "number",
    "newRisk": "number"
  }
}
```

---

## 🔐 **Authentication & Rate Limiting**

### **API Keys (Optional)**
```http
Authorization: Bearer YOUR_API_KEY
```

### **Rate Limits**
- **Public endpoints**: 100 requests/minute
- **Authenticated**: 1000 requests/minute
- **WebSocket**: 10 connections per IP

### **CORS Configuration**
```javascript
// Allowed origins for frontend
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

This specification provides everything your frontend team needs to integrate with the MISTER system for rich data visualizations and interactive dashboards.
