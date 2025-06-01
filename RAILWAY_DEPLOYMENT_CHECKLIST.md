# 🚀 MISTER Risk System - Railway Deployment Checklist

## 📋 PRE-DEPLOYMENT PREPARATION

### **✅ 1. Environment Variables Setup**
Create these environment variables in Railway for each service:

#### **Risk API Service (Port 4000)**
```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database_name

# Blockfrost API
BLOCKFROST_PROJECT_ID=your_blockfrost_mainnet_key

# TapTools API  
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO

# Service Configuration
PORT=4000
NODE_ENV=production
```

#### **Token API Service (Port 3456)**
```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database_name

# TapTools API
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO

# Service Configuration
PORT=3456
NODE_ENV=production
```

#### **Auto-Monitor Service (Port 4001)**
```bash
# Discord Bot
DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA

# API Endpoints
RISK_API_URL=https://your-risk-api.railway.app
TOKEN_API_URL=https://your-token-api.railway.app

# TapTools API
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO

# Database
DATABASE_URL=postgresql://username:password@host:port/database_name

# Service Configuration
PORT=4001
NODE_ENV=production
```

#### **Discord Bot Service**
```bash
# Discord Bot
DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA

# API Endpoints
RISK_API_URL=https://your-risk-api.railway.app
TOKEN_API_URL=https://your-token-api.railway.app

# Service Configuration
NODE_ENV=production
```

---

## 🗄️ DATABASE SETUP

### **✅ 2. PostgreSQL Database on Railway**

1. **Create PostgreSQL Service**:
   - Add PostgreSQL service in Railway
   - Note the connection details
   - Database will auto-generate: `DATABASE_URL`

2. **Initialize Database Schema**:
   ```sql
   -- Run this in Railway PostgreSQL console
   
   -- Token storage table
   CREATE TABLE IF NOT EXISTS tokens (
     id SERIAL PRIMARY KEY,
     unit VARCHAR(120) UNIQUE NOT NULL,
     ticker VARCHAR(50),
     name VARCHAR(100),
     policy_id VARCHAR(56) NOT NULL,
     asset_name_hex VARCHAR(64),
     price DECIMAL(20, 10),
     volume DECIMAL(20, 6),
     mcap DECIMAL(20, 6),
     risk_score INTEGER,
     top_holder_percentage DECIMAL(5, 2),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Create indexes for performance
   CREATE INDEX IF NOT EXISTS idx_tokens_unit ON tokens(unit);
   CREATE INDEX IF NOT EXISTS idx_tokens_ticker ON tokens(ticker);
   CREATE INDEX IF NOT EXISTS idx_tokens_policy_id ON tokens(policy_id);
   CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume);
   CREATE INDEX IF NOT EXISTS idx_tokens_risk_score ON tokens(risk_score);
   CREATE INDEX IF NOT EXISTS idx_tokens_updated_at ON tokens(updated_at);
   ```

3. **Verify Database Connection**:
   - Test connection from Railway console
   - Ensure all tables are created

---

## 🚀 SERVICE DEPLOYMENT

### **✅ 3. Deploy Risk API Service**

1. **Create New Railway Service**:
   - Connect to GitHub repository
   - Set root directory: `/api`
   - Set build command: `npm install && npm run build`
   - Set start command: `npm start`

2. **Configure Environment Variables**:
   - Add all Risk API environment variables
   - Set `PORT=4000`

3. **Update package.json** (if needed):
   ```json
   {
     "scripts": {
       "build": "tsc",
       "start": "node dist/index.js",
       "dev": "ts-node src/index.ts"
     }
   }
   ```

4. **Test Deployment**:
   ```bash
   curl https://your-risk-api.railway.app/health
   curl https://your-risk-api.railway.app/api/agent/status
   ```

### **✅ 4. Deploy Token API Service**

1. **Create New Railway Service**:
   - Connect to GitHub repository  
   - Set root directory: `/monitoring`
   - Set start command: `node token-api.js`

2. **Configure Environment Variables**:
   - Add all Token API environment variables
   - Set `PORT=3456`

3. **Test Deployment**:
   ```bash
   curl https://your-token-api.railway.app/api/health
   curl https://your-token-api.railway.app/api/stats
   ```

### **✅ 5. Deploy Auto-Monitor Service**

1. **Create New Railway Service**:
   - Connect to GitHub repository
   - Set root directory: `/monitoring`
   - Set start command: `node auto-monitor.js start`

2. **Configure Environment Variables**:
   - Add all Auto-Monitor environment variables
   - Set `PORT=4001`
   - Update API URLs to Railway endpoints

3. **Test Deployment**:
   ```bash
   curl https://your-monitor.railway.app/health
   curl https://your-monitor.railway.app/status
   ```

### **✅ 6. Deploy Discord Bot Service**

1. **Create New Railway Service**:
   - Connect to GitHub repository
   - Set root directory: `/discord-bot`
   - Set start command: `node bot-simple.js`

2. **Configure Environment Variables**:
   - Add Discord bot environment variables
   - Update API URLs to Railway endpoints

3. **Verify Bot Connection**:
   - Check Discord server for bot online status
   - Test with `!status` command

---

## 🔧 CONFIGURATION UPDATES

### **✅ 7. Update Inter-Service Communication**

1. **Update Auto-Monitor API Calls**:
   ```javascript
   // In auto-monitor.js, update these URLs:
   const RISK_API_URL = process.env.RISK_API_URL || 'https://your-risk-api.railway.app';
   const TOKEN_API_URL = process.env.TOKEN_API_URL || 'https://your-token-api.railway.app';
   ```

2. **Update Discord Bot API Calls**:
   ```javascript
   // In bot-simple.js, update these URLs:
   const RISK_API_URL = process.env.RISK_API_URL || 'https://your-risk-api.railway.app';
   const TOKEN_API_URL = process.env.TOKEN_API_URL || 'https://your-token-api.railway.app';
   ```

3. **Update Risk API Agent Endpoints**:
   ```javascript
   // In api/src/index.ts, update monitoring service calls:
   const monitorResponse = await fetch('https://your-monitor.railway.app/status');
   ```

### **✅ 8. Database Connection Updates**

1. **Update Connection Strings**:
   ```javascript
   // Use Railway's DATABASE_URL environment variable
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

---

## 🎯 MASTRA AGENT INTEGRATION

### **✅ 9. Update Agent Endpoints**

Once deployed, update your Mastra agent to use production endpoints:

```javascript
// Production endpoints for your Mastra agent
const PRODUCTION_ENDPOINTS = {
  riskApi: 'https://your-risk-api.railway.app',
  tokenApi: 'https://your-token-api.railway.app', 
  monitor: 'https://your-monitor.railway.app'
};

// Agent endpoints to use:
const agentEndpoints = {
  status: `${PRODUCTION_ENDPOINTS.riskApi}/api/agent/status`,
  forceAnalysis: `${PRODUCTION_ENDPOINTS.riskApi}/api/agent/analyze/force/{ticker}`,
  goldStandard: `${PRODUCTION_ENDPOINTS.riskApi}/api/agent/analyze/gold/{ticker}`,
  latestTokens: `${PRODUCTION_ENDPOINTS.riskApi}/api/agent/tokens/latest`,
  riskyTokens: `${PRODUCTION_ENDPOINTS.riskApi}/api/agent/tokens/risky`,
  batchAnalysis: `${PRODUCTION_ENDPOINTS.riskApi}/api/agent/analyze/batch`
};
```

---

## ✅ DEPLOYMENT VERIFICATION

### **✅ 10. System Health Checks**

1. **Test All Services**:
   ```bash
   # Risk API
   curl https://your-risk-api.railway.app/health
   curl https://your-risk-api.railway.app/api/agent/status
   
   # Token API  
   curl https://your-token-api.railway.app/api/health
   
   # Monitor
   curl https://your-monitor.railway.app/health
   curl https://your-monitor.railway.app/status
   ```

2. **Test Agent Endpoints**:
   ```bash
   # Latest tokens
   curl https://your-risk-api.railway.app/api/agent/tokens/latest?limit=3
   
   # Force analysis
   curl -X POST https://your-risk-api.railway.app/api/agent/analyze/force/SNEK \
     -H "Content-Type: application/json" \
     -d '{"postToDiscord": false}'
   ```

3. **Verify Discord Integration**:
   - Check bot is online in Discord
   - Test `!status` command
   - Verify monitoring alerts work

### **✅ 11. Performance Validation**

1. **Check Response Times**:
   - Risk API: < 200ms for cached responses
   - Token API: < 100ms for database queries
   - Monitor: < 50ms for status checks

2. **Verify Caching**:
   - Test same analysis twice
   - Second request should be much faster

3. **Monitor Resource Usage**:
   - Check Railway metrics
   - Ensure no memory leaks
   - Verify database connections

---

## 🎯 FINAL STEPS

### **✅ 12. Production Readiness**

1. **Update Mastra Agent Configuration**:
   - Switch from localhost to Railway URLs
   - Test all agent integrations
   - Verify Discord notifications work

2. **Monitor System Health**:
   - Set up Railway monitoring alerts
   - Monitor API call usage
   - Track database performance

3. **Documentation Update**:
   - Update endpoint URLs in documentation
   - Share production URLs with team
   - Create monitoring dashboard

### **✅ 13. Backup & Recovery**

1. **Database Backups**:
   - Enable Railway automatic backups
   - Test restore procedures

2. **Environment Variables Backup**:
   - Document all environment variables
   - Store securely for disaster recovery

---

## 🚀 DEPLOYMENT COMPLETE!

Once all checkboxes are complete, your MISTER system will be:

- ⚡ **Running on Railway** with full optimization
- 🤖 **Mastra Agent Ready** with production endpoints
- 📊 **Monitoring Active** with Discord integration
- 💾 **Database Optimized** with proper indexing
- 🔄 **Auto-scaling** based on demand

**Your production URLs will be:**
- Risk API: `https://your-risk-api.railway.app`
- Token API: `https://your-token-api.railway.app`
- Monitor: `https://your-monitor.railway.app`

**Ready for production deployment! 🎯**
