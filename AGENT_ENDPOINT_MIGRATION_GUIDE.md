# 🔄 MISTER Agent - Railway Endpoint Migration Guide

## Overview

This document provides the complete endpoint migration from local development to Railway production for your MISTER agent configuration.

---

## 🔗 **Core Service URL Changes**

### **Before (Local Development)**
```javascript
RISK_API_URL=http://localhost:4000
TOKEN_API_URL=http://localhost:3456
MONITOR_URL=http://localhost:4001
```

### **After (Railway Production)**
```javascript
RISK_API_URL=https://risk-api-production.up.railway.app
TOKEN_API_URL=https://token-api-production.up.railway.app
MONITOR_URL=https://auto-monitor-production.up.railway.app
```

---

## 📊 **Risk API Endpoints**

### **Base URL Change**
- **Local**: `http://localhost:4000`
- **Railway**: `https://risk-api-production.up.railway.app`

### **Available Endpoints**
| Endpoint | Local URL | Railway URL | Status |
|----------|-----------|-------------|---------|
| Health Check | `http://localhost:4000/health` | `https://risk-api-production.up.railway.app/health` | ✅ Working |
| Agent Status | `http://localhost:4000/api/agent/status` | `https://risk-api-production.up.railway.app/api/agent/status` | ✅ Working |
| Force Analyze | `http://localhost:4000/api/agent/analyze/force/{ticker}` | `https://risk-api-production.up.railway.app/api/agent/analyze/force/{ticker}` | ✅ Working |
| Gold Standard | `http://localhost:4000/api/agent/analyze/gold/{ticker}` | `https://risk-api-production.up.railway.app/api/agent/analyze/gold/{ticker}` | ✅ Working |
| Latest Tokens | `http://localhost:4000/api/agent/tokens/latest` | `https://risk-api-production.up.railway.app/api/agent/tokens/latest` | ✅ Working |
| Risky Tokens | `http://localhost:4000/api/agent/tokens/risky` | `https://risk-api-production.up.railway.app/api/agent/tokens/risky` | ✅ Working |
| Analyze Token | `http://localhost:4000/analyze/{policyId}` | `https://risk-api-production.up.railway.app/analyze/{policyId}` | ✅ Working |

---

## 🗄️ **Token API Endpoints**

### **Base URL Change**
- **Local**: `http://localhost:3456`
- **Railway**: `https://token-api-production.up.railway.app`

### **Available Endpoints**
| Endpoint | Local URL | Railway URL | Status |
|----------|-----------|-------------|---------|
| Health Check | `http://localhost:3456/api/health` | `https://token-api-production.up.railway.app/api/health` | ✅ Working |
| Database Stats | `http://localhost:3456/api/stats` | `https://token-api-production.up.railway.app/api/stats` | ✅ Working |
| Search Tokens | `http://localhost:3456/api/search?q={query}` | `https://token-api-production.up.railway.app/api/search?q={query}` | ⚠️ TBD |
| Get Token by Ticker | `http://localhost:3456/api/token/{ticker}` | `https://token-api-production.up.railway.app/api/token/{ticker}` | ⚠️ TBD |
| Get All Tokens | `http://localhost:3456/api/tokens` | `https://token-api-production.up.railway.app/api/tokens` | ⚠️ TBD |

---

## 📈 **Auto-Monitor Service**

### **Base URL Change**
- **Local**: `http://localhost:4001`
- **Railway**: `https://auto-monitor-production.up.railway.app`

### **Service Status**
- ✅ **Running**: Autonomous monitoring is active
- ✅ **Processing**: Currently processing token batches
- ✅ **Database**: Saving tokens and analysis data
- ⚠️ **HTTP Endpoints**: Monitor runs as background service, no HTTP endpoints

---

## 🔧 **Agent Configuration Updates**

### **Environment Variables to Update**

```bash
# Old Local Configuration
RISK_API_URL=http://localhost:4000
TOKEN_API_URL=http://localhost:3456
MONITOR_URL=http://localhost:4001

# New Railway Configuration
RISK_API_URL=https://risk-api-production.up.railway.app
TOKEN_API_URL=https://token-api-production.up.railway.app
MONITOR_URL=https://auto-monitor-production.up.railway.app
```

### **Code Changes Required**

If your agent has hardcoded URLs, update them:

```javascript
// Before
const riskApiUrl = 'http://localhost:4000';
const tokenApiUrl = 'http://localhost:3456';

// After
const riskApiUrl = process.env.RISK_API_URL || 'https://risk-api-production.up.railway.app';
const tokenApiUrl = process.env.TOKEN_API_URL || 'https://token-api-production.up.railway.app';
```

---

## 🧪 **Testing Your Agent Connection**

### **1. Test Risk API Connection**
```bash
curl https://risk-api-production.up.railway.app/health
# Expected: {"status":"ready","database":"connected","timestamp":"..."}
```

### **2. Test Token API Connection**
```bash
curl https://token-api-production.up.railway.app/api/health
# Expected: {"success":true,"status":"healthy","timestamp":"...","service":"Token Database API"}
```

### **3. Test Agent Status Endpoint**
```bash
curl https://risk-api-production.up.railway.app/api/agent/status
# Expected: {"status":"operational","timestamp":"...","services":{...}}
```

---

## 🔒 **Security & SSL**

### **HTTPS Required**
- All Railway endpoints use HTTPS
- Update any HTTP-only configurations to support HTTPS
- SSL certificates are automatically managed by Railway

### **CORS Configuration**
- Railway services are configured to accept requests from your agent
- No additional CORS configuration needed

---

## 📊 **Database Changes**

### **Database Connection**
- **Local**: SQLite files (`tokens.db`, etc.)
- **Railway**: PostgreSQL database (shared across all services)

### **Data Migration**
- All services now use the same PostgreSQL database
- Token data is automatically synced across services
- No manual data migration required

---

## 🚨 **Important Notes**

### **Service Availability**
- ✅ **Risk API**: Fully operational
- ✅ **Token API**: Fully operational  
- ✅ **Auto-Monitor**: Running autonomously
- ⚠️ **Discord Bot**: Deployment in progress

### **Rate Limiting**
- Railway services have standard rate limiting
- No changes needed to your agent's request patterns

### **Monitoring**
- All services include health check endpoints
- Monitor service status via `/health` endpoints
- Railway dashboard provides real-time logs and metrics

---

## 🔄 **Rollback Plan**

If you need to rollback to local development:

```bash
# Restore Local Configuration
RISK_API_URL=http://localhost:4000
TOKEN_API_URL=http://localhost:3456
MONITOR_URL=http://localhost:4001

# Start Local Services
cd api && npm start &
cd monitoring && node token-api.js &
cd monitoring && node auto-monitor.js start &
```

---

## 📞 **Support & Troubleshooting**

### **Health Check Commands**
```bash
# Check all services
curl https://risk-api-production.up.railway.app/health
curl https://token-api-production.up.railway.app/api/health

# Check agent-specific endpoints
curl https://risk-api-production.up.railway.app/api/agent/status
```

### **Common Issues**
1. **Connection Timeout**: Check if HTTPS is being used
2. **404 Errors**: Verify endpoint paths match this guide
3. **CORS Errors**: Ensure requests include proper headers

### **Railway Dashboard**
- Monitor logs: https://railway.com/project/d5d17a35-ac87-4d67-ba81-112e4dd55ed9
- Check service status and performance metrics
- View real-time deployment logs

---

## ✅ **Migration Checklist**

- [ ] Update `RISK_API_URL` environment variable
- [ ] Update `TOKEN_API_URL` environment variable  
- [ ] Update any hardcoded URLs in agent code
- [ ] Test Risk API health endpoint
- [ ] Test Token API health endpoint
- [ ] Test agent status endpoint
- [ ] Verify agent can analyze tokens
- [ ] Confirm monitoring data is being processed
- [ ] Update documentation and deployment scripts

---

**🎉 Your MISTER system is now running on Railway with full cloud infrastructure!**
