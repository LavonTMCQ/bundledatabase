# Deployment Guide - MISTER Risk Analysis Platform

## 🚀 Production Deployment Options

### Option 1: Railway Deployment (Recommended)

#### Prerequisites
- Railway account
- GitHub repository
- Environment variables configured

#### Services to Deploy

**1. Risk Analysis API**
```yaml
# railway.toml for api/
[build]
  builder = "nixpacks"
  buildCommand = "npm install"

[deploy]
  startCommand = "npm run dev"
  healthcheckPath = "/health"
  healthcheckTimeout = 300

[env]
  PORT = "4000"
  BLOCKFROST_API_KEY = "${{BLOCKFROST_API_KEY}}"
```

**2. Token Database API**
```yaml
# railway.toml for monitoring/
[build]
  builder = "nixpacks"
  buildCommand = "npm install"

[deploy]
  startCommand = "node simple-token-api.js"
  healthcheckPath = "/api/health"

[env]
  PORT = "3456"
```

**3. Discord Bot**
```yaml
# railway.toml for discord-bot/
[build]
  builder = "nixpacks"
  buildCommand = "npm install"

[deploy]
  startCommand = "node bot-simple.js"

[env]
  DISCORD_BOT_TOKEN = "${{DISCORD_BOT_TOKEN}}"
  DISCORD_CLIENT_ID = "${{DISCORD_CLIENT_ID}}"
```

**4. Automated Monitoring**
```yaml
# railway.toml for monitoring/
[build]
  builder = "nixpacks"
  buildCommand = "npm install"

[deploy]
  startCommand = "node auto-monitor.js start"

[env]
  DISCORD_BOT_TOKEN = "${{DISCORD_BOT_TOKEN}}"
```

#### Environment Variables
```env
# Required for all services
BLOCKFROST_API_KEY=mainnet_your_key_here
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# TapTools API Key (set in code)
TAPTOOLS_API_KEY=your_taptools_key

# Database Configuration
DATABASE_URL=sqlite:./tokens.db

# Alert Configuration
ALERT_CHANNEL_ID=1373811153691607090
```

### Option 2: VPS Deployment

#### Server Requirements
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+ or similar
- **Node.js**: 18+

#### Installation Steps

**1. Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git
sudo apt install git -y
```

**2. Application Deployment**
```bash
# Clone repository
git clone <your-repo-url>
cd cabal-database

# Install dependencies
npm install
cd api && npm install && cd ..
cd discord-bot && npm install && cd ..
cd monitoring && npm install && cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Seed database
cd monitoring
node seed-database.js seed
node bulk-seed.js seed 200
```

**3. PM2 Configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'risk-api',
      script: 'api/server.js',
      env: {
        PORT: 4000,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'token-api',
      script: 'monitoring/simple-token-api.js',
      env: {
        PORT: 3456,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'discord-bot',
      script: 'discord-bot/bot-simple.js',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'auto-monitor',
      script: 'monitoring/auto-monitor.js',
      args: 'start',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

**4. Start Services**
```bash
# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up auto-restart on boot
pm2 startup
```

### Option 3: Docker Deployment

#### Dockerfile Examples

**Risk API Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY api/package*.json ./
RUN npm ci --only=production

COPY api/ .

EXPOSE 4000
CMD ["npm", "run", "dev"]
```

**Docker Compose**
```yaml
version: '3.8'

services:
  risk-api:
    build:
      context: .
      dockerfile: api/Dockerfile
    ports:
      - "4000:4000"
    environment:
      - BLOCKFROST_API_KEY=${BLOCKFROST_API_KEY}
    restart: unless-stopped

  token-api:
    build:
      context: .
      dockerfile: monitoring/Dockerfile
    ports:
      - "3456:3456"
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  discord-bot:
    build:
      context: .
      dockerfile: discord-bot/Dockerfile
    environment:
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
    restart: unless-stopped

  auto-monitor:
    build:
      context: .
      dockerfile: monitoring/Dockerfile
    command: ["node", "auto-monitor.js", "start"]
    environment:
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## 🔧 Configuration Management

### Environment Variables

**Required Variables:**
```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id

# API Keys
BLOCKFROST_API_KEY=mainnet_your_key
TAPTOOLS_API_KEY=your_taptools_key

# Alert Configuration
ALERT_CHANNEL_ID=1373811153691607090

# Database Configuration
DATABASE_PATH=./tokens.db

# Service URLs (for production)
RISK_API_URL=https://your-risk-api.railway.app
TOKEN_API_URL=https://your-token-api.railway.app
```

### Database Management

**Backup Strategy:**
```bash
# Daily backup
cp monitoring/tokens.db backups/tokens_$(date +%Y%m%d).db

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp monitoring/tokens.db backups/tokens_$DATE.db
find backups/ -name "tokens_*.db" -mtime +7 -delete
```

**Database Migration:**
```bash
# Export data
sqlite3 tokens.db ".dump" > backup.sql

# Import to new database
sqlite3 new_tokens.db < backup.sql
```

## 📊 Monitoring & Maintenance

### Health Checks

**API Health Endpoints:**
- Risk API: `GET /health`
- Token API: `GET /api/health`

**Monitoring Script:**
```bash
#!/bin/bash
# health_check.sh

check_service() {
  local url=$1
  local name=$2
  
  if curl -f -s "$url" > /dev/null; then
    echo "✅ $name is healthy"
  else
    echo "❌ $name is down"
    # Add alerting logic here
  fi
}

check_service "http://localhost:4000/health" "Risk API"
check_service "http://localhost:3456/api/health" "Token API"
```

### Log Management

**PM2 Logs:**
```bash
# View logs
pm2 logs

# Log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Performance Monitoring

**Key Metrics to Monitor:**
- API response times
- Database query performance
- Memory usage
- Discord bot uptime
- Alert delivery success rate

## 🔐 Security Considerations

### API Security
- Use HTTPS in production
- Implement rate limiting
- Validate all inputs
- Secure API keys in environment variables

### Database Security
- Regular backups
- File permissions (600 for database file)
- Encryption at rest (if required)

### Discord Bot Security
- Limit bot permissions to minimum required
- Use role-based access control
- Monitor for abuse

## 🚨 Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Check database file permissions
ls -la monitoring/tokens.db

# Recreate database if corrupted
cd monitoring
node seed-database.js seed
```

**Discord Bot Not Responding:**
```bash
# Check bot token
echo $DISCORD_BOT_TOKEN

# Verify bot permissions in Discord server
# Check bot logs for connection errors
```

**API Timeouts:**
```bash
# Check external API status
curl -I https://openapi.taptools.io/api/v1/health
curl -I https://cardano-mainnet.blockfrost.io/api/v0/health

# Increase timeout values if needed
```

### Emergency Procedures

**Service Recovery:**
```bash
# Restart all services
pm2 restart all

# Check service status
pm2 status

# View recent logs
pm2 logs --lines 100
```

**Database Recovery:**
```bash
# Restore from backup
cp backups/tokens_latest.db monitoring/tokens.db

# Verify database integrity
sqlite3 monitoring/tokens.db "PRAGMA integrity_check;"
```

---

**Deployment Checklist:**
- [ ] Environment variables configured
- [ ] Database seeded with initial data
- [ ] All services started and healthy
- [ ] Discord bot connected and responding
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Health checks passing
