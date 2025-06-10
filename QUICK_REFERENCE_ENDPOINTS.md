# 🚀 MISTER Agent - Quick Reference: Railway Endpoints

## 🔗 **Primary URLs for Agent Configuration**

```bash
# Core Service URLs
RISK_API_URL=https://risk-api-production.up.railway.app
TOKEN_API_URL=https://token-api-production.up.railway.app
```

---

## ⚡ **Most Used Endpoints**

### **Risk Analysis**
```bash
# Health Check
GET https://risk-api-production.up.railway.app/health

# Agent Status
GET https://risk-api-production.up.railway.app/api/agent/status

# Force Analyze Token
POST https://risk-api-production.up.railway.app/api/agent/analyze/force/{ticker}

# Gold Standard Analysis
POST https://risk-api-production.up.railway.app/api/agent/analyze/gold/{ticker}

# Get Latest Tokens
GET https://risk-api-production.up.railway.app/api/agent/tokens/latest

# Get Risky Tokens
GET https://risk-api-production.up.railway.app/api/agent/tokens/risky
```

### **Token Database**
```bash
# Health Check
GET https://token-api-production.up.railway.app/api/health

# Database Stats
GET https://token-api-production.up.railway.app/api/stats
```

---

## 🧪 **Quick Test Commands**

```bash
# Test Risk API
curl https://risk-api-production.up.railway.app/health

# Test Token API
curl https://token-api-production.up.railway.app/api/health

# Test Agent Status
curl https://risk-api-production.up.railway.app/api/agent/status
```

---

## 📋 **Environment Variables**

```bash
# Add these to your agent configuration:
RISK_API_URL=https://risk-api-production.up.railway.app
TOKEN_API_URL=https://token-api-production.up.railway.app
NODE_ENV=production
```

---

## ✅ **Service Status**

- ✅ **Risk API**: Fully operational
- ✅ **Token API**: Fully operational
- ✅ **Auto-Monitor**: Running autonomously
- ✅ **Database**: PostgreSQL connected
- ⚠️ **Discord Bot**: In progress

---

**🎯 Your agent is ready to connect to Railway!**
