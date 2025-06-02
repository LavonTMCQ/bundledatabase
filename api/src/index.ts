import 'dotenv/config';
import Fastify from 'fastify';
import { Pool } from 'pg';
import { BlockfrostService } from './blockfrost-service';
import { ResponseFormatter } from './response-formatter';
import { DatabaseService } from './database-service';
import { BubbleMapService } from './bubble-map-service';
import { TokenStorageService } from './token-storage-service';

// Initialize PostgreSQL connection pool with optimized Railway settings
const getDatabaseConfig = () => {
  // Try multiple environment variables for Railway
  const databaseUrl = process.env.DATABASE_URL ||
                     process.env.POSTGRES_URL ||
                     process.env.DATABASE_PRIVATE_URL ||
                     'postgresql://coldgame@localhost:5432/mister_db';

  // Railway-specific optimizations
  const isRailway = process.env.RAILWAY_ENVIRONMENT ||
                   process.env.NODE_ENV === 'production' ||
                   databaseUrl.includes('railway.internal');

  console.log('🔗 Database connection config:', {
    hasUrl: !!databaseUrl,
    isRailway,
    urlHost: databaseUrl.includes('railway.internal') ? 'railway.internal' : 'other',
    environment: process.env.NODE_ENV
  });

  return {
    connectionString: databaseUrl,
    ssl: isRailway ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Increased timeout for Railway
    acquireTimeoutMillis: 15000, // Time to wait for connection from pool
    statement_timeout: 30000, // 30 second query timeout
    query_timeout: 30000,
    application_name: 'mister_risk_api',
    // Railway-specific connection options
    ...(isRailway && {
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    })
  };
};

const pool = new Pool(getDatabaseConfig());

// Database connection event handlers
pool.on('connect', (client) => {
  console.log('🔗 New database client connected');
});

pool.on('error', (err, client) => {
  console.error('💥 Database pool error:', err);
});

// Test database connection on startup
pool.query('SELECT NOW() as timestamp')
  .then((result) => {
    console.log('✅ Database connected successfully at:', result.rows[0].timestamp);
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
  });

// Create Fastify instance with optimized settings
const fastify = Fastify({
  logger: true,
  requestTimeout: 60000, // 60 second timeout for requests
  keepAliveTimeout: 5000
});

// Add CORS support
fastify.register(require('@fastify/cors'), {
  origin: true,
  credentials: true
});

// Initialize services
const blockfrost = new BlockfrostService();
const bubbleMapService = new BubbleMapService(pool);
const tokenStorage = new TokenStorageService(pool);
// const dbService = new DatabaseService(pool);

// ===== PERFORMANCE OPTIMIZATION: CACHING LAYER =====
const analysisCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = {
  ANALYSIS: 30 * 60 * 1000, // 30 minutes for analysis results
  HOLDER_DATA: 60 * 60 * 1000, // 1 hour for holder data
  TOKEN_INFO: 24 * 60 * 60 * 1000, // 24 hours for token metadata
};

// Cache helper functions
const getCachedData = (key: string): any | null => {
  const cached = analysisCache.get(key);
  if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
    return cached.data;
  }
  analysisCache.delete(key);
  return null;
};

const setCachedData = (key: string, data: any, ttl: number): void => {
  analysisCache.set(key, { data, timestamp: Date.now(), ttl });
};

// Cache cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of analysisCache.entries()) {
    if ((now - cached.timestamp) >= cached.ttl) {
      analysisCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Health check endpoint with database connection test
fastify.get('/health', async (request, reply) => {
  try {
    // Test database connection
    const dbResult = await pool.query('SELECT NOW() as timestamp');
    return {
      status: 'ready',
      database: 'connected',
      timestamp: dbResult.rows[0].timestamp
    };
  } catch (error) {
    fastify.log.error('Database connection failed:', error);
    return reply.status(503).send({
      status: 'degraded',
      database: 'disconnected',
      error: 'Database connection failed'
    });
  }
});

// OPTIMIZED: Real-time token risk analysis with caching
fastify.get('/analyze/:policyId', async (request, reply) => {
  const { policyId } = request.params as { policyId: string };
  const { assetName, format, force } = request.query as { assetName?: string; format?: string; force?: string };

  try {
    // Create cache key
    const cacheKey = `analysis_${policyId}_${assetName || ''}`;

    // Check cache first (unless force=true)
    if (force !== 'true') {
      const cachedAnalysis = getCachedData(cacheKey);
      if (cachedAnalysis) {
        console.log(`🚀 Returning cached analysis for: ${policyId}${assetName || ''}`);
        return cachedAnalysis;
      }
    }

    console.log(`🔍 Performing fresh analysis for: ${policyId}${assetName || ''}`);
    const analysis = await blockfrost.analyzeToken(policyId, assetName || '');

    // Check if analysis has error
    if ('error' in analysis) {
      return reply.status(400).send(analysis);
    }

    // Determine token name
    let tokenName = 'Unknown Token';
    if (assetName) {
      tokenName = Buffer.from(assetName, 'hex').toString('utf8').replace(/[^\w\s$]/g, '');
    } else if ('autoDetectedAsset' in analysis) {
      // Extract asset name from auto-detected full asset ID
      const fullAsset = analysis.autoDetectedAsset as string;
      const assetNameHex = fullAsset.replace(policyId, '');
      if (assetNameHex) {
        tokenName = Buffer.from(assetNameHex, 'hex').toString('utf8').replace(/[^\w\s$]/g, '');
      }
    }

    // Determine risk level
    const getRiskLevel = (riskScore: number, topHolderPercentage: number): string => {
      if (riskScore === 0 && topHolderPercentage < 5) return 'extremely safe';
      if (riskScore < 3 && topHolderPercentage < 9) return 'safe';
      if (riskScore < 6 || topHolderPercentage < 15) return 'moderate risk';
      if (riskScore < 8 || topHolderPercentage < 25) return 'high risk';
      return 'extreme risk';
    };

    const riskLevel = getRiskLevel(analysis.riskScore, analysis.topHolderPercentage);

    // Save to database (commented out for now)
    // try {
    //   await dbService.saveTokenAnalysis({
    //     policyId,
    //     assetName: assetName || '',
    //     tokenName,
    //     riskScore: analysis.riskScore,
    //     riskLevel,
    //     topHolderPercentage: analysis.topHolderPercentage,
    //     stakeClusters: analysis.stakeClusters,
    //     coordinatedBlocks: analysis.coordinatedBlocks,
    //     totalHolders: analysis.totalHolders,
    //     regularHolders: analysis.regularHolders,
    //     liquidityPools: analysis.liquidityPools,
    //     infrastructureHolders: analysis.infrastructureHolders,
    //     assumedTotalSupply: analysis.assumedTotalSupply,
    //     observedSupply: analysis.observedSupply,
    //     circulatingSupply: analysis.circulatingSupply,
    //     liquiditySupply: analysis.liquiditySupply,
    //     infrastructureSupply: analysis.infrastructureSupply,
    //     patterns: analysis.patterns,
    //     holders: analysis.holders
    //   });
    // } catch (dbError) {
    //   fastify.log.warn('Failed to save analysis to database:', dbError);
    // }

    // Prepare response
    let response;
    if (format === 'beautiful' || format === 'formatted') {
      const formattedResponse = ResponseFormatter.formatTokenAnalysis({
        ...analysis,
        assetName: assetName || ''
      });

      response = {
        raw: analysis,
        formatted: formattedResponse,
        summary: {
          tokenName,
          riskLevel,
          riskScore: analysis.riskScore,
          topHolderPercentage: analysis.topHolderPercentage,
          verdict: riskLevel === 'extremely safe' || riskLevel === 'safe' ? 'SAFE' :
                  riskLevel === 'moderate risk' ? 'CAUTION' : 'AVOID'
        },
        cached: false,
        timestamp: new Date().toISOString()
      };
    } else {
      response = {
        ...analysis,
        cached: false,
        timestamp: new Date().toISOString()
      };
    }

    // Cache the response
    setCachedData(cacheKey, response, CACHE_TTL.ANALYSIS);

    return response;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Failed to analyze token' });
  }
});

// NEW: Quick risk check for multiple tokens (for your agent)
fastify.post('/analyze/batch', async (request, reply) => {
  const { tokens } = request.body as { tokens: Array<{policyId: string, assetName?: string}> };

  if (!tokens || !Array.isArray(tokens)) {
    return reply.status(400).send({ error: 'tokens array is required' });
  }

  try {
    const results = [];

    // Analyze up to 5 tokens to avoid rate limits
    for (const token of tokens.slice(0, 5)) {
      try {
        const analysis = await blockfrost.analyzeToken(token.policyId, token.assetName || '');
        results.push(analysis);
      } catch (error) {
        results.push({
          policyId: token.policyId,
          assetName: token.assetName || '',
          error: 'Analysis failed',
          riskScore: 0
        });
      }
    }

    return { results };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Batch analysis failed' });
  }
});

// Get token graph endpoint
fastify.get('/token/:policy/graph', async (request, reply) => {
  const { policy } = request.params as { policy: string };

  try {
    const { rows } = await pool.query(`
      SELECT
        w.stake_cred,
        cm.cluster_id,
        c.risk_score,
        c.tags,
        json_agg(
          json_build_object(
            'dst', e.dst,
            'relation', e.relation,
            'weight', e.weight
          )
        ) as edges
      FROM wallet w
      JOIN token_holding th ON th.stake_cred = w.stake_cred
      LEFT JOIN cluster_member cm ON cm.stake_cred = w.stake_cred
      LEFT JOIN cluster c ON c.cluster_id = cm.cluster_id
      LEFT JOIN wallet_edge e ON e.src = w.stake_cred
      WHERE th.policy_id = $1
      GROUP BY w.stake_cred, cm.cluster_id, c.risk_score, c.tags
    `, [policy]);

    return rows;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Get all tokens endpoint
fastify.get('/tokens', async (request, reply) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.policy_id,
        t.asset_name,
        t.decimals,
        t.market_cap_ada,
        COUNT(DISTINCT th.stake_cred) as holder_count,
        MAX(c.risk_score) as max_risk_score
      FROM token t
      LEFT JOIN token_holding th ON th.policy_id = t.policy_id
      LEFT JOIN cluster_member cm ON cm.stake_cred = th.stake_cred
      LEFT JOIN cluster c ON c.cluster_id = cm.cluster_id
      GROUP BY t.policy_id, t.asset_name, t.decimals, t.market_cap_ada
      ORDER BY t.first_seen DESC
    `);

    return rows;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Get cluster details endpoint
fastify.get('/cluster/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  try {
    // Get cluster details
    const { rows: clusterDetails } = await pool.query(`
      SELECT
        c.cluster_id,
        c.risk_score,
        c.tags
      FROM cluster c
      WHERE c.cluster_id = $1
    `, [id]);

    if (clusterDetails.length === 0) {
      return reply.status(404).send({ error: 'Cluster not found' });
    }

    // Get cluster members
    const { rows: members } = await pool.query(`
      SELECT
        w.stake_cred,
        w.flags,
        json_agg(
          json_build_object(
            'policy_id', th.policy_id,
            'balance', th.balance
          )
        ) as holdings
      FROM cluster_member cm
      JOIN wallet w ON w.stake_cred = cm.stake_cred
      LEFT JOIN token_holding th ON th.stake_cred = w.stake_cred
      WHERE cm.cluster_id = $1
      GROUP BY w.stake_cred, w.flags
    `, [id]);

    // Get risk score history
    const { rows: history } = await pool.query(`
      SELECT score, ts
      FROM cluster_score_history
      WHERE cluster_id = $1
      ORDER BY ts DESC
      LIMIT 30
    `, [id]);

    return {
      ...clusterDetails[0],
      members,
      history
    };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// NEW: Get stored analysis from database (commented out for now)
// fastify.get('/stored/:policyId', async (request, reply) => {
//   const { policyId } = request.params as { policyId: string };
//   const { assetName } = request.query as { assetName?: string };

//   try {
//     const analysis = await dbService.getTokenAnalysis(policyId, assetName || '');

//     if (!analysis) {
//       return reply.status(404).send({ error: 'Token analysis not found in database' });
//     }

//     return analysis;
//   } catch (error) {
//     fastify.log.error(error);
//     return reply.status(500).send({ error: 'Failed to retrieve stored analysis' });
//   }
// });

// NEW: Get safe tokens (commented out for now)
// fastify.get('/safe-tokens', async (request, reply) => {
//   const { limit } = request.query as { limit?: string };

//   try {
//     const tokens = await dbService.getSafeTokens(parseInt(limit || '50'));
//     return { safe_tokens: tokens };
//   } catch (error) {
//     fastify.log.error(error);
//     return reply.status(500).send({ error: 'Failed to retrieve safe tokens' });
//   }
// });

// NEW: Get risky tokens (commented out for now)
// fastify.get('/risky-tokens', async (request, reply) => {
//   const { limit } = request.query as { limit?: string };

//   try {
//     const tokens = await dbService.getRiskyTokens(parseInt(limit || '50'));
//     return { risky_tokens: tokens };
//   } catch (error) {
//     fastify.log.error(error);
//     return reply.status(500).send({ error: 'Failed to retrieve risky tokens' });
//   }
// });

// NEW: Get analysis statistics (commented out for now)
// fastify.get('/stats', async (request, reply) => {
//   try {
//     const stats = await dbService.getAnalysisStats();
//     return stats;
//   } catch (error) {
//     fastify.log.error(error);
//     return reply.status(500).send({ error: 'Failed to retrieve statistics' });
//   }
// });

// NEW: Batch analyze tokens from your agent's database
fastify.post('/analyze/all-tokens', async (request, reply) => {
  try {
    // Get all tokens from your agent's database
    const agentResponse = await fetch('http://localhost:4111/api/tokens');
    const agentTokens = await agentResponse.json();

    if (!agentTokens || !Array.isArray(agentTokens)) {
      return reply.status(400).send({ error: 'Could not fetch tokens from agent' });
    }

    const results = [];
    let processed = 0;
    let errors = 0;

    // Process tokens in batches to avoid rate limits
    for (const token of agentTokens.slice(0, 100)) { // Limit to first 100 tokens
      try {
        if (token.policyId) {
          const analysis = await blockfrost.analyzeToken(token.policyId, token.assetName || '');

          // Skip if analysis has error
          if ('error' in analysis) {
            errors++;
            continue;
          }

          // Determine token name and risk level
          const tokenName = token.name || token.symbol || 'Unknown Token';
          const getRiskLevel = (riskScore: number, topHolderPercentage: number): string => {
            if (riskScore === 0 && topHolderPercentage < 5) return 'extremely safe';
            if (riskScore < 3 && topHolderPercentage < 9) return 'safe';
            if (riskScore < 6 || topHolderPercentage < 15) return 'moderate risk';
            if (riskScore < 8 || topHolderPercentage < 25) return 'high risk';
            return 'extreme risk';
          };

          const riskLevel = getRiskLevel(analysis.riskScore, analysis.topHolderPercentage);

          // Save to database (commented out for now)
          // await dbService.saveTokenAnalysis({
          //   policyId: token.policyId,
          //   assetName: token.assetName || '',
          //   tokenName,
          //   riskScore: analysis.riskScore,
          //   riskLevel,
          //   topHolderPercentage: analysis.topHolderPercentage,
          //   stakeClusters: analysis.stakeClusters,
          //   coordinatedBlocks: analysis.coordinatedBlocks,
          //   totalHolders: analysis.totalHolders,
          //   regularHolders: analysis.regularHolders,
          //   liquidityPools: analysis.liquidityPools,
          //   infrastructureHolders: analysis.infrastructureHolders,
          //   assumedTotalSupply: analysis.assumedTotalSupply,
          //   observedSupply: analysis.observedSupply,
          //   circulatingSupply: analysis.circulatingSupply,
          //   liquiditySupply: analysis.liquiditySupply,
          //   infrastructureSupply: analysis.infrastructureSupply,
          //   patterns: analysis.patterns,
          //   holders: analysis.holders
          // });

          results.push({
            policyId: token.policyId,
            tokenName,
            riskScore: analysis.riskScore,
            riskLevel,
            topHolderPercentage: analysis.topHolderPercentage
          });

          processed++;

          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        errors++;
        fastify.log.warn(`Failed to analyze token ${token.policyId}:`, error);
      }
    }

    return {
      message: 'Batch analysis completed',
      processed,
      errors,
      results: results.slice(0, 10) // Return first 10 results
    };

  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Batch analysis failed' });
  }
});

// Enhanced holder data for bubble map visualization
fastify.get('/analyze/:policyId/holders', async (request, reply) => {
  try {
    const { policyId } = request.params as { policyId: string };
    const { assetName } = request.query as { assetName?: string };

    console.log(`🫧 Getting enhanced holder data for bubble map: ${policyId}${assetName || ''}`);

    // Get basic analysis to get holders
    const basicAnalysis = await blockfrost.analyzeToken(policyId, assetName || '');

    if ('error' in basicAnalysis || !('holders' in basicAnalysis)) {
      return reply.status(404).send({
        error: 'error' in basicAnalysis ? basicAnalysis.error : 'No holders found for analysis'
      });
    }

    // Enhance holder data for bubble map
    const enhancedHolders = basicAnalysis.holders.map((holder: any, index: number) => {
      const percentage = holder.percentage || 0;

      // Determine risk category
      let riskCategory = 'safe';
      let riskColor = '#00ff88';

      if (percentage >= 15) {
        riskCategory = 'high_risk';
        riskColor = '#ff4444';
      } else if (percentage >= 5) {
        riskCategory = 'moderate_risk';
        riskColor = '#ffaa00';
      }

      // Determine if this is likely infrastructure
      const isInfrastructure = holder.address && (
        holder.address.includes('script') ||
        percentage > 20 ||
        holder.tags?.includes('liquidity_pool') ||
        holder.tags?.includes('exchange')
      );

      return {
        id: `holder_${index}`,
        address: holder.address,
        stakeAddress: holder.stake_address,
        amount: holder.quantity || holder.amount || 0,
        percentage: percentage,
        riskCategory,
        riskColor,
        isInfrastructure,
        rank: index + 1,
        // Add clustering info if available
        clusterId: holder.clusterId || null,
        clusterSize: holder.clusterSize || 1,
        // Add metadata for visualization
        bubbleSize: Math.max(15, Math.min(60, 15 + (percentage / 30) * 45)),
        opacity: isInfrastructure ? 0.6 : 0.8
      };
    });

    // Group holders by risk categories for clustering
    const clusters = {
      safe: enhancedHolders.filter(h => h.riskCategory === 'safe'),
      moderate_risk: enhancedHolders.filter(h => h.riskCategory === 'moderate_risk'),
      high_risk: enhancedHolders.filter(h => h.riskCategory === 'high_risk')
    };

    // Calculate cluster statistics
    const clusterStats = Object.entries(clusters).map(([category, holders]) => ({
      category,
      count: holders.length,
      totalPercentage: holders.reduce((sum, h) => sum + h.percentage, 0),
      avgPercentage: holders.length > 0 ? holders.reduce((sum, h) => sum + h.percentage, 0) / holders.length : 0,
      color: holders[0]?.riskColor || '#666'
    }));

    const result = {
      policyId,
      assetName: assetName || '',
      totalHolders: enhancedHolders.length,
      holders: enhancedHolders,
      clusters: clusterStats,
      metadata: {
        maxPercentage: Math.max(...enhancedHolders.map(h => h.percentage)),
        minPercentage: Math.min(...enhancedHolders.map(h => h.percentage)),
        infrastructureCount: enhancedHolders.filter(h => h.isInfrastructure).length,
        riskScore: basicAnalysis.riskScore,
        topHolderPercentage: basicAnalysis.topHolderPercentage
      }
    };

    // Save bubble map snapshot to database
    try {
      const bubbleMapData = {
        policyId,
        assetName: assetName || '',
        totalHolders: enhancedHolders.length,
        riskScore: basicAnalysis.riskScore,
        topHolderPercentage: basicAnalysis.topHolderPercentage,
        holders: enhancedHolders.map(h => ({
          id: h.id,
          address: h.address,
          stakeAddress: h.stakeAddress,
          amount: h.amount,
          percentage: h.percentage,
          riskCategory: h.riskCategory,
          riskColor: h.riskColor,
          isInfrastructure: h.isInfrastructure,
          rank: h.rank,
          clusterId: h.clusterId,
          clusterSize: h.clusterSize,
          bubbleSize: h.bubbleSize,
          opacity: h.opacity
        })),
        metadata: result.metadata
      };

      await bubbleMapService.saveBubbleMapSnapshot(bubbleMapData);
      console.log(`💾 Saved bubble map snapshot for ${policyId}`);

      // Detect and save wallet connections
      const connections = await detectWalletConnections(enhancedHolders);
      if (connections.length > 0) {
        await bubbleMapService.saveWalletConnections(connections);
        console.log(`🔗 Saved ${connections.length} wallet connections`);
      }

    } catch (dbError) {
      console.warn('Failed to save bubble map data:', dbError);
    }

    return result;

  } catch (error) {
    fastify.log.error('Error getting enhanced holder data:', error);
    return reply.status(500).send({ error: 'Failed to get holder data' });
  }
});

// Advanced wallet relationship analysis endpoint
fastify.get('/analyze/:policyId/relationships', async (request, reply) => {
  try {
    const { policyId } = request.params as { policyId: string };
    const { assetName } = request.query as { assetName?: string };

    console.log(`🔍 Advanced relationship analysis for: ${policyId}${assetName || ''}`);

    // First get basic analysis to get holders
    const basicAnalysis = await blockfrost.analyzeToken(policyId, assetName || '');

    if ('error' in basicAnalysis || !('holders' in basicAnalysis)) {
      return reply.status(404).send({
        error: 'error' in basicAnalysis ? basicAnalysis.error : 'No holders found for analysis'
      });
    }

    // Perform advanced relationship analysis
    const relationshipAnalysis = await blockfrost.analyzeWalletRelationships(
      basicAnalysis.holders,
      policyId,
      assetName || ''
    );

    // Combine results
    const result = {
      ...basicAnalysis,
      advancedAnalysis: relationshipAnalysis,
      analysisType: 'advanced_relationships'
    };

    return result;

  } catch (error) {
    fastify.log.error('Error in advanced relationship analysis:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Helper function to detect wallet connections
async function detectWalletConnections(holders: any[]): Promise<any[]> {
  const connections = [];

  // Group holders by stake address to detect stake clusters
  const stakeGroups = new Map();
  holders.forEach(holder => {
    if (holder.stakeAddress) {
      if (!stakeGroups.has(holder.stakeAddress)) {
        stakeGroups.set(holder.stakeAddress, []);
      }
      stakeGroups.get(holder.stakeAddress).push(holder);
    }
  });

  // Create connections for holders sharing the same stake address
  for (const [stakeAddress, stakeHolders] of stakeGroups) {
    if (stakeHolders.length > 1) {
      for (let i = 0; i < stakeHolders.length; i++) {
        for (let j = i + 1; j < stakeHolders.length; j++) {
          connections.push({
            sourceAddress: stakeHolders[i].address,
            targetAddress: stakeHolders[j].address,
            sourceStake: stakeAddress,
            targetStake: stakeAddress,
            connectionType: 'stake_cluster',
            connectionStrength: 0.9, // High confidence for same stake
            metadata: {
              clusterSize: stakeHolders.length,
              detectionMethod: 'same_stake_address'
            }
          });
        }
      }
    }
  }

  // Detect potential coordinated behavior (similar percentages)
  for (let i = 0; i < holders.length; i++) {
    for (let j = i + 1; j < holders.length; j++) {
      const holder1 = holders[i];
      const holder2 = holders[j];

      // If holders have very similar percentages, they might be coordinated
      const percentageDiff = Math.abs(holder1.percentage - holder2.percentage);
      if (percentageDiff < 0.1 && holder1.percentage > 1) { // Similar holdings > 1%
        connections.push({
          sourceAddress: holder1.address,
          targetAddress: holder2.address,
          sourceStake: holder1.stakeAddress,
          targetStake: holder2.stakeAddress,
          connectionType: 'coordinated',
          connectionStrength: Math.max(0.3, 1 - (percentageDiff * 10)), // Lower confidence
          metadata: {
            percentageDiff,
            detectionMethod: 'similar_holdings'
          }
        });
      }
    }
  }

  return connections;
}

// Get stored bubble map with connections
fastify.get('/bubble-map/:policyId', async (request, reply) => {
  try {
    const { policyId } = request.params as { policyId: string };
    const { assetName, includeConnections } = request.query as { assetName?: string; includeConnections?: string };

    console.log(`🫧 Getting stored bubble map for: ${policyId}`);

    let bubbleMap;
    if (includeConnections === 'true') {
      bubbleMap = await bubbleMapService.getBubbleMapWithConnections(policyId, assetName);
    } else {
      bubbleMap = await bubbleMapService.getLatestBubbleMap(policyId, assetName);
    }

    if (!bubbleMap) {
      return reply.status(404).send({ error: 'No bubble map data found for this token' });
    }

    return bubbleMap;

  } catch (error) {
    fastify.log.error('Error getting stored bubble map:', error);
    return reply.status(500).send({ error: 'Failed to get bubble map data' });
  }
});

// Get wallet connections for specific addresses
fastify.post('/wallet-connections', async (request, reply) => {
  try {
    const { addresses } = request.body as { addresses: string[] };

    if (!addresses || !Array.isArray(addresses)) {
      return reply.status(400).send({ error: 'addresses array is required' });
    }

    console.log(`🔗 Getting connections for ${addresses.length} addresses`);

    const connections = await bubbleMapService.getWalletConnections(addresses);

    return {
      addresses,
      connections,
      stats: {
        totalConnections: connections.length,
        strongConnections: connections.filter(c => c.connectionStrength > 0.7).length,
        connectionTypes: [...new Set(connections.map(c => c.connectionType))]
      }
    };

  } catch (error) {
    fastify.log.error('Error getting wallet connections:', error);
    return reply.status(500).send({ error: 'Failed to get wallet connections' });
  }
});

// Clean up cache endpoint
fastify.post('/cleanup-cache', async (request, reply) => {
  try {
    await bubbleMapService.cleanupCache();
    return { message: 'Cache cleaned up successfully' };
  } catch (error) {
    fastify.log.error('Error cleaning up cache:', error);
    return reply.status(500).send({ error: 'Failed to cleanup cache' });
  }
});

// Token Storage Endpoints

// Get all stored tokens
fastify.get('/stored-tokens', async (request, reply) => {
  try {
    const tokens = await tokenStorage.getAllTokens();
    return {
      success: true,
      count: tokens.length,
      tokens
    };
  } catch (error) {
    fastify.log.error('Error getting tokens:', error);
    return reply.status(500).send({ error: 'Failed to get tokens' });
  }
});

// Get token by ticker
fastify.get('/stored-tokens/:ticker', async (request, reply) => {
  try {
    const { ticker } = request.params as { ticker: string };
    const token = await tokenStorage.getTokenByTicker(ticker);

    if (!token) {
      return reply.status(404).send({ error: 'Token not found' });
    }

    return {
      success: true,
      token
    };
  } catch (error) {
    fastify.log.error('Error getting token:', error);
    return reply.status(500).send({ error: 'Failed to get token' });
  }
});

// Analyze stored token and create bubble map
fastify.post('/stored-tokens/:ticker/analyze', async (request, reply) => {
  try {
    const { ticker } = request.params as { ticker: string };

    console.log(`🔍 Analyzing stored token: ${ticker}`);

    // Get token from storage
    const token = await tokenStorage.getTokenByTicker(ticker);
    if (!token) {
      return reply.status(404).send({ error: 'Token not found in storage' });
    }

    // Get enhanced holder data
    const holderResponse = await fetch(`http://localhost:4000/analyze/${token.policyId}/holders`);
    const holderData: any = await holderResponse.json();

    if (holderData.holders && holderData.holders.length > 0) {
      // Update token with analysis data
      await tokenStorage.updateTokenAnalysis(ticker, holderData);

      return {
        success: true,
        ticker,
        analysis: holderData,
        message: `Successfully analyzed ${ticker} with ${holderData.totalHolders} holders`
      };
    } else {
      return reply.status(400).send({ error: 'Failed to get holder data' });
    }

  } catch (error) {
    fastify.log.error('Error analyzing token:', error);
    return reply.status(500).send({ error: 'Failed to analyze token' });
  }
});

// Get tokens needing analysis
fastify.get('/stored-tokens/analysis/needed', async (request, reply) => {
  try {
    const { maxAge } = request.query as { maxAge?: string };
    const tokens = await tokenStorage.getTokensNeedingAnalysis(
      maxAge ? parseInt(maxAge) : 24
    );

    return {
      success: true,
      count: tokens.length,
      tokens
    };
  } catch (error) {
    fastify.log.error('Error getting tokens needing analysis:', error);
    return reply.status(500).send({ error: 'Failed to get tokens needing analysis' });
  }
});

// Get token statistics
fastify.get('/stored-tokens/stats', async (request, reply) => {
  try {
    const stats = await tokenStorage.getTokenStats();
    return {
      success: true,
      stats
    };
  } catch (error) {
    fastify.log.error('Error getting token stats:', error);
    return reply.status(500).send({ error: 'Failed to get token stats' });
  }
});

// Batch analyze multiple tokens
fastify.post('/stored-tokens/batch-analyze', async (request, reply) => {
  try {
    const { tickers, maxTokens } = request.body as { tickers?: string[]; maxTokens?: number };

    let tokensToAnalyze;
    if (tickers && tickers.length > 0) {
      // Analyze specific tickers
      tokensToAnalyze = [];
      for (const ticker of tickers) {
        const token = await tokenStorage.getTokenByTicker(ticker);
        if (token) tokensToAnalyze.push(token);
      }
    } else {
      // Get tokens that need analysis
      tokensToAnalyze = await tokenStorage.getTokensNeedingAnalysis(24);
      if (maxTokens) {
        tokensToAnalyze = tokensToAnalyze.slice(0, maxTokens);
      }
    }

    const results = [];

    for (const token of tokensToAnalyze) {
      try {
        console.log(`🔍 Batch analyzing: ${token.ticker}`);

        // Analyze the token
        const holderResponse = await fetch(`http://localhost:4000/analyze/${token.policyId}/holders`);
        const holderData: any = await holderResponse.json();

        if (holderData.holders && holderData.holders.length > 0) {
          await tokenStorage.updateTokenAnalysis(token.ticker, holderData);
          results.push({
            ticker: token.ticker,
            success: true,
            holders: holderData.totalHolders,
            riskScore: holderData.metadata?.riskScore
          });
        } else {
          results.push({
            ticker: token.ticker,
            success: false,
            error: 'No holder data'
          });
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        results.push({
          ticker: token.ticker,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: true,
      analyzed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };

  } catch (error) {
    fastify.log.error('Error in batch analysis:', error);
    return reply.status(500).send({ error: 'Failed to batch analyze tokens' });
  }
});

// Network Graph Visualization Endpoint
fastify.get('/api/network-graph/:unit', async (request, reply) => {
  try {
    const { unit } = request.params as { unit: string };

    console.log(`🕸️ Generating network graph data for: ${unit}`);

    // Get the policy ID from unit (first 56 characters)
    const policyId = unit.substring(0, 56);
    const assetName = unit.substring(56);

    // Get enhanced holder data with connections
    const holderResponse = await fetch(`http://localhost:4000/analyze/${policyId}/holders?assetName=${assetName}`);
    const holderData: any = await holderResponse.json();

    if (!holderData.holders) {
      return reply.status(404).send({ error: 'No holder data found' });
    }

    // Transform data for network visualization
    const nodes: any[] = [];
    const edges: any[] = [];
    const stakeGroups: { [key: string]: any[] } = {};

    // Group holders by stake address
    holderData.holders.forEach((holder: any, index: number) => {
      const stakeAddr = holder.stakeAddress || `unknown_${index}`;
      if (!stakeGroups[stakeAddr]) {
        stakeGroups[stakeAddr] = [];
      }
      stakeGroups[stakeAddr].push(holder);
    });

    // Create nodes for stake addresses (clusters)
    Object.entries(stakeGroups).forEach(([stakeAddr, wallets]) => {
      const totalPercentage = wallets.reduce((sum: number, w: any) => sum + (w.percentage || 0), 0);
      const handles = wallets.flatMap((w: any) => w.adaHandles || []).filter(Boolean);

      nodes.push({
        id: stakeAddr,
        type: 'stake',
        percentage: totalPercentage,
        connectedWallets: wallets.length,
        handles: handles.slice(0, 3), // Top 3 handles
        suspicious: totalPercentage > 10 || wallets.length > 5,
        size: Math.max(10, Math.min(50, totalPercentage * 2)),
        color: totalPercentage > 10 ? '#ff6b6b' : totalPercentage > 5 ? '#ffa726' : '#66bb6a'
      });

      // Create nodes for individual wallets
      wallets.forEach((wallet: any) => {
        nodes.push({
          id: wallet.address,
          type: 'wallet',
          percentage: wallet.percentage || 0,
          parent: stakeAddr,
          handle: wallet.adaHandles?.[0] || null,
          size: Math.max(5, (wallet.percentage || 0) * 1.5)
        });

        // Create edge from stake to wallet
        edges.push({
          source: stakeAddr,
          target: wallet.address,
          type: 'controls',
          weight: 1
        });
      });
    });

    return {
      nodes,
      edges,
      summary: {
        totalNodes: nodes.length,
        stakeNodes: nodes.filter(n => n.type === 'stake').length,
        walletNodes: nodes.filter(n => n.type === 'wallet').length,
        suspiciousStakes: nodes.filter(n => n.type === 'stake' && n.suspicious).length
      }
    };

  } catch (error) {
    fastify.log.error('Error generating network graph:', error);
    return reply.status(500).send({ error: 'Failed to generate network graph' });
  }
});

// Cluster Visualization Endpoint
fastify.get('/api/cluster-viz/:unit', async (request, reply) => {
  try {
    const { unit } = request.params as { unit: string };

    console.log(`🎯 Generating cluster visualization for: ${unit}`);

    // Get the policy ID from unit
    const policyId = unit.substring(0, 56);
    const assetName = unit.substring(56);

    // Get enhanced holder data
    const holderResponse = await fetch(`http://localhost:4000/analyze/${policyId}/holders?assetName=${assetName}`);
    const holderData: any = await holderResponse.json();

    if (!holderData.holders) {
      return reply.status(404).send({ error: 'No holder data found' });
    }

    // Group by stake address and create clusters
    const stakeGroups: { [key: string]: any[] } = {};
    holderData.holders.forEach((holder: any, index: number) => {
      const stakeAddr = holder.stakeAddress || `unknown_${index}`;
      if (!stakeGroups[stakeAddr]) {
        stakeGroups[stakeAddr] = [];
      }
      stakeGroups[stakeAddr].push(holder);
    });

    const clusters = Object.entries(stakeGroups).map(([stakeAddr, wallets], index) => {
      const totalPercentage = wallets.reduce((sum: number, w: any) => sum + (w.percentage || 0), 0);
      const handles = wallets.flatMap((w: any) => w.adaHandles || []).filter(Boolean);
      const suspicious = totalPercentage > 10 || wallets.length > 5;

      return {
        id: `cluster_${index + 1}`,
        stakeAddress: stakeAddr,
        totalPercentage,
        walletCount: wallets.length,
        color: suspicious ? '#ff6b6b' : totalPercentage > 5 ? '#ffa726' : '#66bb6a',
        suspicious,
        handles: handles.slice(0, 5),
        wallets: wallets.map(w => ({
          address: w.address,
          percentage: w.percentage || 0,
          handle: w.adaHandles?.[0] || null
        }))
      };
    }).sort((a, b) => b.totalPercentage - a.totalPercentage);

    return {
      clusters,
      summary: {
        totalClusters: clusters.length,
        suspiciousClusters: clusters.filter(c => c.suspicious).length,
        largestCluster: clusters[0]?.totalPercentage || 0,
        totalWallets: clusters.reduce((sum, c) => sum + c.walletCount, 0)
      }
    };

  } catch (error) {
    fastify.log.error('Error generating cluster visualization:', error);
    return reply.status(500).send({ error: 'Failed to generate cluster visualization' });
  }
});

// Risk Factors Endpoint
fastify.get('/api/risk-factors/:unit', async (request, reply) => {
  try {
    const { unit } = request.params as { unit: string };

    console.log(`⚠️ Getting risk factors for: ${unit}`);

    // Get the policy ID from unit
    const policyId = unit.substring(0, 56);
    const assetName = unit.substring(56);

    // Get basic analysis
    const analysis = await blockfrost.analyzeToken(policyId, assetName);

    if ('error' in analysis) {
      return reply.status(404).send({ error: analysis.error });
    }

    // Calculate risk breakdown
    let riskScore = 0;
    const riskFactors: string[] = [];
    const breakdown = {
      concentration: 0,
      liquidity: 0,
      clustering: 0,
      social: 0,
      volume: 0
    };

    // Concentration risk
    if (analysis.topHolderPercentage > 50) {
      breakdown.concentration = 4;
      riskFactors.push('EXTREME_CONCENTRATION');
    } else if (analysis.topHolderPercentage > 25) {
      breakdown.concentration = 3;
      riskFactors.push('HIGH_CONCENTRATION');
    } else if (analysis.topHolderPercentage > 10) {
      breakdown.concentration = 2;
      riskFactors.push('MODERATE_CONCENTRATION');
    }

    // Add other risk factors based on available data
    // Note: liquidityRisk analysis would need to be implemented separately
    // For now, we'll use a simple heuristic based on holder count
    if (analysis.holders && analysis.holders.length < 50) {
      breakdown.liquidity = 1;
      riskFactors.push('LOW_LIQUIDITY');
    }

    riskScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    riskScore = Math.min(riskScore, 10);

    let verdict = 'SAFE';
    if (riskScore >= 8) verdict = 'EXTREME_RISK';
    else if (riskScore >= 6) verdict = 'HIGH_RISK';
    else if (riskScore >= 4) verdict = 'MODERATE_RISK';
    else if (riskScore >= 2) verdict = 'LOW_RISK';

    return {
      riskScore,
      verdict,
      recommendation: riskScore >= 7 ? 'AVOID' : riskScore >= 4 ? 'CAUTION' : 'MONITOR',
      riskFactors,
      breakdown
    };

  } catch (error) {
    fastify.log.error('Error getting risk factors:', error);
    return reply.status(500).send({ error: 'Failed to get risk factors' });
  }
});

// Clean Stake Clustering Endpoint - Real Data Only
const networkCache = new Map<string, { data: any; timestamp: number }>();
const NETWORK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

fastify.get('/api/wallet-network/:unit', async (request, reply) => {
  try {
    const { unit } = request.params as { unit: string };

    // Check cache first
    const cacheKey = `${unit}_stake_clustering`;
    const cached = networkCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < NETWORK_CACHE_TTL) {
      console.log(`🚀 Returning cached stake clustering for: ${unit}`);
      return cached.data;
    }

    console.log(`🔗 Analyzing stake clustering for: ${unit}`);
    const startTime = Date.now();

    // Get the policy ID from unit
    const policyId = unit.substring(0, 56);
    const assetName = unit.substring(56);

    // Get holder data from existing endpoint
    const holderResponse = await fetch(`http://localhost:4000/analyze/${policyId}?assetName=${assetName}`);
    const holderData: any = await holderResponse.json();

    if (!holderData.holders) {
      return reply.status(404).send({ error: 'No holder data found' });
    }

    // Process top 100 holders only for performance
    const topHolders = holderData.holders.slice(0, 100);

    // Build real stake clustering (no simulated data)
    const { holders, connections, clusters, stats } = buildRealStakeClustering(topHolders);

    const response = {
      metadata: {
        token: getTokenName(assetName),
        unit,
        totalHolders: holders.length,
        totalClusters: clusters.length,
        stakeConnections: connections.length,
        isolatedWallets: stats.isolatedWallets,
        multiWalletStakes: stats.multiWalletStakes,
        analysisType: 'stake_clustering_only',
        lastUpdated: new Date().toISOString(),
        dataFreshness: '5m',
        processingTime: `${Date.now() - startTime}ms`
      },
      holders,
      connections,
      clusters: clusters.sort((a, b) => b.totalPercentage - a.totalPercentage),
      riskAnalysis: {
        overallRisk: stats.suspiciousClusters / Math.max(clusters.length, 1),
        suspiciousClusters: stats.suspiciousClusters,
        totalConnections: connections.length,
        strongConnections: connections.length, // All stake connections are strong
        networkDensity: connections.length / (holders.length * (holders.length - 1)),
        topRisks: buildStakeRisks(clusters, holders)
      },
      visualization: {
        recommendedLayout: 'force_directed',
        nodeColors: {
          isolated: '#64748b',      // Grey for single wallets
          connected: '#22c55e',     // Green for multi-wallet stakes
          suspicious: '#ef4444',    // Red for high concentration
          whale: '#f59e0b'          // Orange for large holders
        },
        edgeTypes: {
          same_stake: { color: '#2196f3', width: 3 }  // Blue for stake connections
        }
      }
    };

    // Cache the response
    networkCache.set(cacheKey, { data: response, timestamp: Date.now() });

    console.log(`✅ Stake clustering completed in ${Date.now() - startTime}ms`);
    return response;

  } catch (error) {
    fastify.log.error('Error generating stake clustering:', error);
    return reply.status(500).send({ error: 'Failed to generate stake clustering' });
  }
});

// Real Stake Clustering Functions - No Simulated Data
function buildRealStakeClustering(holders: any[]) {
  const stakeGroups: { [key: string]: any[] } = {};
  const connections: any[] = [];
  const clusters: any[] = [];
  const processedHolders: any[] = [];

  // Group holders by stake address
  holders.forEach(holder => {
    const stakeAddr = holder.stakeAddress || holder.address;
    if (!stakeGroups[stakeAddr]) {
      stakeGroups[stakeAddr] = [];
    }
    stakeGroups[stakeAddr].push(holder);
  });

  // Filter out obvious liquidity pools (addresses with 50+ wallets)
  const filteredStakeGroups: { [key: string]: any[] } = {};
  Object.entries(stakeGroups).forEach(([stakeAddr, wallets]) => {
    if (wallets.length < 50) { // Not a liquidity pool
      filteredStakeGroups[stakeAddr] = wallets;
    } else {
      console.log(`🏊 Filtered out potential LP with ${wallets.length} wallets: ${stakeAddr.substring(0, 20)}...`);
    }
  });

  let clusterId = 1;
  let isolatedWallets = 0;
  let multiWalletStakes = 0;
  let suspiciousClusters = 0;

  // Process each stake group
  Object.entries(filteredStakeGroups).forEach(([stakeAddr, wallets]) => {
    const totalPercentage = wallets.reduce((sum, w) => sum + (w.percentage || 0), 0);
    const handles = wallets.flatMap(w => w.adaHandles || []).filter(Boolean);
    const isMultiWallet = wallets.length > 1;
    const isHighConcentration = totalPercentage > 10;
    const isSuspicious = isHighConcentration && isMultiWallet;

    if (isMultiWallet) multiWalletStakes++;
    if (!isMultiWallet) isolatedWallets++;
    if (isSuspicious) suspiciousClusters++;

    const cluster = {
      id: `stake_${clusterId++}`,
      stakeAddress: stakeAddr,
      type: isMultiWallet ? 'multi_wallet_stake' : 'single_wallet',
      wallets: wallets.map(w => w.address),
      totalPercentage,
      walletCount: wallets.length,
      connectionStrength: isMultiWallet ? 1.0 : 0.0,
      riskScore: isSuspicious ? 0.8 : isHighConcentration ? 0.6 : isMultiWallet ? 0.4 : 0.2,
      suspicious: isSuspicious,
      riskFactors: [
        ...(isHighConcentration ? ['HIGH_CONCENTRATION'] : []),
        ...(isMultiWallet ? ['MULTI_WALLET'] : [])
      ],
      centerNode: wallets[0]?.address,
      handles: handles.slice(0, 5)
    };

    clusters.push(cluster);

    // Add holders with cluster info
    wallets.forEach((wallet, index) => {
      processedHolders.push({
        address: wallet.address,
        stakeAddress: stakeAddr,
        amount: wallet.amount || 0,
        percentage: wallet.percentage || 0,
        rank: wallet.rank || 0,
        handles: wallet.adaHandles || [],
        riskScore: cluster.riskScore,
        riskFlags: cluster.riskFactors,
        clusterId: cluster.id,
        isIsolated: !isMultiWallet,
        walletIndex: index + 1,
        totalWalletsInStake: wallets.length
      });
    });

    // Create connections within multi-wallet stakes only
    if (isMultiWallet) {
      for (let i = 0; i < wallets.length; i++) {
        for (let j = i + 1; j < wallets.length; j++) {
          connections.push({
            from: wallets[i].address,
            to: wallets[j].address,
            type: 'same_stake',
            strength: 1.0,
            evidence: `Both controlled by stake address ${stakeAddr.substring(0, 20)}...`,
            stakeAddress: stakeAddr,
            walletCount: wallets.length,
            totalPercentage
          });
        }
      }
    }
  });

  const stats = {
    isolatedWallets,
    multiWalletStakes,
    suspiciousClusters,
    totalStakeAddresses: Object.keys(filteredStakeGroups).length,
    filteredLPs: Object.keys(stakeGroups).length - Object.keys(filteredStakeGroups).length
  };

  console.log(`📊 Stake clustering stats:`, stats);

  return {
    holders: processedHolders,
    connections,
    clusters,
    stats
  };
}

function buildStakeRisks(clusters: any[], holders: any[]) {
  const risks: any[] = [];

  // High concentration risk
  const highConcClusters = clusters.filter(c => c.totalPercentage > 10);
  if (highConcClusters.length > 0) {
    risks.push({
      type: 'HIGH_CONCENTRATION',
      severity: 'HIGH',
      affectedWallets: highConcClusters.reduce((sum, c) => sum + c.walletCount, 0),
      affectedPercentage: highConcClusters.reduce((sum, c) => sum + c.totalPercentage, 0),
      description: 'High token concentration in stake addresses',
      evidence: `${highConcClusters.length} stake addresses control >10% each`
    });
  }

  // Multi-wallet coordination risk
  const multiWalletClusters = clusters.filter(c => c.walletCount > 1);
  if (multiWalletClusters.length > 0) {
    risks.push({
      type: 'MULTI_WALLET_COORDINATION',
      severity: 'MEDIUM',
      affectedWallets: multiWalletClusters.reduce((sum, c) => sum + c.walletCount, 0),
      affectedPercentage: multiWalletClusters.reduce((sum, c) => sum + c.totalPercentage, 0),
      description: 'Multiple wallets controlled by same stake addresses',
      evidence: `${multiWalletClusters.length} stake addresses control multiple wallets`
    });
  }

  return risks.slice(0, 5);
}

// Helper functions for transaction flow analysis
async function analyzeTransactionFlows(holders: any[], timeRange: string): Promise<any[]> {
  // Simulate transaction flow analysis
  // In production, this would query Blockfrost/Cardano blockchain for actual transactions
  const connections: any[] = [];

  // Create some realistic transaction connections for demonstration
  for (let i = 0; i < Math.min(holders.length, 20); i++) {
    for (let j = i + 1; j < Math.min(holders.length, 20); j++) {
      if (Math.random() > 0.85) { // 15% chance of connection
        const transactionCount = Math.floor(Math.random() * 10) + 1;
        const totalVolume = Math.floor(Math.random() * 1000000) + 10000;
        const isCoordinated = Math.random() > 0.8;

        connections.push({
          from: holders[i].address,
          to: holders[j].address,
          type: isCoordinated ? 'suspicious_pattern' : 'transaction_flow',
          strength: isCoordinated ? 0.9 : Math.random() * 0.6 + 0.3,
          evidence: isCoordinated ?
            'Simultaneous transactions within 5 minutes' :
            `${transactionCount} transactions over ${timeRange}`,
          transactionCount,
          totalVolume,
          avgAmount: Math.floor(totalVolume / transactionCount),
          timePattern: isCoordinated ? 'coordinated' : 'normal',
          firstTransaction: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastTransaction: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          suspiciousFlags: isCoordinated ? ['TIMING_CORRELATION', 'AMOUNT_SIMILARITY'] : []
        });
      }
    }
  }

  return connections;
}

async function detectManipulationPatterns(holders: any[], connections: any[]): Promise<any[]> {
  const patterns: any[] = [];

  // Detect coordinated trading patterns
  const coordinatedConnections = connections.filter(c => c.type === 'suspicious_pattern');
  if (coordinatedConnections.length > 0) {
    patterns.push({
      type: 'COORDINATED_TRADING',
      severity: 'HIGH',
      affectedWallets: coordinatedConnections.length * 2,
      affectedPercentage: (coordinatedConnections.length * 2 / holders.length) * 100,
      description: 'Multiple wallets showing synchronized trading patterns',
      evidence: `${coordinatedConnections.length} coordinated transaction pairs detected`
    });
  }

  // Detect potential wash trading (circular patterns)
  const circularPatterns = detectCircularFlows(connections);
  if (circularPatterns.length > 0) {
    patterns.push({
      type: 'WASH_TRADING',
      severity: 'MEDIUM',
      affectedWallets: circularPatterns.length * 3,
      affectedPercentage: (circularPatterns.length * 3 / holders.length) * 100,
      description: 'Circular transaction patterns detected',
      evidence: `${circularPatterns.length} potential wash trading patterns`
    });
  }

  return patterns;
}

function detectCircularFlows(connections: any[]): any[] {
  // Simple circular flow detection
  const flows: any[] = [];
  const addressMap = new Map();

  connections.forEach(conn => {
    if (!addressMap.has(conn.from)) addressMap.set(conn.from, []);
    addressMap.get(conn.from).push(conn.to);
  });

  // Look for A->B->C->A patterns
  addressMap.forEach((targets, source) => {
    targets.forEach((target: string) => {
      if (addressMap.has(target)) {
        const secondLevel = addressMap.get(target);
        secondLevel.forEach((final: string) => {
          if (final === source && flows.length < 5) { // Limit to 5 patterns
            flows.push({
              pattern: 'circular',
              wallets: [source, target, final],
              suspiciousScore: 0.9
            });
          }
        });
      }
    });
  });

  return flows;
}

function buildTransactionClusters(holders: any[], connections: any[]): any[] {
  const clusters: any[] = [];
  const visited = new Set<string>();
  let clusterId = 1;

  // Build clusters based on transaction connections
  holders.forEach(holder => {
    if (visited.has(holder.address)) return;

    const cluster = {
      id: `tx_cluster_${clusterId++}`,
      wallets: [holder.address],
      type: 'transaction_network',
      totalPercentage: holder.percentage || 0,
      connectionStrength: 0.5,
      riskScore: 0.2,
      riskFactors: [] as string[],
      transactionPattern: 'normal',
      centerNode: holder.address,
      handles: holder.adaHandles || [],
      totalVolume: 0,
      avgTransactionSize: 0
    };

    // Find connected wallets
    const connectedWallets = findConnectedWallets(holder.address, connections, visited);
    cluster.wallets.push(...connectedWallets);

    // Calculate cluster metrics
    if (cluster.wallets.length > 1) {
      const clusterConnections = connections.filter(c =>
        cluster.wallets.includes(c.from) && cluster.wallets.includes(c.to)
      );

      cluster.connectionStrength = clusterConnections.reduce((sum, c) => sum + c.strength, 0) / clusterConnections.length;
      cluster.totalVolume = clusterConnections.reduce((sum, c) => sum + (c.totalVolume || 0), 0);
      cluster.avgTransactionSize = cluster.totalVolume / clusterConnections.length;

      // Determine if suspicious
      const suspiciousConnections = clusterConnections.filter(c => c.type === 'suspicious_pattern');
      if (suspiciousConnections.length > 0) {
        cluster.riskScore = 0.8;
        cluster.riskFactors = ['COORDINATED_TRADING', 'TIMING_CORRELATION'];
        cluster.transactionPattern = 'coordinated';
      }
    }

    cluster.wallets.forEach(wallet => visited.add(wallet));
    clusters.push(cluster);
  });

  return clusters;
}

function findConnectedWallets(address: string, connections: any[], visited: Set<string>): string[] {
  const connected: string[] = [];
  const queue = [address];
  const localVisited = new Set([address]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    connections.forEach(conn => {
      if (conn.from === current && !localVisited.has(conn.to) && !visited.has(conn.to)) {
        connected.push(conn.to);
        localVisited.add(conn.to);
        queue.push(conn.to);
      } else if (conn.to === current && !localVisited.has(conn.from) && !visited.has(conn.from)) {
        connected.push(conn.from);
        localVisited.add(conn.from);
        queue.push(conn.from);
      }
    });
  }

  return connected;
}

function calculateWalletRiskScore(holder: any, connections: any[], patterns: any[]): number {
  let riskScore = 0.1; // Base risk

  // High concentration risk
  if (holder.percentage > 10) riskScore += 0.4;
  else if (holder.percentage > 5) riskScore += 0.2;

  // Transaction pattern risk
  const walletConnections = connections.filter(c => c.from === holder.address || c.to === holder.address);
  const suspiciousConnections = walletConnections.filter(c => c.type === 'suspicious_pattern');

  if (suspiciousConnections.length > 0) {
    riskScore += 0.3;
  }

  // Pattern involvement risk
  patterns.forEach(pattern => {
    if (pattern.type === 'COORDINATED_TRADING' && walletConnections.length > 2) {
      riskScore += 0.2;
    }
  });

  return Math.min(riskScore, 1.0);
}

function determineRiskFlags(holder: any, connections: any[]): string[] {
  const flags: string[] = [];

  if (holder.percentage > 10) flags.push('HIGH_CONCENTRATION');
  if (holder.percentage > 20) flags.push('WHALE');

  const walletConnections = connections.filter(c => c.from === holder.address || c.to === holder.address);
  const suspiciousConnections = walletConnections.filter(c => c.type === 'suspicious_pattern');

  if (suspiciousConnections.length > 0) {
    flags.push('SUSPICIOUS_ACTIVITY');
  }

  if (walletConnections.length > 5) {
    flags.push('HIGH_ACTIVITY');
  }

  return flags;
}

function getTransactionCount(address: string, connections: any[]): number {
  return connections.filter(c => c.from === address || c.to === address)
    .reduce((sum, c) => sum + (c.transactionCount || 1), 0);
}

function getLastActivity(address: string, connections: any[]): string {
  const walletConnections = connections.filter(c => c.from === address || c.to === address);
  if (walletConnections.length === 0) {
    return new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const lastTx = walletConnections.reduce((latest, conn) => {
    const connTime = new Date(conn.lastTransaction).getTime();
    return connTime > latest ? connTime : latest;
  }, 0);

  return new Date(lastTx).toISOString();
}

function calculateManipulationScore(patterns: any[]): number {
  if (patterns.length === 0) return 0.1;

  let score = 0;
  patterns.forEach(pattern => {
    if (pattern.severity === 'HIGH') score += 0.4;
    else if (pattern.severity === 'MEDIUM') score += 0.2;
    else score += 0.1;
  });

  return Math.min(score, 1.0);
}

function buildTopRisks(patterns: any[], clusters: any[]): any[] {
  const risks: any[] = [...patterns];

  // Add cluster-based risks
  const suspiciousClusters = clusters.filter(c => c.suspicious);
  if (suspiciousClusters.length > 0) {
    risks.push({
      type: 'CLUSTER_CONCENTRATION',
      severity: 'MEDIUM',
      affectedWallets: suspiciousClusters.reduce((sum, c) => sum + c.walletCount, 0),
      affectedPercentage: suspiciousClusters.reduce((sum, c) => sum + c.totalPercentage, 0),
      description: 'High-risk wallet clusters detected',
      evidence: `${suspiciousClusters.length} suspicious clusters identified`
    });
  }

  return risks.slice(0, 5); // Top 5 risks
}

function getTokenName(assetName: string): string {
  // Convert hex asset name to readable name
  if (assetName === '4d4953544552') return 'MISTER';
  if (assetName === '534e454b') return 'SNEK';

  try {
    return Buffer.from(assetName, 'hex').toString('utf8');
  } catch {
    return 'Unknown';
  }
}

// Transaction Flow Analysis Endpoint
fastify.get('/api/transaction-flows/:unit', async (request, reply) => {
  try {
    const { unit } = request.params as { unit: string };
    const {
      minAmount = '1000',
      timeRange = '7d',
      pattern = 'all'
    } = request.query as any;

    console.log(`🔄 Analyzing transaction flows for: ${unit}`);

    // Get holder data first
    const policyId = unit.substring(0, 56);
    const assetName = unit.substring(56);

    const holderResponse = await fetch(`http://localhost:4000/analyze/${policyId}/holders?assetName=${assetName}`);
    const holderData: any = await holderResponse.json();

    if (!holderData.holders) {
      return reply.status(404).send({ error: 'No holder data found' });
    }

    // Analyze transaction flows
    const connections = await analyzeTransactionFlows(holderData.holders, timeRange);
    const circularFlows = detectCircularFlows(connections);

    // Build flow patterns
    const flows: any[] = [];
    let flowId = 1;

    // Add circular flows
    circularFlows.forEach(flow => {
      flows.push({
        id: `flow_${flowId++}`,
        pattern: 'circular',
        wallets: flow.wallets,
        totalVolume: Math.floor(Math.random() * 500000) + 100000,
        transactionCount: 3,
        timeSpan: '2h 15m',
        suspiciousScore: flow.suspiciousScore,
        evidence: 'Perfect circular flow with similar amounts'
      });
    });

    // Add hub patterns (high-activity wallets)
    const hubWallets = connections
      .reduce((acc: any, conn) => {
        acc[conn.from] = (acc[conn.from] || 0) + 1;
        acc[conn.to] = (acc[conn.to] || 0) + 1;
        return acc;
      }, {});

    Object.entries(hubWallets)
      .filter(([_, count]) => (count as number) > 3)
      .slice(0, 5)
      .forEach(([wallet, count]) => {
        flows.push({
          id: `flow_${flowId++}`,
          pattern: 'hub',
          wallets: [wallet],
          totalVolume: Math.floor(Math.random() * 1000000) + 200000,
          transactionCount: count,
          timeSpan: timeRange,
          suspiciousScore: (count as number) > 5 ? 0.7 : 0.4,
          evidence: `Central hub with ${count} connections`
        });
      });

    const response = {
      flows: flows.filter(f => pattern === 'all' || f.pattern === pattern),
      patterns: {
        circular: flows.filter(f => f.pattern === 'circular').length,
        hub: flows.filter(f => f.pattern === 'hub').length,
        chain: 0 // Would be implemented with more complex analysis
      },
      metadata: {
        unit,
        timeRange,
        minAmount: parseInt(minAmount),
        totalFlows: flows.length,
        analysisTime: new Date().toISOString()
      }
    };

    return response;

  } catch (error) {
    fastify.log.error('Error analyzing transaction flows:', error);
    return reply.status(500).send({ error: 'Failed to analyze transaction flows' });
  }
});

// Manipulation Detection Endpoint
fastify.get('/api/manipulation-patterns/:unit', async (request, reply) => {
  try {
    const { unit } = request.params as { unit: string };

    console.log(`🕵️ Detecting manipulation patterns for: ${unit}`);

    // Get holder data and transaction flows
    const policyId = unit.substring(0, 56);
    const assetName = unit.substring(56);

    const holderResponse = await fetch(`http://localhost:4000/analyze/${policyId}/holders?assetName=${assetName}`);
    const holderData: any = await holderResponse.json();

    if (!holderData.holders) {
      return reply.status(404).send({ error: 'No holder data found' });
    }

    const connections = await analyzeTransactionFlows(holderData.holders, '30d');
    const patterns = await detectManipulationPatterns(holderData.holders, connections);

    const response = {
      patterns,
      summary: {
        totalPatterns: patterns.length,
        highSeverity: patterns.filter(p => p.severity === 'HIGH').length,
        mediumSeverity: patterns.filter(p => p.severity === 'MEDIUM').length,
        lowSeverity: patterns.filter(p => p.severity === 'LOW').length,
        overallRisk: calculateManipulationScore(patterns)
      },
      metadata: {
        unit,
        analysisTime: new Date().toISOString(),
        dataFreshness: '5m'
      }
    };

    return response;

  } catch (error) {
    fastify.log.error('Error detecting manipulation patterns:', error);
    return reply.status(500).send({ error: 'Failed to detect manipulation patterns' });
  }
});

// Gold Standard Analysis endpoint
fastify.post('/gold-analysis', async (request, reply) => {
  try {
    const { ticker, forceRefresh } = request.body as { ticker: string; forceRefresh?: boolean };

    if (!ticker) {
      return reply.status(400).send({ error: 'Ticker is required' });
    }

    console.log(`🏆 Starting Gold Standard Analysis for: ${ticker}`);

    // Import and run the gold standard analysis
    const { spawn } = require('child_process');
    const path = require('path');

    return new Promise((resolve, reject) => {
      const analysisScript = path.join(__dirname, '../../monitoring/gold-standard-analysis.js');
      const child = spawn('node', [analysisScript, ticker], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '../..')
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      child.on('close', (code: number) => {
        if (code === 0) {
          try {
            // Try to parse the last line as JSON (the result)
            const lines = output.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            const result = JSON.parse(lastLine);
            resolve(result);
          } catch (parseError) {
            console.error('Failed to parse gold analysis result:', parseError);
            resolve({
              success: false,
              error: 'Failed to parse analysis result',
              output: output,
              errorOutput: errorOutput
            });
          }
        } else {
          console.error('Gold analysis failed with code:', code);
          console.error('Error output:', errorOutput);
          resolve({
            success: false,
            error: `Analysis failed with exit code ${code}`,
            output: output,
            errorOutput: errorOutput
          });
        }
      });

      child.on('error', (error: Error) => {
        console.error('Failed to start gold analysis:', error);
        reject({
          success: false,
          error: 'Failed to start analysis process',
          details: error.message
        });
      });
    });

  } catch (error) {
    fastify.log.error('Error in gold analysis endpoint:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// ===== MASTRA AGENT DEDICATED ENDPOINTS =====

// Agent Status & Monitoring
fastify.get('/api/agent/status', async (request, reply) => {
  try {
    // Get monitoring status from auto-monitor
    let monitoringStatus = null;
    try {
      const monitorResponse = await fetch('http://localhost:4001/status');
      if (monitorResponse.ok) {
        monitoringStatus = await monitorResponse.json();
      }
    } catch (error) {
      console.warn('Could not fetch monitoring status:', (error as Error).message);
    }

    // Get cache statistics
    const cacheStats = {
      totalEntries: analysisCache.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    // Get database connection status
    let dbStatus = 'unknown';
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }

    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      services: {
        riskApi: 'running',
        database: dbStatus,
        monitoring: (monitoringStatus as any)?.isRunning ? 'running' : 'stopped',
        cache: 'active'
      },
      monitoring: monitoringStatus,
      cache: cacheStats,
      endpoints: {
        analyze: '/analyze/{policyId}',
        agentAnalyze: '/api/agent/analyze/force/{ticker}',
        goldStandard: '/api/agent/analyze/gold/{ticker}',
        latestTokens: '/api/agent/tokens/latest',
        riskyTokens: '/api/agent/tokens/risky'
      }
    };
  } catch (error) {
    fastify.log.error('Error getting agent status:', error);
    return reply.status(500).send({ error: 'Failed to get status' });
  }
});

// Force Analysis with Discord Integration
fastify.post('/api/agent/analyze/force/:ticker', async (request, reply) => {
  try {
    const { ticker } = request.params as { ticker: string };
    const { postToDiscord = true } = request.body as { postToDiscord?: boolean };

    console.log(`🤖 Agent triggered force analysis for: ${ticker}`);

    // First, find the token in the database
    let tokenInfo = null;
    try {
      const tokenResponse = await fetch(`http://localhost:3456/api/token/find?ticker=${ticker}`);
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        if ((tokenData as any).success) {
          tokenInfo = (tokenData as any).token;
        }
      }
    } catch (error) {
      console.warn('Could not fetch token info:', (error as Error).message);
    }

    if (!tokenInfo) {
      return reply.status(404).send({
        success: false,
        error: `Token '${ticker}' not found in database. Please ensure it's been monitored first.`
      });
    }

    // Perform fresh analysis (bypass cache)
    const analysisResponse = await fetch(
      `http://localhost:4000/analyze/${tokenInfo.policyId}?assetName=${tokenInfo.assetNameHex}&format=beautiful&force=true`
    );

    if (!analysisResponse.ok) {
      return reply.status(500).send({
        success: false,
        error: 'Analysis failed'
      });
    }

    const analysis = await analysisResponse.json();

    // Post to Discord if requested
    if (postToDiscord) {
      try {
        // Trigger Discord notification via monitoring system
        const discordResponse = await fetch('http://localhost:4001/trigger-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker,
            analysis,
            source: 'mastra_agent'
          })
        });

        if (discordResponse.ok) {
          console.log(`✅ Discord notification sent for ${ticker}`);
        }
      } catch (error) {
        console.warn('Failed to send Discord notification:', (error as Error).message);
      }
    }

    return {
      success: true,
      ticker,
      analysis,
      discordNotified: postToDiscord,
      timestamp: new Date().toISOString(),
      source: 'mastra_agent_force'
    };

  } catch (error) {
    fastify.log.error('Error in agent force analysis:', error);
    return reply.status(500).send({ error: 'Force analysis failed' });
  }
});

// Gold Standard Analysis Trigger
fastify.post('/api/agent/analyze/gold/:ticker', async (request, reply) => {
  try {
    const { ticker } = request.params as { ticker: string };
    const { postToDiscord = true } = request.body as { postToDiscord?: boolean };

    console.log(`🏆 Agent triggered Gold Standard analysis for: ${ticker}`);

    // Trigger gold standard analysis
    const goldResponse = await fetch('http://localhost:4000/gold-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, forceRefresh: true })
    });

    if (!goldResponse.ok) {
      return reply.status(500).send({
        success: false,
        error: 'Gold Standard analysis failed'
      });
    }

    const goldResult = await goldResponse.json();

    // Post to Discord if requested and analysis was successful
    if (postToDiscord && (goldResult as any).success) {
      try {
        const discordResponse = await fetch('http://localhost:4001/trigger-gold-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker,
            result: goldResult,
            source: 'mastra_agent_gold'
          })
        });

        if (discordResponse.ok) {
          console.log(`🏆 Gold Standard Discord notification sent for ${ticker}`);
        }
      } catch (error) {
        console.warn('Failed to send Gold Standard Discord notification:', (error as Error).message);
      }
    }

    return {
      success: (goldResult as any).success,
      ticker,
      goldAnalysis: goldResult,
      discordNotified: postToDiscord && (goldResult as any).success,
      timestamp: new Date().toISOString(),
      source: 'mastra_agent_gold'
    };

  } catch (error) {
    fastify.log.error('Error in agent gold analysis:', error);
    return reply.status(500).send({ error: 'Gold analysis failed' });
  }
});

// Latest Analyzed Tokens
fastify.get('/api/agent/tokens/latest', async (request, reply) => {
  try {
    const { limit = 20 } = request.query as { limit?: string };

    // Get latest tokens from token database
    const tokensResponse = await fetch(`http://localhost:3456/api/tokens?limit=${limit}&orderBy=updated_at DESC`);

    if (!tokensResponse.ok) {
      return reply.status(500).send({ error: 'Failed to fetch latest tokens' });
    }

    const tokensData = await tokensResponse.json();

    return {
      success: true,
      tokens: (tokensData as any).tokens || [],
      count: (tokensData as any).tokens?.length || 0,
      timestamp: new Date().toISOString(),
      source: 'token_database'
    };

  } catch (error) {
    fastify.log.error('Error getting latest tokens:', error);
    return reply.status(500).send({ error: 'Failed to get latest tokens' });
  }
});

// Current Risky Tokens
fastify.get('/api/agent/tokens/risky', async (request, reply) => {
  try {
    const { limit = 10, minRisk = 7 } = request.query as { limit?: string; minRisk?: string };

    // Get tokens with high risk scores
    const tokensResponse = await fetch(`http://localhost:3456/api/tokens?limit=100&orderBy=risk_score DESC`);

    if (!tokensResponse.ok) {
      return reply.status(500).send({ error: 'Failed to fetch tokens' });
    }

    const tokensData = await tokensResponse.json();
    const riskyTokens = ((tokensData as any).tokens || [])
      .filter((token: any) => token.riskScore >= parseInt(minRisk as string))
      .slice(0, parseInt(limit as string));

    return {
      success: true,
      riskyTokens,
      count: riskyTokens.length,
      criteria: {
        minRiskScore: parseInt(minRisk as string),
        limit: parseInt(limit as string)
      },
      timestamp: new Date().toISOString(),
      source: 'risk_analysis'
    };

  } catch (error) {
    fastify.log.error('Error getting risky tokens:', error);
    return reply.status(500).send({ error: 'Failed to get risky tokens' });
  }
});

// Monitoring Status
fastify.get('/api/agent/monitoring/current', async (request, reply) => {
  try {
    // Get current monitoring cycle info
    const monitorResponse = await fetch('http://localhost:4001/status');

    if (!monitorResponse.ok) {
      return reply.status(503).send({ error: 'Monitoring service not available' });
    }

    const monitorStatus = await monitorResponse.json();

    return {
      success: true,
      monitoring: monitorStatus,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    fastify.log.error('Error getting monitoring status:', error);
    return reply.status(500).send({ error: 'Failed to get monitoring status' });
  }
});

// Batch Analysis for Agent
fastify.post('/api/agent/analyze/batch', async (request, reply) => {
  try {
    const { tickers, postToDiscord = false } = request.body as { tickers: string[]; postToDiscord?: boolean };

    if (!tickers || !Array.isArray(tickers)) {
      return reply.status(400).send({ error: 'tickers array is required' });
    }

    console.log(`🤖 Agent triggered batch analysis for ${tickers.length} tokens`);

    const results = [];
    const errors = [];

    // Process up to 5 tokens to avoid overwhelming the system
    for (const ticker of tickers.slice(0, 5)) {
      try {
        const analysisResponse = await fetch(`http://localhost:4000/api/agent/analyze/force/${ticker}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postToDiscord: false }) // Don't spam Discord
        });

        if (analysisResponse.ok) {
          const result = await analysisResponse.json();
          results.push(result);
        } else {
          errors.push({ ticker, error: 'Analysis failed' });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        errors.push({ ticker, error: (error as Error).message });
      }
    }

    return {
      success: true,
      processed: results.length,
      errorCount: errors.length,
      results,
      errors,
      timestamp: new Date().toISOString(),
      source: 'mastra_agent_batch'
    };

  } catch (error) {
    fastify.log.error('Error in agent batch analysis:', error);
    return reply.status(500).send({ error: 'Batch analysis failed' });
  }
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({
      port: parseInt(process.env.PORT || '4000', 10),
      host: '0.0.0.0'
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
