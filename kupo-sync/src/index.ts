import 'dotenv/config';
import fetch from 'node-fetch';
import { Pool } from 'pg';
import { Address } from '@emurgo/cardano-serialization-lib-nodejs';

// Environment variables
const { KUPO_URL, DATABASE_URL } = process.env;

if (!KUPO_URL || !DATABASE_URL) {
  console.error('Missing required environment variables: KUPO_URL, DATABASE_URL');
  process.exit(1);
}

// Initialize PostgreSQL connection pool
const pg = new Pool({ connectionString: DATABASE_URL });

// Types for Kupo events
interface KupoAsset {
  policy: string;
  asset_name?: string;
  quantity: string;
}

interface KupoUtxo {
  transaction_id: string;
  output_index: number;
  address: string;
  value: {
    coins: number;
    assets: KupoAsset[];
  };
  datum_hash?: string;
  script?: string;
  asset: KupoAsset; // For simplicity in the example
}

interface KupoEvent {
  point: string;
  insert: KupoUtxo[];
  delete: KupoUtxo[];
}

/**
 * Extract stake credential from a Cardano address
 */
async function stakeCred(addrBech: string): Promise<string | null> {
  try {
    const addr = Address.from_bech32(addrBech);
    const baseAddr = addr.to_base_address();
    const cred = baseAddr?.stake_cred();
    return cred ? Buffer.from(cred.to_bytes()).toString('hex') : null;
  } catch (error) {
    console.error(`Error extracting stake credential from ${addrBech}:`, error);
    return null;
  }
}

/**
 * Process UTxO insertions
 */
async function processInserts(client: any, utxos: KupoUtxo[]): Promise<void> {
  for (const utxo of utxos) {
    // Extract stake credential
    const stake = await stakeCred(utxo.address);
    if (!stake) continue;

    // Insert wallet if not exists
    await client.query(`
      INSERT INTO wallet (stake_cred) 
      VALUES ($1) 
      ON CONFLICT DO NOTHING`, 
      [stake]
    );

    // Process each asset in the UTxO
    if (utxo.value && utxo.value.assets) {
      for (const asset of utxo.value.assets) {
        // Insert token if not exists
        await client.query(`
          INSERT INTO token (policy_id, asset_name) 
          VALUES ($1, $2) 
          ON CONFLICT DO NOTHING`, 
          [asset.policy, asset.asset_name || null]
        );

        // Update token holding
        await client.query(`
          INSERT INTO token_holding (policy_id, stake_cred, balance)
          VALUES ($1, $2, $3)
          ON CONFLICT (policy_id, stake_cred)
          DO UPDATE SET 
            balance = token_holding.balance + EXCLUDED.balance,
            last_seen = NOW()`,
          [asset.policy, stake, asset.quantity]
        );
      }
    }
  }
}

/**
 * Process UTxO deletions
 */
async function processDeletes(client: any, utxos: KupoUtxo[]): Promise<void> {
  for (const utxo of utxos) {
    // Extract stake credential
    const stake = await stakeCred(utxo.address);
    if (!stake) continue;

    // Process each asset in the UTxO
    if (utxo.value && utxo.value.assets) {
      for (const asset of utxo.value.assets) {
        // Update token holding (subtract balance)
        await client.query(`
          UPDATE token_holding 
          SET 
            balance = balance - $3,
            last_seen = NOW()
          WHERE policy_id = $1 AND stake_cred = $2`,
          [asset.policy, stake, asset.quantity]
        );

        // Remove token holding if balance is zero or negative
        await client.query(`
          DELETE FROM token_holding
          WHERE policy_id = $1 AND stake_cred = $2 AND balance <= 0`,
          [asset.policy, stake]
        );
      }
    }
  }
}

/**
 * Main loop to continuously sync Kupo events
 */
async function loop(): Promise<void> {
  console.log('Starting Kupo sync worker...');
  
  // Get the last processed point
  let { rows } = await pg.query("SELECT COALESCE(max_point, 'origin') AS point FROM sync_cursor");
  let point = rows[0]?.point || 'origin';
  
  console.log(`Starting from point: ${point}`);

  // Infinite loop to continuously process events
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Fetch events from Kupo
      const response = await fetch(`${KUPO_URL}/events?since=${point}`);
      
      if (!response.ok) {
        console.error(`Error fetching events: ${response.status} ${response.statusText}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      const events: KupoEvent[] = await response.json();
      
      // If no events, wait and try again
      if (!events.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      console.log(`Processing ${events.length} events...`);
      
      // Get a client from the pool
      const client = await pg.connect();
      
      try {
        // Begin transaction
        await client.query('BEGIN');
        
        // Process each event
        for (const event of events) {
          // Process inserts
          if (event.insert && event.insert.length > 0) {
            await processInserts(client, event.insert);
          }
          
          // Process deletes
          if (event.delete && event.delete.length > 0) {
            await processDeletes(client, event.delete);
          }
          
          // Update the point to the latest processed event
          point = event.point;
        }
        
        // Update sync cursor
        await client.query(`
          INSERT INTO sync_cursor(id, max_point) 
          VALUES (0, $1)
          ON CONFLICT (id) 
          DO UPDATE SET max_point = $1`, 
          [point]
        );
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`Processed events up to point: ${point}`);
      } catch (error) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        console.error('Error processing events:', error);
      } finally {
        // Release client back to pool
        client.release();
      }
    } catch (error) {
      console.error('Error in main loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Start the sync process
loop().catch(error => {
  console.error('Fatal error in sync process:', error);
  process.exit(1);
});
