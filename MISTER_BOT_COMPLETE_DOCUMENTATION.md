# 🏆 MISTER Risk Analysis Bot - Complete Documentation

## 📋 OVERVIEW
The MISTER Risk Analysis Bot is a comprehensive Cardano token risk analysis system with Discord integration, automated monitoring, and AI-powered analysis capabilities.

## 🚀 CURRENT RUNNING SERVICES & TERMINALS

### **CRITICAL SERVICES TO RESTART AFTER CHAT CHANGE:**

1. **Risk Analysis API** - Port 4000
   ```bash
   cd risk-analysis && node server.js
   ```

2. **Token Database API** - Port 3456
   ```bash
   cd token-api && node server.js
   ```

3. **Discord Bot** - MR. RISK#1169
   ```bash
   cd discord-bot && DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA node bot-simple.js
   ```

4. **Auto-Monitor** - Every 2 hours
   ```bash
   cd monitoring && DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA node auto-monitor.js start
   ```

## 🤖 DISCORD BOT CAPABILITIES

### **📊 CORE ANALYSIS COMMANDS:**
- `/analyze ticker:SNEK` - Basic risk analysis with beautiful formatting
- `/deep ticker:SNEK` - Super deep analysis with clustering and ADA handles
- `/visualize ticker:SNEK` - Beautiful bubble map visualization
- `/price ticker:SNEK` - Current price and market data

### **📋 WATCHLIST COMMANDS:**
- `/watchlist add ticker:SNEK` - Add token to personal watchlist
- `/watchlist view` - View all watchlist tokens
- `/watchlist remove ticker:SNEK` - Remove from watchlist
- `/watchlist analyze` - Analyze all watchlist tokens

### **📈 MARKET & SYSTEM COMMANDS:**
- `/market safe` - Show safest tokens
- `/market risky` - Show riskiest tokens
- `/market stats` - Market statistics
- `/health` - System health check
- `/status` - Bot status and statistics
- `/help` - Comprehensive help guide
- `/config show` - Show current configuration

### **🔍 MONITORING COMMANDS:**
- `/monitor start` - Start volume monitoring
- `/monitor status` - Check monitoring status
- `/monitor test` - Quick volume test

### **🤖 AI SMART COMMANDS:**
- `/smart query:"analyze SNEK token"` - Natural language AI analysis
- `/smart query:"what is the risk of HOSKY?"` - AI-powered queries
- `/smart query:"is AGIX safe to buy?"` - Investment advice

## 🔧 KEY TECHNICAL DETAILS

### **IMPORTANT FILE LOCATIONS:**

1. **Discord Bot Main File:** `discord-bot/bot-simple.js`
2. **Command Registration:** `discord-bot/deploy-fixed-commands.js`
3. **Smart AI Handler:** `discord-bot/smart-command-handler.js`
4. **Risk Analysis API:** `risk-analysis/server.js`
5. **Token Database API:** `token-api/server.js`
6. **Auto-Monitor:** `monitoring/auto-monitor.js`

### **ENVIRONMENT VARIABLES:**
```
DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA
CLIENT_ID=1376772499030675547
RISK_API_URL=http://localhost:4000
TOKEN_API_URL=http://localhost:3456
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
OPENROUTER_API_KEY=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
```

### **DISCORD CHANNEL IDS:**
- **Monitoring Alerts:** 1373811153691607090

## 🎯 RECENT FIXES & FEATURES

### **✅ COMPLETED FEATURES:**
1. **Ticker-Based Commands** - All commands use simple tickers instead of policy IDs
2. **Gold Trophy Footer** - 🏆 appears in all embeds: "🏆 Risk Analysis - Powered by MR's Gold Standard Intelligence"
3. **Enhanced Monitoring** - Deep analysis on ALL new tokens, beautiful SNEK-style formatting
4. **Smart AI Commands** - Natural language processing with OpenRouter integration
5. **Complete Command Set** - All 13 commands properly registered and working
6. **Database Integration** - Automatic ticker-to-policy ID lookup
7. **Beautiful Formatting** - Enhanced Discord embeds with proper branding

### **🔍 MONITORING SYSTEM:**
- **Frequency:** Every 2 hours automatically
- **Analysis:** ALL new tokens get deep analysis (not just suspicious)
- **Format:** Beautiful SNEK-style comprehensive reports
- **Alerts:** Enhanced Discord notifications with full breakdown
- **Footer:** "🏆 Risk Ratings - Mister's Gold Standard • Next cycle in 2 hours"

## 📊 API ENDPOINTS

### **Risk Analysis API (Port 4000):**
- `GET /analyze/{policyId}/holders` - Token holder analysis
- `GET /deep-analyze/{policyId}` - Deep analysis with clustering
- `GET /stored-tokens` - Get stored token list
- `POST /stored-tokens/{ticker}/analyze` - Analyze specific token

### **Token Database API (Port 3456):**
- `GET /api/tokens` - Get all tokens
- `GET /api/token/find?ticker={ticker}` - Find token by ticker
- `GET /api/health` - Health check

## 🎨 VISUAL FEATURES

### **EMBED COLORS:**
- **Success:** Green (#00ff00)
- **Error:** Red (#ff0000)
- **Info:** Blue (#0099ff)
- **MISTER:** Purple (#9932cc)

### **FOOTER BRANDING:**
- **Discord Bot:** "🏆 Risk Analysis - Powered by MR's Gold Standard Intelligence"
- **Monitoring:** "🏆 Risk Ratings - Mister's Gold Standard • Next cycle in 2 hours"
- **Alerts:** "🏆 Risk Ratings - Mister's Gold Standard • Suspicious Token Alert"

## 🔍 TROUBLESHOOTING

### **COMMON ISSUES:**
1. **Commands not showing:** Redeploy with `deploy-fixed-commands.js`
2. **Token not found:** Use `/monitor test` to discover new tokens
3. **API errors:** Check if all 4 services are running
4. **Smart commands failing:** Verify OpenRouter API key

### **TESTING COMMANDS:**
```bash
# Test guaranteed working tokens
/analyze ticker:SNEK
/deep ticker:SNEK
/visualize ticker:SNEK
/price ticker:SNEK

# Test AI commands
/smart query:"analyze SNEK token"
```

## 📈 AVAILABLE TOKENS IN DATABASE
SNEK, HOSKY, MIN, AGIX, WMT, Jimmy, EGO, iBTC, COPI, NTX, and 200+ others from top volume monitoring.

## 🎯 NEXT STEPS AFTER CHAT CHANGE
1. Restart all 4 services using the commands above
2. Test with `/analyze ticker:SNEK` to verify functionality
3. Check monitoring status with `/monitor status`
4. Verify all commands are visible in Discord

---
**🏆 MISTER: The Gold Standard for Cardano Safety**
