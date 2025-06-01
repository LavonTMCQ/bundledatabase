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
