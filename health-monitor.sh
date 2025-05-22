#!/bin/bash
# Health monitoring script for Cabal watch with Kupo

# Load environment variables
source .env

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Function to print success messages
print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to print error messages
print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Function to send alert
send_alert() {
  local message="$1"
  local severity="$2"
  
  if [ -n "$ALERT_WEBHOOK" ]; then
    curl -s -X POST -H "Content-Type: application/json" \
      -d "{\"content\": \"[$severity] $message\", \"username\": \"Cabal Health Monitor\"}" \
      "$ALERT_WEBHOOK" > /dev/null
    
    print_status "Alert sent: [$severity] $message"
  else
    print_status "Alert would be sent (no webhook configured): [$severity] $message"
  fi
}

# Check Kupo health
check_kupo_health() {
  local kupo_url="${KUPO_URL:-http://kupo:1442}"
  local response
  
  print_status "Checking Kupo health..."
  
  response=$(curl -s "$kupo_url/health" 2>/dev/null)
  
  if [ $? -ne 0 ] || [ -z "$response" ]; then
    print_error "Kupo health check failed: No response"
    send_alert "Kupo health check failed: No response" "CRITICAL"
    return 1
  fi
  
  if echo "$response" | grep -q "ready"; then
    print_success "Kupo is healthy"
    return 0
  else
    print_error "Kupo is not ready: $response"
    send_alert "Kupo is not ready: $response" "WARNING"
    return 1
  fi
}

# Check Kupo tip vs cardano-node tip
check_kupo_tip() {
  local kupo_url="${KUPO_URL:-http://kupo:1442}"
  local kupo_tip
  local node_tip
  
  print_status "Checking Kupo tip vs cardano-node tip..."
  
  kupo_tip=$(curl -s "$kupo_url/tip" 2>/dev/null)
  
  if [ $? -ne 0 ] || [ -z "$kupo_tip" ]; then
    print_error "Failed to get Kupo tip"
    send_alert "Failed to get Kupo tip" "WARNING"
    return 1
  fi
  
  node_tip=$(curl -s "http://localhost:3100/api/v1/tip" 2>/dev/null)
  
  if [ $? -ne 0 ] || [ -z "$node_tip" ]; then
    print_error "Failed to get cardano-node tip"
    send_alert "Failed to get cardano-node tip" "WARNING"
    return 1
  fi
  
  kupo_slot=$(echo "$kupo_tip" | grep -o '"slot":[0-9]*' | cut -d':' -f2)
  node_slot=$(echo "$node_tip" | grep -o '"slot":[0-9]*' | cut -d':' -f2)
  
  if [ -z "$kupo_slot" ] || [ -z "$node_slot" ]; then
    print_error "Failed to parse slot numbers"
    send_alert "Failed to parse slot numbers" "WARNING"
    return 1
  fi
  
  lag=$((node_slot - kupo_slot))
  
  if [ $lag -le 30 ]; then
    print_success "Kupo is in sync with cardano-node (lag: $lag slots)"
    return 0
  else
    print_error "Kupo is lagging behind cardano-node by $lag slots"
    send_alert "Kupo is lagging behind cardano-node by $lag slots" "WARNING"
    return 1
  fi
}

# Check API health
check_api_health() {
  local api_url="${API_URL:-http://localhost:4000}"
  local response
  
  print_status "Checking API health..."
  
  response=$(curl -s "$api_url/health" 2>/dev/null)
  
  if [ $? -ne 0 ] || [ -z "$response" ]; then
    print_error "API health check failed: No response"
    send_alert "API health check failed: No response" "CRITICAL"
    return 1
  fi
  
  if echo "$response" | grep -q "ready"; then
    print_success "API is healthy"
    return 0
  else
    print_error "API is not ready: $response"
    send_alert "API is not ready: $response" "WARNING"
    return 1
  fi
}

# Check PostgreSQL replication lag
check_pg_replication() {
  local pg_url="${DATABASE_URL}"
  local response
  
  if [ -z "$pg_url" ]; then
    print_status "Skipping PostgreSQL replication check (no DATABASE_URL)"
    return 0
  fi
  
  print_status "Checking PostgreSQL replication lag..."
  
  response=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DATABASE" -c "SELECT replay_lag FROM pg_stat_replication" -t 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    print_status "No replication found or not applicable"
    return 0
  fi
  
  if [ -z "$response" ]; then
    print_status "No replication found or not applicable"
    return 0
  fi
  
  lag_seconds=$(echo "$response" | awk '{print $1}')
  
  if [ -z "$lag_seconds" ] || [ "$lag_seconds" = "NULL" ]; then
    print_status "No replication lag found or not applicable"
    return 0
  fi
  
  if [ $(echo "$lag_seconds <= 5" | bc) -eq 1 ]; then
    print_success "PostgreSQL replication lag is acceptable: $lag_seconds seconds"
    return 0
  else
    print_error "PostgreSQL replication lag is high: $lag_seconds seconds"
    send_alert "PostgreSQL replication lag is high: $lag_seconds seconds" "WARNING"
    return 1
  fi
}

# Check wallet edge updates
check_wallet_edge_updates() {
  local pg_url="${DATABASE_URL}"
  local response
  
  if [ -z "$pg_url" ]; then
    print_status "Skipping wallet edge updates check (no DATABASE_URL)"
    return 0
  fi
  
  print_status "Checking wallet edge updates..."
  
  response=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DATABASE" -c "SELECT count(*) FROM wallet_edge WHERE updated_at > now()-'10 minutes'::interval" -t 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    print_error "Failed to check wallet edge updates"
    send_alert "Failed to check wallet edge updates" "WARNING"
    return 1
  fi
  
  count=$(echo "$response" | tr -d ' ')
  
  if [ "$count" -gt 0 ]; then
    print_success "Wallet edges are being updated: $count updates in the last 10 minutes"
    return 0
  else
    print_error "No wallet edge updates in the last 10 minutes"
    send_alert "No wallet edge updates in the last 10 minutes" "WARNING"
    return 1
  fi
}

# Main function
main() {
  print_status "Starting health checks..."
  
  # Run all checks
  check_kupo_health
  check_kupo_tip
  check_api_health
  check_pg_replication
  check_wallet_edge_updates
  
  print_status "Health checks completed."
}

# Run main function
main
