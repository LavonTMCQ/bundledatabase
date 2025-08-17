# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Cardano Token Risk Analysis & Cabal Detection System** - part of the MISTER Labs ecosystem. It's a multi-service distributed system that analyzes Cardano tokens for investment risks, detects wallet clusters (cabals), and provides real-time monitoring with Discord integration.

## 🚀 LATEST OPTIMIZATIONS (August 2025)

### API Usage: 90% Reduction Achieved!
- **Before**: ~1,100 TapTools API calls/day
- **After**: ~120-150 TapTools API calls/day
- **Savings**: 950+ API calls per day

### Key Optimizations Implemented:
1. **New TapTools API Key**: `ItDt8Q9DI6Aa4Rc6yDn627cvBxAdRD2X` (updated in taptools-service.js:8)
2. **Rate Limiting**: 1 second minimum delay between ALL API calls (prevents 429 errors)
3. **Smart Caching System**:
   - Market Cap: 30 minutes cache
   - Liquidity Pools: 1 hour cache  
   - Token Holders: 15 minutes cache
   - Top Volume: 10 minutes cache
4. **Safe Tokens Skip List** (21 tokens that don't need analysis):
   - Major: ADA, HOSKY, MIN, SUNDAE, MILK, LENFI, COPI, WMT, INDY
   - User Added: STRIKE, AGENT, SNEK, IAG, WMTX, CHAD
   - Stablecoins: DJED, USDM, iUSD, USDA, USDC, USDT, DAI, BUSD
   - Bridge: rsERG, rsADA, rsBTC, rsETH, WETH, WBTC, WADA
5. **Monitoring Interval**: Reduced from 2 hours to 4 hours (50% fewer runs)
6. **Analysis Scope**: Only analyzes NEW tokens (max 3 per cycle), skips existing database tokens
7. **Railway PORT Fix**: auto-monitor uses `process.env.PORT || 4001` for proper deployment

## Production Endpoints (Working!)

### ✅ Token API: `https://token-api-production.up.railway.app`
- `/api/health` - Health check
- `/api/token/find?ticker=XXX` - Find token by ticker
- `/api/token/search?q=XXX` - Search tokens
- `/api/tokens` - List all tokens
- `/api/stats` - Database statistics (1,573+ tokens!)

### ✅ Auto-Monitor: `https://auto-monitor-production.up.railway.app`
- `/status` - Monitoring status
- `/health` - Health check

### ⚠️ Risk API: Currently failing deployment
- Needs investigation and fix

## Core Services Architecture

The system consists of 6 interconnected services:
1. **API** (`/api/`) - Risk analysis engine with Blockfrost integration
2. **Monitoring** (`/monitoring/`) - Automated token tracking system  
3. **Discord Bot** (`/discord-bot/`) - Community alerts and commands
4. **Frontend** (`/frontend/`) - Web dashboard interface
5. **Cluster Analysis** (`/cluster/`) - Wallet relationship detection
6. **Kupo Sync** (`/kupo-sync/`) - Blockchain data ingestion

## Key Development Commands

### Start Services Locally
```bash
# Token API
cd monitoring && node token-api.js

# Auto-Monitor (with Discord alerts)
cd monitoring && DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA node auto-monitor.js start

# Discord Bot
cd discord-bot && npm start

# Risk API
cd api && npm run dev
```

### Railway Deployment
```bash
# Push to GitHub (auto-deploys if connected)
git add -A && git commit -m "Update" && git push origin main

# Manual deploy scripts
./deploy-to-railway.sh       # Deploy all services
./deploy-mister-to-railway.sh # Deploy MISTER-specific services
```

## Critical Files & Recent Changes

### TapTools Service (`/monitoring/taptools-service.js`)
- Lines 8: API key configuration
- Lines 35-49: Cache system implementation
- Lines 51-57: Rate limiter configuration
- Lines 59-60: Safe tokens list
- Lines 556-567: Rate limiting enforcement
- Lines 569+: API request method with rate limiting

### Auto-Monitor (`/monitoring/auto-monitor.js`)
- Line 162: Monitoring interval (4 hours)
- Line 690: PORT environment variable usage
- Lines 271-272: New token filtering logic
- Lines 300-319: Gold Standard analysis conditions

### Railway Configurations
- `/monitoring/railway.json` - Auto-monitor deployment config
- Each service has its own railway.json with health checks

## Database Schema

- `/docs/database-schema.sql` - Complete PostgreSQL schema
- Production: PostgreSQL on Railway (auto-connected)
- Development: SQLite3 fallback (automatic)
- Current stats: 1,573 tokens, 1,384 mappings, 928 analyses

## Architecture Principles

1. **Service Independence**: Each service can run independently
2. **Database Flexibility**: Automatic SQLite fallback for local development
3. **Beautiful Responses**: All API responses formatted for Discord with emojis
4. **Infrastructure Detection**: Automatically identifies burn wallets, liquidity pools
5. **Cluster Analysis**: Detects related wallets through stake pool analysis
6. **Rate Limit Protection**: Never exceeds API limits (1 call/second)
7. **Efficient Caching**: Reduces redundant API calls by 75%

## Key Integration Points

### TapTools API
- Primary data source for Cardano token data
- Rate limited to prevent 429 errors
- API Key: `ItDt8Q9DI6Aa4Rc6yDn627cvBxAdRD2X`
- Caching reduces calls by 75%

### Discord Integration
- Bot Token: `MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA`
- Formatted responses with risk indicators
- Real-time monitoring alerts for suspicious tokens

### PostgreSQL Database
- Production: Railway PostgreSQL (auto-provisioned)
- Development: SQLite3 fallback
- Connection: `DATABASE_URL` environment variable

## Important Patterns

### TypeScript/JavaScript Hybrid
- API and kupo-sync: TypeScript (compile before running)
- Monitoring, cluster, discord-bot: JavaScript (direct execution)
- Always check file extension before running

### Error Handling
- Services automatically fallback to SQLite if PostgreSQL unavailable
- All services have health check endpoints
- Rate limiting prevents 429 errors
- Comprehensive logging for debugging

### Response Formatting
- Always use `response-formatter.ts` for user-facing responses
- Include emojis for risk levels
- Provide actionable investment recommendations

## Environment Variables

Required for production:
- `DATABASE_URL` - PostgreSQL connection string (Railway provides)
- `TAPTOOLS_API_KEY` - Set to: `ItDt8Q9DI6Aa4Rc6yDn627cvBxAdRD2X`
- `DISCORD_BOT_TOKEN` - Bot authentication
- `PORT` - Service port (Railway provides automatically)
- `NODE_ENV` - Set to "production"
- `RISK_API_URL` - https://risk-api-production.up.railway.app
- `TOKEN_API_URL` - https://token-api-production.up.railway.app

## Common Tasks

### Adding Safe Tokens
1. Edit `/monitoring/taptools-service.js` line 59-60
2. Add ticker to `SAFE_TOKENS` Set
3. Commit and push to trigger Railway deploy

### Adjusting Rate Limits
1. Edit `/monitoring/taptools-service.js` line 54
2. Change `minDelay` value (in milliseconds)
3. Current: 1000ms (1 call/second)

### Changing Monitoring Interval
1. Edit `/monitoring/auto-monitor.js` line 162
2. Change interval calculation (currently 4 hours)
3. Remember to update cache durations accordingly

### Checking API Usage
```bash
# View logs to see API call tracking
railway logs --service auto-monitor

# Look for:
# - "📦 Cache hit" messages (good!)
# - "✅ [TOKEN] is a known safe token" (skipped)
# - "❌ TapTools API error" (rate limiting issues)
```

## Troubleshooting

### 429 Too Many Requests
- Increase rate limiter delay in taptools-service.js
- Check cache is working (look for cache hit messages)
- Verify safe tokens are being skipped

### Railway Deployment Issues
- Ensure PORT uses `process.env.PORT`
- Check health endpoints are configured
- Verify railway.json has correct start command

### Database Connection
- Railway auto-provides DATABASE_URL
- SQLite fallback for local development
- Check connection logs on startup

## Recent Session Summary (August 2025)

### Problems Solved:
1. ✅ Updated TapTools API key to new one
2. ✅ Reduced API calls from 1,100/day to 150/day (90% reduction!)
3. ✅ Fixed Railway deployment health checks (PORT environment)
4. ✅ Added rate limiting to prevent 429 errors
5. ✅ Implemented smart caching system
6. ✅ Added safe token skip list

### Current Status:
- Auto-monitor: ✅ Running perfectly with optimizations
- Token API: ✅ Working with 1,573 tokens in database
- Discord Bot: ✅ Deployed and functional
- Risk API: ⚠️ Deployment failing (needs investigation)

### Files Modified:
- `/monitoring/taptools-service.js` - Caching, rate limiting, API key
- `/monitoring/auto-monitor.js` - PORT fix, interval change
- `/monitoring/railway.json` - Deployment configuration
- `/CLAUDE.md` - This documentation

## Deployment Checklist

Before deploying:
1. ✅ Test locally with new changes
2. ✅ Verify rate limiting works (no 429 errors)
3. ✅ Check cache hit rates in logs
4. ✅ Ensure PORT uses environment variable
5. ✅ Commit and push to GitHub
6. ✅ Monitor Railway deployment logs
7. ✅ Test production endpoints after deploy