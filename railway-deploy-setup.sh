#!/bin/bash

# 🚀 MISTER Risk System - Railway Deployment Setup Script
# This script helps prepare your codebase for Railway deployment

echo "🚀 MISTER Risk System - Railway Deployment Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "api" ] || [ ! -d "monitoring" ]; then
    print_error "Please run this script from the root of your MISTER project directory"
    exit 1
fi

print_info "Setting up Railway deployment configuration..."

# 1. Create Railway configuration files
echo ""
print_info "1. Creating Railway service configurations..."

# Risk API railway.json
mkdir -p api/.railway
cat > api/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

# Token API railway.json
mkdir -p monitoring/.railway
cat > monitoring/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node token-api.js",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

# Auto-Monitor railway.json
cat > monitoring/railway-monitor.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node auto-monitor.js start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

# Discord Bot railway.json
mkdir -p discord-bot/.railway
cat > discord-bot/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node bot-simple.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

print_status "Railway configuration files created"

# 2. Update package.json files for production
echo ""
print_info "2. Updating package.json files for production..."

# Update Risk API package.json
if [ -f "api/package.json" ]; then
    # Add production scripts if they don't exist
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('api/package.json', 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.build = pkg.scripts.build || 'tsc';
    pkg.scripts.start = pkg.scripts.start || 'node dist/index.js';
    pkg.scripts.dev = pkg.scripts.dev || 'ts-node src/index.ts';
    pkg.engines = pkg.engines || {};
    pkg.engines.node = pkg.engines.node || '>=18.0.0';
    fs.writeFileSync('api/package.json', JSON.stringify(pkg, null, 2));
    "
    print_status "Updated api/package.json"
else
    print_warning "api/package.json not found"
fi

# Update monitoring package.json
if [ -f "monitoring/package.json" ]; then
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('monitoring/package.json', 'utf8'));
    pkg.engines = pkg.engines || {};
    pkg.engines.node = pkg.engines.node || '>=18.0.0';
    fs.writeFileSync('monitoring/package.json', JSON.stringify(pkg, null, 2));
    "
    print_status "Updated monitoring/package.json"
fi

# Update discord-bot package.json
if [ -f "discord-bot/package.json" ]; then
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('discord-bot/package.json', 'utf8'));
    pkg.engines = pkg.engines || {};
    pkg.engines.node = pkg.engines.node || '>=18.0.0';
    fs.writeFileSync('discord-bot/package.json', JSON.stringify(pkg, null, 2));
    "
    print_status "Updated discord-bot/package.json"
fi

# 3. Create environment variable templates
echo ""
print_info "3. Creating environment variable templates..."

cat > .env.railway.template << 'EOF'
# 🚀 MISTER Risk System - Railway Environment Variables Template
# Copy these to your Railway service environment variables

# ===========================================
# RISK API SERVICE (Port 4000)
# ===========================================
DATABASE_URL=postgresql://username:password@host:port/database_name
BLOCKFROST_PROJECT_ID=your_blockfrost_mainnet_key
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
PORT=4000
NODE_ENV=production

# ===========================================
# TOKEN API SERVICE (Port 3456)
# ===========================================
DATABASE_URL=postgresql://username:password@host:port/database_name
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
PORT=3456
NODE_ENV=production

# ===========================================
# AUTO-MONITOR SERVICE (Port 4001)
# ===========================================
DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA
RISK_API_URL=https://your-risk-api.railway.app
TOKEN_API_URL=https://your-token-api.railway.app
TAPTOOLS_API_KEY=WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO
DATABASE_URL=postgresql://username:password@host:port/database_name
PORT=4001
NODE_ENV=production

# ===========================================
# DISCORD BOT SERVICE
# ===========================================
DISCORD_BOT_TOKEN=MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA
RISK_API_URL=https://your-risk-api.railway.app
TOKEN_API_URL=https://your-token-api.railway.app
NODE_ENV=production
EOF

print_status "Environment variable template created (.env.railway.template)"

# 4. Create database schema file
echo ""
print_info "4. Creating database schema for Railway PostgreSQL..."

cat > railway-database-schema.sql << 'EOF'
-- 🗄️ MISTER Risk System - Railway Database Schema
-- Run this in your Railway PostgreSQL console

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

-- Verify tables created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
EOF

print_status "Database schema file created (railway-database-schema.sql)"

# 5. Create deployment verification script
echo ""
print_info "5. Creating deployment verification script..."

cat > verify-railway-deployment.sh << 'EOF'
#!/bin/bash

# 🔍 MISTER Risk System - Railway Deployment Verification
# Run this after deploying to Railway to verify everything works

echo "🔍 Verifying Railway Deployment..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Update these URLs with your actual Railway URLs
RISK_API_URL="https://your-risk-api.railway.app"
TOKEN_API_URL="https://your-token-api.railway.app"
MONITOR_URL="https://your-monitor.railway.app"

echo ""
echo "Testing Risk API..."
curl -s "$RISK_API_URL/health" > /dev/null && echo -e "${GREEN}✅ Risk API Health Check: PASS${NC}" || echo -e "${RED}❌ Risk API Health Check: FAIL${NC}"
curl -s "$RISK_API_URL/api/agent/status" > /dev/null && echo -e "${GREEN}✅ Agent Status Endpoint: PASS${NC}" || echo -e "${RED}❌ Agent Status Endpoint: FAIL${NC}"

echo ""
echo "Testing Token API..."
curl -s "$TOKEN_API_URL/api/health" > /dev/null && echo -e "${GREEN}✅ Token API Health Check: PASS${NC}" || echo -e "${RED}❌ Token API Health Check: FAIL${NC}"

echo ""
echo "Testing Monitor Service..."
curl -s "$MONITOR_URL/health" > /dev/null && echo -e "${GREEN}✅ Monitor Health Check: PASS${NC}" || echo -e "${RED}❌ Monitor Health Check: FAIL${NC}"
curl -s "$MONITOR_URL/status" > /dev/null && echo -e "${GREEN}✅ Monitor Status Endpoint: PASS${NC}" || echo -e "${RED}❌ Monitor Status Endpoint: FAIL${NC}"

echo ""
echo "🎯 Update your Mastra agent endpoints to:"
echo "  Risk API: $RISK_API_URL"
echo "  Token API: $TOKEN_API_URL"
echo "  Monitor: $MONITOR_URL"
EOF

chmod +x verify-railway-deployment.sh
print_status "Deployment verification script created (verify-railway-deployment.sh)"

# 6. Create .gitignore updates
echo ""
print_info "6. Updating .gitignore for Railway deployment..."

cat >> .gitignore << 'EOF'

# Railway deployment files
.railway/
railway-*.log

# Environment templates (keep template, ignore actual env files)
.env.railway
.env.production
EOF

print_status ".gitignore updated for Railway"

# 7. Summary
echo ""
echo "🎯 RAILWAY DEPLOYMENT SETUP COMPLETE!"
echo "====================================="
echo ""
print_info "Files created:"
echo "  📁 api/railway.json - Risk API configuration"
echo "  📁 monitoring/railway.json - Token API configuration"
echo "  📁 monitoring/railway-monitor.json - Monitor configuration"
echo "  📁 discord-bot/railway.json - Discord bot configuration"
echo "  📄 .env.railway.template - Environment variables template"
echo "  📄 railway-database-schema.sql - Database schema"
echo "  📄 verify-railway-deployment.sh - Deployment verification"
echo ""
print_info "Next steps:"
echo "  1. 📋 Follow the RAILWAY_DEPLOYMENT_CHECKLIST.md"
echo "  2. 🗄️ Create PostgreSQL service in Railway"
echo "  3. 🚀 Deploy each service separately"
echo "  4. 🔧 Configure environment variables"
echo "  5. ✅ Run verify-railway-deployment.sh"
echo ""
print_status "Ready for Railway deployment! 🚀"
EOF
