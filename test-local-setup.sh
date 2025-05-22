#!/bin/bash
# Script to test the local setup of Cabal watch with Kupo

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

# Check if .env file exists
if [ ! -f .env ]; then
  print_error "No .env file found. Creating one from .env.sample..."
  cp .env.sample .env
  print_status "Please edit the .env file with your configuration before continuing."
  exit 1
fi

# Create a test database
print_status "Creating test environment..."

# Start the services
print_status "Starting Docker services..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is running
if ! docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; then
  print_error "PostgreSQL is not ready. Please check the logs with 'docker-compose logs postgres'"
  exit 1
fi

print_success "PostgreSQL is ready."

# Initialize the database schema
print_status "Initializing database schema..."
docker-compose exec -T postgres psql -U postgres -d cabal_db < schema.sql

if [ $? -ne 0 ]; then
  print_error "Failed to initialize database schema."
  exit 1
fi

print_success "Database schema initialized successfully."

# Start the rest of the services
print_status "Starting remaining services..."
docker-compose up -d

# Wait for services to be ready
print_status "Waiting for services to be ready (this may take a while)..."
sleep 10

# Check if Kupo is running
print_status "Checking Kupo service..."
if ! curl -s http://localhost:1442/health | grep -q "ready"; then
  print_error "Kupo service is not ready. Please check the logs with 'docker-compose logs kupo'"
else
  print_success "Kupo service is running."
fi

# Check if API is running
print_status "Checking API service..."
if ! curl -s http://localhost:4000/health | grep -q "ready"; then
  print_error "API service is not ready. Please check the logs with 'docker-compose logs api'"
else
  print_success "API service is running."
fi

# Test GraphQL endpoint
print_status "Testing GraphQL endpoint..."
GRAPHQL_QUERY='{"query":"{ tokens { policyId assetName } }"}'
GRAPHQL_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$GRAPHQL_QUERY" http://localhost:4000/graphql)

if echo "$GRAPHQL_RESPONSE" | grep -q "errors"; then
  print_error "GraphQL query failed. Response: $GRAPHQL_RESPONSE"
else
  print_success "GraphQL endpoint is working."
fi

# Insert test data
print_status "Inserting test data..."
docker-compose exec -T postgres psql -U postgres -d cabal_db << EOF
-- Insert test token
INSERT INTO token (policy_id, asset_name, decimals, first_seen) 
VALUES ('test_policy_123', 'TEST', 6, NOW());

-- Insert test wallets
INSERT INTO wallet (stake_cred, flags) 
VALUES 
  ('stake_test_1', '{"dev": true}'),
  ('stake_test_2', '{"airdrop": true}'),
  ('stake_test_3', '{}');

-- Insert test token holdings
INSERT INTO token_holding (policy_id, stake_cred, balance) 
VALUES 
  ('test_policy_123', 'stake_test_1', 1000000),
  ('test_policy_123', 'stake_test_2', 500000),
  ('test_policy_123', 'stake_test_3', 250000);

-- Insert test wallet edges
INSERT INTO wallet_edge (src, dst, relation, weight) 
VALUES 
  ('stake_test_1', 'stake_test_2', 'same_stake', 1.0),
  ('stake_test_2', 'stake_test_3', 'same_stake', 0.8);
EOF

if [ $? -ne 0 ]; then
  print_error "Failed to insert test data."
  exit 1
fi

print_success "Test data inserted successfully."

# Run cluster analysis
print_status "Running cluster analysis..."
docker-compose exec -T cluster node cluster.js

if [ $? -ne 0 ]; then
  print_error "Cluster analysis failed."
  exit 1
fi

print_success "Cluster analysis completed successfully."

# Run risk scoring
print_status "Running risk scoring..."
docker-compose exec -T cluster node risk.js

if [ $? -ne 0 ]; then
  print_error "Risk scoring failed."
  exit 1
fi

print_success "Risk scoring completed successfully."

# Test token graph API
print_status "Testing token graph API..."
TOKEN_GRAPH_RESPONSE=$(curl -s "http://localhost:4000/token/test_policy_123/graph")

if [ -z "$TOKEN_GRAPH_RESPONSE" ]; then
  print_error "Token graph API returned empty response."
else
  print_success "Token graph API is working."
fi

# Test GraphQL query for token graph
print_status "Testing GraphQL query for token graph..."
GRAPHQL_QUERY='{"query":"{ tokenGraph(policyId: \"test_policy_123\") { stakeCred clusterId } }"}'
GRAPHQL_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$GRAPHQL_QUERY" http://localhost:4000/graphql)

if echo "$GRAPHQL_RESPONSE" | grep -q "errors"; then
  print_error "GraphQL query for token graph failed. Response: $GRAPHQL_RESPONSE"
else
  print_success "GraphQL query for token graph is working."
fi

print_status "Local setup test completed."
print_status "You can access the GraphQL playground at http://localhost:4000/graphiql"

# Cleanup (optional)
# print_status "Cleaning up test environment..."
# docker-compose down
# print_success "Test environment cleaned up."
