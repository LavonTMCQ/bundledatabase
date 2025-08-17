# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Cardano Token Risk Analysis & Cabal Detection System** - part of the MISTER Labs ecosystem. It's a multi-service distributed system that analyzes Cardano tokens for investment risks, detects wallet clusters (cabals), and provides real-time monitoring with Discord integration.

## Core Services Architecture

The system consists of 6 interconnected services:
1. **API** (`/api/`) - Risk analysis engine with Blockfrost integration
2. **Monitoring** (`/monitoring/`) - Automated token tracking system  
3. **Discord Bot** (`/discord-bot/`) - Community alerts and commands
4. **Frontend** (`/frontend/`) - Web dashboard interface
5. **Cluster Analysis** (`/cluster/`) - Wallet relationship detection
6. **Kupo Sync** (`/kupo-sync/`) - Blockchain data ingestion

## Key Development Commands

### API Service (TypeScript)
```bash
cd api
npm run dev                  # Development with hot reload
npm run build && npm start   # Production build and run
```

### Discord Bot (JavaScript)
```bash
cd discord-bot
npm start                    # Run bot-simple.js (production)
```

### Frontend Dashboard
```bash
cd frontend
npm start                    # Express server on port 3001
```

### Token Monitoring
```bash
cd monitoring
node token-monitor.js        # Main monitoring service
```

### Database Setup
```bash
# Local development uses SQLite3 (automatic)
# Production uses PostgreSQL on Railway (automatic with env vars)
```

## Railway Deployment

Deploy services to Railway:
```bash
./deploy-to-railway.sh       # Deploy all services
./deploy-mister-to-railway.sh # Deploy MISTER-specific services
```

Each service has its own `railway.json` configuration. Environment variables are managed through Railway dashboard.

## Critical Files & Patterns

### Risk Analysis Core
- `/api/src/blockfrost-service.ts` - Main risk scoring engine
- `/api/src/response-formatter.ts` - Discord-ready response formatting
- Risk scores: 0-10 scale with emoji indicators

### Database Schema
- `/docs/database-schema.sql` - Complete PostgreSQL schema
- Supports both PostgreSQL (production) and SQLite3 (development)

### Batch Processing
- `/scripts/batch-process.js` - Process multiple tokens
- Rate limiting: 250ms between API calls to respect Blockfrost limits

## Architecture Principles

1. **Service Independence**: Each service can run independently
2. **Database Flexibility**: Automatic SQLite fallback for local development
3. **Beautiful Responses**: All API responses formatted for Discord with emojis
4. **Infrastructure Detection**: Automatically identifies burn wallets, liquidity pools
5. **Cluster Analysis**: Detects related wallets through stake pool analysis

## Key Integration Points

### Blockfrost API
- Primary data source for Cardano blockchain data
- Rate limited to 500 requests/min
- Requires API key in environment variables

### Discord Integration
- Bot responds to `/analyze [token]` commands
- Formatted responses with risk indicators
- Real-time monitoring alerts

### PostgreSQL Database
- Production: Railway PostgreSQL
- Development: SQLite3 fallback
- Connection string: `DATABASE_URL` environment variable

## Important Patterns

### TypeScript/JavaScript Hybrid
- API and kupo-sync: TypeScript (compile before running)
- Monitoring, cluster, discord-bot: JavaScript (direct execution)
- Always check file extension before running

### Error Handling
- Services automatically fallback to SQLite if PostgreSQL unavailable
- All services have health check endpoints
- Comprehensive logging for debugging

### Response Formatting
- Always use `response-formatter.ts` for user-facing responses
- Include emojis for risk levels
- Provide actionable investment recommendations

## Environment Variables

Required for production:
- `DATABASE_URL` - PostgreSQL connection string
- `BLOCKFROST_API_KEY` - Cardano data access
- `DISCORD_TOKEN` - Bot authentication
- `PORT` - Service port (Railway provides)

## Testing & Quality

```bash
# No test suites currently implemented
# Linting available in TypeScript services:
cd api && npm run lint
```

## Common Tasks

### Adding New Token Analysis
1. Update `/api/src/blockfrost-service.ts` with new analysis logic
2. Modify `/api/src/response-formatter.ts` for output formatting
3. Deploy to Railway with deployment scripts

### Updating Discord Commands
1. Edit `/discord-bot/bot-simple.js` for command logic
2. Test locally with development Discord server
3. Deploy to production via Railway

### Database Migrations
1. Update `/docs/database-schema.sql` with changes
2. Apply to Railway PostgreSQL via dashboard
3. Update local SQLite schema if needed

## Deployment Checklist

Before deploying:
1. Build TypeScript services: `npm run build`
2. Test locally with SQLite fallback
3. Verify environment variables in Railway
4. Run deployment script
5. Check Railway logs for startup confirmation