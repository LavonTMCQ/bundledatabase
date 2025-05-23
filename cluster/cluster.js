/**
 * Cabal Cluster Analysis
 *
 * This script performs wallet clustering based on wallet_edge relationships.
 * It uses a Union-Find algorithm to group wallets into clusters.
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('postgres:5432', 'localhost:5432') || 'postgresql://postgres:cabal_password_123@localhost:5432/cabal_db'
});

/**
 * Union-Find data structure for efficient clustering
 */
class UnionFind {
  constructor() {
    this.parent = {};
    this.rank = {};
  }

  // Make a new set with x as its own parent
  makeSet(x) {
    if (!this.parent[x]) {
      this.parent[x] = x;
      this.rank[x] = 0;
    }
  }

  // Find the representative of the set containing x
  find(x) {
    if (!this.parent[x]) {
      this.makeSet(x);
      return x;
    }

    // Path compression
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }

    return this.parent[x];
  }

  // Union the sets containing x and y
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    // Union by rank
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }
}

/**
 * Main clustering function
 */
async function performClustering() {
  console.log('Starting wallet clustering...');

  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Clear existing cluster data
    await client.query('DELETE FROM cluster_member');
    await client.query('DELETE FROM cluster');

    // Get all wallet edges with relation 'same_stake'
    const { rows: edges } = await client.query(`
      SELECT src, dst FROM wallet_edge
      WHERE relation = 'same_stake'
    `);

    console.log(`Found ${edges.length} wallet edges to process`);

    // Create Union-Find structure
    const uf = new UnionFind();

    // Process all edges
    for (const edge of edges) {
      uf.union(edge.src, edge.dst);
    }

    // Get all wallets
    const { rows: wallets } = await client.query('SELECT stake_cred FROM wallet');

    // Group wallets by their representative (cluster)
    const clusters = {};
    for (const wallet of wallets) {
      const stakeCred = wallet.stake_cred;
      const rep = uf.find(stakeCred);

      if (!clusters[rep]) {
        clusters[rep] = [];
      }

      clusters[rep].push(stakeCred);
    }

    console.log(`Created ${Object.keys(clusters).length} clusters`);

    // Insert clusters into database
    for (const [_, members] of Object.entries(clusters)) {
      if (members.length < 2) continue; // Skip singleton clusters

      // Create new cluster
      const { rows } = await client.query(`
        INSERT INTO cluster (risk_score, tags)
        VALUES (0, '{}')
        RETURNING cluster_id
      `);

      const clusterId = rows[0].cluster_id;

      // Add members to cluster
      for (const member of members) {
        await client.query(`
          INSERT INTO cluster_member (cluster_id, stake_cred)
          VALUES ($1, $2)
        `, [clusterId, member]);
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('Clustering completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during clustering:', error);
  } finally {
    client.release();
  }
}

// Run the clustering
performClustering()
  .then(() => {
    console.log('Clustering process finished');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error in clustering process:', err);
    process.exit(1);
  });
