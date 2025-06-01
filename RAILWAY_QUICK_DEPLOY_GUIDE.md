# ⚡ MISTER Risk System - Railway Quick Deploy Guide

## 🚀 **FASTEST PATH TO PRODUCTION**

### **Step 1: Run Setup Script** (2 minutes)
```bash
./railway-deploy-setup.sh
```
This creates all Railway configuration files automatically.

### **Step 2: Create Railway Services** (10 minutes)

#### **A. PostgreSQL Database**
1. Create new PostgreSQL service in Railway
2. Copy the `DATABASE_URL` from Railway dashboard
3. Run the SQL from `railway-database-schema.sql` in Railway console

#### **B. Risk API Service**
1. Create new service → Connect GitHub repo
2. Set **Root Directory**: `/api`
3. Add environment variables from `.env.railway.template`
4. Deploy automatically triggers

#### **C. Token API Service**  
1. Create new service → Connect GitHub repo
2. Set **Root Directory**: `/monitoring`
3. Set **Start Command**: `node token-api.js`
4. Add environment variables
5. Deploy

#### **D. Auto-Monitor Service**
1. Create new service → Connect GitHub repo  
2. Set **Root Directory**: `/monitoring`
3. Set **Start Command**: `node auto-monitor.js start`
4. Add environment variables (update API URLs to Railway URLs)
5. Deploy

#### **E. Discord Bot Service**
1. Create new service → Connect GitHub repo
2. Set **Root Directory**: `/discord-bot`  
3. Set **Start Command**: `node bot-simple.js`
4. Add environment variables (update API URLs to Railway URLs)
5. Deploy

### **Step 3: Update Inter-Service URLs** (5 minutes)

Once services are deployed, update these environment variables with actual Railway URLs:

```bash
# In Auto-Monitor and Discord Bot services:
RISK_API_URL=https://your-actual-risk-api.railway.app
TOKEN_API_URL=https://your-actual-token-api.railway.app
```

### **Step 4: Verify Deployment** (2 minutes)
```bash
# Update URLs in the script first, then run:
./verify-railway-deployment.sh
```

### **Step 5: Update Mastra Agent** (1 minute)
```javascript
// Update your Mastra agent endpoints:
const PRODUCTION_ENDPOINTS = {
  riskApi: 'https://your-risk-api.railway.app',
  tokenApi: 'https://your-token-api.railway.app',
  monitor: 'https://your-monitor.railway.app'
};
```

---

## 🎯 **PRODUCTION ENDPOINTS FOR MASTRA AGENT**

Once deployed, your agent will use:

```javascript
// System Status
GET https://your-risk-api.railway.app/api/agent/status

// Force Analysis with Discord
POST https://your-risk-api.railway.app/api/agent/analyze/force/{ticker}
Body: {"postToDiscord": true}

// Gold Standard Analysis  
POST https://your-risk-api.railway.app/api/agent/analyze/gold/{ticker}
Body: {"postToDiscord": true}

// Latest Tokens
GET https://your-risk-api.railway.app/api/agent/tokens/latest?limit=5

// Risky Tokens
GET https://your-risk-api.railway.app/api/agent/tokens/risky?limit=3

// Batch Analysis
POST https://your-risk-api.railway.app/api/agent/analyze/batch
Body: {"tickers": ["SNEK", "MISTER"], "postToDiscord": false}
```

---

## ✅ **DEPLOYMENT CHECKLIST**

- [ ] Run `./railway-deploy-setup.sh`
- [ ] Create PostgreSQL service in Railway
- [ ] Run database schema SQL
- [ ] Deploy Risk API service (port 4000)
- [ ] Deploy Token API service (port 3456)  
- [ ] Deploy Auto-Monitor service (port 4001)
- [ ] Deploy Discord Bot service
- [ ] Update inter-service URLs
- [ ] Run verification script
- [ ] Update Mastra agent endpoints
- [ ] Test Discord bot in server
- [ ] Verify monitoring cycle works

---

## 🔧 **TROUBLESHOOTING**

### **Service Won't Start**
- Check environment variables are set
- Verify DATABASE_URL is correct
- Check Railway logs for errors

### **Services Can't Communicate**
- Ensure API URLs use Railway domains (not localhost)
- Check all services are deployed and running
- Verify environment variables are updated

### **Discord Bot Offline**
- Check DISCORD_BOT_TOKEN is correct
- Verify API URLs point to Railway services
- Check bot has proper permissions in Discord

### **Database Connection Issues**
- Verify DATABASE_URL format
- Check PostgreSQL service is running
- Ensure database schema was created

---

## 🚀 **TOTAL DEPLOYMENT TIME: ~20 MINUTES**

Your MISTER system will be production-ready with:
- ⚡ **5-10x faster performance** with optimizations
- 🤖 **Full Mastra agent integration**
- 📊 **Real-time monitoring** with Discord alerts
- 💾 **Optimized database** with proper indexing
- 🔄 **Auto-scaling** on Railway infrastructure

**Ready to switch your agent to production! 🎯**
