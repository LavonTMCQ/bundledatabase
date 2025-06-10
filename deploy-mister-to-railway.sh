#!/bin/bash

# 🚀 MISTER System - Complete Railway Deployment Script
# This script deploys all 4 services to Railway with proper configuration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
PROJECT_NAME="mister-risk-system"
GITHUB_REPO="https://github.com/LavonTMCQ/bundledatabase.git"

print_status "🚀 Starting MISTER System Railway Deployment"
print_status "============================================="

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v railway &> /dev/null; then
    print_error "Railway CLI not found. Please install it:"
    print_error "npm install -g @railway/cli"
    exit 1
fi

if ! railway whoami &> /dev/null; then
    print_error "Not logged into Railway. Please run:"
    print_error "railway login"
    exit 1
fi

print_success "Prerequisites check passed"

# Create or connect to Railway project
print_status "Setting up Railway project..."

# Check if we're already in a Railway project
if railway status &> /dev/null; then
    print_warning "Already connected to a Railway project"
    railway status
else
    print_status "Creating new Railway project: $PROJECT_NAME"
    railway init
fi

# Add PostgreSQL database
print_status "Adding PostgreSQL database..."
railway add postgresql || print_warning "PostgreSQL might already exist"

# Wait for database to be ready
print_status "Waiting for database to be ready..."
sleep 10

# Get database URL
print_status "Getting database connection details..."
DATABASE_URL=$(railway variables get DATABASE_URL 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
    print_error "Failed to get database URL. Please check Railway dashboard."
    exit 1
fi

print_success "Database URL obtained"

# Create database schema
print_status "Setting up database schema..."
cat > temp_schema.sql << 'EOF'
-- MISTER Risk System Database Schema
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  policy_id TEXT NOT NULL,
  asset_name_hex TEXT,
  unit TEXT UNIQUE NOT NULL,
  ticker TEXT,
  name TEXT,
  price DECIMAL,
  volume_24h DECIMAL,
  market_cap DECIMAL,
  circulating_supply DECIMAL,
  total_supply DECIMAL,
  decimals INTEGER DEFAULT 0,
  description TEXT,
  website TEXT,
  twitter TEXT,
  discord TEXT,
  telegram TEXT,
  github TEXT,
  reddit TEXT,
  medium TEXT,
  youtube TEXT,
  instagram TEXT,
  facebook TEXT,
  email TEXT,
  logo_url TEXT,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_verified BOOLEAN DEFAULT FALSE,
  risk_score DECIMAL,
  top_holder_percentage DECIMAL,
  holder_count INTEGER,
  liquidity_pools INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_holders (
  id SERIAL PRIMARY KEY,
  unit TEXT NOT NULL,
  stake_address TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  percentage DECIMAL NOT NULL,
  rank INTEGER NOT NULL,
  ada_handle TEXT,
  is_pool BOOLEAN DEFAULT FALSE,
  is_exchange BOOLEAN DEFAULT FALSE,
  is_burn_wallet BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit) REFERENCES tokens (unit),
  UNIQUE(unit, stake_address)
);

CREATE TABLE IF NOT EXISTS ticker_mapping (
  id SERIAL PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  asset_name_hex TEXT,
  confidence_score DECIMAL DEFAULT 1.0,
  source TEXT DEFAULT 'taptools',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit) REFERENCES tokens (unit)
);

CREATE TABLE IF NOT EXISTS analysis_history (
  id SERIAL PRIMARY KEY,
  unit TEXT NOT NULL,
  risk_score DECIMAL,
  verdict TEXT,
  top_holder_percentage DECIMAL,
  holder_count INTEGER,
  analysis_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit) REFERENCES tokens (unit)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tokens_unit ON tokens(unit);
CREATE INDEX IF NOT EXISTS idx_tokens_ticker ON tokens(ticker);
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume_24h);
CREATE INDEX IF NOT EXISTS idx_ticker_mapping_ticker ON ticker_mapping(ticker);
CREATE INDEX IF NOT EXISTS idx_token_holders_unit ON token_holders(unit);
CREATE INDEX IF NOT EXISTS idx_analysis_history_unit ON analysis_history(unit);
EOF

# Apply schema
railway run "psql \$DATABASE_URL -f temp_schema.sql" || print_warning "Schema setup might have failed"
rm temp_schema.sql

print_success "Database schema applied"

# Deploy services
print_status "Deploying services to Railway..."

# 1. Deploy Risk API
print_status "Deploying Risk API service..."
cd api
railway up --service risk-api || railway up
cd ..

# 2. Deploy Token API
print_status "Deploying Token API service..."
cd monitoring
railway up --service token-api || railway up
cd ..

# 3. Deploy Auto-Monitor
print_status "Deploying Auto-Monitor service..."
cd monitoring
railway up --service auto-monitor || railway up
cd ..

# 4. Deploy Discord Bot
print_status "Deploying Discord Bot service..."
cd discord-bot
railway up --service discord-bot || railway up
cd ..

print_success "All services deployed!"

# Set environment variables
print_status "Setting up environment variables..."

# Get service URLs (these will be available after deployment)
print_status "Services are deploying... URLs will be available shortly."
print_status "Please set the following environment variables in Railway dashboard:"

echo ""
print_warning "REQUIRED ENVIRONMENT VARIABLES:"
echo "================================"
echo ""
echo "🔗 DATABASE_URL: (automatically set by Railway PostgreSQL)"
echo ""
echo "🤖 DISCORD_BOT_TOKEN: MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA"
echo ""
echo "🔑 TAPTOOLS_API_KEY: WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO"
echo ""
echo "🌐 RISK_API_URL: https://your-risk-api.railway.app (set after deployment)"
echo "🌐 TOKEN_API_URL: https://your-token-api.railway.app (set after deployment)"
echo ""
echo "⚙️ NODE_ENV: production"
echo ""

print_success "Deployment completed!"
print_status "============================================="
print_status "🎯 Next Steps:"
print_status "1. Check Railway dashboard for service URLs"
print_status "2. Update environment variables with actual service URLs"
print_status "3. Test all services are working"
print_status "4. Monitor logs for any issues"
print_status ""
print_status "🔗 Railway Dashboard: https://railway.app/dashboard"
print_status "📊 Your project: $PROJECT_NAME"
