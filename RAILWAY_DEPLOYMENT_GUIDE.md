# 🚀 MISTER System - Railway Deployment Guide

## Overview

This guide will help you deploy the complete MISTER system to Railway with all 4 services:

1. **Risk API** (Port 4000) - Risk analysis and token intelligence
2. **Token API** (Port 3456) - Token database and search
3. **Auto-Monitor** (Port 4001) - Automated monitoring service
4. **Discord Bot** - Discord integration for alerts and commands

## 🔧 Prerequisites

1. **Railway CLI installed:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Railway account and login:**
   ```bash
   railway login
   ```

3. **GitHub repository access:**
   - Repository: `https://github.com/LavonTMCQ/bundledatabase.git`

## 🚀 Quick Deployment

### Option 1: Automated Script (Recommended)

```bash
# Run the automated deployment script
./deploy-mister-to-railway.sh
```

### Option 2: Manual Deployment

#### Step 1: Create Railway Project
```bash
railway init mister-risk-system
railway add postgresql
```

#### Step 2: Deploy Each Service

**Risk API:**
```bash
cd api
railway up --service risk-api
```

**Token API:**
```bash
cd monitoring
railway up --service token-api
```

**Auto-Monitor:**
```bash
cd monitoring
railway up --service auto-monitor
```

**Discord Bot:**
```bash
cd discord-bot
railway up --service discord-bot
```

## 🔐 Environment Variables Configuration

### Risk API Service
```bash
DATABASE_URL=postgresql://... (auto-set by Railway)
BLOCKFROST_PROJECT_ID=your_blockfrost_mainnet_key
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
PORT=4000
NODE_ENV=production
```

### Token API Service
```bash
DATABASE_URL=postgresql://... (auto-set by Railway)
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
PORT=3456
NODE_ENV=production
```

### Auto-Monitor Service
```bash
DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA
RISK_API_URL=https://your-risk-api.railway.app
TOKEN_API_URL=https://your-token-api.railway.app
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
DATABASE_URL=postgresql://... (auto-set by Railway)
PORT=4001
NODE_ENV=production
```

### Discord Bot Service
```bash
DISCORD_BOT_TOKEN=MTM3Njc3MJQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA
RISK_API_URL=https://your-risk-api.railway.app
TOKEN_API_URL=https://your-token-api.railway.app
NODE_ENV=production
```

## 📊 Database Schema

The PostgreSQL database will be automatically created with these tables:

- `tokens` - Token information and metadata
- `token_holders` - Token holder data
- `ticker_mapping` - Ticker to unit mapping
- `analysis_history` - Risk analysis history

## 🔍 Verification Steps

### 1. Check Service Health
```bash
# Risk API
curl https://your-risk-api.railway.app/health

# Token API  
curl https://your-token-api.railway.app/api/health

# Auto-Monitor
curl https://your-auto-monitor.railway.app/health
```

### 2. Test Database Connection
```bash
# Check if services can connect to PostgreSQL
railway logs --service risk-api
railway logs --service token-api
```

### 3. Verify Discord Bot
- Check Discord server for bot presence
- Test bot commands in Discord

## 🐛 Troubleshooting

### Common Issues

**1. Database Connection Errors:**
- Ensure `DATABASE_URL` is set correctly
- Check PostgreSQL service is running
- Verify SSL configuration

**2. Service Communication Errors:**
- Update `RISK_API_URL` and `TOKEN_API_URL` with actual Railway URLs
- Ensure all services are deployed and running

**3. Discord Bot Not Responding:**
- Verify `DISCORD_BOT_TOKEN` is correct
- Check bot permissions in Discord server
- Review Discord bot logs

### Debugging Commands
```bash
# View service logs
railway logs --service risk-api
railway logs --service token-api
railway logs --service auto-monitor
railway logs --service discord-bot

# Check service status
railway status

# View environment variables
railway variables
```

## 🔄 Updates and Maintenance

### Updating Services
```bash
# Update specific service
cd api
railway up --service risk-api

# Update all services
./deploy-mister-to-railway.sh
```

### Database Maintenance
```bash
# Connect to database
railway connect postgresql

# Run SQL commands
railway run "psql \$DATABASE_URL -c 'SELECT COUNT(*) FROM tokens;'"
```

## 📈 Monitoring

### Service URLs
After deployment, your services will be available at:
- Risk API: `https://your-risk-api.railway.app`
- Token API: `https://your-token-api.railway.app`
- Auto-Monitor: `https://your-auto-monitor.railway.app`
- Discord Bot: (no public URL, connects to Discord)

### Health Checks
- Risk API: `/health`
- Token API: `/api/health`
- Auto-Monitor: `/health`

## 🎯 Production Checklist

- [ ] All 4 services deployed successfully
- [ ] PostgreSQL database created and schema applied
- [ ] Environment variables configured for all services
- [ ] Service URLs updated in cross-service communication
- [ ] Discord bot connected and responding
- [ ] Health checks passing
- [ ] Monitoring alerts configured
- [ ] Database backups enabled (Railway Pro)

## 🆘 Support

If you encounter issues:
1. Check Railway dashboard for service status
2. Review service logs for errors
3. Verify environment variables are set correctly
4. Test database connectivity
5. Check Discord bot permissions

For Railway-specific issues, consult the [Railway Documentation](https://docs.railway.app/).
