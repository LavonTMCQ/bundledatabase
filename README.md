# Cabal Watch with Kupo

A system for tracking and analyzing Cardano wallet clusters and risk patterns using Kupo indexer.

## Overview

This project implements a Cabal analysis system that:

1. Uses Kupo to index Cardano blockchain data
2. Syncs UTxO events into a PostgreSQL database
3. Clusters wallets based on relationships
4. Scores risk factors for each cluster
5. Provides an API for querying the data

## Architecture

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
   kupo-sync worker ──► PostgreSQL
        │                     ▲
        │ cluster/risk cron   │ API queries
        ▼                     │
 API Gateway (Fastify) ──► UI / other agents
```

## Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- PostgreSQL (included in Docker Compose)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/cabal-database
   cd cabal-database
   ```

2. Create a `.env` file from the template:
   ```bash
   cp .env.sample .env
   ```

3. Edit the `.env` file with your configuration.

4. Start the services:
   ```bash
   docker-compose up -d
   ```

5. Test the local setup:
   ```bash
   ./test-local-setup.sh
   ```

6. Deploy to Railway (optional):
   ```bash
   ./deploy-to-railway.sh
   ```

## Components

### Kupo Sync Worker

The `kupo-sync` worker connects to Kupo's `/events` endpoint and streams blockchain data into the PostgreSQL database. It processes UTxO insertions and deletions to maintain an up-to-date view of token holdings.

### Cluster Analysis

The `cluster.js` script uses a Union-Find algorithm to group wallets into clusters based on their relationships. It identifies wallets that are likely controlled by the same entity.

### Risk Scoring

The `risk.js` script calculates risk scores for each cluster based on various heuristics:
- Developer concentration (dev holds > 20% supply)
- LP withdrawals (> 10% in 24h)
- Airdrop percentage (> 30%)
- Synchronized trading (≥ 3 wallets buying within same block)

### API Gateway

The API Gateway provides endpoints for querying the database:
- `/token/:policy/graph` - Get the wallet graph for a specific token
- `/tokens` - List all tokens with holder counts and risk scores
- `/cluster/:id` - Get details about a specific cluster

## Development

### Building the Kupo Sync Worker

```bash
cd kupo-sync
npm install
npm run build
```

### Running the API Locally

```bash
cd api
npm install
npm run dev
```

## Deployment

This project is designed to be deployed on Railway. You can use the provided deployment script:

```bash
./deploy-to-railway.sh
```

The script will:
1. Initialize a Railway project
2. Create the required volumes
3. Add PostgreSQL
4. Initialize the database schema
5. Deploy all services
6. Set up health monitoring (optional)

For detailed deployment steps, see the `cabal-kupo-setup-progress.md` file.

## Monitoring

A health monitoring script is included to check the status of all components:

```bash
./health-monitor.sh
```

You can set up a cron job to run this script regularly:

```bash
# Add to crontab to run every 15 minutes
*/15 * * * * /path/to/health-monitor.sh >> /path/to/health-monitor.log 2>&1
```

The script checks:
- Kupo health status
- Kupo synchronization with cardano-node
- API health status
- PostgreSQL replication lag (if applicable)
- Wallet edge updates

Alerts can be sent to a Discord webhook if configured in the `.env` file.

## License

[MIT License](LICENSE)
