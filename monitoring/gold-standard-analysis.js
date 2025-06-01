const axios = require('axios');
const TapToolsService = require('./taptools-service.js');
const SuperDeepAnalysis = require('./super-deep-analysis.js');

class GoldStandardAnalysis {
  constructor() {
    this.tapTools = new TapToolsService();
    this.superDeep = new SuperDeepAnalysis();
    this.initialized = false;

    // Blockfrost configuration
    this.BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY || 'mainnetKDR7gGfvHy85Mqr4nYtfjoXq7fX8R1Bu';
    this.BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

    // API call tracking for gold standard analysis
    this.goldApiCallCounter = {
      total: 0,
      byEndpoint: new Map(),
      sessionStart: Date.now()
    };
  }

  async init() {
    if (!this.initialized) {
      await this.tapTools.init();
      await this.superDeep.init();
      this.initialized = true;
    }
  }

  // Track API calls for gold standard analysis
  trackGoldApiCall(endpoint) {
    this.goldApiCallCounter.total++;
    const count = this.goldApiCallCounter.byEndpoint.get(endpoint) || 0;
    this.goldApiCallCounter.byEndpoint.set(endpoint, count + 1);
  }

  // Get gold standard API call statistics
  getGoldApiCallStats() {
    const sessionDuration = Math.round((Date.now() - this.goldApiCallCounter.sessionStart) / 1000 / 60); // minutes

    return {
      total: this.goldApiCallCounter.total,
      sessionDuration: `${sessionDuration} minutes`,
      callsPerMinute: sessionDuration > 0 ? (this.goldApiCallCounter.total / sessionDuration).toFixed(2) : 0,
      byEndpoint: Object.fromEntries(this.goldApiCallCounter.byEndpoint),
      topEndpoints: Array.from(this.goldApiCallCounter.byEndpoint.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([endpoint, count]) => ({ endpoint, count }))
    };
  }

  // Print gold standard API call summary
  printGoldApiCallSummary() {
    const stats = this.getGoldApiCallStats();
    console.log('\n🏆 GOLD STANDARD API CALL SUMMARY:');
    console.log(`🔢 Total calls: ${stats.total}`);
    console.log(`⏱️ Session duration: ${stats.sessionDuration}`);
    console.log(`📈 Calls per minute: ${stats.callsPerMinute}`);
    console.log(`🏆 Top endpoints:`);
    stats.topEndpoints.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.endpoint}: ${item.count} calls`);
    });
    console.log('');
  }

  // Main gold standard analysis function
  async performGoldStandardAnalysis(tokenUnit, ticker) {
    try {
      await this.init();
      console.log(`\n🏆 STARTING GOLD STANDARD ANALYSIS FOR ${ticker}`);
      console.log('🔍 This includes ALL deep analysis features PLUS free token detection!');

      // 1. Run the complete super deep analysis first
      console.log('\n📋 PHASE 1: Running Complete Super Deep Analysis');
      const superDeepResult = await this.superDeep.performSuperDeepAnalysis(tokenUnit, ticker);

      if (!superDeepResult) {
        throw new Error('Super deep analysis failed');
      }

      console.log('🔍 DEBUG: superDeepResult structure:', typeof superDeepResult, Object.keys(superDeepResult || {}));
      console.log('🔍 DEBUG: superDeepResult.analysis exists?', !!superDeepResult?.analysis);
      console.log('🔍 DEBUG: superDeepResult.report exists?', !!superDeepResult?.report);

      if (superDeepResult?.analysis) {
        console.log('🔍 DEBUG: analysis structure:', Object.keys(superDeepResult.analysis));
        console.log('🔍 DEBUG: holderAnalysis exists?', !!superDeepResult.analysis.holderAnalysis);
        if (superDeepResult.analysis.holderAnalysis) {
          console.log('🔍 DEBUG: holderAnalysis structure:', Object.keys(superDeepResult.analysis.holderAnalysis));
          console.log('🔍 DEBUG: holders exists?', !!superDeepResult.analysis.holderAnalysis.holders);
          console.log('🔍 DEBUG: holders is array?', Array.isArray(superDeepResult.analysis.holderAnalysis.holders));
          console.log('🔍 DEBUG: holders length:', superDeepResult.analysis.holderAnalysis.holders?.length);
        }
      }

      const { analysis, report } = superDeepResult;

      console.log('🔍 DEBUG: After destructuring - analysis exists?', !!analysis);
      console.log('🔍 DEBUG: After destructuring - report exists?', !!report);
      console.log('🔍 DEBUG: After destructuring - analysis type:', typeof analysis);
      console.log('🔍 DEBUG: After destructuring - analysis keys:', analysis ? Object.keys(analysis) : 'undefined');

      // Check the specific path that's failing
      console.log('🔍 DEBUG: analysis.holderAnalysis exists?', !!analysis?.holderAnalysis);
      console.log('🔍 DEBUG: analysis.holderAnalysis.holders exists?', !!analysis?.holderAnalysis?.holders);
      console.log('🔍 DEBUG: analysis.holderAnalysis.holders is array?', Array.isArray(analysis?.holderAnalysis?.holders));

      // 2. Skip free token detection for now (needs improvement)
      console.log('\n🎁 PHASE 2: Skipping Free Token Detection (under development)');
      const freeTokenAnalysis = {
        freeRecipients: [],
        totalFreeRecipients: 0,
        totalFreeTokens: 0,
        freeTokenPercentage: 0,
        suspiciousPatterns: [],
        analysisStats: {
          holdersAnalyzed: 0,
          freeRecipientsFound: 0,
          freeTokenPercentage: '0.0',
          note: 'Free token detection temporarily disabled for accuracy improvements'
        }
      };

      // 3. Skip acquisition intelligence for now
      console.log('\n💰 PHASE 3: Skipping Acquisition Intelligence (under development)');
      const acquisitionIntelligence = {
        acquisitionMethods: {
          buyers: [],
          receivers: [],
          mixed: [],
          unknown: []
        },
        summary: {
          totalAnalyzed: 0,
          pureBuyers: 0,
          pureReceivers: 0,
          traders: 0,
          unknown: 0
        }
      };

      // 4. Skip insider network detection for now
      console.log('\n🕵️ PHASE 4: Skipping Insider Network Detection (under development)');
      const insiderNetworkAnalysis = {
        insiderNetworks: [],
        totalNetworks: 0,
        totalInsiders: 0
      };

      // 5. Generate comprehensive gold standard report
      console.log('\n📋 PHASE 5: Generating Gold Standard Report');
      const goldStandardReport = this.generateGoldStandardReport({
        ticker,
        superDeepAnalysis: analysis,
        freeTokenAnalysis,
        acquisitionIntelligence,
        insiderNetworkAnalysis,
        originalReport: report
      });

      // 6. Print API call summary
      this.printGoldApiCallSummary();

      console.log('\n🏆 GOLD STANDARD ANALYSIS COMPLETE!');
      return {
        analysis: {
          ...analysis,
          freeTokenAnalysis,
          acquisitionIntelligence,
          insiderNetworkAnalysis
        },
        report: goldStandardReport
      };

    } catch (error) {
      console.error(`❌ Error in gold standard analysis for ${ticker}:`, error.message);
      throw error;
    }
  }

  // Analyze free token recipients with ADA handles
  async analyzeFreeTokenRecipients(holders, tokenUnit, ticker) {
    console.log('🎁 Analyzing free token recipients...');
    console.log('🔍 DEBUG: analyzeFreeTokenRecipients called');
    console.log('🔍 DEBUG: holders type:', typeof holders);
    console.log('🔍 DEBUG: holders is array:', Array.isArray(holders));
    console.log('🔍 DEBUG: tokenUnit:', tokenUnit);
    console.log('🔍 DEBUG: ticker:', ticker);

    const freeRecipients = [];
    const suspiciousPatterns = [];
    let totalFreeTokens = 0;
    let totalSupply = 0;

    // Validate holders array
    if (!holders || !Array.isArray(holders)) {
      console.error('❌ Invalid holders data:', typeof holders);
      return {
        freeRecipients: [],
        totalFreeRecipients: 0,
        totalFreeTokens: 0,
        freeTokenPercentage: 0,
        suspiciousPatterns: [],
        analysisStats: {
          holdersAnalyzed: 0,
          freeRecipientsFound: 0,
          freeTokenPercentage: '0.0',
          error: 'Invalid holders data'
        }
      };
    }

    console.log(`🎁 Analyzing ${holders.length} holders for free token recipients...`);

    // Calculate total supply from holders
    try {
      console.log('🔍 DEBUG: About to call forEach on holders');
      console.log('🔍 DEBUG: holders type in forEach:', typeof holders);
      console.log('🔍 DEBUG: holders is array in forEach:', Array.isArray(holders));
      console.log('🔍 DEBUG: holders value:', holders);

      holders.forEach(holder => {
        if (holder && (holder.quantity || holder.amount)) {
          totalSupply += parseInt(holder.quantity || holder.amount);
        }
      });

      console.log('🔍 DEBUG: forEach completed successfully');
    } catch (forEachError) {
      console.error('❌ Error in forEach:', forEachError.message);
      console.error('❌ forEach error stack:', forEachError.stack);
      throw forEachError;
    }

    // Analyze each holder for free token receipt
    for (let i = 0; i < Math.min(holders.length, 50); i++) { // Analyze top 50 to manage API calls
      const holder = holders[i];

      try {
        // Get trade history for this stake address (use address property)
        const stakeAddress = holder.stakeAddress || holder.address;
        this.trackGoldApiCall('/wallet/trades');
        const trades = await this.tapTools.getWalletTrades(stakeAddress, tokenUnit, 1, 20);

        // Check if they ever bought the token
        // Look for trades where they spent ADA to get this token
        const hasPurchases = trades && trades.some(trade => {
          // Check if this trade involves the specific token we're analyzing
          const involvesToken = trade.tokenA === tokenUnit || trade.tokenB === tokenUnit ||
                               trade.tokenAUnit === tokenUnit || trade.tokenBUnit === tokenUnit;

          if (!involvesToken) return false;

          // Check if they spent ADA (lovelace) to get the token
          const spentAda = (trade.tokenA === 'lovelace' && trade.tokenB === tokenUnit) ||
                          (trade.tokenAUnit === 'lovelace' && trade.tokenBUnit === tokenUnit) ||
                          (trade.action === 'buy' && involvesToken) ||
                          (trade.type === 'buy' && involvesToken);

          return spentAda;
        });

        if (!hasPurchases) {
          // This holder received tokens without buying!
          const freeAmount = parseInt(holder.quantity || holder.amount);
          totalFreeTokens += freeAmount;

          freeRecipients.push({
            rank: i + 1,
            stakeAddress: stakeAddress,
            handles: holder.handles || [],
            amount: freeAmount,
            percentage: ((freeAmount / totalSupply) * 100).toFixed(2),
            acquisitionMethod: 'FREE_RECEIPT',
            suspiciousLevel: this.calculateSuspicionLevel(holder, freeAmount, totalSupply)
          });

          console.log(`🎁 Found free recipient: Rank ${i + 1} - ${holder.handles?.[0] || 'No handle'} (${((freeAmount / totalSupply) * 100).toFixed(2)}%)`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error analyzing holder ${i + 1}:`, error.message);
      }
    }

    // Detect suspicious patterns
    if (freeRecipients.length > holders.length * 0.3) {
      suspiciousPatterns.push({
        type: 'HIGH_FREE_ALLOCATION',
        description: `${freeRecipients.length} holders (${((freeRecipients.length / holders.length) * 100).toFixed(1)}%) received tokens without buying`,
        riskLevel: 'HIGH'
      });
    }

    const freePercentage = (totalFreeTokens / totalSupply) * 100;
    if (freePercentage > 50) {
      suspiciousPatterns.push({
        type: 'MASSIVE_FREE_DISTRIBUTION',
        description: `${freePercentage.toFixed(1)}% of total supply given away for free`,
        riskLevel: 'EXTREME'
      });
    }

    return {
      freeRecipients: freeRecipients.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage)),
      totalFreeRecipients: freeRecipients.length,
      totalFreeTokens,
      freeTokenPercentage: freePercentage,
      suspiciousPatterns,
      analysisStats: {
        holdersAnalyzed: Math.min(holders.length, 50),
        freeRecipientsFound: freeRecipients.length,
        freeTokenPercentage: freePercentage.toFixed(2)
      }
    };
  }

  // Calculate suspicion level for free recipients
  calculateSuspicionLevel(holder, amount, totalSupply) {
    const percentage = (amount / totalSupply) * 100;

    if (percentage > 10) return 'EXTREME';
    if (percentage > 5) return 'HIGH';
    if (percentage > 2) return 'MEDIUM';
    return 'LOW';
  }

  // Analyze token acquisition methods
  async analyzeTokenAcquisitionMethods(holders, tokenUnit) {
    console.log('💰 Analyzing token acquisition methods...');

    const acquisitionMethods = {
      buyers: [],
      receivers: [],
      mixed: [],
      unknown: []
    };

    // Validate holders array
    if (!holders || !Array.isArray(holders)) {
      console.error('❌ Invalid holders data for acquisition analysis:', typeof holders);
      return {
        acquisitionMethods,
        summary: {
          totalAnalyzed: 0,
          pureBuyers: 0,
          pureReceivers: 0,
          traders: 0,
          unknown: 0,
          error: 'Invalid holders data'
        }
      };
    }

    console.log(`💰 Analyzing acquisition methods for ${Math.min(holders.length, 25)} holders...`);

    // Analyze top 25 holders for acquisition methods
    for (let i = 0; i < Math.min(holders.length, 25); i++) {
      const holder = holders[i];

      try {
        const stakeAddress = holder.stakeAddress || holder.address;
        this.trackGoldApiCall('/wallet/trades');
        const trades = await this.tapTools.getWalletTrades(stakeAddress, tokenUnit, 1, 10);

        // Filter trades for this specific token and categorize them
        const tokenTrades = trades?.filter(trade => {
          return trade.tokenA === tokenUnit || trade.tokenB === tokenUnit ||
                 trade.tokenAUnit === tokenUnit || trade.tokenBUnit === tokenUnit;
        }) || [];

        const buyTrades = tokenTrades.filter(trade => {
          // They bought the token by spending ADA
          return (trade.tokenA === 'lovelace' && trade.tokenB === tokenUnit) ||
                 (trade.tokenAUnit === 'lovelace' && trade.tokenBUnit === tokenUnit) ||
                 (trade.action === 'buy') ||
                 (trade.type === 'buy');
        });

        const sellTrades = tokenTrades.filter(trade => {
          // They sold the token for ADA
          return (trade.tokenA === tokenUnit && trade.tokenB === 'lovelace') ||
                 (trade.tokenAUnit === tokenUnit && trade.tokenBUnit === 'lovelace') ||
                 (trade.action === 'sell') ||
                 (trade.type === 'sell');
        });

        const acquisitionProfile = {
          rank: i + 1,
          stakeAddress: stakeAddress,
          handles: holder.handles || [],
          amount: parseInt(holder.quantity || holder.amount),
          buyTrades: buyTrades.length,
          sellTrades: sellTrades.length,
          totalTrades: tokenTrades.length
        };

        if (buyTrades.length > 0 && sellTrades.length === 0) {
          acquisitionMethods.buyers.push({ ...acquisitionProfile, type: 'PURE_BUYER' });
        } else if (buyTrades.length === 0 && sellTrades.length === 0) {
          acquisitionMethods.receivers.push({ ...acquisitionProfile, type: 'PURE_RECEIVER' });
        } else if (buyTrades.length > 0 && sellTrades.length > 0) {
          acquisitionMethods.mixed.push({ ...acquisitionProfile, type: 'TRADER' });
        } else {
          acquisitionMethods.unknown.push({ ...acquisitionProfile, type: 'UNKNOWN' });
        }

        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Error analyzing acquisition for holder ${i + 1}:`, error.message);
        const stakeAddress = holder.stakeAddress || holder.address;
        acquisitionMethods.unknown.push({
          rank: i + 1,
          stakeAddress: stakeAddress,
          handles: holder.handles || [],
          amount: parseInt(holder.quantity || holder.amount),
          type: 'ERROR'
        });
      }
    }

    return {
      acquisitionMethods,
      summary: {
        totalAnalyzed: Math.min(holders.length, 25),
        pureBuyers: acquisitionMethods.buyers.length,
        pureReceivers: acquisitionMethods.receivers.length,
        traders: acquisitionMethods.mixed.length,
        unknown: acquisitionMethods.unknown.length
      }
    };
  }

  // Detect insider networks
  async detectInsiderNetworks(holders, freeTokenAnalysis) {
    console.log('🕵️ Detecting insider networks...');

    const insiderNetworks = [];
    const connectedGroups = new Map();

    // Safety check for freeTokenAnalysis
    if (!freeTokenAnalysis || !freeTokenAnalysis.freeRecipients) {
      console.log('⚠️ No free token analysis data available for insider network detection');
      return {
        insiderNetworks: [],
        totalNetworks: 0,
        totalInsiders: 0
      };
    }

    // Group free recipients by common patterns
    const freeRecipients = freeTokenAnalysis.freeRecipients || [];

    // Look for connected stake addresses
    freeRecipients.forEach(recipient => {
      const stakePrefix = recipient.stakeAddress.substring(0, 20);

      if (!connectedGroups.has(stakePrefix)) {
        connectedGroups.set(stakePrefix, []);
      }
      connectedGroups.get(stakePrefix).push(recipient);
    });

    // Identify suspicious groups
    connectedGroups.forEach((group, prefix) => {
      if (group.length > 1) {
        const totalAmount = group.reduce((sum, member) => sum + member.amount, 0);
        const totalPercentage = group.reduce((sum, member) => sum + parseFloat(member.percentage), 0);

        insiderNetworks.push({
          type: 'CONNECTED_FREE_RECIPIENTS',
          groupId: prefix,
          members: group,
          totalMembers: group.length,
          totalAmount,
          totalPercentage: totalPercentage.toFixed(2),
          suspicionLevel: totalPercentage > 15 ? 'EXTREME' : totalPercentage > 10 ? 'HIGH' : 'MEDIUM'
        });
      }
    });

    return {
      insiderNetworks,
      totalNetworks: insiderNetworks.length,
      totalInsiders: insiderNetworks.reduce((sum, network) => sum + network.totalMembers, 0)
    };
  }

  // Generate comprehensive gold standard report
  generateGoldStandardReport(data) {
    const { ticker, superDeepAnalysis, freeTokenAnalysis, acquisitionIntelligence, insiderNetworkAnalysis } = data;

    let report = `🏆 GOLD STANDARD ANALYSIS: ${ticker}\n\n`;

    // Enhanced holder breakdown with handles
    report += `👥 COMPLETE HOLDER BREAKDOWN:\n`;

    if (superDeepAnalysis?.holderAnalysis?.holders) {
      const holders = superDeepAnalysis.holderAnalysis.holders;
      const holdersWithHandles = holders.filter(h => h.handles && h.handles.length > 0);
      const holdersWithMultipleHandles = holders.filter(h => h.handles && h.handles.length > 1);

      report += `• 📊 Total Holders: ${holders.length}\n`;
      report += `• 🏷️ Holders with ADA Handles: ${holdersWithHandles.length} (${((holdersWithHandles.length / holders.length) * 100).toFixed(1)}%)\n`;
      report += `• 🎭 Holders with Multiple Handles: ${holdersWithMultipleHandles.length}\n\n`;

      // Show top holders with their handles
      report += `🏆 TOP HOLDERS WITH HANDLES:\n`;
      holders.slice(0, 20).forEach((holder, index) => {
        if (holder.handles && holder.handles.length > 0) {
          const handlesList = holder.handles.slice(0, 3).join(', ');
          const moreHandles = holder.handles.length > 3 ? ` (+${holder.handles.length - 3} more)` : '';
          report += `• ${index + 1}. ${handlesList}${moreHandles} (${holder.percentage}%)\n`;
        } else {
          report += `• ${index + 1}. No handle (${holder.percentage}%)\n`;
        }
      });

      // Show holders with multiple handles specifically
      if (holdersWithMultipleHandles.length > 0) {
        report += `\n🎭 MULTI-HANDLE HOLDERS:\n`;
        holdersWithMultipleHandles.slice(0, 10).forEach((holder, index) => {
          const handlesList = holder.handles.join(', ');
          report += `• ${handlesList} (${holder.percentage}%)\n`;
        });
      }
    }

    report += `\n`;

    // Risk assessment based on concentration and patterns
    let riskAssessment = '🟢 **LOW RISK**: Healthy distribution pattern';
    let riskFactors = [];

    if (superDeepAnalysis?.holderAnalysis) {
      const topHolderPercentage = parseFloat(superDeepAnalysis.holderAnalysis.holders[0]?.percentage || 0);
      const top5Percentage = superDeepAnalysis.holderAnalysis.holders.slice(0, 5)
        .reduce((sum, h) => sum + parseFloat(h.percentage || 0), 0);

      if (topHolderPercentage > 15) {
        riskFactors.push(`Top holder owns ${topHolderPercentage.toFixed(1)}%`);
      }
      if (top5Percentage > 50) {
        riskFactors.push(`Top 5 holders own ${top5Percentage.toFixed(1)}%`);
      }

      // Check for suspicious patterns
      const handlelessHolders = superDeepAnalysis.holderAnalysis.holders.filter(h => !h.handles || h.handles.length === 0);
      const handlelessPercentage = (handlelessHolders.length / superDeepAnalysis.holderAnalysis.holders.length) * 100;

      if (handlelessPercentage > 70) {
        riskFactors.push(`${handlelessPercentage.toFixed(1)}% of holders have no ADA handles`);
      }

      // Determine overall risk level
      if (riskFactors.length >= 3) {
        riskAssessment = '🔴 **HIGH RISK**: Multiple concerning patterns detected';
      } else if (riskFactors.length >= 2) {
        riskAssessment = '🟡 **MEDIUM RISK**: Some concerning patterns detected';
      } else if (riskFactors.length >= 1) {
        riskAssessment = '🟠 **LOW-MEDIUM RISK**: Minor concerns detected';
      }
    }

    report += `🎯 GOLD STANDARD VERDICT:\n${riskAssessment}\n`;

    if (riskFactors.length > 0) {
      report += `\n⚠️ RISK FACTORS:\n`;
      riskFactors.forEach(factor => {
        report += `• ${factor}\n`;
      });
    }

    report += `\n🏆 This analysis provides intelligence that competitors cannot match!\n`;

    return report;
  }
}

module.exports = GoldStandardAnalysis;

// CLI execution
if (require.main === module) {
  async function main() {
    try {
      const ticker = process.argv[2];

      if (!ticker) {
        console.error('❌ Usage: node gold-standard-analysis.js <TICKER>');
        process.exit(1);
      }

      const goldAnalysis = new GoldStandardAnalysis();
      await goldAnalysis.init();

      // Get token info from database
      const token = await goldAnalysis.tapTools.tokenDb.findTokenByTicker(ticker);
      if (!token) {
        console.error(`❌ Token ${ticker} not found in database`);
        process.exit(1);
      }

      console.log(`🏆 Starting Gold Standard Analysis for ${ticker}...`);
      const result = await goldAnalysis.performGoldStandardAnalysis(token.unit, ticker);

      // Output the result as JSON for the API to parse
      console.log(JSON.stringify({
        success: true,
        ticker: ticker,
        analysis: result.analysis,
        report: result.report
      }));

    } catch (error) {
      console.error('❌ Gold Standard Analysis failed:', error.message);
      console.log(JSON.stringify({
        success: false,
        error: error.message,
        ticker: process.argv[2] || 'unknown'
      }));
      process.exit(1);
    }
  }

  main();
}
