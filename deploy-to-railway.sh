#!/bin/bash
# Script to deploy Cabal watch with Kupo to Railway

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

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
  print_error "Railway CLI is not installed. Please install it first:"
  print_status "npm i -g @railway/cli"
  exit 1
fi

# Check if user is logged in to Railway
if ! railway whoami &> /dev/null; then
  print_error "You are not logged in to Railway. Please login first:"
  print_status "railway login"
  exit 1
fi

# Initialize Railway project
print_status "Initializing Railway project..."
railway init cabal-indexer

if [ $? -ne 0 ]; then
  print_error "Failed to initialize Railway project."
  exit 1
fi

print_success "Railway project initialized successfully."

# Create volumes
print_status "Creating volumes..."
railway volume create node-ipc
railway volume create kupo-db

if [ $? -ne 0 ]; then
  print_error "Failed to create volumes."
  exit 1
fi

print_success "Volumes created successfully."

# Add PostgreSQL
print_status "Adding PostgreSQL..."
railway add postgres

if [ $? -ne 0 ]; then
  print_error "Failed to add PostgreSQL."
  exit 1
fi

print_success "PostgreSQL added successfully."

# Get PostgreSQL connection string
print_status "Getting PostgreSQL connection string..."
PG_URL=$(railway variables get DATABASE_URL)

if [ -z "$PG_URL" ]; then
  print_error "Failed to get PostgreSQL connection string."
  exit 1
fi

print_success "PostgreSQL connection string retrieved successfully."

# Initialize database schema
print_status "Initializing database schema..."
railway run "psql $PG_URL -f schema.sql"

if [ $? -ne 0 ]; then
  print_error "Failed to initialize database schema."
  exit 1
fi

print_success "Database schema initialized successfully."

# Deploy services
print_status "Deploying services..."
railway up

if [ $? -ne 0 ]; then
  print_error "Failed to deploy services."
  exit 1
fi

print_success "Services deployed successfully."

# Get service URLs
print_status "Getting service URLs..."
API_URL=$(railway service api domain)
KUPO_URL=$(railway service kupo domain)

print_status "API URL: $API_URL"
print_status "Kupo URL: $KUPO_URL"

print_success "Deployment completed successfully."
print_status "You can access the GraphQL playground at https://$API_URL/graphiql"

# Set up monitoring (optional)
print_status "Would you like to set up monitoring? (y/n)"
read -r setup_monitoring

if [[ "$setup_monitoring" =~ ^[Yy]$ ]]; then
  print_status "Setting up monitoring..."
  
  # Set up health check
  print_status "Setting up health check for API..."
  railway service api healthcheck --path /health --interval 60 --timeout 5 --retries 3
  
  print_status "Setting up health check for Kupo..."
  railway service kupo healthcheck --path /health --interval 60 --timeout 5 --retries 3
  
  # Set up alerts
  print_status "Setting up alerts..."
  print_status "Please enter a Discord webhook URL for alerts (leave empty to skip):"
  read -r webhook_url
  
  if [ -n "$webhook_url" ]; then
    railway variables set ALERT_WEBHOOK="$webhook_url"
    print_success "Alert webhook configured successfully."
  fi
  
  print_success "Monitoring setup completed successfully."
fi

print_status "Deployment and setup completed successfully."
