#!/bin/bash
# Script to test the core components of Cabal watch (without full Cardano node)

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

print_status "Testing core components of Cabal watch system..."

# Check if .env file exists
if [ ! -f .env ]; then
  print_error "No .env file found. Please create one from .env.sample"
  exit 1
fi

# Start PostgreSQL only
print_status "Starting PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is running
for i in {1..30}; do
  if docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; then
    print_success "PostgreSQL is ready."
    break
  fi
  if [ $i -eq 30 ]; then
    print_error "PostgreSQL failed to start after 30 attempts."
    exit 1
  fi
  sleep 2
done

# Initialize the database schema
print_status "Initializing database schema..."
docker-compose exec -T postgres psql -U postgres -d cabal_db < schema.sql

if [ $? -ne 0 ]; then
  print_error "Failed to initialize database schema."
  exit 1
fi

print_success "Database schema initialized successfully."

# Insert test data
print_status "Inserting test data..."
docker-compose exec -T postgres psql -U postgres -d cabal_db << EOF
-- Insert test token
INSERT INTO token (policy_id, asset_name, decimals, first_seen)
VALUES ('test_policy_123', 'TEST', 6, NOW())
ON CONFLICT (policy_id) DO NOTHING;

-- Insert test wallets
INSERT INTO wallet (stake_cred, flags)
VALUES
  ('stake_test_1', '{"dev": true}'),
  ('stake_test_2', '{"airdrop": true}'),
  ('stake_test_3', '{}')
ON CONFLICT (stake_cred) DO NOTHING;

-- Insert test token holdings
INSERT INTO token_holding (policy_id, stake_cred, balance)
VALUES
  ('test_policy_123', 'stake_test_1', 1000000),
  ('test_policy_123', 'stake_test_2', 500000),
  ('test_policy_123', 'stake_test_3', 250000)
ON CONFLICT (policy_id, stake_cred) DO UPDATE SET balance = EXCLUDED.balance;

-- Insert test wallet edges
INSERT INTO wallet_edge (src, dst, relation, weight)
VALUES
  ('stake_test_1', 'stake_test_2', 'same_stake', 1.0),
  ('stake_test_2', 'stake_test_3', 'same_stake', 0.8)
ON CONFLICT (src, dst, relation) DO UPDATE SET weight = EXCLUDED.weight;
EOF

if [ $? -ne 0 ]; then
  print_error "Failed to insert test data."
  exit 1
fi

print_success "Test data inserted successfully."

# Test cluster analysis
print_status "Testing cluster analysis..."
docker-compose exec -T postgres psql -U postgres -d cabal_db -c "
-- Create a simple cluster for testing
INSERT INTO cluster (risk_score, tags) VALUES (0, '{}') ON CONFLICT DO NOTHING;
INSERT INTO cluster_member (cluster_id, stake_cred)
SELECT 1, 'stake_test_1' WHERE NOT EXISTS (SELECT 1 FROM cluster_member WHERE cluster_id = 1 AND stake_cred = 'stake_test_1');
"

if [ $? -ne 0 ]; then
  print_error "Cluster analysis failed."
  exit 1
fi

print_success "Cluster analysis completed successfully."

# Test risk scoring
print_status "Testing risk scoring..."
docker-compose exec -T postgres psql -U postgres -d cabal_db -c "
-- Update cluster risk score for testing
UPDATE cluster SET risk_score = 2.5, tags = '{\"test\"}' WHERE cluster_id = 1;
INSERT INTO cluster_score_history (cluster_id, score) VALUES (1, 2.5) ON CONFLICT DO NOTHING;
"

if [ $? -ne 0 ]; then
  print_error "Risk scoring failed."
  exit 1
fi

print_success "Risk scoring completed successfully."

# Build and start API
print_status "Building and starting API..."
cd api
npm install
npm run build
if [ $? -ne 0 ]; then
  print_error "Failed to build API."
  cd ..
  exit 1
fi

# Start API in background
npm start &
API_PID=$!
cd ..

# Wait for API to start
print_status "Waiting for API to start..."
sleep 10

# Test API health endpoint
print_status "Testing API health endpoint..."
for i in {1..10}; do
  if curl -s http://localhost:4000/health | grep -q "ready"; then
    print_success "API health endpoint is working."
    break
  fi
  if [ $i -eq 10 ]; then
    print_error "API health endpoint failed after 10 attempts."
    kill $API_PID 2>/dev/null
    exit 1
  fi
  sleep 2
done

# Test token graph API
print_status "Testing token graph API..."
TOKEN_GRAPH_RESPONSE=$(curl -s "http://localhost:4000/token/test_policy_123/graph")

if [ -z "$TOKEN_GRAPH_RESPONSE" ]; then
  print_error "Token graph API returned empty response."
  kill $API_PID 2>/dev/null
  exit 1
else
  print_success "Token graph API is working."
fi

# Test tokens endpoint
print_status "Testing tokens endpoint..."
TOKENS_RESPONSE=$(curl -s "http://localhost:4000/tokens")

if [ -z "$TOKENS_RESPONSE" ]; then
  print_error "Tokens endpoint returned empty response."
  kill $API_PID 2>/dev/null
  exit 1
else
  print_success "Tokens endpoint is working."
fi

# Test cluster endpoint
print_status "Testing cluster endpoint..."
CLUSTER_RESPONSE=$(curl -s "http://localhost:4000/cluster/1")

if [ -z "$CLUSTER_RESPONSE" ]; then
  print_error "Cluster endpoint returned empty response."
  kill $API_PID 2>/dev/null
  exit 1
else
  print_success "Cluster endpoint is working."
fi

# Clean up
print_status "Cleaning up..."
kill $API_PID 2>/dev/null
docker-compose down

print_success "Core components test completed successfully!"
print_status "You can access the REST API at http://localhost:4000/health when the API is running"
print_status "Available endpoints: /health, /tokens, /token/{policy}/graph, /cluster/{id}"
print_status "To run the full system with Cardano node, use: docker-compose up -d"
