# MISTER Risk Analysis Platform - Team Documentation

## 🎯 Project Overview

The MISTER Risk Analysis Platform is a comprehensive Cardano token intelligence system that provides real-time risk analysis, automated monitoring, and Discord-based user interaction. The platform combines multiple APIs, databases, and monitoring systems to deliver the most advanced token safety analysis available on Cardano.

## 🏗️ System Architecture

### Core Components

1. **Discord Bot** (`discord-bot/`) - User interface and command system
2. **Risk Analysis API** (`api/`) - Core token analysis engine
3. **Token Database API** (`monitoring/`) - Token storage and retrieval
4. **Automated Monitoring** (`monitoring/`) - Continuous token discovery and risk assessment
5. **TapTools Integration** (`monitoring/`) - External data source integration

### Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (production-ready, file-based)
- **Discord**: Discord.js v14
- **External APIs**: TapTools API, Blockfrost API
- **Monitoring**: Custom automated monitoring system

## 📁 Project Structure

```
cabal-database/
├── api/                          # Risk Analysis API (Port 4000)
│   ├── server.js                 # Main API server
│   ├── package.json              # API dependencies
│   └── routes/                   # API endpoints
├── discord-bot/                  # Discord Bot
│   ├── bot-simple.js             # Main bot file
│   ├── .env                      # Discord credentials
│   └── package.json              # Bot dependencies
├── monitoring/                   # Token Database & Monitoring
│   ├── simple-token-api.js       # Token API (Port 3456)
│   ├── auto-monitor.js           # Automated monitoring
│   ├── taptools-service.js       # TapTools integration
│   ├── token-database.js         # Database operations
│   ├── bulk-seed.js              # Database seeding
│   ├── seed-database.js          # Popular token seeding
│   ├── tokens.db                 # SQLite database
│   └── package.json              # Monitoring dependencies
└── docs/                         # Documentation
    ├── README.md                 # This file
    ├── API.md                    # API documentation
    ├── DEPLOYMENT.md             # Deployment guide
    └── FEATURES.md               # Feature documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Discord Bot Token
- TapTools API Key
- Blockfrost API Key

### Installation

1. **Clone and Install Dependencies**
```bash
git clone <repository>
cd cabal-database
npm install
cd api && npm install
cd ../discord-bot && npm install
cd ../monitoring && npm install
```

2. **Configure Environment Variables**
```bash
# discord-bot/.env
DISCORD_BOT_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_client_id

# Set TapTools API key in monitoring/taptools-service.js
API_KEY = 'your_taptools_key'

# Set Blockfrost API key in api/server.js
BLOCKFROST_API_KEY = 'your_blockfrost_key'
```

3. **Seed Database**
```bash
cd monitoring
node seed-database.js seed        # Seed popular tokens
node bulk-seed.js seed 200        # Seed top 200 volume tokens
```

4. **Start All Services**
```bash
# Terminal 1: Risk Analysis API
cd api && npm run dev

# Terminal 2: Token Database API
cd monitoring && node simple-token-api.js

# Terminal 3: Discord Bot
cd discord-bot && node bot-simple.js

# Terminal 4: Automated Monitoring
cd monitoring && DISCORD_BOT_TOKEN=your_token node auto-monitor.js start
```

## 🔧 Development Guide

### Adding New Features

1. **Discord Commands**: Add to `discord-bot/bot-simple.js`
2. **API Endpoints**: Add to `api/server.js`
3. **Database Operations**: Add to `monitoring/token-database.js`
4. **Monitoring Features**: Add to `monitoring/auto-monitor.js`

### Database Schema

The system uses SQLite with the following main tables:

- `tokens` - Core token information
- `ticker_mappings` - Ticker to unit mappings
- `analysis_history` - Risk analysis results
- `tracked_wallets` - Wallet monitoring

### API Integration

#### TapTools API
- **Base URL**: `https://openapi.taptools.io/api/v1/`
- **Key Endpoints**: `/token/top/volume`, `/token/holders/top`, `/token/links`
- **Rate Limiting**: 1-2 second delays between requests

#### Blockfrost API
- **Base URL**: `https://cardano-mainnet.blockfrost.io/api/v0/`
- **Key Endpoints**: `/assets/{unit}`, `/addresses/{address}`
- **Rate Limiting**: Built-in rate limiting

### Testing

```bash
# Test Discord Bot Commands
/analyze ticker:SNEK
/analyze ticker:MISTER
/monitor test

# Test APIs
curl "http://localhost:4000/health"
curl "http://localhost:3456/api/token/find?ticker=SNEK"

# Test Monitoring
cd monitoring && node auto-monitor.js status
```

## 📊 Current Features

### Discord Bot Commands

- `/analyze` - Comprehensive token risk analysis
- `/monitor` - Token monitoring controls
- `/watchlist` - Personal token watchlists
- `/alerts` - Alert configuration
- `/portfolio` - Portfolio analysis
- `/market` - Market intelligence
- `/mister` - MISTER-specific features
- `/visualize` - Visual analysis tools
- `/help` - Complete help system

### Risk Analysis Features

- **Holder Concentration Analysis**
- **Wallet Clustering Detection**
- **Social Link Verification**
- **Market Cap Analysis**
- **Volume Pattern Analysis**
- **Rug Pull Risk Scoring**

### Monitoring Features

- **Automated Token Discovery** (every 2 hours)
- **Risk Assessment** for new tokens
- **Discord Alerts** for suspicious tokens
- **Database Growth** (200+ tokens and growing)
- **Social Media Integration**

## 🔐 Security Considerations

- **API Keys**: Store in environment variables, never commit
- **Database**: SQLite file-based, backup regularly
- **Rate Limiting**: Implemented for all external APIs
- **Error Handling**: Comprehensive error catching and logging

## 📈 Performance Metrics

- **Response Time**: <2 seconds for token analysis
- **Database Size**: 200+ tokens, growing automatically
- **Uptime**: 99.9% with proper deployment
- **Rate Limits**: Respected for all external APIs

## 🚨 Monitoring & Alerts

### Discord Alerts (Channel: 1373811153691607090)

- **Suspicious Token Alerts**: Risk ≥7 or Concentration ≥60%
- **Monitoring Summaries**: Every 2 hours
- **System Status**: Health checks and errors

### Logging

- **Console Logging**: All operations logged with emojis
- **Error Tracking**: Comprehensive error logging
- **Performance Monitoring**: Response time tracking

## 🔄 Deployment

### Local Development
- All services run on localhost
- Ports: 4000 (Risk API), 3456 (Token API)
- SQLite database in `monitoring/tokens.db`

### Production Deployment
- See `docs/DEPLOYMENT.md` for Railway/cloud deployment
- Environment variable configuration
- Database backup strategies

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow coding standards**: Use existing patterns
4. **Test thoroughly**: All features must work
5. **Update documentation**: Keep docs current
6. **Submit pull request**: Detailed description required

## 📞 Support

- **Team Lead**: Contact for architecture decisions
- **Discord**: Use development channel for questions
- **Documentation**: Check `docs/` folder first
- **Issues**: Create GitHub issues for bugs

## 🎯 Roadmap

### Phase 1 (Completed)
- ✅ Discord bot with comprehensive commands
- ✅ Risk analysis API with TapTools integration
- ✅ Automated monitoring system
- ✅ Database with 200+ tokens

### Phase 2 (In Progress)
- 🔄 Advanced wallet clustering
- 🔄 Machine learning risk models
- 🔄 Real-time price alerts
- 🔄 Portfolio tracking

### Phase 3 (Planned)
- 📋 Web dashboard
- 📋 Mobile app integration
- 📋 Advanced analytics
- 📋 Community features

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Team**: MISTER Development Team
