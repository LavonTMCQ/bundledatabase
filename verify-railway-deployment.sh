#!/bin/bash

# 🔍 MISTER System - Railway Deployment Verification Script
# This script verifies that all services are deployed and working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "🔍 MISTER System - Railway Deployment Verification"
print_status "=================================================="

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    print_error "Railway CLI not found. Please install it first."
    exit 1
fi

# Check if logged into Railway
if ! railway whoami &> /dev/null; then
    print_error "Not logged into Railway. Please run: railway login"
    exit 1
fi

print_status "Checking Railway project status..."
railway status

print_status "Getting service URLs..."

# Function to get service URL
get_service_url() {
    local service_name=$1
    local url=$(railway domain --service "$service_name" 2>/dev/null || echo "")
    if [ -n "$url" ]; then
        echo "https://$url"
    else
        echo ""
    fi
}

# Get service URLs
RISK_API_URL=$(get_service_url "risk-api")
TOKEN_API_URL=$(get_service_url "token-api")
MONITOR_URL=$(get_service_url "auto-monitor")

print_status "Service URLs:"
echo "  Risk API: ${RISK_API_URL:-'Not deployed or no domain'}"
echo "  Token API: ${TOKEN_API_URL:-'Not deployed or no domain'}"
echo "  Auto-Monitor: ${MONITOR_URL:-'Not deployed or no domain'}"

# Function to test HTTP endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local path=$3
    local full_url="${url}${path}"

    if [ -z "$url" ]; then
        print_warning "$name: No URL available"
        return 1
    fi

    print_status "Testing $name: $full_url"

    if curl -s -f "$full_url" > /dev/null; then
        print_success "$name: ✅ Responding"
        return 0
    else
        print_error "$name: ❌ Not responding"
        return 1
    fi
}

# Test service health endpoints
print_status "Testing service health endpoints..."

test_endpoint "Risk API Health" "$RISK_API_URL" "/health"
test_endpoint "Token API Health" "$TOKEN_API_URL" "/api/health"
test_endpoint "Auto-Monitor Health" "$MONITOR_URL" "/health"

# Test API functionality
print_status "Testing API functionality..."

if [ -n "$TOKEN_API_URL" ]; then
    print_status "Testing Token API stats endpoint..."
    if curl -s -f "${TOKEN_API_URL}/api/stats" > /dev/null; then
        print_success "Token API stats: ✅ Working"
    else
        print_warning "Token API stats: ⚠️ Not responding"
    fi
fi

if [ -n "$MONITOR_URL" ]; then
    print_status "Testing Auto-Monitor status endpoint..."
    if curl -s -f "${MONITOR_URL}/status" > /dev/null; then
        print_success "Auto-Monitor status: ✅ Working"
    else
        print_warning "Auto-Monitor status: ⚠️ Not responding"
    fi
fi

# Check database connectivity
print_status "Checking database connectivity..."
if railway run "psql \$DATABASE_URL -c 'SELECT 1;'" &> /dev/null; then
    print_success "Database: ✅ Connected"
else
    print_error "Database: ❌ Connection failed"
fi

# Summary
print_status "=================================================="
print_status "🎯 Deployment Verification Summary"
print_status "=================================================="

if [ -n "$RISK_API_URL" ] && [ -n "$TOKEN_API_URL" ]; then
    print_success "✅ Core services deployed successfully"

    echo ""
    print_status "🔗 Service URLs for your agent configuration:"
    echo "RISK_API_URL=$RISK_API_URL"
    echo "TOKEN_API_URL=$TOKEN_API_URL"

    echo ""
    print_status "📋 Next steps:"
    echo "1. Update your local agent configuration with the URLs above"
    echo "2. Test Discord bot functionality in your Discord server"
    echo "3. Monitor service logs for any issues"

else
    print_warning "⚠️ Some services may not be fully deployed"
    echo ""
    print_status "🔧 Troubleshooting steps:"
    echo "1. Check Railway dashboard for deployment status"
    echo "2. Review service logs for errors"
    echo "3. Verify environment variables are set correctly"
    echo "4. Re-run deployment script if needed"
fi

print_status "=================================================="
print_status "Verification completed!"
