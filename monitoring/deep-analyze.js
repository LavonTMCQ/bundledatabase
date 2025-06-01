#!/usr/bin/env node

const SuperDeepAnalysis = require('./super-deep-analysis');
const TokenDatabase = require('./token-database');
const { EmbedBuilder } = require('discord.js');

class DeepAnalyzeCommand {
  constructor() {
    this.deepAnalysis = new SuperDeepAnalysis();
    this.tokenDb = new TokenDatabase();
  }

  async findTokenByTicker(ticker) {
    try {
      await this.tokenDb.init();
      const token = await this.tokenDb.findTokenByTicker(ticker);
      return token;
    } catch (error) {
      console.error(`❌ Error finding token by ticker:`, error.message);
      return null;
    }
  }

  async analyzeToken(input) {
    try {
      let unit = null;
      let ticker = '';

      // Determine if input is a ticker or unit
      if (input.length === 56 || input.length > 56) {
        // Looks like a policy ID or unit
        unit = input;
        console.log(`🔍 Analyzing by unit: ${unit.substring(0, 20)}...`);
      } else {
        // Looks like a ticker
        ticker = input.toUpperCase();
        console.log(`🔍 Looking up ticker: ${ticker}`);

        const tokenData = await this.findTokenByTicker(ticker);
        if (!tokenData) {
          console.log(`❌ Token ${ticker} not found in database`);
          console.log(`💡 Try using the full unit instead, or add the token to the database first`);
          return null;
        }

        unit = tokenData.unit;
        console.log(`✅ Found ${ticker}: ${unit.substring(0, 20)}...`);
      }

      // Perform super deep analysis
      console.log(`\n🚀 Starting super deep analysis...`);
      const result = await this.deepAnalysis.performSuperDeepAnalysis(unit, ticker);

      return result;

    } catch (error) {
      console.error(`❌ Error analyzing token:`, error.message);
      throw error;
    }
  }

  formatConsoleReport(report) {
    const { summary, details } = report;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🕵️ SUPER DEEP ANALYSIS REPORT`);
    console.log(`${'='.repeat(80)}`);

    // Summary
    console.log(`\n📊 EXECUTIVE SUMMARY:`);
    console.log(`   Token: ${details.basicInfo.ticker || 'Unknown'} (${details.basicInfo.name || 'No name'})`);
    console.log(`   Risk Score: ${summary.riskScore}/10 (${summary.verdict})`);
    console.log(`   Recommendation: ${summary.recommendation}`);
    console.log(`   Price: $${details.basicInfo.price || 'Unknown'}`);
    console.log(`   Market Cap: $${details.basicInfo.marketCap?.toLocaleString() || 'Unknown'}`);

    // Holder Analysis
    console.log(`\n👥 HOLDER ANALYSIS:`);
    console.log(`   Total Holders Analyzed: ${details.holderAnalysis.holderCount}`);
    console.log(`   Top Holder: ${summary.topHolderPercentage.toFixed(2)}%`);
    console.log(`   Top 5 Holders: ${details.holderAnalysis.top5Percentage.toFixed(2)}%`);
    console.log(`   Top 10 Holders: ${details.holderAnalysis.top10Percentage.toFixed(2)}%`);
    console.log(`   Whale Count (>5%): ${details.holderAnalysis.whaleCount}`);
    console.log(`   Major Holders (>1%): ${details.holderAnalysis.majorHolderCount}`);

    // Cluster Analysis
    console.log(`\n🔗 CLUSTER ANALYSIS:`);
    console.log(`   Total Clusters: ${summary.clusterCount}`);
    console.log(`   Suspicious Clusters: ${summary.suspiciousClusters}`);
    console.log(`   Clusters >5%: ${details.clusterAnalysis.clustersOver5Percent}`);
    console.log(`   Clusters >10%: ${details.clusterAnalysis.clustersOver10Percent}`);
    console.log(`   Top Cluster: ${details.clusterAnalysis.topClusterPercentage.toFixed(2)}%`);

    // Stake Analysis
    if (details.stakeAnalysis.detailedClusters.length > 0) {
      console.log(`\n🕵️ TOP STAKE ANALYSIS:`);
      details.stakeAnalysis.detailedClusters.slice(0, 5).forEach((cluster, i) => {
        console.log(`   ${i + 1}. ${cluster.stakeAddress.substring(0, 20)}... (${cluster.totalPercentage.toFixed(2)}%)`);
        console.log(`      Connected Wallets: ${cluster.connectedWallets || 'Unknown'}`);
        console.log(`      Recent Trades: ${cluster.recentTrades || 0}`);
        if (cluster.suspiciousFlags && cluster.suspiciousFlags.length > 0) {
          console.log(`      🚨 Flags: ${cluster.suspiciousFlags.join(', ')}`);
        }
      });
    }

    // Enhanced ADA Handles with stake clustering
    if (details.adaHandles.resolvedHandles > 0) {
      console.log(`\n🏷️ ADA HANDLES FOUND:`);
      console.log(`   Total Handles: ${details.adaHandles.resolvedHandles}`);
      console.log(`   Stakes with Handles: ${details.adaHandles.stakesWithHandles || 0}`);

      // Show stake-grouped handles if available
      if (details.adaHandles.stakeHandleGroups) {
        console.log(`\n🔗 STAKE-GROUPED HANDLES:`);
        Object.values(details.adaHandles.stakeHandleGroups).slice(0, 10).forEach((group, i) => {
          const stakeShort = group.stakeAddress.substring(0, 20);
          console.log(`   ${i + 1}. Rank ${group.holderRank} (${group.holderPercentage.toFixed(2)}%) - ${stakeShort}...`);
          group.handles.forEach(h => {
            console.log(`      🏷️ ${h.handle} (${h.address.substring(0, 12)}...)`);
          });
        });
      } else {
        // Fallback to old format
        Object.entries(details.adaHandles.handles).forEach(([address, handle]) => {
          const holder = details.holderAnalysis.holders.find(h => h.address === address);
          console.log(`   ${handle} - Rank ${holder?.rank || '?'} (${holder?.percentage.toFixed(2) || '?'}%)`);
        });
      }
    }

    // Liquidity Analysis
    console.log(`\n💧 LIQUIDITY ANALYSIS:`);
    console.log(`   Has Liquidity: ${details.liquidityAnalysis.hasLiquidity ? 'Yes' : 'No'}`);
    console.log(`   Liquidity Risk: ${summary.liquidityRisk}`);
    console.log(`   Total ADA Locked: ${details.liquidityAnalysis.totalAdaLocked?.toLocaleString() || 0}`);
    console.log(`   Pool Count: ${details.liquidityAnalysis.poolCount}`);
    if (details.liquidityAnalysis.exchanges) {
      console.log(`   Exchanges: ${details.liquidityAnalysis.exchanges.join(', ')}`);
    }

    // Risk Assessment
    console.log(`\n🚨 RISK ASSESSMENT:`);
    console.log(`   Overall Risk: ${summary.riskScore}/10 (${summary.verdict})`);
    console.log(`   Risk Factors: ${details.riskAssessment.riskFactors.join(', ')}`);
    console.log(`   High Risk Clusters: ${details.stakeAnalysis.highRiskClusters}`);
    console.log(`   Suspicious Flags: ${details.stakeAnalysis.totalSuspiciousFlags}`);

    // Social Links
    if (details.basicInfo.socialLinks) {
      console.log(`\n🔗 SOCIAL LINKS:`);
      Object.entries(details.basicInfo.socialLinks).forEach(([platform, url]) => {
        if (url) console.log(`   ${platform}: ${url}`);
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Analysis completed at: ${new Date(report.timestamp).toLocaleString()}`);
    console.log(`${'='.repeat(80)}`);
  }

  async sendDiscordReport(report, channelId = '1373811153691607090') {
    try {
      const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

      if (!process.env.DISCORD_BOT_TOKEN && !process.argv.includes('--discord-token')) {
        console.log(`⚠️ No Discord token available, skipping Discord report`);
        return;
      }

      console.log(`📤 Sending super deep analysis report to Discord...`);

      const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
      });

      await client.login(process.env.DISCORD_BOT_TOKEN || 'MTM3Njc3MjQ5OTAzMDY3NTU0Nw.Gxsu42.MP40_BZiuJoJha3OKDhRDnjsbHhee9gjD6ZxXA');

      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.log(`❌ Could not find Discord channel: ${channelId}`);
        return;
      }

      const { summary, details } = report;

      // Create concise, actionable embed
      const embed = new EmbedBuilder()
        .setTitle(`🕵️ ${details.basicInfo.ticker || 'Unknown Token'} • Risk: ${summary.riskScore}/10`)
        .setDescription(`💰 $${details.basicInfo.price || 'Unknown'} • 📊 ${details.holderAnalysis.holderCount} holders • 🔗 ${summary.clusterCount} connected groups`)
        .setColor(summary.riskScore >= 7 ? 0xFF0000 : summary.riskScore >= 4 ? 0xFF6600 : 0x00FF00)
        .setTimestamp();

      // Key Metrics (Compact)
      embed.addFields({
        name: '📊 Key Metrics',
        value: [
          `**Top Holder:** ${summary.topHolderPercentage.toFixed(1)}% • **Top 10%:** ${details.holderAnalysis.top10Percentage?.toFixed(1) || 'N/A'}%`,
          `**Connected Groups:** ${summary.clusterCount || 0} • **Suspicious:** ${summary.suspiciousClusters}`,
          `**ADA Handles:** ${details.adaHandles.resolvedHandles || 0} • **Liquidity:** ${details.liquidityAnalysis.totalAdaLocked?.toLocaleString() || 0} ADA`
        ].join('\n'),
        inline: false
      });

      // Most Connected Wallets (This is what users want to see!)
      if (details.stakeAnalysis.detailedClusters.length > 0) {
        const topConnected = details.stakeAnalysis.detailedClusters
          .filter(cluster => cluster.connectedWallets > 1)
          .sort((a, b) => b.connectedWallets - a.connectedWallets)
          .slice(0, 5);

        if (topConnected.length > 0) {
          const connectionsValue = topConnected.map((cluster, i) => {
            let line = `**${i + 1}.** ${cluster.totalPercentage.toFixed(1)}% • ${cluster.connectedWallets} wallets`;

            // Add handles if available
            const stakeHandles = details.adaHandles.stakeHandleGroups?.[cluster.stakeAddress];
            if (stakeHandles && stakeHandles.handles.length > 0) {
              const handlesList = stakeHandles.handles.slice(0, 2).map(h => h.handle).join(', ');
              line += `\n   🏷️ ${handlesList}`;
              if (stakeHandles.handles.length > 2) {
                line += ` (+${stakeHandles.handles.length - 2} more)`;
              }
            }

            // Add suspicious flags
            if (cluster.suspiciousFlags && cluster.suspiciousFlags.length > 0) {
              line += `\n   🚨 ${cluster.suspiciousFlags.slice(0, 2).join(', ')}`;
            }

            return line;
          }).join('\n\n');

          embed.addFields({
            name: '🔗 Most Connected Wallets',
            value: connectionsValue,
            inline: false
          });
        }
      }

      // Notable Handles (Show interesting handles users should watch)
      if (details.adaHandles.resolvedHandles > 0) {
        const notableHandles = [];

        // Get handles from top holders
        if (details.adaHandles.stakeHandleGroups) {
          Object.values(details.adaHandles.stakeHandleGroups)
            .filter(group => group.holderRank <= 10) // Top 10 holders only
            .sort((a, b) => a.holderRank - b.holderRank)
            .slice(0, 8)
            .forEach(group => {
              const mainHandle = group.handles[0]?.handle;
              if (mainHandle) {
                notableHandles.push(`**${group.holderPercentage.toFixed(1)}%** ${mainHandle}`);
              }
            });
        }

        if (notableHandles.length > 0) {
          embed.addFields({
            name: '🏷️ Notable Holders',
            value: notableHandles.join(' • '),
            inline: false
          });
        }
      }

      // Risk Summary (Concise)
      let riskSummary = `**${summary.verdict}** • ${summary.recommendation}`;
      if (details.riskAssessment.riskFactors.length > 0) {
        riskSummary += `\n⚠️ ${details.riskAssessment.riskFactors.slice(0, 3).join(', ')}`;
      }

      embed.addFields({
        name: '🎯 Risk Assessment',
        value: riskSummary,
        inline: false
      });

      // Social Links
      if (details.basicInfo.socialLinks) {
        const links = [];
        if (details.basicInfo.socialLinks.website) links.push(`🌐 [Website](${details.basicInfo.socialLinks.website})`);
        if (details.basicInfo.socialLinks.twitter) links.push(`🐦 [Twitter](${details.basicInfo.socialLinks.twitter})`);
        if (details.basicInfo.socialLinks.discord) links.push(`💬 [Discord](${details.basicInfo.socialLinks.discord})`);
        if (details.basicInfo.socialLinks.telegram) links.push(`📱 [Telegram](${details.basicInfo.socialLinks.telegram})`);

        if (links.length > 0) {
          embed.addFields({
            name: '🔗 Social Links',
            value: links.join(' • '),
            inline: false
          });
        }
      }

      embed.setFooter({ text: `🏆 MISTER Gold Standard Intelligence • ${details.basicInfo.unit.substring(0, 20)}...` });

      await channel.send({ embeds: [embed] });
      console.log(`✅ Super deep analysis report sent to Discord!`);

      await client.destroy();

    } catch (error) {
      console.error(`❌ Error sending Discord report:`, error.message);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`🕵️ SUPER DEEP TOKEN ANALYSIS TOOL`);
    console.log(`\nUsage: node deep-analyze.js <ticker_or_unit> [options]`);
    console.log(`\nExamples:`);
    console.log(`  node deep-analyze.js SNEK                    # Analyze SNEK token`);
    console.log(`  node deep-analyze.js MISTER                  # Analyze MISTER token`);
    console.log(`  node deep-analyze.js 279c909f348e533da5...   # Analyze by unit`);
    console.log(`\nOptions:`);
    console.log(`  --discord-channel <id>    Send report to Discord channel`);
    console.log(`  --save-report            Save report to file`);
    console.log(`  --json                   Output in JSON format`);
    console.log(`\nThis tool performs comprehensive analysis including:`);
    console.log(`  • Top 100 holder analysis with clustering`);
    console.log(`  • Stake address mapping and connected wallets`);
    console.log(`  • ADA handle resolution for top holders`);
    console.log(`  • Liquidity pool analysis across DEXs`);
    console.log(`  • Risk assessment with 15+ factors`);
    console.log(`  • Suspicious pattern detection`);
    process.exit(0);
  }

  const tokenInput = args[0];
  const options = {
    discordChannel: '1373811153691607090', // Default to your alert channel
    saveReport: false,
    jsonOutput: false,
    noDiscord: false
  };

  // Parse options
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--discord-channel' && args[i + 1]) {
      options.discordChannel = args[i + 1];
      i++;
    } else if (args[i] === '--save-report') {
      options.saveReport = true;
    } else if (args[i] === '--json') {
      options.jsonOutput = true;
    } else if (args[i] === '--no-discord') {
      options.noDiscord = true;
    }
  }

  try {
    const analyzer = new DeepAnalyzeCommand();

    console.log(`🚀 Starting super deep analysis for: ${tokenInput}`);
    console.log(`⏱️ This may take 2-3 minutes to complete...`);

    const result = await analyzer.analyzeToken(tokenInput);

    if (!result) {
      console.log(`❌ Analysis failed`);
      process.exit(1);
    }

    if (options.jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      analyzer.formatConsoleReport(result.report);
    }

    // Always send to Discord by default (can be disabled with --no-discord)
    if (!options.noDiscord) {
      await analyzer.sendDiscordReport(result.report, options.discordChannel);
    }

    if (options.saveReport) {
      const fs = require('fs');
      const filename = `deep-analysis-${tokenInput}-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`💾 Report saved to: ${filename}`);
    }

    console.log(`\n✅ Super deep analysis complete!`);

  } catch (error) {
    console.error(`❌ Analysis failed:`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(`❌ Fatal error:`, error.message);
    process.exit(1);
  });
}

module.exports = DeepAnalyzeCommand;
