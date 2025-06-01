const express = require('express');
const cors = require('cors');
const TokenDatabase = require('./token-database');

const app = express();
const port = 3456; // Random port to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
let tokenDb;

async function initializeDatabase() {
  try {
    tokenDb = new TokenDatabase();
    await tokenDb.init();
    console.log('✅ Token database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// API Routes

// Find token by ticker
app.get('/api/token/find', async (req, res) => {
  try {
    const { ticker } = req.query;

    if (!ticker) {
      return res.status(400).json({
        success: false,
        error: 'Ticker parameter is required'
      });
    }

    const token = await tokenDb.findTokenByTicker(ticker);

    if (token) {
      res.json({
        success: true,
        token: {
          policyId: token.policy_id,
          assetNameHex: token.asset_name_hex,
          unit: token.unit,
          ticker: token.ticker,
          name: token.name,
          price: token.price,
          volume24h: token.volume_24h,
          marketCap: token.market_cap,
          riskScore: token.risk_score,
          topHolderPercentage: token.top_holder_percentage,
          socialLinks: {
            website: token.website,
            twitter: token.twitter,
            discord: token.discord,
            telegram: token.telegram,
            github: token.github,
            reddit: token.reddit,
            medium: token.medium,
            youtube: token.youtube,
            instagram: token.instagram,
            facebook: token.facebook,
            email: token.email
          },
          lastUpdated: token.updated_at,
          source: 'database'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Token with ticker '${ticker}' not found in database`
      });
    }
  } catch (error) {
    console.error('Error finding token:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Search tokens
app.get('/api/token/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter (q) is required'
      });
    }

    const tokens = await tokenDb.searchTokens(q, parseInt(limit));

    res.json({
      success: true,
      tokens: tokens.map(token => ({
        policyId: token.policy_id,
        unit: token.unit,
        ticker: token.ticker,
        name: token.name,
        price: token.price,
        volume24h: token.volume_24h,
        riskScore: token.risk_score,
        lastUpdated: token.updated_at
      })),
      count: tokens.length
    });
  } catch (error) {
    console.error('Error searching tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all tokens
app.get('/api/tokens', async (req, res) => {
  try {
    const { page = 1, limit = 50, orderBy = 'volume_24h DESC' } = req.query;

    const tokens = await tokenDb.getAllTokens(parseInt(page), parseInt(limit), orderBy);

    res.json({
      success: true,
      tokens: tokens.map(token => ({
        policyId: token.policy_id,
        unit: token.unit,
        ticker: token.ticker,
        name: token.name,
        price: token.price,
        volume24h: token.volume_24h,
        marketCap: token.market_cap,
        riskScore: token.risk_score,
        topHolderPercentage: token.top_holder_percentage,
        lastUpdated: token.updated_at
      })),
      page: parseInt(page),
      limit: parseInt(limit),
      count: tokens.length
    });
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await tokenDb.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Simple Token API'
  });
});

// Start server
async function startServer() {
  await initializeDatabase();

  const server = app.listen(port, async () => {
    console.log(`🚀 Token Database API running on http://localhost:${port}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET /api/token/find?ticker=SNEK`);
    console.log(`   GET /api/token/search?q=SNEK&limit=10`);
    console.log(`   GET /api/tokens?page=1&limit=50`);
    console.log(`   GET /api/stats`);
    console.log(`   GET /api/health`);
    console.log(`🔄 Server is running... Press Ctrl+C to stop`);

    // Show database stats
    try {
      const stats = await tokenDb.getStats();
      console.log(`💾 Database loaded: ${stats.totalTokens} tokens, ${stats.totalMappings} mappings`);
    } catch (error) {
      console.log(`💾 Database connected`);
    }
  });

  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Token Database API...');
    tokenDb.close();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
