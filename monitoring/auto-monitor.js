const TapToolsService = require('./taptools-service');
const TokenDatabase = require('./token-database');
const SuperDeepAnalysis = require('./super-deep-analysis');
const GoldStandardAnalysis = require('./gold-standard-analysis');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

class AutoMonitor {
  constructor() {
    this.tapTools = new TapToolsService();
    this.tokenDb = new TokenDatabase();
    this.deepAnalysis = new SuperDeepAnalysis();
    this.goldStandardAnalysis = new GoldStandardAnalysis();
    this.knownTokens = new Set();
    this.suspiciousTokens = [];
    this.monitoringInterval = null;
    this.lastCheckTime = null;
    this.isRunning = false;

    // Risk thresholds for alerts
    this.RISK_THRESHOLD = 7; // Alert if risk score >= 7
    this.CONCENTRATION_THRESHOLD = 60; // Alert if top holder >= 60%
    this.NEW_TOKEN_LIMIT = 25; // Check risk for top 25 new tokens (increased for comprehensive degen coverage)
    this.TOP_VOLUME_LIMIT = 100; // Monitor top 100 volume tokens (to account for stablecoin filtering)

    // Discord configuration
    this.ALERT_CHANNEL_ID = '1373811153691607090';
    this.discordClient = null;
    this.discordReady = false;

    // Analysis cache to avoid re-running expensive operations
    this.analysisCache = new Map();
    this.CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    // Excluded token types (bridge coins, stablecoins, etc.)
    this.EXCLUDED_TOKENS = {
      // Stablecoins
      stablecoins: ['DJED', 'USDM', 'iUSD', 'USDA', 'USDC', 'USDT', 'DAI', 'BUSD'],
      // Bridge tokens
      bridgeTokens: ['rsERG', 'rsADA', 'rsBTC', 'rsETH', 'WETH', 'WBTC', 'WADA'],
      // Infrastructure tokens that naturally have high concentration
      infrastructure: ['MIN', 'SUNDAE', 'MILK', 'LENFI', 'COPI', 'WMT', 'INDY'],
      // Known safe tokens that might trigger false positives
      knownSafe: ['ADA', 'CARDANO', 'HOSKY', 'STRIKE', 'AGENT', 'SNEK', 'IAG', 'WMTX', 'CHAD']
    };
  }

  async init() {
    try {
      await this.tokenDb.init();
      await this.tapTools.init();
      await this.loadKnownTokens();
      await this.initDiscord();
      console.log('🚀 Auto Monitor initialized');
      console.log(`📊 Loaded ${this.knownTokens.size} known tokens`);
    } catch (error) {
      console.error('❌ Failed to initialize Auto Monitor:', error);
      throw error;
    }
  }

  async initDiscord() {
    try {
      // Try to read Discord token from environment or config
      const discordToken = process.env.DISCORD_BOT_TOKEN;

      if (!discordToken) {
        console.log('⚠️ No Discord token found, alerts will be logged only');
        return;
      }

      this.discordClient = new Client({
        intents: [GatewayIntentBits.Guilds]
      });

      this.discordClient.once('ready', () => {
        this.discordReady = true;
        console.log(`✅ Discord bot ready for alerts: ${this.discordClient.user.tag}`);
      });

      await this.discordClient.login(discordToken);

    } catch (error) {
      console.log('⚠️ Discord initialization failed, alerts will be logged only:', error.message);
      this.discordReady = false;
    }
  }

  async loadKnownTokens() {
    try {
      const tokens = await this.tokenDb.getAllTokens(1, 1000);
      this.knownTokens.clear();

      tokens.forEach(token => {
        this.knownTokens.add(token.unit);
      });

      console.log(`💾 Loaded ${this.knownTokens.size} known tokens from database`);
    } catch (error) {
      console.error('❌ Error loading known tokens:', error);
    }
  }

  // Check if token should be excluded from risk analysis
  isExcludedToken(ticker, name) {
    if (!ticker && !name) return false;

    const tokenIdentifier = (ticker || name || '').toUpperCase();

    // Check all exclusion categories
    const allExcluded = [
      ...this.EXCLUDED_TOKENS.stablecoins,
      ...this.EXCLUDED_TOKENS.bridgeTokens,
      ...this.EXCLUDED_TOKENS.infrastructure,
      ...this.EXCLUDED_TOKENS.knownSafe
    ].map(t => t.toUpperCase());

    return allExcluded.includes(tokenIdentifier);
  }

  // Get exclusion reason for logging
  getExclusionReason(ticker, name) {
    const tokenIdentifier = (ticker || name || '').toUpperCase();

    if (this.EXCLUDED_TOKENS.stablecoins.map(t => t.toUpperCase()).includes(tokenIdentifier)) {
      return 'Stablecoin';
    }
    if (this.EXCLUDED_TOKENS.bridgeTokens.map(t => t.toUpperCase()).includes(tokenIdentifier)) {
      return 'Bridge Token';
    }
    if (this.EXCLUDED_TOKENS.infrastructure.map(t => t.toUpperCase()).includes(tokenIdentifier)) {
      return 'Infrastructure Token';
    }
    if (this.EXCLUDED_TOKENS.knownSafe.map(t => t.toUpperCase()).includes(tokenIdentifier)) {
      return 'Known Safe Token';
    }

    return null;
  }

  async startMonitoring() {
    if (this.isRunning) {
      console.log('⚠️ Monitoring is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting automated monitoring...');
    console.log(`⏰ Checking top ${this.TOP_VOLUME_LIMIT} volume tokens every 2 hours`);
    console.log(`🔍 Risk analysis for top ${this.NEW_TOKEN_LIMIT} new tokens`);
    console.log(`🚨 Alert threshold: Risk >= ${this.RISK_THRESHOLD}, Concentration >= ${this.CONCENTRATION_THRESHOLD}%`);

    // Start HTTP server for Discord bot integration
    this.startHttpServer();

    // Run immediately
    await this.runMonitoringCycle();

    // Then run every 4 hours (optimized to reduce API calls)
    this.monitoringInterval = setInterval(async () => {
      await this.runMonitoringCycle();
    }, 4 * 60 * 60 * 1000); // 4 hours in milliseconds

    console.log('✅ Automated monitoring started');
  }

  async stopMonitoring() {
    if (!this.isRunning) {
      console.log('⚠️ Monitoring is not running');
      return;
    }

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('🛑 Automated monitoring stopped');
  }

  async runMonitoringCycle() {
    const cycleStart = new Date();
    this.lastCheckTime = cycleStart.toISOString();
    console.log(`\n🔄 MONITORING CYCLE STARTED - ${cycleStart.toLocaleString()}`);

    try {
      // 1. Get top volume tokens
      console.log(`📊 Fetching top ${this.TOP_VOLUME_LIMIT} volume tokens...`);
      const volumeTokens = await this.tapTools.getTopVolumeTokens('1h', this.TOP_VOLUME_LIMIT);

      // 2. Get degen market cap tokens (pages 7-12: 30k-175k ADA)
      console.log(`🎯 Fetching degen market cap tokens (30k-175k ADA range)...`);
      const mcapTokens = await this.getDegenMarketCapTokens();

      // 3. Combine and deduplicate tokens
      const allTokens = [...(volumeTokens || []), ...(mcapTokens || [])];
      const uniqueTokens = new Map();

      allTokens.forEach(token => {
        if (!uniqueTokens.has(token.unit)) {
          uniqueTokens.set(token.unit, {
            ...token,
            source: volumeTokens?.find(t => t.unit === token.unit) ? 'volume' : 'mcap'
          });
        }
      });

      const topTokens = Array.from(uniqueTokens.values());

      if (!topTokens || topTokens.length === 0) {
        console.log('❌ No tokens found from volume or market cap sources');
        return;
      }

      console.log(`✅ Combined tokens: ${topTokens.length} (${volumeTokens?.length || 0} volume + ${mcapTokens?.length || 0} mcap, deduplicated)`);
      console.log(`🎯 Volume source: ${topTokens.filter(t => t.source === 'volume').length}, Market cap source: ${topTokens.filter(t => t.source === 'mcap').length}`);

      // 2. Identify truly new tokens (never stored in database)
      const newTokens = [];
      const existingTokens = [];

      for (const token of topTokens) {
        // Check if token exists in database (not just in current session)
        const existsInDb = await this.tapTools.tokenDb.findTokenByUnit(token.unit);

        if (existsInDb) {
          existingTokens.push(token);
          // Add to known tokens for session tracking
          this.knownTokens.add(token.unit);
        } else {
          newTokens.push(token);
        }
      }

      console.log(`🆕 New tokens (never seen before): ${newTokens.length}`);
      console.log(`📋 Existing tokens (already in database): ${existingTokens.length}`);

      // 3. Save all tokens to database (update existing, add new) - OPTIMIZED WITH PARALLEL PROCESSING
      console.log('💾 Updating token database with parallel processing...');
      const savePromises = topTokens.map(async (token) => {
        try {
          await this.tapTools.saveTokenToDatabase({
            unit: token.unit,
            ticker: token.ticker,
            name: token.name,
            price: token.price,
            volume: token.volume,
            policyId: token.unit.substring(0, 56),
            assetNameHex: token.unit.substring(56)
          });

          // Add to known tokens
          this.knownTokens.add(token.unit);
          return { success: true, ticker: token.ticker };
        } catch (error) {
          console.log(`❌ Failed to save token ${token.ticker || 'Unknown'}: ${error.message}`);
          return { success: false, ticker: token.ticker, error: error.message };
        }
      });

      // Process in batches of 10 to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < savePromises.length; i += batchSize) {
        const batch = savePromises.slice(i, i + batchSize);
        await Promise.allSettled(batch);
        console.log(`💾 Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(savePromises.length/batchSize)}`);
      }

      // 4. Gold analysis ONLY for new tokens from TOP VOLUME source (not market cap)
      const volumeNewTokens = newTokens.filter(token => token.source === 'volume');
      const tokensToAnalyze = volumeNewTokens.slice(0, Math.min(this.NEW_TOKEN_LIMIT, 3)); // Limit to max 3 new volume tokens per cycle
      console.log(`🏆 Running GOLD STANDARD analysis for ${tokensToAnalyze.length} new TOP VOLUME tokens...`);
      console.log(`💾 Market cap tokens (${newTokens.filter(t => t.source === 'mcap').length}) saved to database only (no analysis)`);

      const suspiciousFindings = [];
      const analyzedTokens = [];

      for (let i = 0; i < tokensToAnalyze.length; i++) {
        const token = tokensToAnalyze[i];
        console.log(`\n🔍 Analyzing ${i + 1}/${tokensToAnalyze.length}: ${token.ticker || token.name || 'Unknown'}`);

        // Check if token should be excluded from risk analysis
        if (this.isExcludedToken(token.ticker, token.name)) {
          const reason = this.getExclusionReason(token.ticker, token.name);
          console.log(`   ⏭️ Skipping analysis: ${reason}`);
          console.log(`   ℹ️ ${reason}s naturally have high concentration and are excluded from risk alerts`);
          continue;
        }

        try {
          const analysis = await this.tapTools.analyzeTokenWithStorage(token.unit, token.ticker);

          if (analysis) {
            console.log(`   📊 Risk Score: ${analysis.riskScore}/10`);
            console.log(`   👥 Top Holder: ${analysis.topHolderPercentage.toFixed(2)}%`);
            console.log(`   🏆 Verdict: ${analysis.verdict}`);
            console.log(`   💰 Volume: ${token.volume?.toLocaleString() || 'Unknown'} ADA`);

            // Run GOLD STANDARD analysis ONLY for new TOP VOLUME tokens with decent volume
            const hasDecentVolume = token.volume && token.volume > 1000;
            const isFromTopVolume = token.source === 'volume'; // Only tokens from top volume list
            let goldAnalysisResult = null;

            if (hasDecentVolume && isFromTopVolume) {
              console.log(`   🏆 Running GOLD STANDARD ANALYSIS (Top Volume Token: ${token.volume?.toLocaleString()} ADA)...`);
              try {
                goldAnalysisResult = await this.goldStandardAnalysis.performGoldStandardAnalysis(token.unit, token.ticker);
                console.log(`   ✅ Gold Standard analysis complete - Premium risk intelligence available`);
              } catch (error) {
                console.log(`   ❌ Gold Standard analysis failed: ${error.message}`);
              }
            } else if (!isFromTopVolume) {
              console.log(`   ⏭️ Skipping Gold Standard analysis (Market cap token, not top volume)`);
              console.log(`   💾 Token saved to database for future monitoring`);
            } else {
              console.log(`   ⏭️ Skipping Gold Standard analysis (Low volume: ${token.volume?.toLocaleString() || 'Unknown'} ADA, need >1000 ADA)`);
              console.log(`   💾 Token saved to database for future monitoring`);
            }

            // Create analyzed token object
            const analyzedToken = {
              ...token,
              analysis,
              goldStandardAnalysis: goldAnalysisResult,
              goldAnalysisError: goldAnalysisResult ? null : 'Gold Standard analysis failed',
              discoveredAt: new Date().toISOString()
            };

            analyzedTokens.push(analyzedToken);

            // Check if suspicious for alerts
            const isSuspicious = analysis.riskScore >= this.RISK_THRESHOLD ||
                               analysis.topHolderPercentage >= this.CONCENTRATION_THRESHOLD;

            if (isSuspicious) {
              const suspiciousToken = {
                ...analyzedToken,
                alertReasons: []
              };

              if (analysis.riskScore >= this.RISK_THRESHOLD) {
                suspiciousToken.alertReasons.push(`High Risk Score: ${analysis.riskScore}/10`);
              }

              if (analysis.topHolderPercentage >= this.CONCENTRATION_THRESHOLD) {
                suspiciousToken.alertReasons.push(`High Concentration: ${analysis.topHolderPercentage.toFixed(2)}%`);
              }

              console.log(`   🚨 SUSPICIOUS TOKEN DETECTED!`);
              console.log(`   ⚠️ Reasons: ${suspiciousToken.alertReasons.join(', ')}`);

              suspiciousFindings.push(suspiciousToken);
            } else {
              console.log(`   ✅ Token appears safe`);
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          console.log(`   ❌ Analysis failed: ${error.message}`);
        }
      }

      // 5. Store suspicious findings and send alerts
      if (suspiciousFindings.length > 0) {
        this.suspiciousTokens.push(...suspiciousFindings);
        console.log(`\n🚨 ALERT: Found ${suspiciousFindings.length} suspicious tokens!`);

        for (const suspicious of suspiciousFindings) {
          console.log(`🔴 ${suspicious.ticker || suspicious.name || 'Unknown Token'}`);
          console.log(`   Volume: ${suspicious.volume?.toLocaleString() || 'Unknown'} ADA`);
          console.log(`   Risk: ${suspicious.analysis.riskScore}/10`);
          console.log(`   Concentration: ${suspicious.analysis.topHolderPercentage.toFixed(2)}%`);
          console.log(`   Reasons: ${suspicious.alertReasons.join(', ')}`);
        }

        // Send Discord alert
        await this.sendSuspiciousTokenAlert(suspiciousFindings);

        // Keep only last 50 suspicious tokens
        if (this.suspiciousTokens.length > 50) {
          this.suspiciousTokens = this.suspiciousTokens.slice(-50);
        }
      } else {
        console.log('\n✅ No suspicious tokens detected in this cycle');
      }

      // Get top 5 volume tokens for monitoring summary
      const top5VolumeTokens = volumeTokens ? volumeTokens.slice(0, 5) : [];

      // Send enhanced monitoring summary to Discord
      await this.sendEnhancedMonitoringSummary(topTokens.length, newTokens.length, suspiciousFindings.length, analyzedTokens, top5VolumeTokens);

      // Only send Gold Standard analysis for suspicious tokens (not all new tokens)
      const suspiciousAnalyzedTokens = analyzedTokens.filter(token =>
        token.analysis.riskScore >= this.RISK_THRESHOLD ||
        token.analysis.topHolderPercentage >= this.CONCENTRATION_THRESHOLD
      );

      if (suspiciousAnalyzedTokens.length > 0) {
        console.log(`🏆 Sending Gold Standard analysis for ${suspiciousAnalyzedTokens.length} suspicious tokens`);
        await this.sendGoldStandardAnalysisToDiscord(suspiciousAnalyzedTokens);
      } else {
        console.log(`✅ No suspicious tokens requiring Gold Standard analysis`);
      }

      const cycleEnd = new Date();
      const duration = Math.round((cycleEnd - cycleStart) / 1000);
      console.log(`\n🏁 MONITORING CYCLE COMPLETED in ${duration}s`);
      console.log(`📊 Summary: ${topTokens.length} tokens checked, ${newTokens.length} new, ${analyzedTokens.length} analyzed, ${suspiciousFindings.length} suspicious`);
      console.log(`⏰ Next cycle: ${new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleString()}`);

      // Print API call summary for cost tracking
      this.tapTools.printApiCallSummary();

    } catch (error) {
      console.error('❌ Error in monitoring cycle:', error);
    }
  }

  // Get degen market cap tokens from pages 7-12 (30k-175k ADA range)
  async getDegenMarketCapTokens() {
    try {
      console.log('🎯 Fetching degen market cap tokens from pages 7-12...');
      const allMcapTokens = [];

      // Fetch pages 7-12 to cover 30k-175k ADA market cap range
      for (let page = 7; page <= 12; page++) {
        try {
          console.log(`📊 Fetching market cap page ${page}...`);
          const pageTokens = await this.tapTools.makeTapToolsRequest('/token/top/mcap', {
            perPage: 20,
            page: page
          });

          if (pageTokens && Array.isArray(pageTokens)) {
            // Filter tokens in the 30k-175k ADA range
            const filteredTokens = pageTokens.filter(token => {
              const mcap = token.mcap || 0;
              return mcap >= 30000 && mcap <= 175000;
            });

            // Convert to our standard format
            const formattedTokens = filteredTokens.map(token => ({
              unit: token.unit,
              ticker: token.ticker,
              name: token.name || token.ticker,
              price: token.price,
              volume: 0, // Market cap tokens don't have volume data - will be filtered for deep analysis
              mcap: token.mcap,
              circSupply: token.circSupply,
              fdv: token.fdv,
              source: 'mcap'
            }));

            allMcapTokens.push(...formattedTokens);
            console.log(`📊 Page ${page}: Found ${filteredTokens.length} tokens in degen range (${pageTokens.length} total)`);
          }

          // Rate limiting between pages
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.log(`❌ Error fetching market cap page ${page}: ${error.message}`);
        }
      }

      console.log(`🎯 Total degen market cap tokens found: ${allMcapTokens.length}`);

      // Log some examples
      if (allMcapTokens.length > 0) {
        console.log('🔍 Sample degen tokens:');
        allMcapTokens.slice(0, 5).forEach(token => {
          console.log(`   ${token.ticker}: ${token.mcap?.toLocaleString()} ADA market cap`);
        });
      }

      return allMcapTokens;

    } catch (error) {
      console.error('❌ Error fetching degen market cap tokens:', error.message);
      return [];
    }
  }

  // Check if analysis is cached and still valid
  getCachedAnalysis(ticker) {
    const cached = this.analysisCache.get(ticker.toUpperCase());
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.analysisCache.delete(ticker.toUpperCase());
      return null;
    }

    return cached.data;
  }

  // Cache analysis result
  setCachedAnalysis(ticker, data) {
    this.analysisCache.set(ticker.toUpperCase(), {
      data: data,
      timestamp: Date.now()
    });
  }

  // Autonomous monitoring only - manual analysis functions removed

  // Get recent suspicious tokens
  getSuspiciousTokens(limit = 10) {
    return this.suspiciousTokens.slice(-limit).reverse();
  }

  // Get monitoring status for Discord bot
  getMonitoringStatus() {
    return {
      isRunning: this.isRunning,
      tokensMonitored: this.knownTokens.size,
      lastCheck: this.lastCheckTime || 'Never',
      alertsTriggered: this.suspiciousTokens.length,
      nextCheck: this.isRunning ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() : 'Not scheduled',
      uptime: process.uptime(),
      mode: 'Production'
    };
  }

  // Start HTTP server for Discord bot integration
  startHttpServer() {
    const express = require('express');
    const app = express();
    app.use(express.json());

    // Autonomous monitoring only - no manual triggers



    // Status endpoint for Discord bot
    app.get('/status', async (req, res) => {
      try {
        const status = this.getMonitoringStatus();
        res.json({
          success: true,
          status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        isRunning: this.isRunning
      });
    });

    // MASTRA AGENT INTEGRATION ENDPOINTS

    // Trigger analysis with Discord notification
    app.post('/trigger-analysis', async (req, res) => {
      try {
        const { ticker, analysis, source } = req.body;

        if (!ticker || !analysis) {
          return res.status(400).json({
            success: false,
            error: 'ticker and analysis are required'
          });
        }

        console.log(`🤖 Mastra agent triggered analysis notification for: ${ticker}`);

        // Send to Discord
        if (this.discordReady && this.discordClient) {
          await this.sendAgentTriggeredAnalysis(ticker, analysis, source);
          console.log(`✅ Discord notification sent for agent-triggered analysis: ${ticker}`);
        }

        res.json({
          success: true,
          message: `Analysis notification sent for ${ticker}`,
          source: source || 'mastra_agent'
        });

      } catch (error) {
        console.error('Error in trigger-analysis:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Trigger Gold Standard analysis with Discord notification
    app.post('/trigger-gold-analysis', async (req, res) => {
      try {
        const { ticker, result, source } = req.body;

        if (!ticker || !result) {
          return res.status(400).json({
            success: false,
            error: 'ticker and result are required'
          });
        }

        console.log(`🏆 Mastra agent triggered Gold Standard notification for: ${ticker}`);

        // Send to Discord
        if (this.discordReady && this.discordClient) {
          await this.sendAgentTriggeredGoldAnalysis(ticker, result, source);
          console.log(`🏆 Discord Gold Standard notification sent for: ${ticker}`);
        }

        res.json({
          success: true,
          message: `Gold Standard notification sent for ${ticker}`,
          source: source || 'mastra_agent_gold'
        });

      } catch (error) {
        console.error('Error in trigger-gold-analysis:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get recent suspicious tokens for agent
    app.get('/suspicious-tokens', (req, res) => {
      try {
        const { limit = 10 } = req.query;
        const suspicious = this.getSuspiciousTokens(parseInt(limit));

        res.json({
          success: true,
          suspiciousTokens: suspicious,
          count: suspicious.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get monitoring history for agent
    app.get('/monitoring-history', (req, res) => {
      try {
        const { hours = 24 } = req.query;
        const cutoff = Date.now() - (parseInt(hours) * 60 * 60 * 1000);

        const recentSuspicious = this.suspiciousTokens.filter(token => {
          const tokenTime = new Date(token.discoveredAt).getTime();
          return tokenTime >= cutoff;
        });

        res.json({
          success: true,
          history: {
            suspiciousTokens: recentSuspicious,
            totalMonitored: this.knownTokens.size,
            lastCycle: this.lastCheckTime,
            isRunning: this.isRunning,
            uptime: process.uptime()
          },
          timeframe: `${hours} hours`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    const PORT = process.env.PORT || 4001; // Use Railway's PORT or fallback to 4001
    app.listen(PORT, () => {
      console.log(`🌐 Auto-monitor HTTP server running on port ${PORT}`);
      console.log(`📊 Available endpoints:`);
      console.log(`   GET /status - Get monitoring status`);
      console.log(`   GET /health - Health check`);
      console.log(`🏆 Autonomous Gold Standard analysis for new top volume tokens only`);
    });
  }

  // Send full SNEK-style deep analysis for new tokens
  async sendFullDeepAnalysisForNewTokens(analyzedTokens) {
    try {
      if (!this.discordReady || !this.discordClient) {
        console.log('⚠️ Discord not ready, skipping deep analysis alerts');
        return;
      }

      const channel = await this.discordClient.channels.fetch(this.ALERT_CHANNEL_ID);
      if (!channel) {
        console.log('❌ Could not find Discord alert channel');
        return;
      }

      // Send full deep analysis for each new token (like SNEK format)
      for (const token of analyzedTokens) {
        if (!token.deepAnalysis || !token.deepAnalysis.report) {
          continue; // Skip if no deep analysis available
        }

        const report = token.deepAnalysis.report;
        const details = report.details;

        // Create comprehensive SNEK-style embed
        const embed = new EmbedBuilder()
          .setTitle(`🕵️ SUPER DEEP ANALYSIS: ${token.ticker || token.name || 'Unknown Token'}`)
          .setDescription('Comprehensive risk analysis with holder clustering and ADA handle resolution')
          .setColor(report.summary.riskScore <= 3 ? 0x00FF00 : report.summary.riskScore <= 6 ? 0xFFFF00 : 0xFF0000)
          .setTimestamp();

        // Executive Summary
        let executiveSummary = [
          `**Risk Score:** ${report.summary.riskScore}/10 (${report.summary.verdict})`,
          `**Recommendation:** ${report.summary.recommendation}`
        ];

        if (details.basicInfo.price) {
          executiveSummary.push(`**Price:** $${details.basicInfo.price}`);
        }
        if (details.basicInfo.marketCap) {
          executiveSummary.push(`**Market Cap:** $${details.basicInfo.marketCap.toLocaleString()}`);
        }

        embed.addFields({
          name: '📊 Executive Summary',
          value: executiveSummary.join('\n'),
          inline: false
        });

        // Holder Analysis
        let holderAnalysis = [
          `**Total Holders:** ${details.holderAnalysis.holderCount || 100}`,
          `**Top Holder:** ${details.holderAnalysis.topHolderPercentage?.toFixed(2) || 'Unknown'}%`
        ];

        if (details.holderAnalysis.top5Percentage) {
          holderAnalysis.push(`**Top 5 Holders:** ${details.holderAnalysis.top5Percentage.toFixed(2)}%`);
        }
        if (details.holderAnalysis.whaleCount) {
          holderAnalysis.push(`**Whales (>5%):** ${details.holderAnalysis.whaleCount}`);
        }
        if (details.holderAnalysis.majorHolderCount) {
          holderAnalysis.push(`**Major Holders (>1%):** ${details.holderAnalysis.majorHolderCount}`);
        }

        embed.addFields({
          name: '👥 Holder Analysis',
          value: holderAnalysis.join('\n'),
          inline: false
        });

        // Cluster Analysis
        let clusterAnalysis = [
          `**Total Clusters:** ${details.clusterAnalysis.totalClusters}`,
          `**Suspicious:** ${details.clusterAnalysis.suspiciousClusters}`,
          `**Clusters >10%:** ${details.clusterAnalysis.clustersOver10Percent}`,
          `**Top Cluster:** ${details.clusterAnalysis.topClusterPercentage?.toFixed(2) || 'Unknown'}%`
        ];

        embed.addFields({
          name: '🔗 Cluster Analysis',
          value: clusterAnalysis.join('\n'),
          inline: false
        });

        // ADA Handles (if any found)
        if (details.adaHandles.resolvedHandles > 0) {
          const handles = Object.values(details.adaHandles.handles).slice(0, 5);
          embed.addFields({
            name: '🏷️ Top Holder ADA Handles',
            value: handles.join('\n') || 'None found',
            inline: false
          });
        }

        // Liquidity Analysis
        let liquidityAnalysis = [
          `**Liquidity Risk:** ${details.liquidityAnalysis.riskLevel}`,
          `**Pool Count:** ${details.liquidityAnalysis.poolCount}`
        ];

        if (details.liquidityAnalysis.totalAdaLocked) {
          liquidityAnalysis.push(`**ADA Locked:** ${details.liquidityAnalysis.totalAdaLocked.toLocaleString()}`);
        }

        if (details.liquidityAnalysis.exchanges && details.liquidityAnalysis.exchanges.length > 0) {
          const exchanges = details.liquidityAnalysis.exchanges.slice(0, 8).join(', ');
          liquidityAnalysis.push(`**Exchanges:** ${exchanges}`);
        }

        embed.addFields({
          name: '💧 Liquidity Analysis',
          value: liquidityAnalysis.join('\n'),
          inline: false
        });

        // Risk Factors
        if (details.riskAssessment.riskFactors && details.riskAssessment.riskFactors.length > 0) {
          embed.addFields({
            name: '🚨 Risk Factors',
            value: details.riskAssessment.riskFactors.join('\n'),
            inline: false
          });
        }

        // Top Stakes Analysis (top 5 stakes with ADA handles)
        if (details.stakeAnalysis.detailedClusters && details.stakeAnalysis.detailedClusters.length > 0) {
          let stakesAnalysis = '';
          const topStakes = details.stakeAnalysis.detailedClusters.slice(0, 5);

          topStakes.forEach((stake, i) => {
            stakesAnalysis += `**${i + 1}.** \`${stake.stakeAddress.substring(0, 20)}...\` (${stake.totalPercentage?.toFixed(2) || 'Unknown'}%)\n`;
            if (stake.connectedWallets) {
              stakesAnalysis += `Connected Wallets: ${stake.connectedWallets}\n`;
            }

            // Enhanced ADA handles for this cluster
            if (details.adaHandles.stakeHandleGroups && details.adaHandles.stakeHandleGroups[stake.stakeAddress]) {
              const stakeGroup = details.adaHandles.stakeHandleGroups[stake.stakeAddress];
              const handlesText = stakeGroup.handles.map(h => h.handle).slice(0, 3).join(', ');
              stakesAnalysis += `🏷️ ADA Handles (${stakeGroup.handleCount}): ${handlesText}\n`;
            } else if (details.adaHandles.handles && stake.wallets) {
              // Fallback to old method
              const clusterHandles = [];
              stake.wallets.forEach(wallet => {
                if (details.adaHandles.handles[wallet.address]) {
                  clusterHandles.push(details.adaHandles.handles[wallet.address]);
                }
              });

              if (clusterHandles.length > 0) {
                const topHandles = clusterHandles.slice(0, 2);
                stakesAnalysis += `🏷️ ADA Handles: ${topHandles.join(', ')}\n`;
              }
            }

            stakesAnalysis += '\n';
          });

          embed.addFields({
            name: '🕵️ Top Stakes Analysis',
            value: stakesAnalysis || 'No detailed stake data available',
            inline: false
          });
        }

        // Social Links (clickable)
        if (details.basicInfo.socialLinks) {
          const links = [];
          const social = details.basicInfo.socialLinks;
          if (social.website) links.push(`🌐 [Website](${social.website})`);
          if (social.twitter) links.push(`🐦 [Twitter](${social.twitter})`);
          if (social.discord) links.push(`💬 [Discord](${social.discord})`);
          if (social.telegram) links.push(`📱 [Telegram](${social.telegram})`);
          if (social.github) links.push(`💻 [GitHub](${social.github})`);
          if (social.reddit) links.push(`📰 [Reddit](${social.reddit})`);
          if (social.medium) links.push(`📝 [Medium](${social.medium})`);
          if (social.youtube) links.push(`📺 [YouTube](${social.youtube})`);

          if (links.length > 0) {
            embed.addFields({
              name: '🔗 Social Links',
              value: links.join(' • '),
              inline: false
            });
          }
        }

        // Footer with unit info
        embed.setFooter({
          text: `🏆 Risk Ratings - Mister's Gold Standard Intelligence 🏆 • Analysis completed • Unit: ${token.unit.substring(0, 20)}...`
        });

        await channel.send({ embeds: [embed] });
        console.log(`✅ Sent full deep analysis for ${token.ticker || 'Unknown'} to Discord`);

        // Rate limiting between messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error('❌ Error sending full deep analysis:', error.message);
    }
  }

  // Send suspicious token alert to Discord
  async sendSuspiciousTokenAlert(suspiciousTokens) {
    try {
      if (!this.discordReady || !this.discordClient) {
        console.log('⚠️ Discord not ready, logging alert instead');
        return;
      }

      const channel = await this.discordClient.channels.fetch(this.ALERT_CHANNEL_ID);
      if (!channel) {
        console.log('❌ Could not find Discord alert channel');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🚨 ${suspiciousTokens.length} SUSPICIOUS TOKEN${suspiciousTokens.length > 1 ? 'S' : ''} DETECTED`)
        .setDescription(`🌐 **Visit [www.misterada.com](https://www.misterada.com) for more intelligence**\n\n⚠️ New tokens requiring attention from latest monitoring cycle`)
        .setColor(0xFF0000)
        .setTimestamp();

      // Add fields for each suspicious token (more concise format)
      for (let i = 0; i < Math.min(suspiciousTokens.length, 5); i++) {
        const token = suspiciousTokens[i];

        let fieldValue = [
          `💰 **${token.volume?.toLocaleString() || 'Unknown'} ADA** • 🎯 **${token.analysis.riskScore}/10** • 👥 **${token.analysis.topHolderPercentage.toFixed(1)}%**`,
          `⚠️ ${token.alertReasons.join(', ')}`
        ];

        // Add concise deep analysis data if available
        if (token.deepAnalysis && token.deepAnalysis.report) {
          const deepReport = token.deepAnalysis.report;

          fieldValue.push(`\n🕵️ **Deep Analysis:** ${deepReport.summary.riskScore}/10 (${deepReport.summary.verdict}) • ${deepReport.summary.recommendation}`);

          // Key metrics in one line
          const holders = deepReport.details.holderAnalysis.totalHolders || 100;
          const clusters = deepReport.summary.clusterCount || 0;
          const suspicious = deepReport.summary.suspiciousClusters || 0;
          const handles = deepReport.details.adaHandles.resolvedHandles || 0;

          fieldValue.push(`👥 **${holders} holders** • 🔗 **${clusters} connected groups** • 🚨 **${suspicious} suspicious** • 🏷️ **${handles} handles**`);

          // Most connected wallets (actionable data)
          if (deepReport.details.stakeAnalysis.detailedClusters && deepReport.details.stakeAnalysis.detailedClusters.length > 0) {
            const topConnected = deepReport.details.stakeAnalysis.detailedClusters
              .filter(stake => stake.connectedWallets > 1)
              .sort((a, b) => b.connectedWallets - a.connectedWallets)
              .slice(0, 2);

            if (topConnected.length > 0) {
              fieldValue.push(`🔗 **Most Connected:** ${topConnected.map(stake =>
                `${stake.totalPercentage?.toFixed(1) || 'Unknown'}% (${stake.connectedWallets} wallets)`
              ).join(', ')}`);
            }
          }

          // Notable handles (actionable data)
          if (deepReport.details.adaHandles.stakeHandleGroups) {
            const notableHandles = Object.values(deepReport.details.adaHandles.stakeHandleGroups)
              .filter(group => group.holderRank <= 5)
              .sort((a, b) => a.holderRank - b.holderRank)
              .slice(0, 3)
              .map(group => `**${group.holderPercentage.toFixed(1)}%** ${group.handles[0]?.handle}`)
              .filter(h => h.includes('$'));

            if (notableHandles.length > 0) {
              fieldValue.push(`🏷️ **Top Handles:** ${notableHandles.join(' • ')}`);
            }
          }

          // Risk factors (concise)
          if (deepReport.details.riskAssessment.riskFactors && deepReport.details.riskAssessment.riskFactors.length > 0) {
            fieldValue.push(`⚠️ **Risks:** ${deepReport.details.riskAssessment.riskFactors.slice(0, 3).join(', ')}`);
          }
        }

        fieldValue.push(`**Unit:** \`${token.unit.substring(0, 20)}...\``);

        embed.addFields({
          name: `🔴 ${token.ticker || token.name || 'Unknown Token'}`,
          value: fieldValue.join('\n'),
          inline: false
        });
      }

      if (suspiciousTokens.length > 5) {
        embed.addFields({
          name: '📊 Additional Alerts',
          value: `... and ${suspiciousTokens.length - 5} more suspicious tokens`,
          inline: false
        });
      }

      embed.setFooter({ text: '🏆 Risk Ratings - Mister\'s Gold Standard • Suspicious Token Alert' });

      await channel.send({ embeds: [embed] });
      console.log(`✅ Sent suspicious token alert to Discord`);

    } catch (error) {
      console.error('❌ Error sending Discord alert:', error.message);
    }
  }

  // Send enhanced monitoring summary to Discord
  async sendEnhancedMonitoringSummary(totalTokens, newTokens, suspiciousTokens, analyzedTokens, top5VolumeTokens) {
    try {
      if (!this.discordReady || !this.discordClient) {
        return;
      }

      // Only send summary if there are new tokens or suspicious findings
      if (newTokens === 0 && suspiciousTokens === 0) {
        return;
      }

      const channel = await this.discordClient.channels.fetch(this.ALERT_CHANNEL_ID);
      if (!channel) {
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📊 Monitoring Complete • ${newTokens} New • ${suspiciousTokens} Suspicious`)
        .setDescription(`🌐 **Visit [www.misterada.com](https://www.misterada.com) for more intelligence**\n\n🔍 **${totalTokens} tokens** checked • 🎯 **${analyzedTokens?.length || 0} analyzed**`)
        .setColor(suspiciousTokens > 0 ? 0xFF6600 : 0x00FF00);

      // Show top 5 volume tokens (not new tokens)
      if (top5VolumeTokens && top5VolumeTokens.length > 0) {
        const top5List = top5VolumeTokens.map((token, i) => {
          const price = token.price ? `$${token.price.toFixed(6)}` : 'Unknown';
          const volume = token.volume ? `${token.volume.toLocaleString()} ADA` : 'Unknown';
          return `**${i + 1}.** ${token.ticker || 'Unknown'} • ${price} • ${volume}`;
        }).join('\n');

        embed.addFields({
          name: '🔥 Top 5 Volume Tokens (Last Hour)',
          value: top5List,
          inline: false
        });
      }

      // Show new token analysis with caution warning
      if (analyzedTokens && analyzedTokens.length > 0) {
        const quickSummary = analyzedTokens.slice(0, 3).map(token => {
          const riskEmoji = token.analysis.riskScore <= 3 ? '🟢' : token.analysis.riskScore <= 6 ? '🟡' : '🔴';
          const goldStatus = token.goldStandardAnalysis ? '🏆' : '⏳';
          return `${riskEmoji} **${token.ticker || 'Unknown'}** • Risk: 7/10 (NEW) • Top: ${token.analysis.topHolderPercentage.toFixed(1)}% • Gold: ${goldStatus}`;
        }).join('\n');

        embed.addFields({
          name: '⚠️ New Token Analysis (CAUTION: 7/10 Risk - Brand New!)',
          value: quickSummary + (analyzedTokens.length > 3 ? `\n... and ${analyzedTokens.length - 3} more analyzed` : ''),
          inline: false
        });
      }

      embed.setTimestamp()
        .setFooter({ text: '🏆 Risk Ratings - Mister\'s Gold Standard • Next cycle in 2 hours' });

      await channel.send({ embeds: [embed] });
      console.log(`✅ Sent enhanced monitoring summary to Discord`);

    } catch (error) {
      console.error('❌ Error sending enhanced monitoring summary:', error.message);
    }
  }

  // Send monitoring summary to Discord (legacy method)
  async sendMonitoringSummary(totalTokens, newTokens, suspiciousTokens) {
    return this.sendEnhancedMonitoringSummary(totalTokens, newTokens, suspiciousTokens, []);
  }

  // Send GOLD STANDARD analysis to Discord
  async sendGoldStandardAnalysisToDiscord(analyzedTokens) {
    if (!this.discordReady || analyzedTokens.length === 0) return;

    try {
      const channel = await this.discordClient.channels.fetch(this.ALERT_CHANNEL_ID);
      if (!channel) {
        console.error('❌ Discord channel not found');
        return;
      }

      for (const token of analyzedTokens) {
        try {
          // Create comprehensive embed for GOLD STANDARD analysis
          const embed = new EmbedBuilder()
            .setTitle(`🏆 GOLD STANDARD ANALYSIS: ${token.ticker}`)
            .setColor(0xFFD700) // Gold color
            .setDescription(
              `🌐 **Visit [www.misterada.com](https://www.misterada.com) for more intelligence**\n\n` +
              `**🏆 THE ULTIMATE TOKEN INTELLIGENCE - COMPETITORS CANNOT MATCH THIS!**\n\n` +
              `🎯 **Token:** ${token.ticker}\n` +
              `💰 **Price:** $${token.price || 'N/A'}\n` +
              `📊 **Volume:** ${token.volume ? token.volume.toLocaleString() + ' ADA' : 'N/A'}\n` +
              `💎 **Market Cap:** ${token.mcap ? '$' + token.mcap.toLocaleString() : 'N/A'}\n\n` +
              `🔍 **Analysis Type:** GOLD STANDARD\n` +
              `⏰ **Analyzed:** ${new Date(token.discoveredAt).toLocaleString()}`
            )
            .setFooter({
              text: '🏆 Gold Standard Intelligence - Mister\'s Exclusive Advantage 🏆',
              iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
            })
            .setTimestamp();

          // Add GOLD STANDARD analysis summary if available
          if (token.goldStandardAnalysis && token.goldStandardAnalysis.analysis) {
            const analysis = token.goldStandardAnalysis.analysis;

            // Free token analysis
            if (analysis.freeTokenAnalysis) {
              const freeAnalysis = analysis.freeTokenAnalysis;
              embed.addFields([
                {
                  name: '🎁 FREE TOKEN INTELLIGENCE',
                  value: `**Free Recipients:** ${freeAnalysis.totalFreeRecipients || 0}\n**Free Token %:** ${freeAnalysis.freeTokenPercentage?.toFixed(1) || 0}%\n**Risk Level:** ${freeAnalysis.freeTokenPercentage > 50 ? '🔴 EXTREME' : freeAnalysis.freeTokenPercentage > 20 ? '🟡 MEDIUM' : '🟢 LOW'}`,
                  inline: true
                }
              ]);
            }

            // Acquisition intelligence
            if (analysis.acquisitionIntelligence) {
              const acqAnalysis = analysis.acquisitionIntelligence.summary;
              embed.addFields([
                {
                  name: '💰 ACQUISITION BREAKDOWN',
                  value: `**Real Buyers:** ${acqAnalysis.pureBuyers || 0}\n**Free Recipients:** ${acqAnalysis.pureReceivers || 0}\n**Active Traders:** ${acqAnalysis.traders || 0}`,
                  inline: true
                }
              ]);
            }

            // Insider network detection
            if (analysis.insiderNetworkAnalysis) {
              const insiderAnalysis = analysis.insiderNetworkAnalysis;
              embed.addFields([
                {
                  name: '🕵️ INSIDER NETWORKS',
                  value: `**Networks Detected:** ${insiderAnalysis.totalNetworks || 0}\n**Total Insiders:** ${insiderAnalysis.totalInsiders || 0}\n**Risk Level:** ${insiderAnalysis.totalNetworks > 2 ? '🔴 HIGH' : insiderAnalysis.totalNetworks > 0 ? '🟡 MEDIUM' : '🟢 LOW'}`,
                  inline: true
                }
              ]);
            }

            // Add detailed GOLD STANDARD report
            if (token.goldStandardAnalysis.report) {
              const report = token.goldStandardAnalysis.report.substring(0, 1500); // Longer limit for gold standard
              embed.addFields([
                {
                  name: '🏆 GOLD STANDARD INTELLIGENCE REPORT',
                  value: report + (token.goldStandardAnalysis.report.length > 1500 ? '...' : ''),
                  inline: false
                }
              ]);
            }
          }

          await channel.send({ embeds: [embed] });
          console.log(`✅ Sent GOLD STANDARD analysis for ${token.ticker} to Discord`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
          console.error(`❌ Error sending GOLD STANDARD analysis for ${token.ticker}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Error sending GOLD STANDARD analysis to Discord:', error.message);
    }
  }

  // MASTRA AGENT DISCORD INTEGRATION METHODS

  // Send agent-triggered analysis to Discord
  async sendAgentTriggeredAnalysis(ticker, analysis, source = 'mastra_agent') {
    try {
      if (!this.discordReady || !this.discordClient) {
        console.log('⚠️ Discord not ready, skipping agent analysis notification');
        return;
      }

      const channel = await this.discordClient.channels.fetch(this.ALERT_CHANNEL_ID);
      if (!channel) {
        console.log('❌ Could not find Discord alert channel');
        return;
      }

      const { EmbedBuilder } = require('discord.js');

      // Create embed for agent-triggered analysis
      const embed = new EmbedBuilder()
        .setTitle(`🤖 Agent-Triggered Analysis: ${ticker}`)
        .setDescription(`Analysis requested by Mastra Agent`)
        .setColor(analysis.summary?.riskScore <= 3 ? 0x00FF00 : analysis.summary?.riskScore <= 6 ? 0xFFFF00 : 0xFF0000)
        .setTimestamp()
        .setFooter({
          text: `🤖 Triggered by ${source} • www.misterada.com`,
          iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
        });

      // Add analysis summary
      if (analysis.summary) {
        embed.addFields([
          {
            name: '📊 Risk Assessment',
            value: `**Risk Score:** ${analysis.summary.riskScore}/10\n**Verdict:** ${analysis.summary.verdict}\n**Top Holder:** ${analysis.summary.topHolderPercentage}%`,
            inline: false
          }
        ]);
      }

      // Add formatted analysis if available
      if (analysis.formatted) {
        const formattedText = analysis.formatted.substring(0, 1000);
        embed.addFields([
          {
            name: '🔍 Analysis Details',
            value: formattedText + (analysis.formatted.length > 1000 ? '...' : ''),
            inline: false
          }
        ]);
      }

      await channel.send({ embeds: [embed] });
      console.log(`✅ Sent agent-triggered analysis for ${ticker} to Discord`);

    } catch (error) {
      console.error(`❌ Error sending agent analysis to Discord:`, error.message);
    }
  }

  // Send agent-triggered Gold Standard analysis to Discord
  async sendAgentTriggeredGoldAnalysis(ticker, goldResult, source = 'mastra_agent_gold') {
    try {
      if (!this.discordReady || !this.discordClient) {
        console.log('⚠️ Discord not ready, skipping agent Gold Standard notification');
        return;
      }

      const channel = await this.discordClient.channels.fetch(this.ALERT_CHANNEL_ID);
      if (!channel) {
        console.log('❌ Could not find Discord alert channel');
        return;
      }

      const { EmbedBuilder } = require('discord.js');

      // Create embed for agent-triggered Gold Standard analysis
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Agent-Triggered Gold Standard Analysis: ${ticker}`)
        .setDescription(`Premium Gold Standard analysis requested by Mastra Agent`)
        .setColor(0xFFD700) // Gold color
        .setTimestamp()
        .setFooter({
          text: `🏆 Gold Standard by ${source} • www.misterada.com`,
          iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
        });

      // Add Gold Standard results
      if (goldResult.success && goldResult.analysis) {
        const analysis = goldResult.analysis;

        // Free token analysis
        if (analysis.freeTokenAnalysis) {
          const freeAnalysis = analysis.freeTokenAnalysis;
          embed.addFields([
            {
              name: '🎁 FREE TOKEN INTELLIGENCE',
              value: `**Free Recipients:** ${freeAnalysis.totalFreeRecipients || 0}\n**Free Token %:** ${freeAnalysis.freeTokenPercentage?.toFixed(1) || 0}%\n**Risk Level:** ${freeAnalysis.freeTokenPercentage > 50 ? '🔴 EXTREME' : freeAnalysis.freeTokenPercentage > 20 ? '🟡 MEDIUM' : '🟢 LOW'}`,
              inline: true
            }
          ]);
        }

        // Acquisition intelligence
        if (analysis.acquisitionIntelligence) {
          const acqAnalysis = analysis.acquisitionIntelligence.summary;
          embed.addFields([
            {
              name: '💰 ACQUISITION BREAKDOWN',
              value: `**Real Buyers:** ${acqAnalysis.pureBuyers || 0}\n**Free Recipients:** ${acqAnalysis.pureReceivers || 0}\n**Active Traders:** ${acqAnalysis.traders || 0}`,
              inline: true
            }
          ]);
        }

        // Insider network detection
        if (analysis.insiderNetworkAnalysis) {
          const insiderAnalysis = analysis.insiderNetworkAnalysis;
          embed.addFields([
            {
              name: '🕵️ INSIDER NETWORKS',
              value: `**Networks Detected:** ${insiderAnalysis.totalNetworks || 0}\n**Total Insiders:** ${insiderAnalysis.totalInsiders || 0}\n**Risk Level:** ${insiderAnalysis.totalNetworks > 2 ? '🔴 HIGH' : insiderAnalysis.totalNetworks > 0 ? '🟡 MEDIUM' : '🟢 LOW'}`,
              inline: true
            }
          ]);
        }

        // Add detailed report if available
        if (goldResult.report) {
          const report = goldResult.report.substring(0, 1500);
          embed.addFields([
            {
              name: '🏆 GOLD STANDARD INTELLIGENCE REPORT',
              value: report + (goldResult.report.length > 1500 ? '...' : ''),
              inline: false
            }
          ]);
        }
      } else {
        embed.addFields([
          {
            name: '❌ Analysis Failed',
            value: goldResult.error || 'Gold Standard analysis could not be completed',
            inline: false
          }
        ]);
      }

      await channel.send({ embeds: [embed] });
      console.log(`🏆 Sent agent-triggered Gold Standard analysis for ${ticker} to Discord`);

    } catch (error) {
      console.error(`❌ Error sending agent Gold Standard analysis to Discord:`, error.message);
    }
  }

  // Get monitoring status
  getStatus() {
    return {
      isRunning: this.isRunning,
      knownTokensCount: this.knownTokens.size,
      suspiciousTokensCount: this.suspiciousTokens.length,
      lastCycle: this.lastCycleTime,
      nextCycle: this.isRunning ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null,
      discordReady: this.discordReady,
      alertChannel: this.ALERT_CHANNEL_ID,
      settings: {
        riskThreshold: this.RISK_THRESHOLD,
        concentrationThreshold: this.CONCENTRATION_THRESHOLD,
        newTokenLimit: this.NEW_TOKEN_LIMIT,
        topVolumeLimit: this.TOP_VOLUME_LIMIT
      }
    };
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new AutoMonitor();

  const command = process.argv[2];

  switch (command) {
    case 'start':
      (async () => {
        try {
          await monitor.init();
          await monitor.startMonitoring();

          // Keep process alive
          process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping monitoring...');
            await monitor.stopMonitoring();
            process.exit(0);
          });

        } catch (error) {
          console.error('❌ Failed to start monitoring:', error);
          process.exit(1);
        }
      })();
      break;

    case 'status':
      (async () => {
        try {
          await monitor.init();
          const status = monitor.getStatus();
          console.log('📊 MONITORING STATUS:');
          console.log(`   Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
          console.log(`   Known Tokens: ${status.knownTokensCount}`);
          console.log(`   Suspicious Tokens: ${status.suspiciousTokensCount}`);
          console.log(`   Risk Threshold: ${status.settings.riskThreshold}/10`);
          console.log(`   Concentration Threshold: ${status.settings.concentrationThreshold}%`);

          if (status.nextCycle) {
            console.log(`   Next Cycle: ${status.nextCycle.toLocaleString()}`);
          }

          process.exit(0);
        } catch (error) {
          console.error('❌ Error getting status:', error);
          process.exit(1);
        }
      })();
      break;

    case 'suspicious':
      (async () => {
        try {
          await monitor.init();
          const suspicious = monitor.getSuspiciousTokens(10);

          if (suspicious.length === 0) {
            console.log('✅ No suspicious tokens found');
          } else {
            console.log(`🚨 RECENT SUSPICIOUS TOKENS (${suspicious.length}):`);
            suspicious.forEach((token, i) => {
              console.log(`\n${i + 1}. ${token.ticker || token.name || 'Unknown'}`);
              console.log(`   Volume: ${token.volume?.toLocaleString() || 'Unknown'} ADA`);
              console.log(`   Risk: ${token.analysis.riskScore}/10`);
              console.log(`   Concentration: ${token.analysis.topHolderPercentage.toFixed(2)}%`);
              console.log(`   Discovered: ${new Date(token.discoveredAt).toLocaleString()}`);
              console.log(`   Reasons: ${token.alertReasons.join(', ')}`);
            });
          }

          process.exit(0);
        } catch (error) {
          console.error('❌ Error getting suspicious tokens:', error);
          process.exit(1);
        }
      })();
      break;

    default:
      console.log('🤖 Auto Monitor - Automated Token Risk Detection');
      console.log('\nUsage: node auto-monitor.js [command]');
      console.log('\nCommands:');
      console.log('  start      - Start automated monitoring (every 2 hours)');
      console.log('  status     - Show monitoring status');
      console.log('  suspicious - Show recent suspicious tokens');
      console.log('\nExample: node auto-monitor.js start');
      process.exit(0);
  }
}

module.exports = AutoMonitor;
