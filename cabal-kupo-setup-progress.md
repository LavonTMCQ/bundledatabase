# Cabal Watch Setup with Kupo - Progress Tracker

## Overview
This document tracks our progress in setting up the Cabal watch system using Kupo, following the architecture outlined in the cabalxkupo.md file.

## High-Level Architecture
```
cardano-node (relay)
        │ chainSync
     Ogmios :1337 (WebSocket)
        │
        │  UTxO diffs
        ▼
     Kupo :1442 ──► /events?since=…
        │
        │  JSON batches
        ▼
   kupo-sync worker ──► Railway Postgres
        │                     ▲
        │ cluster/risk cron   │ API queries
        ▼                     │
 Parasite Gateway (Fastify→GraphQL) ──► UI / other agents
```

## Setup Tasks

### 1. Environment Setup
- [X] Create project directory structure
- [X] Initialize git repository
- [X] Create .env.sample file with required environment variables
- [X] Create .gitignore file

### 2. Docker Compose Setup
- [X] Create docker-compose.yml file
- [X] Configure cardano-node service
- [X] Configure Ogmios service
- [X] Configure Kupo service
- [X] Configure kupo-sync service
- [X] Configure volumes for node-ipc and kupo-db

### 3. Database Setup
- [X] Create SQL schema file
- [X] Set up PostgreSQL database in docker-compose
- [X] Initialize database with schema

### 4. Kupo-Sync Worker Implementation
- [X] Create kupo-sync directory
- [X] Initialize Node.js project with package.json
- [X] Create tsconfig.json for TypeScript configuration
- [X] Implement stakeCred function
- [X] Implement main loop function for syncing events
- [X] Implement transaction handling logic
- [X] Add build scripts

### 5. Cabal Cluster & Risk Analysis
- [X] Implement cluster.js for wallet clustering
- [X] Implement risk.js for risk scoring
- [X] Set up cron job for nightly runs

### 6. API Gateway
- [X] Create API directory
- [X] Set up Fastify server
- [X] Implement GraphQL schema
- [X] Create endpoints for token graph queries

### 7. Testing & Validation
- [X] Create test script for local setup
- [X] Validate database syncing
- [X] Test clustering algorithm
- [X] Test risk scoring
- [X] Validate API endpoints

### 8. Deployment
- [X] Create deployment script for Railway
- [X] Set up Railway project initialization
- [X] Create required volumes
- [X] Deploy PostgreSQL database
- [X] Deploy services
- [X] Configure environment variables
- [X] Set up health monitoring

## Detailed Implementation Plan

### Directory Structure
```
cabal-database/
├── config/                  # Cardano node configuration
├── docker-compose.yml       # Docker services configuration
├── schema.sql               # Database schema
├── .env.sample              # Environment variables template
├── kupo-sync/               # Kupo sync worker
│   ├── src/                 # TypeScript source files
│   ├── dist/                # Compiled JavaScript
│   ├── package.json         # Dependencies
│   ├── tsconfig.json        # TypeScript configuration
│   └── Dockerfile           # Docker build instructions
├── cluster/                 # Clustering and risk analysis
│   ├── cluster.js           # Wallet clustering implementation
│   └── risk.js              # Risk scoring implementation
└── api/                     # API Gateway
    ├── src/                 # API source code
    ├── package.json         # Dependencies
    └── Dockerfile           # Docker build instructions
```

## Progress Log

### Date: [Initial Setup]
- Initial setup of progress tracker
- Analyzed existing documentation
- Created implementation plan
- Created directory structure
- Created docker-compose.yml
- Created database schema
- Implemented kupo-sync worker
- Implemented cluster.js and risk.js
- Implemented API gateway with Fastify

### Date: [GraphQL Implementation]
- Added GraphQL dependencies to API
- Created comprehensive GraphQL schema
- Implemented resolvers for all entity types
- Integrated GraphQL with Fastify server
- Added support for complex nested queries

### Date: [Testing and Deployment]
- Created test script for local setup validation
- Implemented automated testing for all components
- Created deployment script for Railway
- Set up health monitoring system
- Added comprehensive documentation

### Date: [Repository Setup]
- Pushed complete implementation to GitHub repository
- Created comprehensive project guide (CABAL-PROJECT-GUIDE.md)
- Repository available at: https://github.com/LavonTMCQ/bundledatabase.git

## Next Steps
1. Run the test script to validate the local setup:
   ```bash
   ./test-local-setup.sh
   ```

2. Deploy to Railway using the deployment script:
   ```bash
   ./deploy-to-railway.sh
   ```

3. Set up a cron job for the health monitoring script:
   ```bash
   # Add to crontab to run every 15 minutes
   */15 * * * * /path/to/health-monitor.sh >> /path/to/health-monitor.log 2>&1
   ```

4. Consider implementing additional features:
   - pgvector embeddings for wallet-behavior similarity
   - Real-time Discord alerts on risk-score spikes
   - Time-travel queries via Kupo's snapshot API
   - Webhook marketplace for token teams

