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
- [ ] Implement GraphQL schema
- [X] Create endpoints for token graph queries

### 7. Testing & Validation
- [ ] Test local setup with docker-compose
- [ ] Validate database syncing
- [ ] Test clustering algorithm
- [ ] Test risk scoring
- [ ] Validate API endpoints

### 8. Deployment
- [ ] Set up Railway project
- [ ] Create required volumes
- [ ] Deploy PostgreSQL database
- [ ] Deploy services
- [ ] Configure environment variables
- [ ] Set up health monitoring

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

### Date: [Current Date]
- Initial setup of progress tracker
- Analyzed existing documentation
- Created implementation plan
- Created directory structure
- Created docker-compose.yml
- Created database schema
- Implemented kupo-sync worker
- Implemented cluster.js and risk.js
- Implemented API gateway with Fastify

## Next Steps
1. Implement GraphQL schema for more complex queries
2. Test local setup with docker-compose
3. Deploy to Railway
4. Set up health monitoring

