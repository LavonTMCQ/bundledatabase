# 🎨 MISTER Frontend API Integration Guide

## Overview

This document outlines how to enhance the current MISTER system to serve both your existing agent and new frontend visualization applications. The system will provide comprehensive API endpoints for data visualization, analytics, and interactive dashboards.

---

## 🏗️ **Current Architecture vs Enhanced Architecture**

### **Current Setup (Agent-Focused)**
```
Agent → Risk API (Port 4000) → PostgreSQL
Agent → Token API (Port 3456) → PostgreSQL
Auto-Monitor → Background Processing
Discord Bot → User Interface
```

### **Enhanced Setup (Agent + Frontend)**
```
Agent → Risk API → PostgreSQL
Frontend → Risk API → Data Visualization
Frontend → Token API → Search & Analytics
Frontend → Visualization API → Chart Data
Frontend → Real-time API → Live Updates
Auto-Monitor → Background Processing
Discord Bot → User Interface
```

---

## 📊 **Frontend API Requirements**

### **1. Data Visualization Endpoints**
- Token holder distribution charts
- Risk score analytics
- Market trend visualizations
- Wallet network graphs
- Portfolio analysis dashboards

### **2. Real-time Data Feeds**
- Live token monitoring updates
- Risk score changes
- New token alerts
- Market activity streams

### **3. Interactive Analytics**
- Custom date range queries
- Filtered token searches
- Comparative analysis
- Historical trend data

---

## 🔧 **API Enhancement Plan**

### **Phase 1: Extend Existing APIs**

#### **Risk API Enhancements** (`https://risk-api-production.up.railway.app`)

**New Endpoints for Frontend:**

```javascript
// Visualization Data
GET /api/frontend/tokens/distribution/{policyId}
GET /api/frontend/tokens/risk-analytics
GET /api/frontend/tokens/market-trends
GET /api/frontend/holders/network/{policyId}
GET /api/frontend/portfolio/analysis

// Real-time Data
GET /api/frontend/live/monitoring-status
GET /api/frontend/live/recent-analyses
GET /api/frontend/live/risk-alerts
WebSocket /api/frontend/ws/live-updates

// Analytics & Reporting
GET /api/frontend/analytics/risk-distribution
GET /api/frontend/analytics/market-health
GET /api/frontend/analytics/top-tokens
GET /api/frontend/reports/daily-summary
GET /api/frontend/reports/risk-trends
```

#### **Token API Enhancements** (`https://token-api-production.up.railway.app`)

**New Endpoints for Frontend:**

```javascript
// Search & Discovery
GET /api/frontend/search/tokens?q={query}&filters={filters}
GET /api/frontend/search/advanced?criteria={criteria}
GET /api/frontend/tokens/trending
GET /api/frontend/tokens/categories

// Data Export
GET /api/frontend/export/tokens?format={json|csv}
GET /api/frontend/export/holders/{policyId}
GET /api/frontend/export/analytics/{timeframe}

// Batch Operations
POST /api/frontend/batch/analyze
POST /api/frontend/batch/compare
GET /api/frontend/batch/status/{batchId}
```

### **Phase 2: New Visualization API**

**Create dedicated Visualization API service:**

```javascript
// Base URL: https://visualization-api-production.up.railway.app

// Chart Data
GET /api/charts/pie/{policyId}/holders
GET /api/charts/bar/{policyId}/distribution
GET /api/charts/line/risk-trends?timeframe={period}
GET /api/charts/scatter/risk-vs-volume
GET /api/charts/bubble/market-overview

// Network Graphs
GET /api/graphs/wallet-connections/{policyId}
GET /api/graphs/stake-clusters/{policyId}
GET /api/graphs/transaction-flow/{address}

// Dashboard Data
GET /api/dashboard/overview
GET /api/dashboard/portfolio/{userId}
GET /api/dashboard/market-health
GET /api/dashboard/alerts
```

---

## 📋 **Detailed API Specifications**

### **1. Token Distribution Visualization**

```javascript
// Endpoint: GET /api/frontend/tokens/distribution/{policyId}
// Purpose: Get holder distribution data for pie/bar charts

Response Format:
{
  "success": true,
  "data": {
    "tokenInfo": {
      "policyId": "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f",
      "ticker": "SNEK",
      "name": "Snek Token",
      "totalSupply": 76800000000,
      "circulatingSupply": 76800000000
    },
    "distribution": {
      "topHolders": [
        {
          "rank": 1,
          "address": "addr1...",
          "adaHandle": "$snek_treasury",
          "amount": 7680000000,
          "percentage": 10.0,
          "isPool": false,
          "isExchange": false
        }
      ],
      "summary": {
        "top10Percentage": 45.2,
        "top20Percentage": 62.8,
        "top50Percentage": 78.5,
        "giniCoefficient": 0.72,
        "concentrationRisk": "Medium"
      }
    },
    "chartData": {
      "pieChart": [
        { "label": "$snek_treasury", "value": 10.0, "color": "#ff6b6b" },
        { "label": "Top 2-10", "value": 35.2, "color": "#4ecdc4" },
        { "label": "Top 11-50", "value": 33.3, "color": "#45b7d1" },
        { "label": "Others", "value": 21.5, "color": "#96ceb4" }
      ]
    }
  }
}
```

### **2. Risk Analytics Dashboard**

```javascript
// Endpoint: GET /api/frontend/analytics/risk-distribution
// Purpose: Get risk score distribution across all analyzed tokens

Response Format:
{
  "success": true,
  "data": {
    "overview": {
      "totalTokens": 1247,
      "averageRiskScore": 4.2,
      "lastUpdated": "2025-06-07T18:30:00Z"
    },
    "riskDistribution": {
      "safe": { "count": 312, "percentage": 25.0, "range": "0-3" },
      "moderate": { "count": 498, "percentage": 39.9, "range": "4-6" },
      "risky": { "count": 437, "percentage": 35.1, "range": "7-10" }
    },
    "trendData": [
      { "date": "2025-06-01", "avgRisk": 4.1, "tokenCount": 1200 },
      { "date": "2025-06-07", "avgRisk": 4.2, "tokenCount": 1247 }
    ],
    "topRiskyTokens": [
      {
        "ticker": "SCAM",
        "riskScore": 9.8,
        "reason": "Extreme holder concentration",
        "policyId": "abc123..."
      }
    ]
  }
}
```

### **3. Real-time Monitoring Feed**

```javascript
// WebSocket: wss://risk-api-production.up.railway.app/api/frontend/ws/live-updates
// Purpose: Real-time updates for frontend dashboards

Message Types:
{
  "type": "new_analysis",
  "data": {
    "ticker": "NEWTOKEN",
    "riskScore": 6.5,
    "verdict": "CAUTION",
    "timestamp": "2025-06-07T18:35:00Z"
  }
}

{
  "type": "risk_alert",
  "data": {
    "ticker": "DANGER",
    "oldRisk": 4.2,
    "newRisk": 8.1,
    "reason": "Sudden holder concentration increase",
    "timestamp": "2025-06-07T18:36:00Z"
  }
}

{
  "type": "monitoring_update",
  "data": {
    "tokensProcessed": 1247,
    "newTokensFound": 5,
    "alertsTriggered": 2,
    "timestamp": "2025-06-07T18:37:00Z"
  }
}
```

### **4. Network Visualization Data**

```javascript
// Endpoint: GET /api/graphs/wallet-connections/{policyId}
// Purpose: Get wallet network data for graph visualizations

Response Format:
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "stake1u9...",
        "type": "stake_address",
        "label": "$whale_wallet",
        "size": 15.2,
        "color": "#ff6b6b",
        "properties": {
          "percentage": 15.2,
          "amount": 11776000000,
          "isPool": false,
          "riskLevel": "high"
        }
      }
    ],
    "edges": [
      {
        "source": "stake1u9...",
        "target": "stake1ux...",
        "weight": 0.8,
        "type": "transaction_flow",
        "properties": {
          "transactionCount": 45,
          "totalVolume": 2500000,
          "suspiciousActivity": true
        }
      }
    ],
    "clusters": [
      {
        "id": "cluster_1",
        "nodes": ["stake1u9...", "stake1ux..."],
        "totalPercentage": 28.7,
        "riskScore": 8.2,
        "suspiciousPatterns": ["coordinated_trading", "wash_trading"]
      }
    ]
  }
}
```

---

## 🔌 **Frontend Integration Examples**

### **React/Next.js Integration**

```javascript
// Frontend API Client
class MisterApiClient {
  constructor() {
    this.baseUrl = 'https://risk-api-production.up.railway.app';
    this.tokenApiUrl = 'https://token-api-production.up.railway.app';
  }

  // Get token distribution for charts
  async getTokenDistribution(policyId) {
    const response = await fetch(`${this.baseUrl}/api/frontend/tokens/distribution/${policyId}`);
    return response.json();
  }

  // Get risk analytics for dashboard
  async getRiskAnalytics() {
    const response = await fetch(`${this.baseUrl}/api/frontend/analytics/risk-distribution`);
    return response.json();
  }

  // Search tokens with filters
  async searchTokens(query, filters = {}) {
    const params = new URLSearchParams({ q: query, ...filters });
    const response = await fetch(`${this.tokenApiUrl}/api/frontend/search/tokens?${params}`);
    return response.json();
  }

  // Real-time updates via WebSocket
  connectToLiveUpdates(onMessage) {
    const ws = new WebSocket(`wss://risk-api-production.up.railway.app/api/frontend/ws/live-updates`);
    ws.onmessage = (event) => onMessage(JSON.parse(event.data));
    return ws;
  }
}
```

### **Chart.js Integration Example**

```javascript
// Pie Chart for Token Distribution
async function createDistributionChart(policyId) {
  const client = new MisterApiClient();
  const data = await client.getTokenDistribution(policyId);
  
  const ctx = document.getElementById('distributionChart').getContext('2d');
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.data.chartData.pieChart.map(item => item.label),
      datasets: [{
        data: data.data.chartData.pieChart.map(item => item.value),
        backgroundColor: data.data.chartData.pieChart.map(item => item.color)
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${data.data.tokenInfo.ticker} Holder Distribution`
        }
      }
    }
  });
}
```

---

## 🚀 **Implementation Roadmap**

### **Week 1: API Extensions**
- [ ] Add frontend endpoints to Risk API
- [ ] Add search and export endpoints to Token API
- [ ] Implement CORS for frontend access
- [ ] Add rate limiting for public endpoints

### **Week 2: Visualization API**
- [ ] Create new Visualization API service
- [ ] Implement chart data endpoints
- [ ] Add network graph data endpoints
- [ ] Deploy to Railway

### **Week 3: Real-time Features**
- [ ] Implement WebSocket connections
- [ ] Add live monitoring feeds
- [ ] Create alert system for frontend
- [ ] Add caching for performance

### **Week 4: Documentation & Testing**
- [ ] Complete API documentation
- [ ] Create frontend SDK/client library
- [ ] Add example implementations
- [ ] Performance testing and optimization

---

## 📚 **Next Steps**

1. **Review current API capabilities** and identify gaps
2. **Design frontend mockups** to understand data requirements
3. **Implement Phase 1 enhancements** to existing APIs
4. **Create Visualization API service** for complex chart data
5. **Add real-time WebSocket connections** for live updates
6. **Develop frontend SDK** for easy integration
7. **Deploy and test** all enhancements on Railway

This architecture will allow your frontend to create rich, interactive visualizations while maintaining full compatibility with your existing agent system.
