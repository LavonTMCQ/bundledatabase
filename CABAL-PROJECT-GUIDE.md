# Cabal Watch with Kupo - Project Guide

## Overview

This document serves as a comprehensive guide to the Cabal watch system implementation using Kupo. It explains what has been done, where to find everything, and how to use the system.

## Project Structure

```
cabal-database/
├── api/                      # API Gateway
│   ├── src/                  # API source code
│   │   ├── index.ts          # Main API server
│   │   └── schema.ts         # GraphQL schema and resolvers
│   ├── Dockerfile            # Docker build instructions
│   ├── package.json          # Dependencies
│   └── tsconfig.json         # TypeScript configuration
│
├── cluster/                  # Clustering and risk analysis
│   ├── cluster.js            # Wallet clustering implementation
│   ├── cron.sh               # Cron job for nightly runs
│   └── risk.js               # Risk scoring implementation
│
├── config/                   # Cardano node configuration
│   └── mainnet.yaml          # Mainnet configuration
│
├── kupo-sync/                # Kupo sync worker
│   ├── src/                  # TypeScript source files
│   │   └── index.ts          # Main worker implementation
│   ├── dist/                 # Compiled JavaScript
│   ├── Dockerfile            # Docker build instructions
│   ├── package.json          # Dependencies
│   └── tsconfig.json         # TypeScript configuration
│
├── .env.sample               # Environment variables template
├── .gitignore                # Git ignore file
├── cabal-kupo-setup-progress.md  # Progress tracker
├── cabaldb.md                # Database design documentation
├── cabalxkupo.md             # Kupo integration documentation
├── deploy-to-railway.sh      # Railway deployment script
├── docker-compose.yml        # Docker services configuration
├── health-monitor.sh         # Health monitoring script
├── kupo-connection-guide.md  # Kupo connection guide
├── README.md                 # Project README
├── schema.sql                # Database schema
└── test-local-setup.sh       # Local testing script
```

## Key Components

### 1. Docker Compose Configuration (`docker-compose.yml`)

The Docker Compose file sets up the following services:
- **cardano-node**: Runs a Cardano node relay
- **ogmios**: Provides WebSocket interface to cardano-node
- **kupo**: Indexes the Cardano blockchain
- **kupo-sync**: Syncs Kupo events to PostgreSQL
- **postgres**: Stores the data

**Location**: `docker-compose.yml`

### 2. Database Schema (`schema.sql`)

The database schema defines tables for:
- Tokens
- Wallets
- Token holdings
- Wallet edges (connections)
- Clusters
- Cluster members
- Risk score history

**Location**: `schema.sql`

### 3. Kupo Sync Worker (`kupo-sync/`)

The Kupo sync worker:
- Connects to Kupo's events endpoint
- Processes UTxO insertions and deletions
- Updates the database with token holdings
- Maintains wallet relationships

**Key Files**:
- `kupo-sync/src/index.ts`: Main implementation
- `kupo-sync/package.json`: Dependencies
- `kupo-sync/Dockerfile`: Docker build instructions

### 4. Cluster Analysis (`cluster/`)

The cluster analysis scripts:
- Group wallets into clusters based on relationships
- Calculate risk scores for each cluster
- Run on a schedule via cron job

**Key Files**:
- `cluster/cluster.js`: Wallet clustering implementation
- `cluster/risk.js`: Risk scoring implementation
- `cluster/cron.sh`: Cron job for nightly runs

### 5. API Gateway (`api/`)

The API gateway provides:
- REST endpoints for basic queries
- GraphQL interface for complex queries
- Health check endpoints

**Key Files**:
- `api/src/index.ts`: Main API server
- `api/src/schema.ts`: GraphQL schema and resolvers
- `api/Dockerfile`: Docker build instructions

### 6. Testing and Deployment Scripts

Scripts for testing and deployment:
- `test-local-setup.sh`: Tests the local setup
- `deploy-to-railway.sh`: Deploys to Railway
- `health-monitor.sh`: Monitors system health

## How to Use

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/cabal-database
   cd cabal-database
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.sample .env
   # Edit .env with your configuration
   ```

3. **Start the services**:
   ```bash
   docker-compose up -d
   ```

4. **Test the setup**:
   ```bash
   ./test-local-setup.sh
   ```

5. **Access the API**:
   - REST API: http://localhost:4000/token/{policy_id}/graph
   - GraphQL Playground: http://localhost:4000/graphiql

### Deployment

1. **Deploy to Railway**:
   ```bash
   ./deploy-to-railway.sh
   ```

2. **Set up monitoring**:
   ```bash
   # Add to crontab to run every 15 minutes
   */15 * * * * /path/to/health-monitor.sh >> /path/to/health-monitor.log 2>&1
   ```

## GraphQL Queries

The GraphQL API supports the following queries:

### Get All Tokens
```graphql
{
  tokens {
    policyId
    assetName
    decimals
    holderCount
    maxRiskScore
  }
}
```

### Get Token Graph
```graphql
{
  tokenGraph(policyId: "test_policy_123") {
    stakeCred
    clusterId
    edges {
      dst
      relation
      weight
    }
  }
}
```

### Get Cluster Details
```graphql
{
  cluster(clusterId: 1) {
    clusterId
    riskScore
    tags
    members {
      stakeCred
      flags
    }
    history {
      score
      timestamp
    }
  }
}
```

### Get High-Risk Clusters
```graphql
{
  highRiskClusters(threshold: 5) {
    clusterId
    riskScore
    tags
  }
}
```

## Documentation

The project includes several documentation files:

- **README.md**: General project overview
- **cabal-kupo-setup-progress.md**: Detailed progress tracker
- **cabaldb.md**: Database design documentation
- **cabalxkupo.md**: Kupo integration documentation
- **kupo-connection-guide.md**: Guide to connecting to Kupo

## Next Steps

1. **Run the test script** to validate the local setup:
   ```bash
   ./test-local-setup.sh
   ```

2. **Deploy to Railway** using the deployment script:
   ```bash
   ./deploy-to-railway.sh
   ```

3. **Set up health monitoring**:
   ```bash
   # Add to crontab
   */15 * * * * /path/to/health-monitor.sh >> /path/to/health-monitor.log 2>&1
   ```

4. **Consider implementing additional features**:
   - pgvector embeddings for wallet-behavior similarity
   - Real-time Discord alerts on risk-score spikes
   - Time-travel queries via Kupo's snapshot API
   - Webhook marketplace for token teams

## Troubleshooting

### Common Issues

1. **Kupo not syncing**:
   - Check Kupo logs: `docker-compose logs kupo`
   - Verify cardano-node is running: `docker-compose logs node`
   - Ensure Ogmios is connected: `docker-compose logs ogmios`

2. **Database connection issues**:
   - Verify PostgreSQL is running: `docker-compose logs postgres`
   - Check connection string in .env file
   - Ensure schema is initialized: `docker-compose exec postgres psql -U postgres -d cabal_db -c "\dt"`

3. **API not responding**:
   - Check API logs: `docker-compose logs api`
   - Verify API container is running: `docker-compose ps api`
   - Test health endpoint: `curl http://localhost:4000/health`

### Getting Help

For additional help, refer to:
- The progress tracker (`cabal-kupo-setup-progress.md`)
- The Kupo documentation: https://cardanosolutions.github.io/kupo
- The Railway documentation: https://docs.railway.app
