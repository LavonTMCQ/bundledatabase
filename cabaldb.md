### Deep‑Dive Blueprint

**Cabal Analysis + Wallet‑Connection Indexer for Cardano**

---

#### 1. Why seed a database first?

* **Speed** – your Parasite front‑end can fetch a pre‑joined graph in ≤ 100 ms instead of crawling the chain on every page‑load.
* **Stability** – you normalize stake credentials once, so all derivative analytics (cabal clustering, risk scores, whale heatmaps) share one source of truth.
* **Cost control** – one well‑tuned indexer can hit Koios / Blockfrost aggressively, cache the results in your Railway Postgres once, and every UI read after that is free.

---

#### 2. System‑level architecture

| Layer                         | What it does                                                                        | Tech options                                                                                                                                                                                                                           | Notes                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **A. Chain Watcher / Seeder** | Streams new blocks & mints, bulk‑downloads holder snapshots, normalizes stake creds | • **Blockfrost REST + WebSocket‑Link** (zero infra) ([GitHub][1])  <br>• **Koios** (free REST, high rate‑limit) ([api.koios.rest][2])  <br>• **Self‑hosted Oura + Ogmios** (full tip‑of‑chain pipeline) ([ogmios.dev][3], [GitHub][4]) | Start with Blockfrost/Koios; drop in Oura later for true real‑time |
| **B. Cabal Analysis Engine**  | Groups wallets into clusters by stake address + heuristic overlaps, scores risk     | Rust or TypeScript service with a job queue (BullMQ / RabbitMQ).  Uses pgvector or Neo4j for graph ops if Postgres edges grow large.                                                                                                   |                                                                    |
| **C. Railway Postgres**       | Authoritative store for tokens, wallets, clusters, risk metrics                     | Railway “PostgreSQL” template (1‑click, auto‑backups) ([Railway Docs][5])                                                                                                                                                              | Partition by `token_policy_id` to keep hot shards small            |
| **D. API / Graph Gateway**    | Serves data to Parasite UI & any other micro‑services                               | Fastify + TRPC or NestJS GraphQL; JWT keyed to user tier                                                                                                                                                                               |                                                                    |
| **E. Front‑end (Parasite)**   | Renders interactive graph (d3‑force / Cytoscape) & risk panels                      | Already in place; consumes cluster+edge JSON                                                                                                                                                                                           |                                                                    |

---

#### 3. Database schema (Postgres)

```sql
-- tokens
CREATE TABLE token (
  policy_id      text PRIMARY KEY,
  asset_name     text,
  decimals       int,
  first_seen     timestamptz,
  market_cap_ada numeric,
  last_refreshed timestamptz
);

-- individual stake wallets
CREATE TABLE wallet (
  stake_cred   text PRIMARY KEY,
  first_tx     bigint,
  last_tx      bigint,
  flags        jsonb  -- e.g. {"farmer":true,"dev":false}
);

-- many‑to‑many: which wallets hold which tokens
CREATE TABLE token_holding (
  policy_id   text REFERENCES token,
  stake_cred  text REFERENCES wallet,
  balance     numeric,
  last_seen   bigint,
  PRIMARY KEY (policy_id, stake_cred)
);

-- clustering
CREATE TABLE cluster (
  cluster_id   bigserial PRIMARY KEY,
  risk_score   numeric,
  tags         text[]
);
CREATE TABLE cluster_member (
  cluster_id  bigint REFERENCES cluster,
  stake_cred  text   REFERENCES wallet,
  PRIMARY KEY (cluster_id, stake_cred)
);

-- wallet‑to‑wallet edges (for graph viz)
CREATE TABLE wallet_edge (
  src_stake  text,
  dst_stake  text,
  relation   text,  -- "same_stake", "same_tx", "lp_pair", …
  weight     numeric,
  PRIMARY KEY (src_stake, dst_stake, relation)
);
CREATE INDEX ON wallet_edge (src_stake);
```

*Use `pgvector` for “behavioral embeddings” if you want cosine‑similarity searches later.*

---

#### 4. Bootstrapping (initial seeding)

1. **Pull the first N popular tokens**

   ```bash
   GET https://openapi.taptools.io/v1/tokens/top?limit=500
   ```

   TapTools excludes deprecated assets and returns market‑cap‑sorted lists. ([openapi.taptools.io][6])

2. **For each token**

   * `Koios /asset_address_list` or `Blockfrost /assets/{policy}/addresses` → insert rows into `token_holding` (batch `UNNEST` for speed).
   * Merge stake credentials into `wallet` + `wallet_edge` (“same\_stake”).
   * Mark “developer wallets” by cross‑checking `Koios /asset_policy_info`.

3. **Cluster pass**

   * Graph‑traverse edges of type `same_stake`; union‑find to assign `cluster_id`.
   * Compute risk heuristics per cluster (dev share % > 20? liquidity pulls?).

---

#### 5. Staying fresh (continuous mode)

| Task                   | Trigger                                              | What happens                                                           |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| **New token detector** | Listen to Block  metadata for `policy + mint` events | Immediately enqueue “seed‑this‑token” job                              |
| **Delta update**       | Every block (or every 5 min cron)                    | Pull only *changed* balances via `since_block` param; update snapshots |
| **Re‑score clusters**  | Nightly                                              | Re‑run risk model, persist history to `cluster_score_history` table    |
| **DB health**          | Daily                                                | `VACUUM ANALYZE`, roll partitions                                      |

---

#### 6. Cabal heuristics starter pack

| Signal                      | Metric                                        | Typical weight |
| --------------------------- | --------------------------------------------- | -------------- |
| **Developer concentration** | Top cluster’s % of supply                     | +4 risk        |
| **LP withdrawals**          | # of > 10 % pool pulls in 24 h                | +3 risk        |
| **Airdrop ratio**           | Non‑buy transfers ÷ total holders             | +2 risk        |
| **Synced trading**          | ≥ 3 wallets buying within same 1‑block window | +1 risk        |
| **Burn cadence**            | Regular burns (‑risk)                         | –2 risk        |

Tune weights with historical rug data.

---

#### 7. Railway deployment walk‑through

This section guides the main agent through setting up the PostgreSQL database and connecting services on Railway.

1.  **Set up PostgreSQL on Railway:**
    *   Navigate to your Railway project dashboard.
    *   Click **"New"** or **"Add Service"** and select **"Database"**.
    *   Choose **"PostgreSQL"** from the list of available databases.
    *   Railway will provision a new PostgreSQL instance. Once ready, go to the service's **"Connect"** tab.
    *   **Crucially, copy the `DATABASE_URL` (Connection String)**. This will be in the format `postgresql://postgres:<password>@<host>:<port>/<database_name>`. You'll need this for your indexer and API services.
    *   Note down the individual connection parameters as well (host, port, user, password, database name) as some tools or libraries might prefer these.

2.  **Configure and Deploy the "Indexer" Service:**
    *   In your Railway project, add a new service for the indexer (e.g., click **"New"** -> **"GitHub Repo"** and select your indexer's repository, or deploy from a local Docker image).
    *   **Environment Variables:**
        *   Go to the indexer service's **"Variables"** tab.
        *   Add `DATABASE_URL` and paste the connection string copied in step 1.
        *   Add `BLOCKFROST_KEY`: Your API key for Blockfrost.
        *   Add `KOIOS_BASE`: The base URL for Koios API (e.g., `https://api.koios.rest/api/v0`).
        *   Add any other necessary environment variables for your indexer (e.g., `TAPTOOLS_API_KEY` if you decide to use their authenticated endpoints).
    *   **Dockerfile/Build Settings:**
        *   Ensure your `Dockerfile` correctly builds your Rust binary (for Oura) or Node.js application.
        *   Example `CMD` for Node.js: `CMD ["node","dist/index.js"]`
    *   **Networking:** Railway services within the same project can typically communicate using internal hostnames (e.g., `postgres.internal` or the service name given by Railway for your Postgres instance). The `DATABASE_URL` provided by Railway usually already points to the correct internal address.

3.  **Configure and Deploy the "API" Service (GraphQL Gateway):**
    *   Add another new service for your API (e.g., Fastify/NestJS).
    *   **Environment Variables:**
        *   Similar to the indexer, add the `DATABASE_URL` to this service's environment variables.
        *   Add any JWT secret keys or other API-specific configurations here.
    *   **Build & Run Commands:**
        *   Set up the build command (e.g., `pnpm install && pnpm build` for a Next.js or Fastify project).
        *   Set the start command (e.g., `pnpm start` or `node dist/main.js`).
    *   **Port Exposure:**
        *   Ensure the API service exposes the correct port (e.g., 3000 or 4000). Railway usually detects this from your `Dockerfile` (if using `EXPOSE`) or application, but you can configure it in the service's **"Settings"** tab under **"Networking"** -> **"Expose port"**.
    *   Enable **"Auto-Deploy"** if you want Railway to redeploy on new commits to your repository's main branch.

4.  **Database Schema Initialization & Seeding:**
    *   **Initial Schema:** Before the indexer can write data, the database tables defined in Section 3 need to be created. You can do this by:
        *   Connecting to the Railway Postgres instance using a tool like `psql`, pgAdmin, or a database client in your IDE (using the connection details from Step 1).
        *   Running the `CREATE TABLE` SQL statements from Section 3.
        *   Alternatively, if your indexer or API service uses an ORM with migration capabilities (e.g., Prisma, TypeORM, Diesel), configure it to run migrations on startup or via a deployment script.
    *   **Initial Seeding (Section 4):** Once the schema is in place, the indexer service will be responsible for performing the bootstrapping steps (pulling tokens, fetching holder data, etc.). Ensure the indexer's logic correctly implements these steps upon its first run or via a specific command.

5.  **Observe and Monitor:**
    *   Use Railway's **"Logs"** tab for each service (Postgres, Indexer, API) to monitor their status, check for errors, and observe operations (e.g., block counts from the indexer).
    *   Set up alerts in Railway (if available/needed) for high error rates, job lag, or resource utilization to proactively manage the deployment.

*Railway automatically networks services within the same project. Your indexer and API services should be able to connect to the PostgreSQL service using the provided `DATABASE_URL` which typically resolves to an internal hostname like `postgres.internal` or a service-specific alias. ([DEV Community][7], [Railway Docs][5])*

---

#### 8. Front‑end query examples

```graphql
query ClusterGraph($policy: String!) {
  walletConnections(policyId: $policy) {
    stakeCred
    clusterId
    edges {
      dstStake
      relation
      weight
    }
    risk {
      score
      flags
    }
  }
}
```

Parasite renders the array straight into a force‑directed graph; clicking a node can pop the cluster risk dashboard.

---

#### 9. Roadmap & punch list

| Phase | Goal                  | Key Deliverables                                                                           |
| ----- | --------------------- | ------------------------------------------------------------------------------------------ |
| **0** | Prototype             | Seed 100 top tokens; manual Cabal run; validate UI latency                                 |
| **1** | Continuous sync       | Block‑listen worker, nightly re‑score, Telegram/Webhook alert on high‑risk clusters        |
| **2** | Advanced analytics    | pgvector behavioral clustering, “Who Bought the Rumor” heatmaps, time‑series risk trending |
| **3** | External monetization | Paid API tiers, webhook packages for other token teams, live dashboard embeds              |

---

##### TL;DR

Spin up a Railway Postgres, pair it with a lightweight Blockfrost/Koios watcher (or an Oura pipeline when you’re ready), seed top tokens via TapTools, cluster wallets by stake cred, write edges & risk to Postgres, and expose it through a GraphQL microservice. Your Parasite UI can then render instant Cabal maps and risk grades without hammering the chain.

Let me know which part you want code for first—indexer skeleton, cluster algorithm, or the API gateway—and we’ll drill in.

[1]: https://github.com/blockfrost/blockfrost-websocket-link?utm_source=chatgpt.com "WebSocket link for Blockfrost.io API. - GitHub"
[2]: https://api.koios.rest/?utm_source=chatgpt.com "Koios API Documentation"
[3]: https://ogmios.dev/mini-protocols/local-chain-sync/?utm_source=chatgpt.com "Chain synchronization - Ogmios"
[4]: https://github.com/txpipe/oura?utm_source=chatgpt.com "txpipe/oura: The tail of Cardano - GitHub"
[5]: https://docs.railway.com/guides/postgresql?utm_source=chatgpt.com "PostgreSQL - Railway Docs"
[6]: https://openapi.taptools.io/?utm_source=chatgpt.com "TapTools - API Documentation"
[7]: https://dev.to/ngoakor12/connect-a-railway-databasepostgresql-with-node-postgres-in-express-15lf?utm_source=chatgpt.com "Connect a Railway database(postgreSQL) with node-postgres in ..."
