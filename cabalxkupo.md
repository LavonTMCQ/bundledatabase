# Kupo‑Powered Cabal Indexer & Risk Engine

**One‑Shot Deployment Guide for the MASTRA Agent Cluster**

---

## 0. TL;DR

1. **Spin up** `cardano‑node → Ogmios → Kupo` (relay‑light footprints).
2. **Deploy** a `kupo‑sync` worker that streams `/events` into Railway Postgres.
3. **Run** the Cabal clustering & risk‑scorer cron.
4. **Expose** a GraphQL/REST micro‑service for the Parasite front‑end and any other agents.

Everything—container specs, DB schema, env vars, health probes—is in this file. Paste it straight into your agent’s context or initialise a new repo with it.

---

## 1. High‑Level Architecture

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

---

## 2. Deployment Steps

### 2.1 Railway Project & Volumes

```bash
railway init cabal-indexer
railway volume create node-ipc   # chain db & socket (~25 GB main‑net)
railway volume create kupo-db    # pruned index (~12 GB)
railway add postgres             # free tier is fine to start
```

### 2.2 `docker-compose.yml`

```yaml
version: "3.9"
services:
  node:
    image: ghcr.io/input-output-hk/cardano-node:8.10.0
    command: ["run", "--config", "/config/mainnet.yaml"]
    volumes: ["node-ipc:/ipc", "./config:/config"]
    restart: unless-stopped
    environment:
      - NETWORK=mainnet

  ogmios:
    image: cardanosolutions/ogmios:v6.2.0
    command: ["--node-socket","/ipc/node.socket","--host","0.0.0.0"]
    volumes: ["node-ipc:/ipc"]
    depends_on: [node]
    restart: unless-stopped

  kupo:
    image: cardanosolutions/kupo:v2.10.0
    command: >
      --node-socket /ipc/node.socket
      --host 0.0.0.0 --port 1442
      --since origin
      --match-policy '.*'
      --prune-utxo
      --ogmios http://ogmios:1337
    depends_on: [ogmios]
    volumes: ["kupo-db:/var/lib/kupo","node-ipc:/ipc"]
    restart: unless-stopped

  kupo-sync:
    build: ./kupo-sync        # see § 3
    environment:
      KUPO_URL: http://kupo:1442
      DATABASE_URL: ${PG_URL}
    depends_on: [kupo, postgres]
    restart: unless-stopped
volumes:
  node-ipc:
  kupo-db:
```

Push this file to Railway; Auto‑Deploy will orchestrate the stack.

---

## 3. `kupo‑sync` Worker Skeleton (TypeScript)

```ts
import 'dotenv/config';
import fetch from 'node-fetch';
import { Pool } from 'pg';
import { Address } from '@emurgo/cardano-serialization-lib-nodejs';

const { KUPO_URL, DATABASE_URL } = process.env;
const pg = new Pool({ connectionString: DATABASE_URL });

async function stakeCred(addrBech: string) {
  const addr = Address.from_bech32(addrBech).to_base_address();
  const cred = addr?.stake_cred();
  return cred ? Buffer.from(cred.to_bytes()).toString('hex') : null;
}

async function loop() {
  let { rows: [{ point }] } = await pg.query(
    "SELECT COALESCE(max_point,'origin') AS point FROM sync_cursor");
  // eslint-disable-next-line
  while (true) {
    const r = await fetch(`${KUPO_URL}/mainnet/events?since=${point}`);
    const events = await r.json();
    if (!events.length) { await new Promise(r => setTimeout(r, 2000)); continue; }

    const client = await pg.connect();
    try {
      await client.query('BEGIN');
      for (const ev of events) {
        for (const utxo of ev.insert) {
          const stake = await stakeCred(utxo.address);
          await client.query(`
            INSERT INTO wallet (stake_cred) VALUES ($1)
            ON CONFLICT DO NOTHING`, [stake]);

          await client.query(`
            INSERT INTO token_holding (policy_id, stake_cred, balance)
            VALUES ($1,$2,$3)
            ON CONFLICT (policy_id,stake_cred)
            DO UPDATE SET balance = EXCLUDED.balance`,
            [utxo.asset.policy, stake, utxo.asset.quantity]);
        }
        // similar logic for deletes → set balance 0 or remove row
      }
      point = events.at(-1).point;
      await client.query(`
        INSERT INTO sync_cursor(max_point) VALUES ($1)
        ON CONFLICT (id) DO UPDATE SET max_point = $1`, [point]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK'); console.error(e);
    } finally { client.release(); }
  }
}
loop();
```

> **Build**
>
> ```bash
> pnpm i
> pnpm build      # transpile to dist/
> ```

---

## 4. Postgres Schema

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE sync_cursor(id int PRIMARY KEY DEFAULT 0, max_point text);

CREATE TABLE token (
  policy_id text PRIMARY KEY,
  asset_name text,
  decimals int,
  first_seen timestamptz DEFAULT now()
);

CREATE TABLE wallet (
  stake_cred text PRIMARY KEY,
  flags jsonb DEFAULT '{}'  -- farmer/dev etc.
);

CREATE TABLE token_holding (
  policy_id text REFERENCES token,
  stake_cred text REFERENCES wallet,
  balance numeric,
  last_seen timestamptz DEFAULT now(),
  PRIMARY KEY (policy_id, stake_cred)
);

CREATE TABLE wallet_edge (
  src text, dst text, relation text, weight numeric,
  PRIMARY KEY (src, dst, relation)
);

CREATE TABLE cluster (
  cluster_id serial PRIMARY KEY,
  risk_score numeric,
  tags text[]
);
CREATE TABLE cluster_member (
  cluster_id int REFERENCES cluster,
  stake_cred text REFERENCES wallet,
  PRIMARY KEY (cluster_id, stake_cred)
);
```

---

## 5. Cabal Cluster & Risk Cron

*Run nightly or on‑demand.*

```bash
node cluster.js          # union‑find on wallet_edge where relation='same_stake'
node risk.js             # compute heuristics & update cluster.risk_score
```

*Example risk weights (tweak as needed):*

| Heuristic                | SQL                       | Weight |
| ------------------------ | ------------------------- | ------ |
| Dev holds > 20 % supply  | pct\_supply(dev\_cluster) | +4     |
| LP pulled > 10 % in 24 h | lp\_delta                 | +3     |
| Airdrop wallets > 30 %   | addr\_tag='airdrop'       | +2     |

Store history to `cluster_score_history(cluster_id, score, ts)` for trend charts.

---

## 6. API Gateway (Fastify + tRPC sample)

```ts
app.get('/token/:policy/graph', async (req, rep) => {
  const { rows } = await pg.query(`
    SELECT w.stake_cred, cm.cluster_id, c.risk_score,
           json_agg(json_build_object('dst', e.dst, 'rel', e.relation, 'w', e.weight)) edges
    FROM wallet w
    JOIN token_holding th ON th.stake_cred = w.stake_cred
    LEFT JOIN cluster_member cm ON cm.stake_cred = w.stake_cred
    LEFT JOIN cluster c ON c.cluster_id = cm.cluster_id
    LEFT JOIN wallet_edge e ON e.src = w.stake_cred
    WHERE th.policy_id = $1
    GROUP BY w.stake_cred, cm.cluster_id, c.risk_score`, [req.params.policy]);
  rep.send(rows);
});
```

---

## 7. Environment Variables

| Var             | Example                               | Used by        |
| --------------- | ------------------------------------- | -------------- |
| `KUPO_URL`      | `http://kupo:1442`                    | kupo‑sync      |
| `DATABASE_URL`  | `postgresql://user:pass@host:5432/db` | kupo‑sync, API |
| `NODE_ENV`      | `production`                          | node services  |
| `ALERT_WEBHOOK` | Discord URL                           | risk cron      |

---

## 8. Health & Alerts

| Endpoint                                                             | Healthy response     | Alarm if |
| -------------------------------------------------------------------- | -------------------- | -------- |
| `GET /health` (Kupo)                                                 | `{"status":"ready"}` | non‑200  |
| `GET /tip` (Kupo) vs `cardano-node tip`                              | lag ≤ 30 s           | > 30 s   |
| `pg_stat_replication` (if read‑replicas)                             | replay\_lag ≤ 5 s    | > 10 s   |
| `SELECT count(*) FROM wallet_edge WHERE updated_at > now()-'10 min'` | growing              | 0 rows   |

Use Railway’s metrics tab or pipe to Grafana/Tg alerts.

---

## 9. Quick‑Start Script (local test)

```bash
git clone https://github.com/your‑org/cabal-indexer
cd cabal-indexer
cp .env.sample .env      # set KUPO_URL + DATABASE_URL
docker compose up -d     # node, ogmios, kupo, postgres, worker
pnpm install && pnpm build && node dist/cluster.js
curl localhost:4000/token/<policy>/graph  # sanity check
```

---

## 10. Next Feature Ideas

1. **pgvector embeddings** for wallet‑behavior similarity.
2. **Real‑time Discord alerts** on risk‑score spikes.
3. **Time‑travel queries** (`AS OF BLOCK …`) via Kupo’s snapshot API.
4. **Webhook marketplace** so other token teams can subscribe to Cabal feeds.

---

### Done.

Drop this file anywhere your MASTRA agent can read Markdown (or convert to JSON spec). The stack will self‑bootstrap; the only manual wait is syncing the node to tip (≈ 4 h on a good connection).

Ping me if you need production hardening (back‑ups, pgBouncer, read‑replicas) or a deeper dive into the risk‑scoring model.
