const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const TokenDatabase = require('./token-database');
require('dotenv').config();

// TapTools Configuration
const TAPTOOLS_API_KEY = 'ItDt8Q9DI6Aa4Rc6yDn627cvBxAdRD2X';

// ADA Handle Policy ID from the guide
const HANDLE_POLICY_ID = 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';
const TAPTOOLS_BASE_URL = 'https://openapi.taptools.io/api/v1';
const RISK_API_URL = process.env.RISK_API_URL || 'http://localhost:4000';
const DATA_DIR = './data';
const TOKENS_FILE = path.join(DATA_DIR, 'latest_tokens.json');
const ANALYZED_TOKENS_FILE = path.join(DATA_DIR, 'analyzed_tokens.json');

class TapToolsService {
  constructor() {
    // Wallet tracking system
    this.trackedWallets = new Map(); // address -> tracking info
    this.trackingFile = path.join(DATA_DIR, 'tracked_wallets.json');
    this.tokenDb = new TokenDatabase();
    this.initialized = false;

    // API call tracking
    this.apiCallCounter = {
      total: 0,
      byEndpoint: new Map(),
      byHour: new Map(),
      sessionStart: Date.now(),
      lastReset: Date.now()
    };

    // Cache system for API responses
    this.cache = {
      marketCap: new Map(), // unit -> {data, timestamp}
      liquidity: new Map(), // unit -> {data, timestamp}
      holders: new Map(), // unit -> {data, timestamp}
      topVolume: new Map() // timeframe -> {data, timestamp}
    };
    
    // Cache durations (in milliseconds)
    this.CACHE_DURATION = {
      marketCap: 30 * 60 * 1000, // 30 minutes for market cap
      liquidity: 60 * 60 * 1000, // 1 hour for liquidity pools
      holders: 15 * 60 * 1000, // 15 minutes for holders
      topVolume: 10 * 60 * 1000 // 10 minutes for top volume
    };

    // Known safe tokens to skip analysis
    this.SAFE_TOKENS = new Set([
      // Major tokens
      'ADA', 'HOSKY', 'MIN', 'SUNDAE', 'MILK', 'LENFI', 'COPI', 'WMT', 'INDY',
      'STRIKE', 'AGENT', 'SNEK', 'IAG', 'WMTX', 'CHAD',
      // Stablecoins
      'DJED', 'USDM', 'iUSD', 'USDA', 'USDC', 'USDT', 'DAI', 'BUSD',
      // Bridge tokens
      'rsERG', 'rsADA', 'rsBTC', 'rsETH', 'WETH', 'WBTC', 'WADA'
    ]);
  }

  async init() {
    if (this.initialized) return;

    // Create data directory if it doesn't exist
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    // Initialize database
    await this.tokenDb.init();

    console.log('🔧 TapTools Service initialized');

    // Load tracked wallets
    await this.loadTrackedWallets();

    this.initialized = true;
  }

  // Load tracked wallets from file
  async loadTrackedWallets() {
    try {
      const data = await fs.readFile(this.trackingFile, 'utf8');
      const wallets = JSON.parse(data);
      this.trackedWallets = new Map(Object.entries(wallets));
      console.log(`📋 Loaded ${this.trackedWallets.size} tracked wallets`);
    } catch (error) {
      console.log('📋 No existing tracked wallets file, starting fresh');
      this.trackedWallets = new Map();
    }
  }

  // Save tracked wallets to file
  async saveTrackedWallets() {
    try {
      const wallets = Object.fromEntries(this.trackedWallets);
      await fs.writeFile(this.trackingFile, JSON.stringify(wallets, null, 2));
      console.log(`💾 Saved ${this.trackedWallets.size} tracked wallets`);
    } catch (error) {
      console.error('❌ Error saving tracked wallets:', error.message);
    }
  }

  // Add wallet for tracking (supports both stake and addr1)
  async addWalletTracking(address, label = '', notes = '') {
    try {
      console.log(`📌 Adding wallet for tracking: ${address.substring(0, 20)}...`);

      // Determine if it's a stake or addr1 address
      const isStake = address.startsWith('stake1');
      const isAddr = address.startsWith('addr1');

      if (!isStake && !isAddr) {
        throw new Error('Address must start with stake1 or addr1');
      }

      // Get ADA Handle
      const handle = await this.getAdaHandle(address);

      // If it's a stake, get connected wallets
      let connectedWallets = [];
      if (isStake) {
        connectedWallets = await this.getWalletsFromStake(address);
      }

      // Get portfolio info
      const portfolio = await this.getWalletPortfolio(address).catch(() => null);

      const trackingInfo = {
        address,
        type: isStake ? 'stake' : 'wallet',
        label: label || `${isStake ? 'Stake' : 'Wallet'} ${this.trackedWallets.size + 1}`,
        notes,
        handle,
        connectedWallets: connectedWallets.length,
        connectedAddresses: connectedWallets,
        portfolio,
        addedAt: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
        alerts: []
      };

      this.trackedWallets.set(address, trackingInfo);
      await this.saveTrackedWallets();

      console.log(`✅ Added ${trackingInfo.type}: ${trackingInfo.label}`);
      if (handle) console.log(`🏷️ Handle: ${handle}`);
      if (connectedWallets.length > 0) console.log(`🔗 Connected wallets: ${connectedWallets.length}`);

      return trackingInfo;

    } catch (error) {
      console.error(`❌ Error adding wallet tracking:`, error.message);
      return null;
    }
  }

  // Remove wallet from tracking
  async removeWalletTracking(address) {
    if (this.trackedWallets.has(address)) {
      const info = this.trackedWallets.get(address);
      this.trackedWallets.delete(address);
      await this.saveTrackedWallets();
      console.log(`🗑️ Removed ${info.label} from tracking`);
      return true;
    } else {
      console.log(`❌ Wallet not found in tracking list`);
      return false;
    }
  }

  // List all tracked wallets
  listTrackedWallets() {
    console.log(`📋 TRACKED WALLETS (${this.trackedWallets.size}):\n`);

    if (this.trackedWallets.size === 0) {
      console.log('No wallets currently tracked');
      return;
    }

    let index = 1;
    for (const [address, info] of this.trackedWallets) {
      const handleText = info.handle ? ` (${info.handle})` : '';
      const connectedText = info.connectedWallets > 0 ? ` [${info.connectedWallets} wallets]` : '';

      console.log(`${index}. ${info.label}${handleText}`);
      console.log(`   Type: ${info.type.toUpperCase()}`);
      console.log(`   Address: ${address.substring(0, 30)}...${connectedText}`);
      console.log(`   Added: ${new Date(info.addedAt).toLocaleDateString()}`);
      if (info.notes) console.log(`   Notes: ${info.notes}`);
      console.log('');

      index++;
    }
  }

  // Monitor tracked wallets for changes
  async monitorTrackedWallets() {
    console.log(`🔍 MONITORING ${this.trackedWallets.size} TRACKED WALLETS...\n`);

    if (this.trackedWallets.size === 0) {
      console.log('No wallets to monitor');
      return;
    }

    for (const [address, info] of this.trackedWallets) {
      console.log(`🔍 Checking: ${info.label} (${info.type})`);

      try {
        // Get current portfolio
        const currentPortfolio = await this.getWalletPortfolio(address).catch(() => null);

        // Compare with previous portfolio
        if (info.portfolio && currentPortfolio) {
          const oldValue = info.portfolio.liquidValue || 0;
          const newValue = currentPortfolio.liquidValue || 0;
          const change = newValue - oldValue;
          const changePercent = oldValue > 0 ? (change / oldValue) * 100 : 0;

          if (Math.abs(changePercent) > 10) { // 10% change threshold
            console.log(`🚨 SIGNIFICANT CHANGE DETECTED!`);
            console.log(`   Value: $${oldValue.toLocaleString()} → $${newValue.toLocaleString()}`);
            console.log(`   Change: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`);

            // Add alert
            info.alerts.push({
              type: 'VALUE_CHANGE',
              timestamp: new Date().toISOString(),
              oldValue,
              newValue,
              changePercent
            });
          }
        }

        // Update tracking info
        info.portfolio = currentPortfolio;
        info.lastChecked = new Date().toISOString();

        console.log(`   ✅ Current value: $${currentPortfolio?.liquidValue?.toLocaleString() || 'Unknown'}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error monitoring ${info.label}:`, error.message);
      }

      console.log('');
    }

    // Save updated tracking info
    await this.saveTrackedWallets();
    console.log('📊 Monitoring complete!');
  }

  // Get detailed trade history for a tracked wallet
  async getWalletTradeHistory(address, unit = null, days = 7) {
    console.log(`📈 Getting trade history for: ${address.substring(0, 20)}...`);

    try {
      // Get recent trades
      const trades = await this.getWalletTrades(address, unit, 1, 100);

      if (trades.length === 0) {
        console.log('📈 No trades found');
        return {
          totalTrades: 0,
          buyTrades: 0,
          sellTrades: 0,
          totalVolume: 0,
          tokens: [],
          recentTrades: []
        };
      }

      // Filter trades by time (last X days)
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentTrades = trades.filter(trade => trade.time * 1000 > cutoffTime);

      // Analyze trade patterns
      const analysis = this.analyzeTradeHistory(recentTrades);

      console.log(`📈 Found ${recentTrades.length} trades in last ${days} days`);
      console.log(`📊 Buy/Sell ratio: ${analysis.buyTrades}/${analysis.sellTrades}`);
      console.log(`💰 Total volume: ${analysis.totalVolume.toLocaleString()} ADA`);

      return {
        ...analysis,
        recentTrades: recentTrades.slice(0, 10), // Last 10 trades
        period: `${days} days`
      };

    } catch (error) {
      console.error(`❌ Error getting trade history:`, error.message);
      return null;
    }
  }

  // Analyze trade history patterns
  analyzeTradeHistory(trades) {
    const analysis = {
      totalTrades: trades.length,
      buyTrades: 0,
      sellTrades: 0,
      totalVolume: 0,
      tokens: new Set(),
      suspiciousPatterns: [],
      avgTradeSize: 0,
      largestTrade: 0,
      tradingFrequency: 0
    };

    let totalTradeValue = 0;
    const tradesByToken = new Map();
    const tradesByHour = new Map();

    trades.forEach(trade => {
      // Determine if it's a buy or sell (ADA is usually tokenB in buys, tokenA in sells)
      const isBuy = trade.tokenB === 'lovelace' || trade.tokenBName === 'ADA';
      const isSell = trade.tokenA === 'lovelace' || trade.tokenAName === 'ADA';

      if (isBuy) {
        analysis.buyTrades++;
        analysis.totalVolume += trade.tokenBAmount / 1000000; // Convert lovelace to ADA
        totalTradeValue += trade.tokenBAmount / 1000000;
      } else if (isSell) {
        analysis.sellTrades++;
        analysis.totalVolume += trade.tokenAAmount / 1000000; // Convert lovelace to ADA
        totalTradeValue += trade.tokenAAmount / 1000000;
      }

      // Track tokens traded
      const token = isBuy ? trade.tokenAName : trade.tokenBName;
      analysis.tokens.add(token);

      // Track trades by token
      if (!tradesByToken.has(token)) {
        tradesByToken.set(token, { buys: 0, sells: 0, volume: 0 });
      }
      const tokenStats = tradesByToken.get(token);
      if (isBuy) {
        tokenStats.buys++;
        tokenStats.volume += trade.tokenBAmount / 1000000;
      } else if (isSell) {
        tokenStats.sells++;
        tokenStats.volume += trade.tokenAAmount / 1000000;
      }

      // Track trading hours
      const hour = new Date(trade.time * 1000).getHours();
      tradesByHour.set(hour, (tradesByHour.get(hour) || 0) + 1);

      // Track largest trade
      const tradeValue = isBuy ? trade.tokenBAmount / 1000000 : trade.tokenAAmount / 1000000;
      if (tradeValue > analysis.largestTrade) {
        analysis.largestTrade = tradeValue;
      }
    });

    // Calculate averages
    analysis.avgTradeSize = analysis.totalTrades > 0 ? totalTradeValue / analysis.totalTrades : 0;

    // Detect suspicious patterns
    if (analysis.totalTrades > 50) {
      analysis.suspiciousPatterns.push('HIGH_FREQUENCY_TRADING');
    }

    if (analysis.buyTrades === 0 && analysis.sellTrades > 0) {
      analysis.suspiciousPatterns.push('ONLY_SELLING');
    }

    if (analysis.sellTrades === 0 && analysis.buyTrades > 0) {
      analysis.suspiciousPatterns.push('ONLY_BUYING');
    }

    // Check for coordinated trading (many trades in same hour)
    const maxTradesPerHour = Math.max(...tradesByHour.values());
    if (maxTradesPerHour > 10) {
      analysis.suspiciousPatterns.push('COORDINATED_TRADING');
    }

    // Convert sets to arrays for JSON serialization
    analysis.tokens = Array.from(analysis.tokens);
    analysis.tokenBreakdown = Object.fromEntries(tradesByToken);
    analysis.hourlyDistribution = Object.fromEntries(tradesByHour);

    return analysis;
  }

  // Enhanced monitoring with trade history
  async monitorTrackedWalletsWithTrades() {
    console.log(`🔍 MONITORING ${this.trackedWallets.size} TRACKED WALLETS WITH TRADE HISTORY...\n`);

    if (this.trackedWallets.size === 0) {
      console.log('No wallets to monitor');
      return;
    }

    for (const [address, info] of this.trackedWallets) {
      console.log(`🔍 Checking: ${info.label} (${info.type})`);

      try {
        // Get current portfolio
        const currentPortfolio = await this.getWalletPortfolio(address).catch(() => null);

        // Get trade history
        const tradeHistory = await this.getWalletTradeHistory(address, null, 7);

        // Compare with previous data
        if (info.portfolio && currentPortfolio) {
          const oldValue = info.portfolio.liquidValue || 0;
          const newValue = currentPortfolio.liquidValue || 0;
          const change = newValue - oldValue;
          const changePercent = oldValue > 0 ? (change / oldValue) * 100 : 0;

          if (Math.abs(changePercent) > 10) {
            console.log(`🚨 SIGNIFICANT CHANGE DETECTED!`);
            console.log(`   Value: $${oldValue.toLocaleString()} → $${newValue.toLocaleString()}`);
            console.log(`   Change: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`);
          }
        }

        // Display trade analysis
        if (tradeHistory && tradeHistory.totalTrades > 0) {
          console.log(`📈 Trade Activity (7 days):`);
          console.log(`   Total trades: ${tradeHistory.totalTrades}`);
          console.log(`   Buy/Sell: ${tradeHistory.buyTrades}/${tradeHistory.sellTrades}`);
          console.log(`   Volume: ${tradeHistory.totalVolume.toFixed(2)} ADA`);
          console.log(`   Avg trade: ${tradeHistory.avgTradeSize.toFixed(2)} ADA`);
          console.log(`   Tokens traded: ${tradeHistory.tokens.join(', ')}`);

          if (tradeHistory.suspiciousPatterns.length > 0) {
            console.log(`🚨 Suspicious patterns: ${tradeHistory.suspiciousPatterns.join(', ')}`);
          }
        } else {
          console.log(`📈 No recent trading activity`);
        }

        // Update tracking info
        info.portfolio = currentPortfolio;
        info.tradeHistory = tradeHistory;
        info.lastChecked = new Date().toISOString();

        console.log(`   ✅ Current value: $${currentPortfolio?.liquidValue?.toLocaleString() || 'Unknown'}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error monitoring ${info.label}:`, error.message);
      }

      console.log('');
    }

    // Save updated tracking info
    await this.saveTrackedWallets();
    console.log('📊 Enhanced monitoring complete!');
  }

  // Track API call
  trackApiCall(endpoint) {
    this.apiCallCounter.total++;

    // Track by endpoint
    const count = this.apiCallCounter.byEndpoint.get(endpoint) || 0;
    this.apiCallCounter.byEndpoint.set(endpoint, count + 1);

    // Track by hour
    const hour = new Date().getHours();
    const hourCount = this.apiCallCounter.byHour.get(hour) || 0;
    this.apiCallCounter.byHour.set(hour, hourCount + 1);
  }

  // Get API call statistics
  getApiCallStats() {
    const now = Date.now();
    const sessionDuration = Math.round((now - this.apiCallCounter.sessionStart) / 1000 / 60); // minutes
    const hoursSinceReset = Math.round((now - this.apiCallCounter.lastReset) / 1000 / 60 / 60); // hours

    return {
      total: this.apiCallCounter.total,
      sessionDuration: `${sessionDuration} minutes`,
      hoursSinceReset: hoursSinceReset,
      callsPerMinute: sessionDuration > 0 ? (this.apiCallCounter.total / sessionDuration).toFixed(2) : 0,
      byEndpoint: Object.fromEntries(this.apiCallCounter.byEndpoint),
      byHour: Object.fromEntries(this.apiCallCounter.byHour),
      topEndpoints: Array.from(this.apiCallCounter.byEndpoint.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([endpoint, count]) => ({ endpoint, count }))
    };
  }

  // Reset API call counter (call this at the start of each monitoring cycle)
  resetApiCallCounter() {
    this.apiCallCounter = {
      total: 0,
      byEndpoint: new Map(),
      byHour: new Map(),
      sessionStart: Date.now(),
      lastReset: Date.now()
    };
  }

  // Print API call summary
  printApiCallSummary() {
    const stats = this.getApiCallStats();
    console.log('\n📊 API CALL SUMMARY:');
    console.log(`🔢 Total calls: ${stats.total}`);
    console.log(`⏱️ Session duration: ${stats.sessionDuration}`);
    console.log(`📈 Calls per minute: ${stats.callsPerMinute}`);
    console.log(`🏆 Top endpoints:`);
    stats.topEndpoints.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.endpoint}: ${item.count} calls`);
    });
    console.log('');
  }

  // Check if cached data is still valid
  isCacheValid(timestamp, duration) {
    return (Date.now() - timestamp) < duration;
  }

  // Get from cache if valid
  getFromCache(cacheType, key, duration) {
    const cached = this.cache[cacheType].get(key);
    if (cached && this.isCacheValid(cached.timestamp, duration)) {
      console.log(`📦 Cache hit for ${cacheType}:${key}`);
      return cached.data;
    }
    return null;
  }

  // Save to cache
  saveToCache(cacheType, key, data) {
    this.cache[cacheType].set(key, {
      data,
      timestamp: Date.now()
    });
  }

  async makeTapToolsRequest(endpoint, params = {}) {
    try {
      // Track the API call
      this.trackApiCall(endpoint);

      const response = await axios.get(`${TAPTOOLS_BASE_URL}${endpoint}`, {
        headers: {
          'x-api-key': TAPTOOLS_API_KEY,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error(`❌ TapTools API error for ${endpoint}:`, error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}, Data:`, error.response.data);
      }
      return null;
    }
  }

  async getTopVolumeTokens(timeframe = '1h', limit = 50) {
    // Check cache first
    const cacheKey = `${timeframe}-${limit}`;
    const cached = this.getFromCache('topVolume', cacheKey, this.CACHE_DURATION.topVolume);
    if (cached) {
      return cached;
    }

    console.log(`🔍 Fetching top volume tokens (${timeframe})...`);

    // Convert numeric hours to proper timeframe format
    let apiTimeframe = timeframe;
    if (typeof timeframe === 'number') {
      apiTimeframe = `${timeframe}h`;
    }

    const tokens = await this.makeTapToolsRequest('/token/top/volume', {
      timeframe: apiTimeframe,
      perPage: limit // Use perPage parameter instead of limit
    });

    if (tokens && Array.isArray(tokens)) {
      console.log(`📊 Found ${tokens.length} tokens with top volume in ${timeframe}`);

      // Save to cache
      this.saveToCache('topVolume', cacheKey, tokens);

      // Debug: Let's see the actual format of the first few tokens
      console.log('\n🔍 DEBUG: Sample token data:');
      tokens.slice(0, 3).forEach((token, i) => {
        console.log(`Token ${i + 1}:`, JSON.stringify(token, null, 2));
      });

      return tokens;
    }

    return [];
  }

  async getTopTokenHolders(unit, page = 1, perPage = 100) {
    // Check cache first
    const cacheKey = `${unit}-${page}-${perPage}`;
    const cached = this.getFromCache('holders', cacheKey, this.CACHE_DURATION.holders);
    if (cached) {
      return cached;
    }

    console.log(`👥 Fetching top holders for token: ${unit.substring(0, 20)}...`);

    const holders = await this.makeTapToolsRequest('/token/holders/top', {
      unit,
      page,
      perPage
    });

    if (holders && Array.isArray(holders)) {
      console.log(`👥 Found ${holders.length} holders for token`);
      // Save to cache
      this.saveToCache('holders', cacheKey, holders);
      return holders;
    }

    return [];
  }

  async getTokenLiquidityPools(unit, adaOnly = 1) {
    // Check cache first
    const cacheKey = `${unit}-${adaOnly}`;
    const cached = this.getFromCache('liquidity', cacheKey, this.CACHE_DURATION.liquidity);
    if (cached) {
      return cached;
    }

    console.log(`💧 Fetching liquidity pools for token: ${unit.substring(0, 20)}...`);

    const pools = await this.makeTapToolsRequest('/token/pools', {
      unit,
      adaOnly
    });

    if (pools && Array.isArray(pools)) {
      console.log(`💧 Found ${pools.length} liquidity pools for token`);
      // Save to cache
      this.saveToCache('liquidity', cacheKey, pools);
      return pools;
    }

    return [];
  }

  async getTokenMarketCap(unit) {
    // Check cache first
    const cached = this.getFromCache('marketCap', unit, this.CACHE_DURATION.marketCap);
    if (cached) {
      return cached;
    }

    console.log(`📊 Fetching market cap data for token: ${unit.substring(0, 20)}...`);

    const mcapData = await this.makeTapToolsRequest('/token/mcap', {
      unit
    });

    if (mcapData && mcapData.circSupply !== undefined && mcapData.circSupply !== null) {
      console.log(`📊 Market cap data: ${mcapData.ticker} - Circ Supply: ${(mcapData.circSupply || 0).toLocaleString()}, Price: $${mcapData.price}`);
      // Save to cache
      this.saveToCache('marketCap', unit, mcapData);
      return mcapData;
    } else if (mcapData) {
      console.log(`📊 Market cap data: ${mcapData.ticker} - Circ Supply: N/A, Price: $${mcapData.price || 'N/A'}`);
      // Save to cache even if partial data
      this.saveToCache('marketCap', unit, mcapData);
      return mcapData;
    }

    return null;
  }

  async getAddressInfo(address = null, paymentCred = null) {
    if (!address && !paymentCred) {
      throw new Error('Either address or paymentCred must be provided');
    }

    console.log(`📍 Fetching address info for: ${address ? address.substring(0, 20) + '...' : 'paymentCred: ' + paymentCred?.substring(0, 20) + '...'}`);

    const params = {};
    if (address) params.address = address;
    if (paymentCred) params.paymentCred = paymentCred;

    const addressData = await this.makeTapToolsRequest('/address/info', params);

    if (addressData && addressData.address) {
      console.log(`📍 Address info: ${addressData.assets?.length || 0} assets, ${addressData.lovelace} lovelace`);
      return addressData;
    }

    return null;
  }

  async getTransactionUtxos(hash) {
    console.log(`🔗 Fetching transaction UTxOs for: ${hash.substring(0, 20)}...`);

    const txData = await this.makeTapToolsRequest('/transaction/utxos', {
      hash
    });

    if (txData && txData.hash) {
      console.log(`🔗 Transaction UTxOs: ${txData.inputs?.length || 0} inputs, ${txData.outputs?.length || 0} outputs`);
      return txData;
    }

    return null;
  }

  async getWalletPortfolio(address) {
    console.log(`💼 Fetching portfolio for: ${address.substring(0, 20)}...`);

    const portfolioData = await this.makeTapToolsRequest('/wallet/portfolio/positions', {
      address
    });

    if (portfolioData && portfolioData.adaBalance !== undefined) {
      console.log(`💼 Portfolio: ${portfolioData.numFTs} FTs, ${portfolioData.numNFTs} NFTs, $${portfolioData.liquidValue?.toLocaleString()} value`);
      return portfolioData;
    }

    return null;
  }

  async getWalletTrades(address, unit = null, page = 1, perPage = 50) {
    console.log(`📈 Fetching trades for: ${address.substring(0, 20)}...`);

    const params = { address, page, perPage };
    if (unit) params.unit = unit;

    const tradesData = await this.makeTapToolsRequest('/wallet/trades/tokens', params);

    if (tradesData && Array.isArray(tradesData)) {
      console.log(`📈 Found ${tradesData.length} trades`);
      return tradesData;
    }

    return [];
  }

  async getWalletValueTrend(address, timeframe = '30d', quote = 'ADA') {
    console.log(`📊 Fetching value trend for: ${address.substring(0, 20)}...`);

    const trendData = await this.makeTapToolsRequest('/wallet/value/trended', {
      address,
      timeframe,
      quote
    });

    if (trendData && Array.isArray(trendData)) {
      console.log(`📊 Found ${trendData.length} value points over ${timeframe}`);
      return trendData;
    }

    return [];
  }

  // Get token social links from TapTools
  async getTokenLinks(unit) {
    try {
      console.log(`🔗 Getting token links for: ${unit.substring(0, 20)}...`);

      const response = await this.makeTapToolsRequest('/token/links', {
        unit: unit
      });

      if (response && typeof response === 'object') {
        console.log(`🔗 Found links for token`);
        return response;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error getting token links:`, error.message);
      return null;
    }
  }

  // Format token links for display
  formatTokenLinks(links) {
    if (!links || typeof links !== 'object') {
      return null;
    }

    const linkEntries = [];

    if (links.website) linkEntries.push(`🌐 [Website](${links.website})`);
    if (links.twitter) linkEntries.push(`🐦 [Twitter](${links.twitter})`);
    if (links.discord) linkEntries.push(`💬 [Discord](${links.discord})`);
    if (links.telegram) linkEntries.push(`📱 [Telegram](${links.telegram})`);
    if (links.github) linkEntries.push(`💻 [GitHub](${links.github})`);
    if (links.reddit) linkEntries.push(`📰 [Reddit](${links.reddit})`);
    if (links.medium) linkEntries.push(`📝 [Medium](${links.medium})`);
    if (links.youtube) linkEntries.push(`📺 [YouTube](${links.youtube})`);
    if (links.instagram) linkEntries.push(`📸 [Instagram](${links.instagram})`);
    if (links.facebook) linkEntries.push(`👥 [Facebook](${links.facebook})`);
    if (links.email) linkEntries.push(`📧 [Email](mailto:${links.email})`);

    return linkEntries.length > 0 ? linkEntries.join(' • ') : null;
  }

  // Save token data to database
  async saveTokenToDatabase(tokenData) {
    try {
      // Ensure database is initialized
      if (!this.initialized) {
        await this.init();
      }

      const {
        unit,
        ticker,
        name,
        price,
        volume,
        policyId,
        assetNameHex = ''
      } = tokenData;

      // Get additional data from TapTools
      const [links, mcapData, holders] = await Promise.all([
        this.getTokenLinks(unit).catch(() => null),
        this.getTokenMarketCap(unit).catch(() => null),
        this.getTopTokenHolders(unit, 1, 100).catch(() => [])  // Get top 100 holders for proper analysis
      ]);

      // Calculate holder statistics
      let topHolderPercentage = 0;
      let holderCount = 0;
      if (holders && holders.length > 0) {
        const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);
        topHolderPercentage = totalSupply > 0 ? (holders[0].amount / totalSupply) * 100 : 0;
        holderCount = holders.length;
      }

      // Parse social links
      const socialLinks = {};
      if (links) {
        socialLinks.website = links.website;
        socialLinks.twitter = links.twitter;
        socialLinks.discord = links.discord;
        socialLinks.telegram = links.telegram;
        socialLinks.github = links.github;
        socialLinks.reddit = links.reddit;
        socialLinks.medium = links.medium;
        socialLinks.youtube = links.youtube;
        socialLinks.instagram = links.instagram;
        socialLinks.facebook = links.facebook;
        socialLinks.email = links.email;
      }

      // Save to database
      const tokenDbData = {
        policyId: policyId || unit.substring(0, 56),
        assetNameHex: assetNameHex || unit.substring(56),
        unit,
        ticker,
        name,
        price,
        volume24h: volume,
        marketCap: mcapData?.marketCap,
        circulatingSupply: mcapData?.circSupply,
        totalSupply: mcapData?.totalSupply,
        socialLinks,
        topHolderPercentage,
        holderCount
      };

      await this.tokenDb.saveToken(tokenDbData);

      // Save ticker mapping if ticker exists
      if (ticker) {
        await this.tokenDb.saveTickerMapping(
          ticker,
          unit,
          policyId || unit.substring(0, 56),
          assetNameHex || unit.substring(56),
          1.0,
          'taptools'
        );
      }

      console.log(`💾 Saved token to database: ${ticker || name || 'Unknown'}`);
      return true;

    } catch (error) {
      console.error('❌ Error saving token to database:', error.message);
      return false;
    }
  }

  // Find token by ticker (database first, then TapTools)
  async findTokenByTicker(ticker) {
    try {
      // First check database
      const dbToken = await this.tokenDb.findTokenByTicker(ticker);
      if (dbToken) {
        console.log(`✅ Found ${ticker} in database`);
        return {
          unit: dbToken.unit,
          policyId: dbToken.policy_id,
          assetNameHex: dbToken.asset_name_hex,
          ticker: dbToken.ticker,
          name: dbToken.name,
          source: 'database'
        };
      }

      // If not in database, search TapTools (this would require a search endpoint)
      console.log(`🔍 ${ticker} not found in database, checking TapTools...`);

      // For now, return null - we'll need to implement TapTools search
      return null;

    } catch (error) {
      console.error(`❌ Error finding token by ticker:`, error.message);
      return null;
    }
  }

  // Enhanced token analysis with database storage
  async analyzeTokenWithStorage(unit, ticker = '') {
    try {
      // Ensure database is initialized
      if (!this.initialized) {
        await this.init();
      }

      console.log(`🔍 Analyzing token: ${ticker || unit.substring(0, 20)}...`);

      // Get comprehensive token data
      const [links, mcapData, holders, pools] = await Promise.all([
        this.getTokenLinks(unit),
        this.getTokenMarketCap(unit),
        this.getTopTokenHolders(unit, 1, 100),
        this.getTokenLiquidityPools(unit)
      ]);

      // Calculate risk metrics
      let riskScore = 0;
      let topHolderPercentage = 0;
      let holderCount = 0;

      if (holders && holders.length > 0) {
        const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);
        topHolderPercentage = totalSupply > 0 ? (holders[0].amount / totalSupply) * 100 : 0;
        holderCount = holders.length;

        // Calculate risk score based on concentration
        if (topHolderPercentage > 80) riskScore += 4;
        else if (topHolderPercentage > 60) riskScore += 3;
        else if (topHolderPercentage > 40) riskScore += 2;
        else if (topHolderPercentage > 25) riskScore += 1;

        // Adjust for holder count
        if (holderCount < 10) riskScore += 2;
        else if (holderCount < 50) riskScore += 1;
      }

      // Determine verdict
      let verdict = 'SAFE';
      if (riskScore >= 7) verdict = 'HIGH_RISK';
      else if (riskScore >= 4) verdict = 'CAUTION';

      const analysisResult = {
        unit,
        ticker: ticker || mcapData?.ticker,
        name: mcapData?.name,
        price: mcapData?.price,
        marketCap: mcapData?.marketCap,
        circulatingSupply: mcapData?.circSupply,
        riskScore,
        verdict,
        topHolderPercentage,
        holderCount,
        liquidityPools: pools?.length || 0,
        socialLinks: links,
        holders: holders?.slice(0, 10) || [],
        analysisTimestamp: new Date().toISOString()
      };

      // Save to database
      await this.saveTokenToDatabase({
        unit,
        ticker: ticker || mcapData?.ticker,
        name: mcapData?.name,
        price: mcapData?.price,
        volume: 0, // We don't have volume from this analysis
        policyId: unit.substring(0, 56),
        assetNameHex: unit.substring(56)
      });

      // Save analysis history
      await this.tokenDb.saveAnalysisHistory(
        unit,
        riskScore,
        verdict,
        topHolderPercentage,
        holderCount,
        analysisResult
      );

      return analysisResult;

    } catch (error) {
      console.error('❌ Error analyzing token:', error.message);
      return null;
    }
  }

  // Get ADA Handle for an address using Blockfrost
  async getAdaHandle(address) {
    try {
      console.log(`🏷️ Getting ADA Handle for: ${address.substring(0, 20)}...`);

      const response = await axios.get(`https://cardano-mainnet.blockfrost.io/api/v0/addresses/${address}`, {
        headers: {
          'project_id': process.env.BLOCKFROST_API_KEY || 'mainnetKDR7gGfvHy85Mqr4nYtfjoXq7fX8R1Bu'
        },
        timeout: 30000
      });

      if (response.data && response.data.amount) {
        // Look for ADA Handle assets
        const handleAssets = response.data.amount.filter(asset =>
          asset.unit && asset.unit.includes(HANDLE_POLICY_ID)
        );

        if (handleAssets.length > 0) {
          // Extract handle name from the first handle asset
          const handleUnit = handleAssets[0].unit;
          const hexName = handleUnit.replace(HANDLE_POLICY_ID, '');

          try {
            // Convert hex to UTF-8 and clean up
            const rawUtf8 = Buffer.from(hexName, 'hex').toString('utf8');
            const cleanedName = rawUtf8.replace(/[^\x20-\x7E]/g, '');
            const handle = `$${cleanedName}`;

            console.log(`🏷️ Found handle: ${handle} for ${address.substring(0, 12)}...`);
            return handle;
          } catch (error) {
            console.error(`❌ Error decoding handle hex: ${hexName}`, error);
            return null;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Error getting handle for ${address.substring(0, 12)}:`, error.message);
      return null;
    }
  }

  // Get ADA Handles for multiple addresses (batch processing)
  async getAdaHandles(addresses) {
    console.log(`🏷️ Getting ADA Handles for ${addresses.length} addresses...`);

    const handles = {};
    const batchSize = 10; // Smaller batches to avoid rate limiting

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);

      console.log(`🏷️ Processing handle batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(addresses.length/batchSize)}`);

      const batchPromises = batch.map(async (address) => {
        const handle = await this.getAdaHandle(address);
        handles[address] = handle;
        return { address, handle };
      });

      await Promise.all(batchPromises);

      // Rate limiting between batches
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const foundHandles = Object.values(handles).filter(h => h !== null).length;
    console.log(`🏷️ Found ${foundHandles} handles out of ${addresses.length} addresses`);

    return handles;
  }

  // Get all addr1... wallets connected to a stake address using Blockfrost
  async getWalletsFromStake(stakeAddress) {
    try {
      console.log(`🔍 Getting wallets for stake: ${stakeAddress.substring(0, 20)}...`);

      // Use Blockfrost to get addresses associated with this stake
      const response = await axios.get(`https://cardano-mainnet.blockfrost.io/api/v0/accounts/${stakeAddress}/addresses`, {
        headers: {
          'project_id': process.env.BLOCKFROST_API_KEY || 'mainnetYOUR_API_KEY_HERE'
        },
        timeout: 30000
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`🔍 Found ${response.data.length} wallets for stake ${stakeAddress.substring(0, 20)}...`);
        return response.data;
      }

      return [];
    } catch (error) {
      console.error(`❌ Error getting wallets for stake ${stakeAddress.substring(0, 12)}:`, error.message);
      return [];
    }
  }

  // Enhanced stake analysis with connected wallets
  async analyzeStakeWithConnectedWallets(stakeAddress, tokenUnit, rank, percentage) {
    console.log(`🕵️ Analyzing stake ${rank} with connected wallets...`);

    try {
      // Get all wallets connected to this stake
      const connectedWallets = await this.getWalletsFromStake(stakeAddress);

      // Get additional intelligence for this stake
      const [portfolio, trades, valueTrend] = await Promise.all([
        this.getWalletPortfolio(stakeAddress).catch(() => null),
        this.getWalletTrades(stakeAddress, tokenUnit, 1, 50).catch(() => []),
        this.getWalletValueTrend(stakeAddress, '30d', 'ADA').catch(() => [])
      ]);

      // Analyze wallet patterns
      const walletAnalysis = {
        stakeAddress,
        rank,
        percentage,
        connectedWallets: connectedWallets.length,
        walletAddresses: connectedWallets,
        portfolio,
        trades: trades.length,
        valueTrend: valueTrend.length,
        suspiciousFlags: []
      };

      // Flag suspicious patterns
      if (connectedWallets.length > 10) {
        walletAnalysis.suspiciousFlags.push('MANY_WALLETS');
      }

      if (connectedWallets.length === 1 && percentage > 10) {
        walletAnalysis.suspiciousFlags.push('SINGLE_WALLET_LARGE_STAKE');
      }

      if (portfolio && portfolio.numFTs <= 3) {
        walletAnalysis.suspiciousFlags.push('FEW_TOKENS');
      }

      if (trades.length > 20) {
        walletAnalysis.suspiciousFlags.push('HIGH_TRADING_ACTIVITY');
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

      return walletAnalysis;

    } catch (error) {
      console.error(`❌ Error analyzing stake ${stakeAddress.substring(0, 12)}:`, error.message);
      return {
        stakeAddress,
        rank,
        percentage,
        connectedWallets: 0,
        walletAddresses: [],
        error: error.message
      };
    }
  }

  // Enhanced liquidity analysis
  analyzeLiquidityPools(pools, tokenTicker) {
    if (!pools || pools.length === 0) {
      return {
        hasLiquidity: false,
        poolCount: 0,
        totalAdaLocked: 0,
        totalTokenLocked: 0,
        exchanges: [],
        liquidityScore: 0,
        liquidityRisk: 'HIGH' // No liquidity = high risk
      };
    }

    let totalAdaLocked = 0;
    let totalTokenLocked = 0;
    const exchanges = new Set();

    pools.forEach(pool => {
      exchanges.add(pool.exchange);

      // Determine which token is ADA and which is our target token
      if (pool.tokenATicker === 'ADA') {
        totalAdaLocked += pool.tokenALocked;
        totalTokenLocked += pool.tokenBLocked;
      } else if (pool.tokenBTicker === 'ADA') {
        totalAdaLocked += pool.tokenBLocked;
        totalTokenLocked += pool.tokenALocked;
      }
    });

    // Calculate liquidity score (0-10)
    let liquidityScore = 0;
    let liquidityRisk = 'HIGH';

    if (totalAdaLocked >= 1000000) { // 1M+ ADA
      liquidityScore = 10;
      liquidityRisk = 'LOW';
    } else if (totalAdaLocked >= 500000) { // 500K+ ADA
      liquidityScore = 8;
      liquidityRisk = 'LOW';
    } else if (totalAdaLocked >= 100000) { // 100K+ ADA
      liquidityScore = 6;
      liquidityRisk = 'MEDIUM';
    } else if (totalAdaLocked >= 50000) { // 50K+ ADA
      liquidityScore = 4;
      liquidityRisk = 'MEDIUM';
    } else if (totalAdaLocked >= 10000) { // 10K+ ADA
      liquidityScore = 2;
      liquidityRisk = 'HIGH';
    } else {
      liquidityScore = 1;
      liquidityRisk = 'HIGH';
    }

    return {
      hasLiquidity: true,
      poolCount: pools.length,
      totalAdaLocked,
      totalTokenLocked,
      exchanges: Array.from(exchanges),
      liquidityScore,
      liquidityRisk,
      pools: pools.map(pool => ({
        exchange: pool.exchange,
        onchainID: pool.onchainID,
        adaLocked: pool.tokenATicker === 'ADA' ? pool.tokenALocked : pool.tokenBLocked,
        tokenLocked: pool.tokenATicker === 'ADA' ? pool.tokenBLocked : pool.tokenALocked
      }))
    };
  }

  // Enhanced analysis that combines TapTools holders with our risk analysis
  async analyzeTokenWithTapToolsHolders(policyId, assetName = '', ticker = '', unit = '') {
    try {
      console.log(`🔍 Enhanced analysis for: ${ticker || 'Unknown'} (${policyId})`);

      // Check if this is a known safe token
      if (ticker && this.SAFE_TOKENS.has(ticker.toUpperCase())) {
        console.log(`✅ ${ticker} is a known safe token - skipping detailed analysis`);
        return {
          summary: {
            tokenName: ticker,
            riskScore: 1,
            verdict: 'SAFE',
            topHolderPercentage: 0,
            dataSource: 'Known Safe Token',
            note: 'Established token with good reputation'
          },
          skipped: true,
          reason: 'known_safe_token'
        };
      }

      // Get market cap data for accurate supply information
      const mcapData = await this.getTokenMarketCap(unit);

      // Get liquidity pools data
      const liquidityPools = await this.getTokenLiquidityPools(unit, 1);
      const liquidityAnalysis = this.analyzeLiquidityPools(liquidityPools, ticker);

      console.log(`💧 Liquidity: ${liquidityAnalysis.poolCount} pools, ${(liquidityAnalysis.totalAdaLocked || 0).toLocaleString()} ADA locked (${liquidityAnalysis.liquidityRisk} risk)`);

      // First try our regular API analysis
      const basicAnalysis = await this.analyzeTokenWithOurAPI(policyId, assetName, ticker);

      if (!basicAnalysis || !basicAnalysis.summary) {
        console.log(`⚠️ Basic analysis failed, trying TapTools holders data...`);

        // If basic analysis fails, try to get holders from TapTools
        const tapToolsHolders = await this.getTopTokenHolders(unit, 1, 100);

        if (tapToolsHolders.length > 0) {
          console.log(`✅ Got ${tapToolsHolders.length} holders from TapTools`);

          // Create a simplified analysis using TapTools data with accurate supply
          const enhancedAnalysis = this.createAnalysisFromTapToolsHoldersWithMcap(
            tapToolsHolders,
            ticker,
            policyId,
            assetName,
            mcapData
          );

          // Add liquidity analysis
          enhancedAnalysis.liquidityAnalysis = liquidityAnalysis;

          // Add market cap data
          enhancedAnalysis.marketCapData = mcapData;

          // Adjust risk score based on liquidity
          enhancedAnalysis.summary.riskScore = this.adjustRiskScoreForLiquidity(
            enhancedAnalysis.summary.riskScore,
            liquidityAnalysis
          );

          return enhancedAnalysis;
        }
      }

      // If we have basic analysis, try to enhance it with TapTools holders and liquidity
      if (basicAnalysis && basicAnalysis.summary) {
        console.log(`✅ Basic analysis successful, enhancing with TapTools data...`);

        const tapToolsHolders = await this.getTopTokenHolders(unit, 1, 100);

        if (tapToolsHolders.length > 0) {
          // Enhance the existing analysis with TapTools data
          basicAnalysis.tapToolsHolders = tapToolsHolders;
          basicAnalysis.enhanced = true;

          // Add TapTools-based concentration analysis with accurate supply
          const tapToolsConcentration = this.analyzeTapToolsConcentration(tapToolsHolders, mcapData);
          basicAnalysis.tapToolsAnalysis = tapToolsConcentration;

          console.log(`🔍 TapTools concentration: Top holder ${tapToolsConcentration.topHolderPercentage.toFixed(2)}% (${tapToolsConcentration.dataSource})`);
        }

        // Add liquidity analysis
        basicAnalysis.liquidityAnalysis = liquidityAnalysis;

        // Add market cap data
        basicAnalysis.marketCapData = mcapData;

        // Adjust risk score based on liquidity
        basicAnalysis.summary.riskScore = this.adjustRiskScoreForLiquidity(
          basicAnalysis.summary.riskScore,
          liquidityAnalysis
        );

        return basicAnalysis;
      }

      console.log(`❌ Both analysis methods failed for ${ticker}`);
      return null;

    } catch (error) {
      console.error(`❌ Error in enhanced analysis for ${ticker}:`, error.message);
      return null;
    }
  }

  // Adjust risk score based on liquidity analysis
  adjustRiskScoreForLiquidity(originalRiskScore, liquidityAnalysis) {
    let adjustedScore = originalRiskScore;

    if (!liquidityAnalysis.hasLiquidity) {
      // No liquidity = very high risk
      adjustedScore = Math.min(10, adjustedScore + 2);
    } else if (liquidityAnalysis.liquidityRisk === 'HIGH') {
      // Low liquidity = increased risk
      adjustedScore = Math.min(10, adjustedScore + 1);
    } else if (liquidityAnalysis.liquidityRisk === 'LOW') {
      // Good liquidity = slightly reduced risk
      adjustedScore = Math.max(0, adjustedScore - 1);
    }

    return adjustedScore;
  }

  // Advanced stake-level clustering analysis (TapTools already groups by stake)
  analyzeStakeClustering(holders, circulatingSupply = null) {
    console.log(`🔍 Analyzing stake-level clustering for ${holders.length} holders...`);

    // TapTools holders are already grouped by stake addresses!
    // Each "address" is actually a stake address representing an entity

    const totalObserved = holders.reduce((sum, holder) => sum + holder.amount, 0);
    const supply = circulatingSupply || totalObserved;

    const stakeAnalysis = holders.map((holder, index) => {
      const percentage = supply > 0 ? (holder.amount / supply) * 100 : 0;

      return {
        stakeAddress: holder.address,
        rank: index + 1,
        amount: holder.amount,
        percentage,
        isLargeStake: percentage > 5, // Stakes over 5% are concerning
        isMajorStake: percentage > 10, // Stakes over 10% are very concerning
        isDominantStake: percentage > 25 // Stakes over 25% are extremely concerning
      };
    });

    // Calculate concentration metrics
    const top1Percentage = stakeAnalysis[0]?.percentage || 0;
    const top3Percentage = stakeAnalysis.slice(0, 3).reduce((sum, stake) => sum + stake.percentage, 0);
    const top5Percentage = stakeAnalysis.slice(0, 5).reduce((sum, stake) => sum + stake.percentage, 0);
    const top10Percentage = stakeAnalysis.slice(0, 10).reduce((sum, stake) => sum + stake.percentage, 0);

    // Count concerning stakes
    const largeStakes = stakeAnalysis.filter(s => s.isLargeStake).length;
    const majorStakes = stakeAnalysis.filter(s => s.isMajorStake).length;
    const dominantStakes = stakeAnalysis.filter(s => s.isDominantStake).length;

    // Risk assessment based on stake concentration
    let concentrationRisk = 'LOW';
    let riskScore = 1;

    if (top1Percentage > 50) {
      concentrationRisk = 'EXTREME';
      riskScore = 10;
    } else if (top3Percentage > 75) {
      concentrationRisk = 'VERY_HIGH';
      riskScore = 9;
    } else if (top1Percentage > 30) {
      concentrationRisk = 'HIGH';
      riskScore = 8;
    } else if (top3Percentage > 50) {
      concentrationRisk = 'HIGH';
      riskScore = 7;
    } else if (top5Percentage > 50) {
      concentrationRisk = 'MEDIUM';
      riskScore = 5;
    } else if (top10Percentage > 50) {
      concentrationRisk = 'MEDIUM';
      riskScore = 4;
    } else if (largeStakes > 5) {
      concentrationRisk = 'MEDIUM';
      riskScore = 3;
    }

    return {
      totalStakes: holders.length,
      circulatingSupply: supply,
      observedSupply: totalObserved,
      concentrationMetrics: {
        top1Percentage,
        top3Percentage,
        top5Percentage,
        top10Percentage
      },
      stakeCounts: {
        largeStakes,
        majorStakes,
        dominantStakes
      },
      concentrationRisk,
      riskScore,
      topStakes: stakeAnalysis.slice(0, 10),
      suspiciousPatterns: {
        singleDominantStake: top1Percentage > 40,
        fewMajorStakes: top3Percentage > 60,
        highConcentration: top10Percentage > 80
      }
    };
  }

  // Analyze multi-asset holdings of top holders
  async analyzeMultiAssetHoldings(holders, maxAnalyze = 10) {
    console.log(`🎯 Analyzing multi-asset holdings for top ${Math.min(holders.length, maxAnalyze)} holders...`);

    const holdingPatterns = [];
    const commonAssets = new Map(); // asset -> count of holders

    for (let i = 0; i < Math.min(holders.length, maxAnalyze); i++) {
      const holder = holders[i];

      try {
        const addressInfo = await this.getAddressInfo(holder.address);

        if (addressInfo && addressInfo.assets) {
          const assetCount = addressInfo.assets.length;
          const assetList = addressInfo.assets.map(asset => ({
            unit: asset.unit,
            amount: asset.amount,
            // Try to extract policy ID for analysis
            policyId: asset.unit?.substring(0, 56)
          }));

          holdingPatterns.push({
            address: holder.address,
            rank: i + 1,
            tokenAmount: holder.amount,
            totalAssets: assetCount,
            assets: assetList,
            lovelace: addressInfo.lovelace,
            stakeAddress: addressInfo.stakeAddress
          });

          // Track common assets
          assetList.forEach(asset => {
            if (asset.unit && asset.unit !== 'lovelace') {
              const count = commonAssets.get(asset.unit) || 0;
              commonAssets.set(asset.unit, count + 1);
            }
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        console.error(`❌ Error analyzing holdings for ${holder.address.substring(0, 12)}:`, error.message);
      }
    }

    // Find assets held by multiple top holders (suspicious)
    const suspiciousAssets = Array.from(commonAssets.entries())
      .filter(([asset, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      totalAnalyzed: Math.min(holders.length, maxAnalyze),
      holdingPatterns,
      suspiciousAssets: suspiciousAssets.map(([asset, count]) => ({
        asset,
        holderCount: count,
        policyId: asset.substring(0, 56)
      }))
    };
  }

  // Create analysis from TapTools holders data when Blockfrost fails
  createAnalysisFromTapToolsHolders(holders, ticker, policyId, assetName) {
    const totalSupply = holders.reduce((sum, holder) => sum + holder.amount, 0);
    const topHolderAmount = holders[0]?.amount || 0;
    const topHolderPercentage = totalSupply > 0 ? (topHolderAmount / totalSupply) * 100 : 0;

    // Simple risk scoring based on concentration
    let riskScore = 0;
    let verdict = 'SAFE';

    if (topHolderPercentage > 50) {
      riskScore = 9;
      verdict = 'AVOID';
    } else if (topHolderPercentage > 30) {
      riskScore = 7;
      verdict = 'AVOID';
    } else if (topHolderPercentage > 15) {
      riskScore = 5;
      verdict = 'CAUTION';
    } else if (topHolderPercentage > 9) {
      riskScore = 3;
      verdict = 'CAUTION';
    } else {
      riskScore = 1;
      verdict = 'SAFE';
    }

    return {
      summary: {
        tokenName: ticker || 'Unknown Token',
        riskLevel: verdict.toLowerCase(),
        riskScore,
        topHolderPercentage,
        verdict,
        totalHolders: holders.length,
        dataSource: 'TapTools'
      },
      tapToolsHolders: holders,
      enhanced: false,
      fallbackAnalysis: true
    };
  }

  // Create analysis from TapTools holders data with accurate market cap data
  createAnalysisFromTapToolsHoldersWithMcap(holders, ticker, policyId, assetName, mcapData) {
    // Use accurate circulating supply if available
    const circulatingSupply = mcapData?.circSupply || holders.reduce((sum, holder) => sum + holder.amount, 0);
    const topHolderAmount = holders[0]?.amount || 0;
    const topHolderPercentage = circulatingSupply > 0 ? (topHolderAmount / circulatingSupply) * 100 : 0;

    // Enhanced risk scoring based on accurate concentration
    let riskScore = 0;
    let verdict = 'SAFE';

    if (topHolderPercentage > 50) {
      riskScore = 9;
      verdict = 'AVOID';
    } else if (topHolderPercentage > 30) {
      riskScore = 7;
      verdict = 'AVOID';
    } else if (topHolderPercentage > 15) {
      riskScore = 5;
      verdict = 'CAUTION';
    } else if (topHolderPercentage > 9) {
      riskScore = 3;
      verdict = 'CAUTION';
    } else {
      riskScore = 1;
      verdict = 'SAFE';
    }

    // Calculate additional concentration metrics
    const top5Amount = holders.slice(0, 5).reduce((sum, holder) => sum + holder.amount, 0);
    const top5Percentage = circulatingSupply > 0 ? (top5Amount / circulatingSupply) * 100 : 0;

    const top10Amount = holders.slice(0, 10).reduce((sum, holder) => sum + holder.amount, 0);
    const top10Percentage = circulatingSupply > 0 ? (top10Amount / circulatingSupply) * 100 : 0;

    return {
      summary: {
        tokenName: ticker || 'Unknown Token',
        riskLevel: verdict.toLowerCase(),
        riskScore,
        topHolderPercentage,
        top5Percentage,
        top10Percentage,
        verdict,
        totalHolders: holders.length,
        circulatingSupply,
        totalSupply: mcapData?.totalSupply || circulatingSupply,
        marketCap: mcapData?.mcap,
        price: mcapData?.price,
        dataSource: 'TapTools + Market Cap'
      },
      tapToolsHolders: holders,
      marketCapData: mcapData,
      enhanced: false,
      fallbackAnalysis: true,
      accurateSupply: !!mcapData
    };
  }

  // Analyze concentration from TapTools holders with accurate circulating supply
  analyzeTapToolsConcentration(holders, mcapData = null) {
    if (!holders || holders.length === 0) {
      return { topHolderPercentage: 0, top5Percentage: 0, top10Percentage: 0 };
    }

    // Use accurate circulating supply from market cap data if available
    let circulatingSupply = mcapData?.circSupply;

    // Fallback to observed supply from holders if no market cap data
    if (!circulatingSupply) {
      circulatingSupply = holders.reduce((sum, holder) => sum + holder.amount, 0);
    }

    const topHolderPercentage = circulatingSupply > 0 ? (holders[0].amount / circulatingSupply) * 100 : 0;

    const top5Amount = holders.slice(0, 5).reduce((sum, holder) => sum + holder.amount, 0);
    const top5Percentage = circulatingSupply > 0 ? (top5Amount / circulatingSupply) * 100 : 0;

    const top10Amount = holders.slice(0, 10).reduce((sum, holder) => sum + holder.amount, 0);
    const top10Percentage = circulatingSupply > 0 ? (top10Amount / circulatingSupply) * 100 : 0;

    const top20Amount = holders.slice(0, 20).reduce((sum, holder) => sum + holder.amount, 0);
    const top20Percentage = circulatingSupply > 0 ? (top20Amount / circulatingSupply) * 100 : 0;

    return {
      topHolderPercentage,
      top5Percentage,
      top10Percentage,
      top20Percentage,
      circulatingSupply,
      totalSupply: mcapData?.totalSupply || circulatingSupply,
      observedSupply: holders.reduce((sum, holder) => sum + holder.amount, 0),
      holdersAnalyzed: holders.length,
      dataSource: mcapData ? 'TapTools Market Cap' : 'Observed from Holders'
    };
  }

  // Advanced suspicious wallet behavior analysis
  async analyzeSuspiciousWalletBehavior(stakeAddress, tokenUnit, maxAnalyze = 5) {
    console.log(`🕵️ Analyzing suspicious behavior for stake: ${stakeAddress.substring(0, 20)}...`);

    try {
      // Get portfolio, trades, and value trend
      const [portfolio, trades, valueTrend] = await Promise.all([
        this.getWalletPortfolio(stakeAddress),
        this.getWalletTrades(stakeAddress, tokenUnit, 1, 100),
        this.getWalletValueTrend(stakeAddress, '30d', 'ADA')
      ]);

      const suspiciousFlags = [];
      let suspicionScore = 0;

      // Analyze portfolio composition
      if (portfolio) {
        // Very few tokens = suspicious (could be purpose-built wallet)
        if (portfolio.numFTs <= 3) {
          suspiciousFlags.push('FEW_TOKENS');
          suspicionScore += 2;
        }

        // High value but few assets = whale or institutional
        if (portfolio.liquidValue > 100000 && portfolio.numFTs <= 5) {
          suspiciousFlags.push('HIGH_VALUE_FEW_ASSETS');
          suspicionScore += 1;
        }

        // No NFTs might indicate bot/institutional wallet
        if (portfolio.numNFTs === 0 && portfolio.numFTs > 0) {
          suspiciousFlags.push('NO_NFTS');
          suspicionScore += 1;
        }
      }

      // Analyze trading patterns
      if (trades && trades.length > 0) {
        const tokenTrades = trades.filter(trade =>
          trade.tokenA === tokenUnit || trade.tokenB === tokenUnit
        );

        if (tokenTrades.length > 0) {
          // Check for coordinated timing (trades within short windows)
          const tradeTimes = tokenTrades.map(t => t.time).sort();
          let coordinatedTrades = 0;

          for (let i = 1; i < tradeTimes.length; i++) {
            if (tradeTimes[i] - tradeTimes[i-1] < 300) { // 5 minutes
              coordinatedTrades++;
            }
          }

          if (coordinatedTrades > 2) {
            suspiciousFlags.push('COORDINATED_TIMING');
            suspicionScore += 3;
          }

          // Check for only buying (no selling) = accumulation
          const buyTrades = tokenTrades.filter(t => t.action === 'buy');
          const sellTrades = tokenTrades.filter(t => t.action === 'sell');

          if (buyTrades.length > 0 && sellTrades.length === 0) {
            suspiciousFlags.push('ONLY_BUYING');
            suspicionScore += 2;
          }

          // Check for large single trades
          const largeTrades = tokenTrades.filter(t => t.tokenAAmount > 1000000 || t.tokenBAmount > 1000000);
          if (largeTrades.length > 0) {
            suspiciousFlags.push('LARGE_TRADES');
            suspicionScore += 1;
          }
        }
      }

      // Analyze value trend
      if (valueTrend && valueTrend.length > 0) {
        const recentValues = valueTrend.slice(-7); // Last 7 data points
        const valueChanges = [];

        for (let i = 1; i < recentValues.length; i++) {
          const change = (recentValues[i].value - recentValues[i-1].value) / recentValues[i-1].value;
          valueChanges.push(change);
        }

        // Sudden large value increases = suspicious
        const largeIncreases = valueChanges.filter(change => change > 0.5).length;
        if (largeIncreases > 2) {
          suspiciousFlags.push('SUDDEN_VALUE_SPIKES');
          suspicionScore += 2;
        }

        // Very volatile = potential manipulation
        const avgVolatility = valueChanges.reduce((sum, change) => sum + Math.abs(change), 0) / valueChanges.length;
        if (avgVolatility > 0.3) {
          suspiciousFlags.push('HIGH_VOLATILITY');
          suspicionScore += 1;
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      return {
        stakeAddress,
        suspiciousFlags,
        suspicionScore,
        riskLevel: suspicionScore >= 6 ? 'HIGH' : suspicionScore >= 3 ? 'MEDIUM' : 'LOW',
        portfolio,
        trades: trades?.length || 0,
        valueTrend: valueTrend?.length || 0,
        analysis: {
          hasPortfolio: !!portfolio,
          hasTrades: trades && trades.length > 0,
          hasValueTrend: valueTrend && valueTrend.length > 0
        }
      };

    } catch (error) {
      console.error(`❌ Error analyzing wallet ${stakeAddress.substring(0, 12)}:`, error.message);
      return {
        stakeAddress,
        suspiciousFlags: ['ANALYSIS_ERROR'],
        suspicionScore: 0,
        riskLevel: 'UNKNOWN',
        error: error.message
      };
    }
  }

  // Analyze coordinated behavior across multiple stakes
  async analyzeCoordinatedBehavior(topStakes, tokenUnit, maxAnalyze = 10) {
    console.log(`🔍 Analyzing coordinated behavior across ${Math.min(topStakes.length, maxAnalyze)} stakes...`);

    const walletAnalyses = [];
    const coordinationFlags = [];

    // Analyze each stake individually
    for (let i = 0; i < Math.min(topStakes.length, maxAnalyze); i++) {
      const stake = topStakes[i];
      const analysis = await this.analyzeSuspiciousWalletBehavior(stake.stakeAddress, tokenUnit);
      walletAnalyses.push(analysis);

      // Rate limiting between analyses
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Look for coordination patterns
    const tradingWallets = walletAnalyses.filter(w => w.trades > 0);
    const highValueWallets = walletAnalyses.filter(w => w.portfolio?.liquidValue > 50000);
    const suspiciousWallets = walletAnalyses.filter(w => w.suspicionScore >= 3);

    // Check for coordinated timing across wallets
    if (tradingWallets.length >= 3) {
      coordinationFlags.push('MULTIPLE_TRADING_WALLETS');
    }

    // Check for similar portfolio patterns
    if (highValueWallets.length >= 3) {
      coordinationFlags.push('MULTIPLE_HIGH_VALUE_WALLETS');
    }

    // Check for widespread suspicious behavior
    if (suspiciousWallets.length >= Math.min(topStakes.length, maxAnalyze) * 0.5) {
      coordinationFlags.push('WIDESPREAD_SUSPICIOUS_BEHAVIOR');
    }

    const coordinationScore = coordinationFlags.length;

    return {
      totalAnalyzed: Math.min(topStakes.length, maxAnalyze),
      walletAnalyses,
      coordinationFlags,
      coordinationScore,
      coordinationRisk: coordinationScore >= 3 ? 'HIGH' : coordinationScore >= 2 ? 'MEDIUM' : 'LOW',
      summary: {
        tradingWallets: tradingWallets.length,
        highValueWallets: highValueWallets.length,
        suspiciousWallets: suspiciousWallets.length,
        avgSuspicionScore: walletAnalyses.reduce((sum, w) => sum + w.suspicionScore, 0) / walletAnalyses.length
      }
    };
  }

  // Convert TapTools unit to policy ID and asset name
  parseTokenUnit(unit) {
    if (!unit || unit === 'lovelace') {
      return null;
    }

    // TapTools unit format is: policyId + assetNameHex (concatenated)
    // Policy ID is always 56 characters (28 bytes in hex)
    if (unit.length >= 56) {
      const policyId = unit.substring(0, 56);
      const assetNameHex = unit.substring(56);

      // Convert hex asset name back to ASCII for debugging
      let assetNameAscii = '';
      try {
        if (assetNameHex) {
          assetNameAscii = Buffer.from(assetNameHex, 'hex').toString('utf8');
        }
      } catch (error) {
        // Keep as hex if conversion fails
        assetNameAscii = assetNameHex;
      }

      console.log(`🔍 Parsed token: Policy=${policyId}, AssetHex=${assetNameHex}, AssetName=${assetNameAscii}`);

      return {
        policyId,
        assetName: assetNameHex, // Keep as hex for our API
        assetNameAscii, // For debugging/display
        unit
      };
    }

    console.log(`⚠️ Invalid unit format: ${unit} (length: ${unit.length})`);
    return null;
  }

  // Convert ticker to hex for our API
  tickerToHex(ticker) {
    if (!ticker) return '';
    return Buffer.from(ticker.toUpperCase(), 'utf8').toString('hex');
  }

  async analyzeTokenWithOurAPI(policyId, assetName = '', ticker = '') {
    try {
      console.log(`🔍 Analyzing token: ${ticker || 'Unknown'} (${policyId})`);

      const params = new URLSearchParams();
      if (assetName) {
        params.append('assetName', assetName);
      } else if (ticker) {
        // Convert ticker to hex if no asset name provided
        params.append('assetName', this.tickerToHex(ticker));
      }
      params.append('format', 'beautiful');

      const url = `${RISK_API_URL}/analyze/${policyId}?${params.toString()}`;
      console.log(`🔗 API URL: ${url}`);

      const response = await axios.get(url, {
        timeout: 60000
      });

      if (response.data && response.data.error) {
        console.log(`⚠️ Analysis error for ${ticker}: ${response.data.error}`);
        return null;
      }

      if (response.data && response.data.summary) {
        console.log(`✅ Analysis successful for ${ticker}: ${response.data.summary.riskScore}/10 (${response.data.summary.verdict})`);
        return response.data;
      }

      console.log(`⚠️ Unexpected response format for ${ticker}`);
      return null;
    } catch (error) {
      console.error(`❌ Error analyzing token ${ticker} (${policyId}):`, error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}, Data:`, error.response.data);
      }
      return null;
    }
  }

  async getAdvancedRelationshipAnalysis(policyId, assetName = '', ticker = '') {
    try {
      console.log(`🕵️ Getting advanced analysis for: ${ticker || 'Unknown'}`);

      const params = new URLSearchParams();
      if (assetName) {
        params.append('assetName', assetName);
      } else if (ticker) {
        params.append('assetName', this.tickerToHex(ticker));
      }

      const response = await axios.get(`${RISK_API_URL}/analyze/${policyId}/relationships?${params.toString()}`, {
        timeout: 90000 // Longer timeout for advanced analysis
      });

      if (response.data.error) {
        console.log(`⚠️ Advanced analysis error for ${ticker}: ${response.data.error}`);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error(`❌ Error in advanced analysis for ${ticker}:`, error.message);
      return null;
    }
  }

  async scanAndAnalyzeLatestTokens(timeframe = '1h', maxTokens = 20) {
    console.log(`🚀 Starting scan for latest tokens (${timeframe})...`);

    try {
      // Get top volume tokens from TapTools
      const tokens = await this.getTopVolumeTokens(timeframe, 1, maxTokens);

      if (!tokens || tokens.length === 0) {
        console.log('❌ No tokens found from TapTools');
        return;
      }

      // Load previously analyzed tokens to avoid duplicates
      let analyzedTokens = [];
      try {
        const data = await fs.readFile(ANALYZED_TOKENS_FILE, 'utf8');
        analyzedTokens = JSON.parse(data);
      } catch (error) {
        console.log('📝 No previous analysis history found');
      }

      const analyzedUnits = new Set(analyzedTokens.map(t => t.unit));
      const newTokens = [];
      const analysisResults = [];

      for (const token of tokens) {
        const { price, ticker, unit, volume } = token;

        // Skip if already analyzed recently
        if (analyzedUnits.has(unit)) {
          console.log(`⏭️ Skipping ${ticker} - already analyzed`);
          continue;
        }

        // Parse the unit to get policy ID and asset name
        const parsed = this.parseTokenUnit(unit);
        if (!parsed) {
          console.log(`⚠️ Could not parse unit for ${ticker}: ${unit}`);
          continue;
        }

        console.log(`\n🎯 NEW TOKEN DETECTED: ${ticker}`);
        console.log(`💰 Price: $${price}`);
        console.log(`📊 Volume (${timeframe}): $${volume.toLocaleString()}`);
        console.log(`🔗 Unit: ${unit}`);
        console.log(`📋 Policy ID: ${parsed.policyId}`);

        newTokens.push({
          ticker,
          unit,
          policyId: parsed.policyId,
          assetName: parsed.assetName,
          price,
          volume,
          detectedAt: new Date().toISOString()
        });

        // Analyze with enhanced TapTools + our risk API
        const basicAnalysis = await this.analyzeTokenWithTapToolsHolders(
          parsed.policyId,
          parsed.assetName,
          ticker,
          unit
        );

        if (basicAnalysis && basicAnalysis.summary) {
          const { tokenName, riskScore, verdict, topHolderPercentage } = basicAnalysis.summary;
          const riskEmoji = verdict === 'SAFE' ? '🟢' : verdict === 'CAUTION' ? '⚠️' : '🔴';

          console.log(`${riskEmoji} Risk Analysis: ${riskScore}/10 (${verdict})`);
          console.log(`👥 Top Holder: ${topHolderPercentage}%`);

          // Get advanced relationship analysis for interesting tokens
          let advancedAnalysis = null;
          if (riskScore >= 5 || topHolderPercentage >= 15) {
            console.log(`🕵️ Running advanced analysis (high risk/concentration)...`);
            advancedAnalysis = await this.getAdvancedRelationshipAnalysis(
              parsed.policyId,
              parsed.assetName,
              ticker
            );
          }

          analysisResults.push({
            ...token,
            ...parsed,
            tokenName,
            riskScore,
            verdict,
            topHolderPercentage,
            basicAnalysis,
            advancedAnalysis,
            analyzedAt: new Date().toISOString()
          });

          // Save high-risk tokens for alerts
          if (riskScore >= 7) {
            await this.saveHighRiskAlert(token, basicAnalysis, advancedAnalysis);
          }
        }

        // Rate limiting between analyses
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Save results
      if (newTokens.length > 0) {
        await this.saveLatestTokens(newTokens);
        console.log(`💾 Saved ${newTokens.length} new tokens`);
      }

      if (analysisResults.length > 0) {
        // Update analyzed tokens history
        analyzedTokens.push(...analysisResults);
        await fs.writeFile(ANALYZED_TOKENS_FILE, JSON.stringify(analyzedTokens, null, 2));
        console.log(`📊 Saved analysis for ${analysisResults.length} tokens`);

        // Print summary
        this.printAnalysisSummary(analysisResults);
      }

    } catch (error) {
      console.error('❌ Error in scan and analyze:', error);
    }
  }

  async saveLatestTokens(tokens) {
    try {
      await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('❌ Error saving latest tokens:', error);
    }
  }

  async saveHighRiskAlert(token, basicAnalysis, advancedAnalysis) {
    try {
      const alertsFile = path.join(DATA_DIR, 'high_risk_alerts.json');
      let alerts = [];

      try {
        const data = await fs.readFile(alertsFile, 'utf8');
        alerts = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet
      }

      alerts.push({
        ticker: token.ticker,
        unit: token.unit,
        price: token.price,
        volume: token.volume,
        tokenName: basicAnalysis.summary.tokenName,
        riskScore: basicAnalysis.summary.riskScore,
        verdict: basicAnalysis.summary.verdict,
        topHolderPercentage: basicAnalysis.summary.topHolderPercentage,
        hasAdvancedAnalysis: !!advancedAnalysis,
        detectedAt: new Date().toISOString()
      });

      await fs.writeFile(alertsFile, JSON.stringify(alerts, null, 2));
      console.log(`🚨 HIGH-RISK ALERT: ${token.ticker} (${basicAnalysis.summary.riskScore}/10)`);

    } catch (error) {
      console.error('❌ Error saving high-risk alert:', error);
    }
  }

  printAnalysisSummary(results) {
    console.log('\n📊 ANALYSIS SUMMARY:');
    console.log('='.repeat(50));

    const safe = results.filter(r => r.verdict === 'SAFE');
    const caution = results.filter(r => r.verdict === 'CAUTION');
    const avoid = results.filter(r => r.verdict === 'AVOID');

    console.log(`🟢 SAFE: ${safe.length} tokens`);
    console.log(`⚠️ CAUTION: ${caution.length} tokens`);
    console.log(`🔴 AVOID: ${avoid.length} tokens`);

    if (avoid.length > 0) {
      console.log('\n🚨 HIGH-RISK TOKENS:');
      avoid.forEach(token => {
        console.log(`  • ${token.ticker}: ${token.riskScore}/10 (Top holder: ${token.topHolderPercentage}%)`);
      });
    }

    console.log('='.repeat(50));
  }

  async getStats() {
    const stats = {
      service: 'TapTools Integration',
      apiKey: TAPTOOLS_API_KEY ? 'Configured' : 'Missing',
      riskApiUrl: RISK_API_URL
    };

    try {
      const data = await fs.readFile(ANALYZED_TOKENS_FILE, 'utf8');
      const analyzed = JSON.parse(data);
      stats.totalAnalyzed = analyzed.length;
      stats.analyzedToday = analyzed.filter(token => {
        const tokenDate = new Date(token.analyzedAt);
        const today = new Date();
        return tokenDate.toDateString() === today.toDateString();
      }).length;
    } catch (error) {
      stats.totalAnalyzed = 0;
      stats.analyzedToday = 0;
    }

    return stats;
  }
}

// CLI interface
if (require.main === module) {
  const service = new TapToolsService();

  const command = process.argv[2];
  const param1 = process.argv[3] || '1h';

  switch (command) {
    case 'scan':
      service.scanAndAnalyzeLatestTokens(param1, 20).then(() => {
        console.log('✅ Scan completed');
        process.exit(0);
      });
      break;
    case 'top':
      service.getTopVolumeTokens(param1, 1, 20).then(tokens => {
        console.log('📊 Top Volume Tokens:');
        tokens.forEach((token, i) => {
          console.log(`${i + 1}. ${token.ticker}: $${token.volume.toLocaleString()} volume`);
        });
        process.exit(0);
      });
      break;
    case 'stats':
      service.getStats().then(stats => {
        console.log('📊 TapTools Service Stats:');
        console.log(JSON.stringify(stats, null, 2));
        process.exit(0);
      });
      break;
    case 'test':
      // Test parsing and analysis of first token
      service.getTopVolumeTokens('1h', 1, 1).then(async tokens => {
        if (tokens.length > 0) {
          const token = tokens[0];
          console.log('\n🧪 TESTING TOKEN PARSING AND ANALYSIS:');
          console.log('Raw token:', JSON.stringify(token, null, 2));

          const parsed = service.parseTokenUnit(token.unit);
          console.log('Parsed:', parsed);

          if (parsed) {
            console.log('\n🔍 Testing enhanced analysis with TapTools holders...');
            const analysis = await service.analyzeTokenWithTapToolsHolders(
              parsed.policyId,
              parsed.assetName,
              token.ticker,
              token.unit
            );

            if (analysis) {
              console.log('✅ Enhanced analysis successful!');
              console.log(`Risk: ${analysis.summary.riskScore}/10 (${analysis.summary.verdict})`);
              console.log(`Data source: ${analysis.summary.dataSource || 'Blockfrost'}`);
              if (analysis.enhanced) {
                console.log('🔍 Enhanced with TapTools holders data');
              }
              if (analysis.fallbackAnalysis) {
                console.log('🔄 Fallback analysis using TapTools only');
              }
            } else {
              console.log('❌ Enhanced analysis failed');
            }
          }
        }
        process.exit(0);
      });
      break;
    case 'holders':
      // Test holders endpoint
      const testUnit = process.argv[3] || 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58';
      const numHolders = parseInt(process.argv[4]) || 20;
      service.getTopTokenHolders(testUnit, 1, numHolders).then(holders => {
        console.log(`👥 Top ${holders.length} holders:`);
        holders.forEach((holder, i) => {
          const percentage = holders.length > 0 ? (holder.amount / holders.reduce((sum, h) => sum + h.amount, 0)) * 100 : 0;
          console.log(`${i + 1}. ${holder.address} : ${holder.amount.toLocaleString()} (${percentage.toFixed(2)}%)`);
        });
        process.exit(0);
      });
      break;
    case 'pools':
      // Test liquidity pools endpoint
      const poolsUnit = process.argv[3] || 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58';
      service.getTokenLiquidityPools(poolsUnit, 1).then(pools => {
        console.log(`💧 Found ${pools.length} liquidity pools:`);
        pools.forEach((pool, i) => {
          const adaLocked = pool.tokenATicker === 'ADA' ? pool.tokenALocked : pool.tokenBLocked;
          const tokenLocked = pool.tokenATicker === 'ADA' ? pool.tokenBLocked : pool.tokenALocked;
          console.log(`${i + 1}. ${pool.exchange}: ${(adaLocked || 0).toLocaleString()} ADA + ${(tokenLocked || 0).toLocaleString()} tokens`);
        });

        if (pools.length > 0) {
          const analysis = service.analyzeLiquidityPools(pools, 'TEST');
          console.log('\n📊 Liquidity Analysis:');
          console.log(`Total ADA Locked: ${(analysis.totalAdaLocked || 0).toLocaleString()}`);
          console.log(`Liquidity Score: ${analysis.liquidityScore}/10`);
          console.log(`Liquidity Risk: ${analysis.liquidityRisk}`);
          console.log(`Exchanges: ${analysis.exchanges.join(', ')}`);
        }

        process.exit(0);
      });
      break;
    case 'mcap':
      // Test market cap endpoint
      const mcapUnit = process.argv[3] || 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58';
      service.getTokenMarketCap(mcapUnit).then(mcapData => {
        if (mcapData) {
          console.log('📊 Market Cap Data:');
          console.log(`Ticker: ${mcapData.ticker}`);
          console.log(`Price: $${mcapData.price}`);
          console.log(`Circulating Supply: ${(mcapData.circSupply || 0).toLocaleString()}`);
          console.log(`Total Supply: ${(mcapData.totalSupply || 0).toLocaleString()}`);
          console.log(`Market Cap: $${(mcapData.mcap || 0).toLocaleString()}`);
          console.log(`FDV: $${(mcapData.fdv || 0).toLocaleString()}`);

          const circulationRatio = (mcapData.circSupply / mcapData.totalSupply) * 100;
          console.log(`Circulation Ratio: ${circulationRatio.toFixed(2)}%`);
        } else {
          console.log('❌ No market cap data found');
        }
        process.exit(0);
      });
      break;
    case 'address':
      // Test address info endpoint
      const testAddress = process.argv[3] || 'addr1q9j5jqhqak5nmqphdqt4cj9kq0gppa49afyznggw03hjzhwxr0exydkt78th5wwrjphxh0h6rrgghzwxse6q3pdf9sxqkg2mmq';
      service.getAddressInfo(testAddress).then(addressInfo => {
        if (addressInfo) {
          console.log('📍 Address Info:');
          console.log(`Address: ${addressInfo.address}`);
          console.log(`Payment Cred: ${addressInfo.paymentCred}`);
          console.log(`Stake Address: ${addressInfo.stakeAddress || 'None'}`);
          console.log(`Lovelace: ${addressInfo.lovelace}`);
          console.log(`Assets: ${addressInfo.assets?.length || 0}`);

          if (addressInfo.assets && addressInfo.assets.length > 0) {
            console.log('\n🎯 Top Assets:');
            addressInfo.assets.slice(0, 5).forEach((asset, i) => {
              console.log(`${i + 1}. ${asset.unit?.substring(0, 20)}... : ${asset.amount}`);
            });
          }
        } else {
          console.log('❌ No address info found');
        }
        process.exit(0);
      });
      break;
    case 'tx':
      // Test transaction UTxOs endpoint
      const testTxHash = process.argv[3] || '8be33680ec04da1cc98868699c5462fbbf6975529fb6371669fa735d2972d69b';
      service.getTransactionUtxos(testTxHash).then(txData => {
        if (txData) {
          console.log('🔗 Transaction UTxOs:');
          console.log(`Hash: ${txData.hash}`);
          console.log(`Inputs: ${txData.inputs?.length || 0}`);
          console.log(`Outputs: ${txData.outputs?.length || 0}`);

          if (txData.inputs && txData.inputs.length > 0) {
            console.log('\n📥 Sample Inputs:');
            txData.inputs.slice(0, 3).forEach((input, i) => {
              console.log(`${i + 1}. ${input.address?.substring(0, 20)}... : ${input.value?.lovelace || 0} lovelace`);
            });
          }

          if (txData.outputs && txData.outputs.length > 0) {
            console.log('\n📤 Sample Outputs:');
            txData.outputs.slice(0, 3).forEach((output, i) => {
              console.log(`${i + 1}. ${output.address?.substring(0, 20)}... : ${output.value?.lovelace || 0} lovelace`);
            });
          }
        } else {
          console.log('❌ No transaction data found');
        }
        process.exit(0);
      });
      break;
    case 'cluster':
      // Test stake clustering analysis
      const clusterUnit = process.argv[3] || 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58';
      Promise.all([
        service.getTopTokenHolders(clusterUnit, 1, 50),
        service.getTokenMarketCap(clusterUnit)
      ]).then(([holders, mcapData]) => {
        if (holders.length > 0) {
          console.log(`🔍 Analyzing stake clustering for ${holders.length} holders...`);
          const clusterAnalysis = service.analyzeStakeClustering(holders, mcapData?.circSupply);

          console.log('\n📊 Stake Clustering Results:');
          console.log(`Total Stakes: ${clusterAnalysis.totalStakes}`);
          console.log(`Concentration Risk: ${clusterAnalysis.concentrationRisk} (${clusterAnalysis.riskScore}/10)`);
          console.log(`Circulating Supply: ${(clusterAnalysis.circulatingSupply || 0).toLocaleString()}`);

          console.log('\n🎯 Concentration Metrics:');
          console.log(`Top 1 Stake: ${clusterAnalysis.concentrationMetrics.top1Percentage.toFixed(2)}%`);
          console.log(`Top 3 Stakes: ${clusterAnalysis.concentrationMetrics.top3Percentage.toFixed(2)}%`);
          console.log(`Top 5 Stakes: ${clusterAnalysis.concentrationMetrics.top5Percentage.toFixed(2)}%`);
          console.log(`Top 10 Stakes: ${clusterAnalysis.concentrationMetrics.top10Percentage.toFixed(2)}%`);

          console.log('\n🚨 Concerning Stakes:');
          console.log(`Large Stakes (>5%): ${clusterAnalysis.stakeCounts.largeStakes}`);
          console.log(`Major Stakes (>10%): ${clusterAnalysis.stakeCounts.majorStakes}`);
          console.log(`Dominant Stakes (>25%): ${clusterAnalysis.stakeCounts.dominantStakes}`);

          if (clusterAnalysis.topStakes.length > 0) {
            console.log('\n🏆 Top 5 Stakes:');
            clusterAnalysis.topStakes.slice(0, 5).forEach((stake, i) => {
              const riskFlag = stake.isDominantStake ? '🚨' : stake.isMajorStake ? '⚠️' : stake.isLargeStake ? '🟡' : '🟢';
              console.log(`${i + 1}. ${riskFlag} ${stake.stakeAddress.substring(0, 20)}... : ${stake.percentage.toFixed(2)}%`);
            });
          }

          console.log('\n🔍 Suspicious Patterns:');
          Object.entries(clusterAnalysis.suspiciousPatterns).forEach(([pattern, detected]) => {
            const flag = detected ? '🚨 DETECTED' : '✅ Clear';
            console.log(`${pattern}: ${flag}`);
          });
        }
        process.exit(0);
      });
      break;
    case 'assets':
      // Test multi-asset holdings analysis
      const assetsUnit = process.argv[3] || 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58';
      service.getTopTokenHolders(assetsUnit, 1, 10).then(async holders => {
        if (holders.length > 0) {
          console.log(`🎯 Analyzing multi-asset holdings for ${holders.length} holders...`);
          const assetAnalysis = await service.analyzeMultiAssetHoldings(holders, 5);

          console.log('\n📊 Asset Holdings Results:');
          console.log(`Total Analyzed: ${assetAnalysis.totalAnalyzed}`);

          if (assetAnalysis.suspiciousAssets.length > 0) {
            console.log('\n🚨 Common Assets (Suspicious):');
            assetAnalysis.suspiciousAssets.slice(0, 5).forEach((asset, i) => {
              console.log(`${i + 1}. ${asset.asset.substring(0, 30)}... (${asset.holderCount} holders)`);
            });
          }

          if (assetAnalysis.holdingPatterns.length > 0) {
            console.log('\n💼 Top Holder Asset Counts:');
            assetAnalysis.holdingPatterns.forEach((pattern, i) => {
              console.log(`${i + 1}. Rank ${pattern.rank}: ${pattern.totalAssets} assets`);
            });
          }
        }
        process.exit(0);
      });
      break;
    case 'portfolio':
      // Test wallet portfolio endpoint
      const portfolioAddress = process.argv[3] || 'stake1u8rphunzxm9lr4m688peqmnthmap35yt38rgvaqgsk5jcrqdr2vuc';
      service.getWalletPortfolio(portfolioAddress).then(portfolio => {
        if (portfolio) {
          console.log('💼 Wallet Portfolio:');
          console.log(`ADA Balance: ${portfolio.adaBalance?.toLocaleString()} ADA`);
          console.log(`ADA Value: $${portfolio.adaValue?.toLocaleString()}`);
          console.log(`Liquid Value: $${portfolio.liquidValue?.toLocaleString()}`);
          console.log(`Fungible Tokens: ${portfolio.numFTs}`);
          console.log(`NFTs: ${portfolio.numNFTs}`);

          if (portfolio.positionsFt && portfolio.positionsFt.length > 0) {
            console.log('\n🎯 Top FT Positions:');
            portfolio.positionsFt.slice(0, 5).forEach((pos, i) => {
              console.log(`${i + 1}. ${pos.ticker || 'Unknown'}: ${pos.amount?.toLocaleString()} ($${pos.value?.toLocaleString()})`);
            });
          }
        } else {
          console.log('❌ No portfolio data found');
        }
        process.exit(0);
      });
      break;
    case 'trades':
      // Test wallet trades endpoint
      const tradesAddress = process.argv[3] || 'stake1u8rphunzxm9lr4m688peqmnthmap35yt38rgvaqgsk5jcrqdr2vuc';
      const tradesUnit = process.argv[4];
      service.getWalletTrades(tradesAddress, tradesUnit, 1, 20).then(trades => {
        console.log(`📈 Found ${trades.length} trades:`);
        trades.slice(0, 10).forEach((trade, i) => {
          const date = new Date(trade.time * 1000).toLocaleDateString();
          console.log(`${i + 1}. ${trade.action?.toUpperCase()} ${trade.tokenAName} → ${trade.tokenBName} (${date})`);
        });
        process.exit(0);
      });
      break;
    case 'trend':
      // Test wallet value trend endpoint
      const trendAddress = process.argv[3] || 'stake1u8rphunzxm9lr4m688peqmnthmap35yt38rgvaqgsk5jcrqdr2vuc';
      const timeframe = process.argv[4] || '30d';
      service.getWalletValueTrend(trendAddress, timeframe, 'ADA').then(trend => {
        console.log(`📊 Value trend over ${timeframe} (${trend.length} points):`);
        if (trend.length > 0) {
          const first = trend[0];
          const last = trend[trend.length - 1];
          const change = ((last.value - first.value) / first.value) * 100;
          console.log(`Start: ${first.value.toLocaleString()} ADA`);
          console.log(`End: ${last.value.toLocaleString()} ADA`);
          console.log(`Change: ${change.toFixed(2)}%`);
        }
        process.exit(0);
      });
      break;
    case 'suspicious':
      // Test suspicious wallet behavior analysis
      const suspiciousAddress = process.argv[3] || 'stake178zs7r5yvpdfmnqphdqt4cj9kq0gppa49afyznggw03hjzhwxr0exydkt78th5wwrjphxh0h6rrgghzwxse6q3pdf9sxqkg2mmq';
      const suspiciousUnit = process.argv[4] || 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58';
      service.analyzeSuspiciousWalletBehavior(suspiciousAddress, suspiciousUnit).then(analysis => {
        console.log('🕵️ Suspicious Wallet Analysis:');
        console.log(`Stake: ${analysis.stakeAddress.substring(0, 30)}...`);
        console.log(`Risk Level: ${analysis.riskLevel}`);
        console.log(`Suspicion Score: ${analysis.suspicionScore}/10`);
        console.log(`Suspicious Flags: ${analysis.suspiciousFlags.join(', ')}`);

        if (analysis.portfolio) {
          console.log(`Portfolio: ${analysis.portfolio.numFTs} FTs, $${analysis.portfolio.liquidValue?.toLocaleString()} value`);
        }

        console.log(`Trades: ${analysis.trades}`);
        console.log(`Value Trend Points: ${analysis.valueTrend}`);

        process.exit(0);
      });
      break;
    case 'coordination':
      // Test coordinated behavior analysis
      const coordUnit = process.argv[3] || 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58';
      service.getTopTokenHolders(coordUnit, 1, 10).then(async holders => {
        if (holders.length > 0) {
          const stakes = holders.map((h, i) => ({ stakeAddress: h.address, rank: i + 1 }));
          const coordination = await service.analyzeCoordinatedBehavior(stakes, coordUnit, 5);

          console.log('🔍 Coordinated Behavior Analysis:');
          console.log(`Total Analyzed: ${coordination.totalAnalyzed}`);
          console.log(`Coordination Risk: ${coordination.coordinationRisk}`);
          console.log(`Coordination Score: ${coordination.coordinationScore}/3`);
          console.log(`Coordination Flags: ${coordination.coordinationFlags.join(', ')}`);

          console.log('\n📊 Summary:');
          console.log(`Trading Wallets: ${coordination.summary.tradingWallets}`);
          console.log(`High Value Wallets: ${coordination.summary.highValueWallets}`);
          console.log(`Suspicious Wallets: ${coordination.summary.suspiciousWallets}`);
          console.log(`Avg Suspicion Score: ${coordination.summary.avgSuspicionScore.toFixed(2)}`);
        }
        process.exit(0);
      });
      break;
    case 'hunt':
      // Hunt for multiple wallets under same stakes
      const huntUnit = process.argv[3] || '8fef2d34078659493ce161a6c7fba4b56afefa8535296a5743f6958741414441';
      const huntCount = parseInt(process.argv[4]) || 100;

      console.log(`🕵️ HUNTING FOR MULTIPLE WALLETS UNDER SAME STAKES...`);
      console.log(`Token: ${huntUnit.substring(0, 20)}...`);
      console.log(`Analyzing top ${huntCount} holders...\n`);

      service.getTopTokenHolders(huntUnit, 1, huntCount).then(async holders => {
        if (holders.length === 0) {
          console.log('❌ No holders found');
          process.exit(0);
          return;
        }

        console.log(`📊 Found ${holders.length} stake addresses`);

        // Group stakes by similarity (look for potential clustering)
        const stakeGroups = new Map();
        const suspiciousStakes = [];

        holders.forEach((holder, index) => {
          const stake = holder.address;
          const percentage = (holder.amount / holders.reduce((sum, h) => sum + h.amount, 0)) * 100;

          // Look for stakes with similar prefixes (potential clustering)
          const prefix = stake.substring(0, 20);
          if (!stakeGroups.has(prefix)) {
            stakeGroups.set(prefix, []);
          }
          stakeGroups.get(prefix).push({
            stake,
            amount: holder.amount,
            percentage,
            rank: index + 1
          });

          // Flag suspicious stakes
          if (percentage > 5) {
            suspiciousStakes.push({
              stake,
              amount: holder.amount,
              percentage,
              rank: index + 1,
              riskLevel: percentage > 25 ? 'EXTREME' : percentage > 15 ? 'HIGH' : percentage > 10 ? 'MEDIUM' : 'LOW'
            });
          }
        });

        // Look for potential clustering patterns
        console.log('\n🔍 CLUSTERING ANALYSIS:');
        let clustersFound = 0;
        for (const [prefix, stakes] of stakeGroups) {
          if (stakes.length > 1) {
            clustersFound++;
            const totalAmount = stakes.reduce((sum, s) => sum + s.amount, 0);
            const totalPercentage = stakes.reduce((sum, s) => sum + s.percentage, 0);

            console.log(`\n🚨 POTENTIAL CLUSTER ${clustersFound}:`);
            console.log(`Prefix: ${prefix}...`);
            console.log(`Stakes: ${stakes.length}`);
            console.log(`Combined: ${totalAmount.toLocaleString()} tokens (${totalPercentage.toFixed(2)}%)`);

            stakes.forEach((stake, i) => {
              console.log(`  ${i + 1}. Rank ${stake.rank}: ${stake.stake.substring(0, 25)}... (${stake.percentage.toFixed(2)}%)`);
            });
          }
        }

        if (clustersFound === 0) {
          console.log('✅ No obvious clustering patterns found in stake prefixes');
        }

        // Show suspicious individual stakes
        if (suspiciousStakes.length > 0) {
          console.log('\n🚨 SUSPICIOUS INDIVIDUAL STAKES:');
          suspiciousStakes.forEach((stake, i) => {
            const riskEmoji = stake.riskLevel === 'EXTREME' ? '🔴' : stake.riskLevel === 'HIGH' ? '🟠' : stake.riskLevel === 'MEDIUM' ? '🟡' : '🟢';
            console.log(`${i + 1}. ${riskEmoji} Rank ${stake.rank}: ${stake.stake.substring(0, 30)}... (${stake.percentage.toFixed(2)}% - ${stake.riskLevel})`);
          });
        }

        // Summary statistics
        console.log('\n📊 SUMMARY:');
        console.log(`Total Stakes Analyzed: ${holders.length}`);
        console.log(`Potential Clusters: ${clustersFound}`);
        console.log(`Suspicious Stakes (>5%): ${suspiciousStakes.length}`);

        const top10Percentage = holders.slice(0, 10).reduce((sum, h) => {
          const percentage = (h.amount / holders.reduce((sum, h) => sum + h.amount, 0)) * 100;
          return sum + percentage;
        }, 0);

        console.log(`Top 10 Stakes Control: ${top10Percentage.toFixed(2)}%`);

        if (top10Percentage > 80) {
          console.log('🚨 EXTREME CONCENTRATION - HIGH RUG PULL RISK!');
        } else if (top10Percentage > 60) {
          console.log('⚠️ HIGH CONCENTRATION - MODERATE RUG PULL RISK');
        } else if (top10Percentage > 40) {
          console.log('🟡 MEDIUM CONCENTRATION - SOME RISK');
        } else {
          console.log('🟢 GOOD DISTRIBUTION - LOW RISK');
        }

        process.exit(0);
      });
      break;
    case 'resolve':
      // Test resolving addr1 wallets from stake address
      const resolveStake = process.argv[3] || 'stake178j4fcxw7pwgxw92yu28c2zqzqzqzqzqzqzqzqzqzqzqzqzqzqzqzqzqzqzq';
      service.getWalletsFromStake(resolveStake).then(wallets => {
        console.log(`🔍 RESOLVING WALLETS FOR STAKE: ${resolveStake.substring(0, 30)}...`);
        console.log(`Found ${wallets.length} connected addr1... wallets:\n`);

        wallets.forEach((wallet, i) => {
          console.log(`${i + 1}. ${wallet.address || wallet}`);
        });

        if (wallets.length === 0) {
          console.log('❌ No wallets found or API error');
        } else if (wallets.length === 1) {
          console.log('\n✅ Single wallet - Normal pattern');
        } else if (wallets.length <= 5) {
          console.log('\n🟡 Multiple wallets - Could be normal');
        } else {
          console.log('\n🚨 Many wallets - Potentially suspicious!');
        }

        process.exit(0);
      });
      break;
    case 'deep':
      // Deep analysis: Get top stakes and resolve their wallets
      const deepUnit = process.argv[3] || '2852268cf6e2db42e20f2fd3125f541e5d6c5a3d70b4dda17c2daa82';
      const deepCount = parseInt(process.argv[4]) || 10;

      console.log(`🕵️ DEEP WALLET ANALYSIS`);
      console.log(`Token: ${deepUnit.substring(0, 20)}...`);
      console.log(`Analyzing top ${deepCount} stakes and their connected wallets...\n`);

      service.getTopTokenHolders(deepUnit, 1, deepCount).then(async holders => {
        if (holders.length === 0) {
          console.log('❌ No holders found');
          process.exit(0);
          return;
        }

        const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);

        console.log(`📊 Found ${holders.length} top stakes\n`);

        for (let i = 0; i < Math.min(holders.length, deepCount); i++) {
          const holder = holders[i];
          const percentage = (holder.amount / totalSupply) * 100;

          console.log(`🔍 STAKE ${i + 1}: ${holder.address.substring(0, 30)}...`);
          console.log(`   Holdings: ${(holder.amount || 0).toLocaleString()} tokens (${percentage.toFixed(2)}%)`);

          // Get connected wallets
          const wallets = await service.getWalletsFromStake(holder.address);

          if (wallets.length === 0) {
            console.log(`   ❌ No wallets found or API error`);
          } else if (wallets.length === 1) {
            console.log(`   ✅ Single wallet: ${wallets[0].address || wallets[0]}`);
          } else {
            console.log(`   🚨 ${wallets.length} CONNECTED WALLETS:`);
            wallets.forEach((wallet, j) => {
              const addr = wallet.address || wallet;
              console.log(`      ${j + 1}. ${addr.substring(0, 50)}...`);
            });

            if (wallets.length > 5) {
              console.log(`   🔴 HIGHLY SUSPICIOUS - Many wallets under one stake!`);
            } else if (wallets.length > 2) {
              console.log(`   🟡 POTENTIALLY SUSPICIOUS - Multiple wallets`);
            }
          }

          console.log(''); // Empty line for readability

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Summary
        const multiWalletStakes = [];
        for (let i = 0; i < Math.min(holders.length, deepCount); i++) {
          const holder = holders[i];
          const wallets = await service.getWalletsFromStake(holder.address);
          if (wallets.length > 1) {
            multiWalletStakes.push({
              stake: holder.address,
              wallets: wallets.length,
              percentage: (holder.amount / totalSupply) * 100
            });
          }
        }

        console.log(`📊 SUMMARY:`);
        console.log(`Stakes analyzed: ${Math.min(holders.length, deepCount)}`);
        console.log(`Multi-wallet stakes: ${multiWalletStakes.length}`);

        if (multiWalletStakes.length > 0) {
          console.log(`\n🚨 SUSPICIOUS MULTI-WALLET STAKES:`);
          multiWalletStakes.forEach((stake, i) => {
            console.log(`${i + 1}. ${stake.wallets} wallets, ${stake.percentage.toFixed(2)}% holdings`);
          });
        }

        process.exit(0);
      });
      break;
    case 'handles':
      // Deep analysis with ADA Handles
      const handlesUnit = process.argv[3] || '2852268cf6e2db42e20f2fd3125f541e5d6c5a3d70b4dda17c2daa82';
      const handlesCount = parseInt(process.argv[4]) || 10;

      console.log(`🏷️ DEEP ANALYSIS WITH ADA HANDLES`);
      console.log(`Token: ${handlesUnit.substring(0, 20)}...`);
      console.log(`Analyzing top ${handlesCount} stakes with handles and connected wallets...\n`);

      service.getTopTokenHolders(handlesUnit, 1, handlesCount).then(async holders => {
        if (holders.length === 0) {
          console.log('❌ No holders found');
          process.exit(0);
          return;
        }

        const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);

        console.log(`📊 Found ${holders.length} top stakes\n`);

        for (let i = 0; i < Math.min(holders.length, handlesCount); i++) {
          const holder = holders[i];
          const percentage = (holder.amount / totalSupply) * 100;

          console.log(`🔍 STAKE ${i + 1}: ${holder.address.substring(0, 30)}...`);
          console.log(`   Holdings: ${(holder.amount || 0).toLocaleString()} tokens (${percentage.toFixed(2)}%)`);

          // Get ADA Handle for the stake address
          const stakeHandle = await service.getAdaHandle(holder.address);
          if (stakeHandle) {
            console.log(`   🏷️ Stake Handle: ${stakeHandle}`);
          }

          // Get connected wallets
          const wallets = await service.getWalletsFromStake(holder.address);

          if (wallets.length === 0) {
            console.log(`   ❌ No wallets found or API error`);
          } else if (wallets.length === 1) {
            const walletAddr = wallets[0].address || wallets[0];
            console.log(`   ✅ Single wallet: ${walletAddr.substring(0, 30)}...`);

            // Get handle for the wallet
            const walletHandle = await service.getAdaHandle(walletAddr);
            if (walletHandle) {
              console.log(`      🏷️ Wallet Handle: ${walletHandle}`);
            }
          } else {
            console.log(`   🚨 ${wallets.length} CONNECTED WALLETS:`);

            // Get handles for all connected wallets
            const walletAddresses = wallets.map(w => w.address || w);
            const walletHandles = await service.getAdaHandles(walletAddresses);

            wallets.forEach((wallet, j) => {
              const addr = wallet.address || wallet;
              const handle = walletHandles[addr];
              const handleText = handle ? ` (${handle})` : '';
              console.log(`      ${j + 1}. ${addr.substring(0, 40)}...${handleText}`);
            });

            const handlesFound = Object.values(walletHandles).filter(h => h !== null).length;
            if (handlesFound > 0) {
              console.log(`      🏷️ Found ${handlesFound} handles in connected wallets`);
            }

            if (wallets.length > 5) {
              console.log(`   🔴 HIGHLY SUSPICIOUS - Many wallets under one stake!`);
            } else if (wallets.length > 2) {
              console.log(`   🟡 POTENTIALLY SUSPICIOUS - Multiple wallets`);
            }
          }

          console.log(''); // Empty line for readability

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`📊 ANALYSIS COMPLETE!`);
        process.exit(0);
      });
      break;
    case 'track':
      // Add wallet for tracking
      const trackAddress = process.argv[3];
      const trackLabel = process.argv[4] || '';
      const trackNotes = process.argv[5] || '';

      if (!trackAddress) {
        console.log('❌ Please provide an address to track');
        console.log('Usage: node taptools-service.js track <stake1...> [label] [notes]');
        console.log('       node taptools-service.js track <addr1...> [label] [notes]');
        process.exit(1);
      }

      service.addWalletTracking(trackAddress, trackLabel, trackNotes).then(() => {
        process.exit(0);
      });
      break;
    case 'untrack':
      // Remove wallet from tracking
      const untrackAddress = process.argv[3];

      if (!untrackAddress) {
        console.log('❌ Please provide an address to untrack');
        console.log('Usage: node taptools-service.js untrack <address>');
        process.exit(1);
      }

      service.removeWalletTracking(untrackAddress).then(() => {
        process.exit(0);
      });
      break;
    case 'list':
      // List tracked wallets
      (async () => {
        await service.loadTrackedWallets(); // Ensure wallets are loaded
        service.listTrackedWallets();
        process.exit(0);
      })();
      break;
    case 'monitor':
      // Monitor tracked wallets
      (async () => {
        await service.loadTrackedWallets(); // Ensure wallets are loaded
        await service.monitorTrackedWallets();
        process.exit(0);
      })();
      break;
    case 'trades':
      // Get trade history for a specific wallet
      const tradeAnalysisAddress = process.argv[3];
      const tradeAnalysisDays = parseInt(process.argv[4]) || 7;

      if (!tradeAnalysisAddress) {
        console.log('❌ Please provide an address to analyze trades');
        console.log('Usage: node taptools-service.js trades <address> [days]');
        process.exit(1);
      }

      (async () => {
        const tradeHistory = await service.getWalletTradeHistory(tradeAnalysisAddress, null, tradeAnalysisDays);

        if (tradeHistory && tradeHistory.totalTrades > 0) {
          console.log(`\n📊 DETAILED TRADE ANALYSIS:`);
          console.log(`Period: ${tradeHistory.period}`);
          console.log(`Total trades: ${tradeHistory.totalTrades}`);
          console.log(`Buy trades: ${tradeHistory.buyTrades}`);
          console.log(`Sell trades: ${tradeHistory.sellTrades}`);
          console.log(`Total volume: ${(tradeHistory.totalVolume || 0).toFixed(2)} ADA`);
          console.log(`Average trade: ${(tradeHistory.avgTradeSize || 0).toFixed(2)} ADA`);
          console.log(`Largest trade: ${(tradeHistory.largestTrade || 0).toFixed(2)} ADA`);
          console.log(`Tokens traded: ${tradeHistory.tokens.join(', ')}`);

          if (tradeHistory.suspiciousPatterns.length > 0) {
            console.log(`🚨 Suspicious patterns: ${tradeHistory.suspiciousPatterns.join(', ')}`);
          }

          if (tradeHistory.recentTrades.length > 0) {
            console.log(`\n📈 RECENT TRADES:`);
            tradeHistory.recentTrades.slice(0, 5).forEach((trade, i) => {
              const date = new Date(trade.time * 1000).toLocaleDateString();
              const isBuy = trade.tokenB === 'lovelace' || trade.tokenBName === 'ADA';
              const action = isBuy ? 'BUY' : 'SELL';
              const token = isBuy ? trade.tokenAName : trade.tokenBName;
              const amount = isBuy ? trade.tokenBAmount / 1000000 : trade.tokenAAmount / 1000000;

              console.log(`${i + 1}. ${action} ${token} - ${amount.toFixed(2)} ADA (${date})`);
            });
          }
        }

        process.exit(0);
      })();
      break;
    case 'monitor-trades':
      // Enhanced monitoring with trade history
      (async () => {
        await service.loadTrackedWallets();
        await service.monitorTrackedWalletsWithTrades();
        process.exit(0);
      })();
      break;
    case 'monitor-start':
      // Start monitoring top volume tokens
      const monitorTimeframe = process.argv[3] || '1h';
      const monitorLimit = parseInt(process.argv[4]) || 10;

      console.log(`🚀 STARTING TOP VOLUME TOKEN MONITORING`);
      console.log(`Timeframe: ${monitorTimeframe}`);
      console.log(`Monitoring top ${monitorLimit} tokens...\n`);

      (async () => {
        try {
          // Get top volume tokens
          const topTokens = await service.getTopVolumeTokens(monitorTimeframe, monitorLimit);

          if (topTokens.length === 0) {
            console.log('❌ No top volume tokens found');
            process.exit(0);
            return;
          }

          console.log(`📊 Found ${topTokens.length} top volume tokens to monitor\n`);

          // Start monitoring loop
          let monitoringActive = true;
          let monitorCount = 0;

          const monitorInterval = setInterval(async () => {
            monitorCount++;
            console.log(`🔍 MONITORING CYCLE ${monitorCount} - ${new Date().toLocaleTimeString()}`);

            for (let i = 0; i < topTokens.length; i++) {
              const token = topTokens[i];
              console.log(`\n📈 Analyzing ${i + 1}/${topTokens.length}: ${token.name || 'Unknown'}`);
              console.log(`   Volume: ${(token.volume || 0).toLocaleString()} ADA`);
              console.log(`   Unit: ${token.unit.substring(0, 20)}...`);

              try {
                // Get token links
                const links = await service.getTokenLinks(token.unit);
                if (links) {
                  const formattedLinks = service.formatTokenLinks(links);
                  if (formattedLinks) {
                    console.log(`   🔗 Links: ${formattedLinks}`);
                  }
                }

                // Get cluster analysis
                const clusterAnalysis = await service.getTopTokenHolders(token.unit, 1, 10);
                if (clusterAnalysis && clusterAnalysis.length > 0) {
                  const totalSupply = clusterAnalysis.reduce((sum, h) => sum + h.amount, 0);
                  const topHolderPct = ((clusterAnalysis[0].amount / totalSupply) * 100).toFixed(2);
                  console.log(`   👥 Top holder: ${topHolderPct}% (${clusterAnalysis.length} stakes analyzed)`);

                  // Check for suspicious concentration
                  if (topHolderPct > 50) {
                    console.log(`   🚨 EXTREME CONCENTRATION DETECTED!`);
                  } else if (topHolderPct > 25) {
                    console.log(`   ⚠️ HIGH CONCENTRATION WARNING`);
                  } else if (topHolderPct > 15) {
                    console.log(`   🟡 MODERATE CONCENTRATION`);
                  } else {
                    console.log(`   ✅ HEALTHY DISTRIBUTION`);
                  }
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));

              } catch (error) {
                console.log(`   ❌ Analysis error: ${error.message}`);
              }
            }

            console.log(`\n⏰ Monitoring cycle ${monitorCount} complete. Next cycle in 5 minutes...`);

            // Stop after 12 cycles (1 hour with 5-minute intervals)
            if (monitorCount >= 12) {
              console.log('\n🏁 Monitoring session complete!');
              clearInterval(monitorInterval);
              process.exit(0);
            }

          }, 5 * 60 * 1000); // 5 minutes

          // Handle Ctrl+C to stop monitoring
          process.on('SIGINT', () => {
            console.log('\n🛑 Stopping monitoring...');
            clearInterval(monitorInterval);
            process.exit(0);
          });

          console.log('🔄 Monitoring started! Press Ctrl+C to stop early.');

        } catch (error) {
          console.error('❌ Error starting monitoring:', error.message);
          process.exit(1);
        }
      })();
      break;
    case 'monitor-test':
      // Quick test of top volume tokens
      const testTimeframe = process.argv[3] || '1h';
      const testLimit = parseInt(process.argv[4]) || 5;

      console.log(`🧪 TESTING TOP VOLUME TOKEN ANALYSIS`);
      console.log(`Timeframe: ${testTimeframe}`);
      console.log(`Testing top ${testLimit} tokens...\n`);

      (async () => {
        try {
          const topTokens = await service.getTopVolumeTokens(testTimeframe, testLimit);

          if (topTokens.length === 0) {
            console.log('❌ No top volume tokens found');
            process.exit(0);
            return;
          }

          console.log(`📊 Found ${topTokens.length} top volume tokens\n`);

          for (let i = 0; i < topTokens.length; i++) {
            const token = topTokens[i];
            console.log(`🔍 TESTING ${i + 1}/${topTokens.length}: ${token.ticker || token.name || 'Unknown Token'}`);
            console.log(`   Volume: ${(token.volume || 0).toLocaleString()} ADA`);
            console.log(`   Unit: ${token.unit}`);

            try {
              // Test token links
              const links = await service.getTokenLinks(token.unit);
              if (links) {
                const formattedLinks = service.formatTokenLinks(links);
                console.log(`   🔗 Social Links: ${formattedLinks || 'None found'}`);
              } else {
                console.log(`   🔗 Social Links: None available`);
              }

              // Test holder analysis
              const holders = await service.getTopTokenHolders(token.unit, 1, 5);
              if (holders && holders.length > 0) {
                const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);
                const topHolderPct = ((holders[0].amount / totalSupply) * 100).toFixed(2);
                console.log(`   👥 Top holder: ${topHolderPct}% (${holders.length} stakes)`);
                console.log(`   📊 Risk level: ${topHolderPct > 50 ? '🚨 EXTREME' : topHolderPct > 25 ? '⚠️ HIGH' : topHolderPct > 15 ? '🟡 MODERATE' : '✅ LOW'}`);
              } else {
                console.log(`   👥 Holder data: Not available`);
              }

              // Save token to database
              try {
                await service.saveTokenToDatabase({
                  unit: token.unit,
                  ticker: token.ticker,
                  name: token.name,
                  price: token.price,
                  volume: token.volume,
                  policyId: token.unit.substring(0, 56),
                  assetNameHex: token.unit.substring(56)
                });
                console.log(`   💾 Saved to database`);
              } catch (dbError) {
                console.log(`   ❌ Database save failed: ${dbError.message}`);
              }

              console.log(''); // Empty line

              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
              console.log(`   ❌ Analysis error: ${error.message}\n`);
            }
          }

          console.log('🎯 Test complete!');
          process.exit(0);

        } catch (error) {
          console.error('❌ Error running test:', error.message);
          process.exit(1);
        }
      })();
      break;
    default:
      console.log('Usage: node taptools-service.js [command] [parameter]');
      console.log('\n📊 Token Analysis Commands:');
      console.log('  scan [timeframe]     - Scan and analyze latest tokens (default: 1h)');
      console.log('  top [timeframe]      - Get top volume tokens (default: 1h)');
      console.log('  monitor-start [hours] [limit] - Start monitoring top volume tokens (default: 1h, 10 tokens)');
      console.log('  monitor-test [hours] [limit]  - Quick test of top volume tokens (default: 1h, 5 tokens)');
      console.log('  test                 - Test enhanced analysis on first token');
      console.log('  holders [unit]       - Test holders endpoint');
      console.log('  pools [unit]         - Test liquidity pools endpoint');
      console.log('  mcap [unit]          - Test market cap endpoint');
      console.log('  cluster [unit]       - Test stake clustering analysis');
      console.log('  assets [unit]        - Test multi-asset holdings analysis');
      console.log('  hunt [unit] [count]  - Hunt for multiple wallets under same stakes');
      console.log('\n🕵️ Wallet Analysis Commands:');
      console.log('  address [addr]       - Test address info endpoint');
      console.log('  portfolio [stake]    - Test wallet portfolio endpoint');
      console.log('  trades [stake] [unit] - Test wallet trades endpoint');
      console.log('  trend [stake] [time] - Test wallet value trend endpoint');
      console.log('  suspicious [stake] [unit] - Test suspicious behavior analysis');
      console.log('  coordination [unit]  - Test coordinated behavior analysis');
      console.log('  resolve [stake]      - Resolve addr1 wallets from stake address');
      console.log('  deep [unit] [count]  - Deep analysis: stakes + connected wallets');
      console.log('  handles [unit] [count] - Deep analysis with ADA Handles');
      console.log('\n📌 Wallet Tracking Commands:');
      console.log('  track <address> [label] [notes] - Add wallet/stake for tracking');
      console.log('  untrack <address>    - Remove wallet from tracking');
      console.log('  list                 - List all tracked wallets');
      console.log('  monitor              - Monitor tracked wallets for changes');
      console.log('  trades <address> [days] - Get trade history for wallet (default: 7 days)');
      console.log('  monitor-trades       - Monitor tracked wallets with trade analysis');
      console.log('\n🔧 Utility Commands:');
      console.log('  tx [hash]            - Test transaction UTxOs endpoint');
      console.log('  stats                - Show service statistics');
      console.log('\nTimeframes: 1h, 4h, 12h, 24h, 7d, 30d, 180d, 1y, all');
      process.exit(1);
  }
}

module.exports = TapToolsService;
