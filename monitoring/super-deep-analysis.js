const TapToolsService = require('./taptools-service');
const TokenDatabase = require('./token-database');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class SuperDeepAnalysis {
  constructor() {
    this.tapTools = new TapToolsService();
    this.tokenDb = new TokenDatabase();
    this.initialized = false;

    // Blockfrost configuration
    this.BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY || 'mainnetKDR7gGfvHy85Mqr4nYtfjoXq7fX8R1Bu';
    this.BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

    // ADA Handle policy ID
    this.HANDLE_POLICY_ID = 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';

    // Blockfrost API call tracking
    this.blockfrostCallCounter = {
      total: 0,
      byEndpoint: new Map(),
      sessionStart: Date.now()
    };
  }

  async init() {
    if (!this.initialized) {
      await this.tapTools.init();
      await this.tokenDb.init();
      this.initialized = true;
    }
  }

  // Track Blockfrost API call
  trackBlockfrostCall(endpoint) {
    this.blockfrostCallCounter.total++;
    const count = this.blockfrostCallCounter.byEndpoint.get(endpoint) || 0;
    this.blockfrostCallCounter.byEndpoint.set(endpoint, count + 1);
  }

  // Get Blockfrost API call statistics
  getBlockfrostCallStats() {
    const sessionDuration = Math.round((Date.now() - this.blockfrostCallCounter.sessionStart) / 1000 / 60); // minutes

    return {
      total: this.blockfrostCallCounter.total,
      sessionDuration: `${sessionDuration} minutes`,
      callsPerMinute: sessionDuration > 0 ? (this.blockfrostCallCounter.total / sessionDuration).toFixed(2) : 0,
      byEndpoint: Object.fromEntries(this.blockfrostCallCounter.byEndpoint),
      topEndpoints: Array.from(this.blockfrostCallCounter.byEndpoint.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([endpoint, count]) => ({ endpoint, count }))
    };
  }

  // Print Blockfrost API call summary
  printBlockfrostCallSummary() {
    const stats = this.getBlockfrostCallStats();
    console.log('\n📊 BLOCKFROST API CALL SUMMARY:');
    console.log(`🔢 Total calls: ${stats.total}`);
    console.log(`⏱️ Session duration: ${stats.sessionDuration}`);
    console.log(`📈 Calls per minute: ${stats.callsPerMinute}`);
    console.log(`🏆 Top endpoints:`);
    stats.topEndpoints.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.endpoint}: ${item.count} calls`);
    });
    console.log('');
  }

  // Main super deep analysis function
  async performSuperDeepAnalysis(unit, ticker = '') {
    console.log(`🕵️ STARTING SUPER DEEP ANALYSIS FOR: ${ticker || unit.substring(0, 20)}...`);

    try {
      await this.init();

      const analysis = {
        basicInfo: {},
        holderAnalysis: {},
        clusterAnalysis: {},
        stakeAnalysis: {},
        adaHandles: {},
        liquidityAnalysis: {},
        riskAssessment: {},
        suspiciousPatterns: [],
        timestamp: new Date().toISOString()
      };

      // 1. Basic token information
      console.log('\n📊 PHASE 1: Basic Token Information');
      analysis.basicInfo = await this.getBasicTokenInfo(unit, ticker);

      // 2. Comprehensive holder analysis (top 100)
      console.log('\n👥 PHASE 2: Comprehensive Holder Analysis');
      analysis.holderAnalysis = await this.getComprehensiveHolderAnalysis(unit);

      // 3. Stake address clustering
      console.log('\n🔗 PHASE 3: Stake Address Clustering');
      analysis.clusterAnalysis = await this.performClusterAnalysis(analysis.holderAnalysis.holders);

      // 4. Detailed stake analysis with connected wallets
      console.log('\n🕵️ PHASE 4: Detailed Stake Analysis');
      analysis.stakeAnalysis = await this.performDetailedStakeAnalysis(analysis.clusterAnalysis.clusters, unit);

      // 5. ADA Handle resolution for top holders
      console.log('\n🏷️ PHASE 5: ADA Handle Resolution');
      analysis.adaHandles = await this.resolveAdaHandlesForHolders(analysis.holderAnalysis.holders);

      // 6. Liquidity and market analysis
      console.log('\n💧 PHASE 6: Liquidity and Market Analysis');
      analysis.liquidityAnalysis = await this.performLiquidityAnalysis(unit);

      // 7. Risk assessment and pattern detection
      console.log('\n🚨 PHASE 7: Risk Assessment and Pattern Detection');
      analysis.riskAssessment = await this.performRiskAssessment(analysis);

      // 8. Generate comprehensive report
      console.log('\n📋 PHASE 8: Generating Comprehensive Report');
      const report = this.generateComprehensiveReport(analysis, ticker);

      // 9. Print API call summary
      this.printBlockfrostCallSummary();

      console.log('\n✅ SUPER DEEP ANALYSIS COMPLETE!');
      return { analysis, report };

    } catch (error) {
      console.error('❌ Error in super deep analysis:', error.message);
      throw error;
    }
  }

  // Phase 1: Basic token information
  async getBasicTokenInfo(unit, ticker) {
    const [links, mcapData, pools] = await Promise.all([
      this.tapTools.getTokenLinks(unit).catch(() => null),
      this.tapTools.getTokenMarketCap(unit).catch(() => null),
      this.tapTools.getTokenLiquidityPools(unit).catch(() => [])
    ]);

    // Calculate market cap if not provided
    let marketCap = mcapData?.marketCap;
    if (!marketCap && mcapData?.price && mcapData?.circSupply) {
      marketCap = mcapData.price * mcapData.circSupply;
    }

    return {
      unit,
      ticker: ticker || mcapData?.ticker,
      name: mcapData?.name,
      price: mcapData?.price,
      marketCap: marketCap,
      circulatingSupply: mcapData?.circSupply,
      socialLinks: links,
      liquidityPools: pools?.length || 0,
      policyId: unit.substring(0, 56),
      assetNameHex: unit.substring(56)
    };
  }

  // Phase 2: Comprehensive holder analysis
  async getComprehensiveHolderAnalysis(unit) {
    const holders = await this.tapTools.getTopTokenHolders(unit, 1, 100);

    if (!holders || holders.length === 0) {
      return { holders: [], totalSupply: 0, holderCount: 0 };
    }

    const totalSupply = holders.reduce((sum, h) => sum + h.amount, 0);

    // Filter out liquidity pools (holders with >10% are likely pools)
    const filteredHolders = holders.filter((holder, index) => {
      const percentage = totalSupply > 0 ? (holder.amount / totalSupply) * 100 : 0;
      if (percentage > 10) {
        console.log(`🚫 Excluding likely liquidity pool: ${holder.address.substring(0, 12)}... (${percentage.toFixed(2)}%)`);
        return false;
      }
      return true;
    });

    console.log(`👥 Found ${filteredHolders.length} real holders after excluding ${holders.length - filteredHolders.length} liquidity pools`);

    const enrichedHolders = filteredHolders.map((holder, index) => ({
      ...holder,
      rank: index + 1,
      percentage: totalSupply > 0 ? (holder.amount / totalSupply) * 100 : 0,
      isWhale: (holder.amount / totalSupply) * 100 > 3, // Changed from 5% to 3%
      isMajorHolder: (holder.amount / totalSupply) * 100 > 1
    }));

    return {
      holders: enrichedHolders,
      totalSupply,
      holderCount: filteredHolders.length, // Real holders count
      originalHolderCount: holders.length, // Including pools
      excludedPools: holders.length - filteredHolders.length,
      whaleCount: enrichedHolders.filter(h => h.isWhale).length,
      majorHolderCount: enrichedHolders.filter(h => h.isMajorHolder).length,
      topHolderPercentage: enrichedHolders[0]?.percentage || 0,
      top5Percentage: enrichedHolders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0),
      top10Percentage: enrichedHolders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0)
    };
  }

  // Phase 3: Stake address clustering
  async performClusterAnalysis(holders) {
    console.log(`🔍 Analyzing clusters from ${holders.length} holders...`);

    // Group holders by stake address (TapTools already provides stake addresses)
    const stakeGroups = {};

    holders.forEach(holder => {
      const stakeAddr = holder.address; // TapTools provides stake addresses
      if (!stakeGroups[stakeAddr]) {
        stakeGroups[stakeAddr] = [];
      }
      stakeGroups[stakeAddr].push(holder);
    });

    // Identify clusters (multiple wallets under same stake)
    const clusters = Object.entries(stakeGroups).map(([stakeAddr, wallets]) => ({
      stakeAddress: stakeAddr,
      walletCount: wallets.length,
      totalHoldings: wallets.reduce((sum, w) => sum + w.amount, 0),
      totalPercentage: wallets.reduce((sum, w) => sum + w.percentage, 0),
      wallets: wallets,
      isSuspicious: wallets.length > 1 || wallets[0]?.percentage > 3
    }));

    // Sort by total percentage (highest first)
    clusters.sort((a, b) => b.totalPercentage - a.totalPercentage);

    const suspiciousClusters = clusters.filter(c => c.isSuspicious);

    return {
      clusters,
      totalClusters: clusters.length,
      suspiciousClusters: suspiciousClusters.length,
      topClusterPercentage: clusters[0]?.totalPercentage || 0,
      clustersOver3Percent: clusters.filter(c => c.totalPercentage > 3).length,
      clustersOver5Percent: clusters.filter(c => c.totalPercentage > 5).length,
      clustersOver10Percent: clusters.filter(c => c.totalPercentage > 10).length
    };
  }

  // Phase 4: Detailed stake analysis with connected wallets
  async performDetailedStakeAnalysis(clusters, unit) {
    console.log(`🕵️ Performing detailed analysis on top ${Math.min(clusters.length, 25)} clusters...`);

    const detailedAnalysis = [];
    const topClusters = clusters.slice(0, 25); // Analyze top 25 clusters

    for (const cluster of topClusters) {
      console.log(`🔍 Analyzing cluster: ${cluster.stakeAddress.substring(0, 20)}... (${cluster.totalPercentage.toFixed(2)}%)`);

      try {
        // Get connected wallets for this stake address
        const connectedWallets = await this.getWalletsFromStake(cluster.stakeAddress);

        // Get portfolio and trading data
        const [portfolio, trades] = await Promise.all([
          this.tapTools.getWalletPortfolio(cluster.stakeAddress).catch(() => null),
          this.tapTools.getWalletTrades(cluster.stakeAddress, unit, 1, 50).catch(() => [])
        ]);

        const analysis = {
          ...cluster,
          connectedWallets: connectedWallets.length,
          walletAddresses: connectedWallets,
          portfolio,
          recentTrades: trades.length,
          suspiciousFlags: []
        };

        // Flag suspicious patterns
        if (connectedWallets.length > 10) {
          analysis.suspiciousFlags.push('MANY_CONNECTED_WALLETS');
        }
        if (cluster.totalPercentage > 25) {
          analysis.suspiciousFlags.push('DOMINANT_STAKE');
        }
        if (trades.length > 20) {
          analysis.suspiciousFlags.push('HIGH_TRADING_ACTIVITY');
        }
        if (portfolio && portfolio.numFTs <= 3) {
          analysis.suspiciousFlags.push('LIMITED_TOKEN_DIVERSITY');
        }

        detailedAnalysis.push(analysis);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error analyzing stake ${cluster.stakeAddress.substring(0, 12)}:`, error.message);
        detailedAnalysis.push({
          ...cluster,
          error: error.message
        });
      }
    }

    return {
      detailedClusters: detailedAnalysis,
      totalSuspiciousFlags: detailedAnalysis.reduce((sum, c) => sum + (c.suspiciousFlags?.length || 0), 0),
      highRiskClusters: detailedAnalysis.filter(c => (c.suspiciousFlags?.length || 0) >= 2).length
    };
  }

  // Phase 5: Enhanced ADA Handle resolution with stake clustering
  async resolveAdaHandlesForHolders(holders) {
    console.log(`🏷️ Resolving ADA handles for all ${holders.length} holders...`);

    const topHolders = holders; // Resolve for all holders
    const handles = {};
    const stakeHandleGroups = {}; // Group handles by stake address

    for (const holder of topHolders) {
      try {
        // Get all connected wallets for this stake address
        const connectedWallets = await this.getWalletsFromStake(holder.address);

        // Get all ADA handles for this stake address by checking connected payment addresses
        const foundHandles = await this.getStakeAddressHandles(holder.address);

        if (foundHandles.length > 0) {
          console.log(`🏷️ Found ${foundHandles.length} handles for rank ${holder.rank} (${holder.percentage.toFixed(2)}%)`);

          foundHandles.forEach(handleInfo => {
            handles[handleInfo.paymentAddress] = handleInfo.handle;
            console.log(`🏷️ Found handle: ${handleInfo.handle} for rank ${holder.rank}`);
          });

          // Group handles by stake address
          stakeHandleGroups[holder.address] = {
            stakeAddress: holder.address,
            holderRank: holder.rank,
            holderPercentage: holder.percentage,
            handles: foundHandles.map(h => ({ address: h.paymentAddress, handle: h.handle })),
            handleCount: foundHandles.length
          };
        }

        // Rate limiting between holders
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error getting handles for ${holder.address.substring(0, 12)}:`, error.message);
      }
    }

    return {
      resolvedHandles: Object.keys(handles).length,
      handles,
      stakeHandleGroups, // NEW: Grouped by stake address
      topHoldersWithHandles: topHolders.filter(h => handles[h.address]).length,
      stakesWithHandles: Object.keys(stakeHandleGroups).length // NEW: Count of stakes with handles
    };
  }

  // Phase 6: Liquidity analysis
  async performLiquidityAnalysis(unit) {
    const pools = await this.tapTools.getTokenLiquidityPools(unit);

    if (!pools || pools.length === 0) {
      return {
        hasLiquidity: false,
        riskLevel: 'EXTREME',
        totalAdaLocked: 0,
        poolCount: 0
      };
    }

    let totalAdaLocked = 0;
    const exchanges = new Set();

    pools.forEach(pool => {
      exchanges.add(pool.exchange);
      if (pool.tokenATicker === 'ADA') {
        totalAdaLocked += pool.tokenALocked;
      } else if (pool.tokenBTicker === 'ADA') {
        totalAdaLocked += pool.tokenBLocked;
      }
    });

    let riskLevel = 'HIGH';
    if (totalAdaLocked >= 1000000) riskLevel = 'LOW';
    else if (totalAdaLocked >= 100000) riskLevel = 'MEDIUM';

    return {
      hasLiquidity: true,
      riskLevel,
      totalAdaLocked,
      poolCount: pools.length,
      exchanges: Array.from(exchanges),
      pools
    };
  }

  // Phase 7: Risk assessment
  async performRiskAssessment(analysis) {
    let riskScore = 0;
    const riskFactors = [];

    // Debug logging for concentration
    console.log(`🔍 DEBUG: Top holder percentage: ${analysis.holderAnalysis.topHolderPercentage}%`);

    // Holder concentration risk
    if (analysis.holderAnalysis.topHolderPercentage > 50) {
      riskScore += 4;
      riskFactors.push('EXTREME_CONCENTRATION');
      console.log(`🔍 DEBUG: Added 4 points for EXTREME_CONCENTRATION (${analysis.holderAnalysis.topHolderPercentage}%)`);
    } else if (analysis.holderAnalysis.topHolderPercentage > 25) {
      riskScore += 3;
      riskFactors.push('HIGH_CONCENTRATION');
      console.log(`🔍 DEBUG: Added 3 points for HIGH_CONCENTRATION (${analysis.holderAnalysis.topHolderPercentage}%)`);
    } else if (analysis.holderAnalysis.topHolderPercentage > 10) {
      riskScore += 2;
      riskFactors.push('MODERATE_CONCENTRATION');
      console.log(`🔍 DEBUG: Added 2 points for MODERATE_CONCENTRATION (${analysis.holderAnalysis.topHolderPercentage}%)`);
    } else {
      console.log(`🔍 DEBUG: No concentration risk added (${analysis.holderAnalysis.topHolderPercentage}%)`);
    }

    // Cluster risk
    if (analysis.clusterAnalysis.clustersOver10Percent > 3) {
      riskScore += 2;
      riskFactors.push('MULTIPLE_LARGE_CLUSTERS');
    }

    // Liquidity risk
    if (!analysis.liquidityAnalysis.hasLiquidity) {
      riskScore += 3;
      riskFactors.push('NO_LIQUIDITY');
    } else if (analysis.liquidityAnalysis.riskLevel === 'HIGH') {
      riskScore += 1;
      riskFactors.push('LOW_LIQUIDITY');
    }

    // Social verification
    if (!analysis.basicInfo.socialLinks || Object.keys(analysis.basicInfo.socialLinks).length === 0) {
      riskScore += 1;
      riskFactors.push('NO_SOCIAL_PRESENCE');
    }

    // Suspicious cluster patterns
    if (analysis.stakeAnalysis.highRiskClusters > 0) {
      riskScore += 2;
      riskFactors.push('SUSPICIOUS_CLUSTERS');
    }

    // Cap at 10
    riskScore = Math.min(riskScore, 10);

    let verdict = 'SAFE';
    if (riskScore >= 8) verdict = 'EXTREME_RISK';
    else if (riskScore >= 6) verdict = 'HIGH_RISK';
    else if (riskScore >= 4) verdict = 'MODERATE_RISK';
    else if (riskScore >= 2) verdict = 'LOW_RISK';

    console.log(`🔍 DEBUG: Final risk score: ${riskScore}/10 (${verdict})`);
    console.log(`🔍 DEBUG: Risk factors: ${riskFactors.join(', ')}`);

    return {
      riskScore,
      verdict,
      riskFactors,
      isHighRisk: riskScore >= 7,
      recommendAction: riskScore >= 7 ? 'AVOID' : riskScore >= 4 ? 'CAUTION' : 'MONITOR'
    };
  }

  // Helper: Get wallets from stake address
  async getWalletsFromStake(stakeAddress) {
    try {
      this.trackBlockfrostCall('/accounts/addresses');
      const response = await axios.get(`${this.BLOCKFROST_BASE_URL}/accounts/${stakeAddress}/addresses`, {
        headers: { 'project_id': this.BLOCKFROST_API_KEY },
        timeout: 30000
      });

      return response.data || [];
    } catch (error) {
      console.error(`❌ Error getting wallets for stake:`, error.message);
      return [];
    }
  }

  // Helper: Get connected payment addresses for a stake address
  async getConnectedAddresses(stakeAddress) {
    try {
      this.trackBlockfrostCall('/accounts/addresses');
      const response = await axios.get(`${this.BLOCKFROST_BASE_URL}/accounts/${stakeAddress}/addresses`, {
        headers: { 'project_id': this.BLOCKFROST_API_KEY },
        timeout: 30000
      });

      if (response.data && Array.isArray(response.data)) {
        return response.data.map(addr => addr.address);
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  // Helper: Get ADA handle for a payment address
  async getAdaHandle(address) {
    try {
      this.trackBlockfrostCall('/addresses');
      const response = await axios.get(`${this.BLOCKFROST_BASE_URL}/addresses/${address}`, {
        headers: { 'project_id': this.BLOCKFROST_API_KEY },
        timeout: 30000
      });

      if (response.data && response.data.amount) {
        const handleAssets = response.data.amount.filter(asset =>
          asset.unit && asset.unit.includes(this.HANDLE_POLICY_ID)
        );

        if (handleAssets.length > 0) {
          const handles = [];
          handleAssets.forEach(asset => {
            try {
              const handleUnit = asset.unit;
              const hexName = handleUnit.replace(this.HANDLE_POLICY_ID, '');
              const rawUtf8 = Buffer.from(hexName, 'hex').toString('utf8');
              const cleanedName = rawUtf8.replace(/[^\x20-\x7E]/g, '');
              handles.push(`$${cleanedName}`);
            } catch (error) {
              // Skip invalid handles
            }
          });
          return handles.length > 0 ? handles : null;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // Helper: Get all ADA handles for a stake address by checking connected payment addresses
  async getStakeAddressHandles(stakeAddress) {
    try {
      // First get all connected payment addresses
      const paymentAddresses = await this.getConnectedAddresses(stakeAddress);

      if (paymentAddresses.length === 0) {
        return [];
      }

      console.log(`🔍 Checking ${paymentAddresses.length} payment addresses for stake ${stakeAddress.substring(0, 12)}...`);

      const allHandles = [];

      // Check each payment address for handles
      for (const paymentAddr of paymentAddresses) {
        try {
          const handles = await this.getAdaHandle(paymentAddr);
          if (handles && Array.isArray(handles)) {
            handles.forEach(handle => {
              allHandles.push({
                handle: handle,
                paymentAddress: paymentAddr
              });
            });
          } else if (handles) {
            allHandles.push({
              handle: handles,
              paymentAddress: paymentAddr
            });
          }

          // Rate limiting between payment address checks
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          // Continue with next address
        }
      }

      return allHandles;
    } catch (error) {
      return [];
    }
  }

  // Generate comprehensive report
  generateComprehensiveReport(analysis, ticker) {
    const { basicInfo, holderAnalysis, clusterAnalysis, stakeAnalysis, adaHandles, liquidityAnalysis, riskAssessment } = analysis;

    return {
      title: `🕵️ SUPER DEEP ANALYSIS: ${ticker || basicInfo.ticker || 'Unknown Token'}`,
      summary: {
        riskScore: riskAssessment.riskScore,
        verdict: riskAssessment.verdict,
        recommendation: riskAssessment.recommendAction,
        topHolderPercentage: holderAnalysis.topHolderPercentage,
        clusterCount: clusterAnalysis.totalClusters,
        suspiciousClusters: clusterAnalysis.suspiciousClusters,
        liquidityRisk: liquidityAnalysis.riskLevel
      },
      details: {
        basicInfo,
        holderAnalysis,
        clusterAnalysis,
        stakeAnalysis,
        adaHandles,
        liquidityAnalysis,
        riskAssessment
      },
      timestamp: analysis.timestamp
    };
  }
}

module.exports = SuperDeepAnalysis;
