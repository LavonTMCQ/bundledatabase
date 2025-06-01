const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const SmartCommandHandler = require('./smart-command-handler');
require('dotenv').config();

// Initialize database
const db = new sqlite3.Database('./data/bot.db');

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      gif_safe TEXT DEFAULT 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
      gif_moderate TEXT DEFAULT 'https://media.giphy.com/media/3o7abAHdYvw33jLjWM/giphy.gif',
      gif_risky TEXT DEFAULT 'https://media.giphy.com/media/3o7absbD7PbTFQa0c8/giphy.gif',
      alerts_enabled BOOLEAN DEFAULT 1,
      alert_threshold INTEGER DEFAULT 7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, guild_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      policy_id TEXT NOT NULL,
      ticker TEXT DEFAULT '',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, policy_id)
    )
  `);
});

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// Initialize smart command handler
const smartHandler = new SmartCommandHandler();

// MISTER-themed Default GIFs
const DEFAULT_GIFS = {
  safe: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', // Celebration/Success
  moderate: 'https://media.giphy.com/media/3o7aCRloybJlXpNjSU/giphy.gif', // Thinking/Caution
  risky: 'https://media.giphy.com/media/3o7abAHdYvw33jLjWM/giphy.gif' // Warning/Danger
};

// MISTER branding colors
const MISTER_COLORS = {
  safe: 0x00ff88,      // MISTER Green
  moderate: 0xffaa00,  // MISTER Orange
  risky: 0xff4444,     // MISTER Red
  info: 0x4488ff,      // MISTER Blue
  mister: 0x00ff88     // Primary MISTER color
};

// MISTER-branded Helper functions
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(MISTER_COLORS.risky)
    .setFooter({
      text: '🏆 Risk Analysis - Powered by MR\'s Gold Standard Intelligence',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(MISTER_COLORS.safe)
    .setFooter({
      text: '🏆 Risk Analysis - Powered by MR\'s Gold Standard Intelligence',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

function createInfoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setColor(MISTER_COLORS.info)
    .setFooter({
      text: '🏆 Risk Analysis - Powered by MR\'s Gold Standard Intelligence',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

function createMisterEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`🎯 ${title}`)
    .setDescription(description)
    .setColor(MISTER_COLORS.mister)
    .setFooter({
      text: '🏆 Risk Analysis - Powered by MR\'s Gold Standard Intelligence',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

function createRiskAnalysisEmbed(analysis, gifConfig) {
  const { summary, formatted, raw } = analysis;

  let color, gifUrl;

  switch (summary.verdict) {
    case 'SAFE':
      color = MISTER_COLORS.safe;
      gifUrl = gifConfig.safe;
      break;
    case 'CAUTION':
      color = MISTER_COLORS.moderate;
      gifUrl = gifConfig.moderate;
      break;
    case 'AVOID':
      color = MISTER_COLORS.risky;
      gifUrl = gifConfig.risky;
      break;
    default:
      color = MISTER_COLORS.info;
      gifUrl = gifConfig.moderate;
  }

  const verdictEmoji = summary.verdict === 'SAFE' ? '🟢' :
                      summary.verdict === 'CAUTION' ? '⚠️' : '❌';

  // MISTER comparison logic
  const isMisterToken = summary.tokenName.toUpperCase().includes('MISTER');
  const misterComparison = isMisterToken ?
    '🎯 **This IS the MISTER token - The Gold Standard!**' :
    getMisterComparison(summary.riskScore);

  // Extract detailed info from formatted analysis
  const detailedInfo = formatted || '';
  const riskFactors = extractRiskFactors(detailedInfo);

  const embed = new EmbedBuilder()
    .setTitle(`🔍 ${summary.tokenName} • Risk: ${summary.riskScore}/10`)
    .setDescription(`🌐 **Visit [www.misterada.com](https://www.misterada.com) for more intelligence**\n\n${verdictEmoji} **${summary.verdict}** • ${summary.riskLevel.toUpperCase()}\n\n${misterComparison}`)
    .setColor(color)
    .addFields(
      {
        name: '📊 Key Metrics',
        value: `**Risk Score:** ${summary.riskScore}/10 • **Top Holder:** ${summary.topHolderPercentage}% • **MISTER Standard:** ${getMisterRating(summary.riskScore)}`,
        inline: false
      }
    );

  // Add detailed risk factors if available
  if (riskFactors.length > 0) {
    embed.addFields({
      name: '🔍 Risk Factors Detected',
      value: riskFactors.slice(0, 5).join('\n') || 'No major risk factors detected',
      inline: false
    });
  }

  // Add supply intelligence
  const supplyIntelligence = createSupplyIntelligence(analysis);
  if (supplyIntelligence) {
    embed.addFields({
      name: '📊 Supply Intelligence',
      value: supplyIntelligence,
      inline: false
    });
  }

  // Add enhanced holder analysis with network data
  if (summary.holderCount || raw?.totalHolders) {
    const holderCount = summary.holderCount || raw?.totalHolders || 'Unknown';
    const top20Percentage = calculateTop20Percentage(raw);
    const stakeConnections = summary.stakeConnections || 0;
    const clusteredPercentage = summary.clusteredPercentage || 0;

    embed.addFields({
      name: '👥 Holder Analysis',
      value: `**Total Holders:** ${holderCount}\n**Top 20 Holders:** ${top20Percentage}%\n**Distribution:** ${getDistributionRating(summary.topHolderPercentage)}\n**Concentration Risk:** ${summary.topHolderPercentage > 20 ? '🔴 High' : summary.topHolderPercentage > 10 ? '🟡 Medium' : '🟢 Low'}`,
      inline: false
    });

    // Add network clustering analysis
    if (stakeConnections > 0 || clusteredPercentage > 0) {
      embed.addFields({
        name: '🔗 Network Analysis',
        value: `**Stake Connections:** ${stakeConnections}\n**Clustered Holdings:** ${clusteredPercentage.toFixed(1)}%\n**Clustering Risk:** ${clusteredPercentage > 30 ? '🔴 High' : clusteredPercentage > 15 ? '🟡 Medium' : '🟢 Low'}\n**Multi-wallet Detection:** ${stakeConnections > 10 ? '⚠️ Detected' : '✅ Clean'}`,
        inline: false
      });
    }

    // Add top holders with ADA handles if available
    const topHoldersWithHandles = getTopHoldersWithHandles(raw?.holders || [], 5);
    if (topHoldersWithHandles.length > 0) {
      embed.addFields({
        name: '🏆 Top Holders (with ADA Handles)',
        value: topHoldersWithHandles,
        inline: false
      });
    }
  }

  // Add recommendation
  embed.addFields({
    name: '💡 MISTER Recommendation',
    value: getDetailedRecommendation(summary.riskScore, summary.verdict),
    inline: false
  });

  // Add social links if available
  if (analysis.socialLinks) {
    embed.addFields({
      name: '🔗 Official Links',
      value: analysis.socialLinks,
      inline: false
    });
  }

  return embed
    .setImage(gifUrl)
    .setFooter({
      text: '🏆 Risk Analysis - Powered by MR\'s Gold Standard Intelligence',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

// MISTER comparison functions
function getMisterComparison(riskScore) {
  if (riskScore === 0) return '🎯 **MISTER-LEVEL SAFETY** - Meets the gold standard!';
  if (riskScore <= 2) return '🟢 **MISTER-APPROVED** - Very close to MISTER standards';
  if (riskScore <= 4) return '⚠️ **MISTER-CAUTIOUS** - Acceptable but monitor closely';
  if (riskScore <= 6) return '🔶 **MISTER-CONCERNED** - Higher risk than MISTER prefers';
  return '❌ **MISTER-REJECTED** - Too risky for MISTER standards';
}

function getMisterRating(riskScore) {
  if (riskScore === 0) return '🏆 GOLD';
  if (riskScore <= 2) return '🥈 SILVER';
  if (riskScore <= 4) return '🥉 BRONZE';
  if (riskScore <= 6) return '⚠️ CAUTION';
  return '❌ AVOID';
}

// Helper functions for detailed analysis
function extractRiskFactors(formattedText) {
  const factors = [];

  if (formattedText.includes('high concentration')) {
    factors.push('🔴 High holder concentration detected');
  }
  if (formattedText.includes('coordinated')) {
    factors.push('🔴 Potential coordinated trading patterns');
  }
  if (formattedText.includes('whale')) {
    factors.push('🟡 Large whale holdings detected');
  }
  if (formattedText.includes('liquidity')) {
    factors.push('🟢 Healthy liquidity distribution');
  }
  if (formattedText.includes('burn')) {
    factors.push('🟢 Burn wallet identified and excluded');
  }
  if (formattedText.includes('stake pool')) {
    factors.push('🟢 Stake pool holdings identified');
  }

  return factors;
}

function getDistributionRating(topHolderPercentage) {
  if (topHolderPercentage <= 5) return '🟢 Excellent';
  if (topHolderPercentage <= 10) return '🟢 Good';
  if (topHolderPercentage <= 20) return '🟡 Fair';
  if (topHolderPercentage <= 30) return '🔴 Poor';
  return '🔴 Very Poor';
}

function getDetailedRecommendation(riskScore, verdict) {
  if (riskScore === 0) {
    return '🏆 **MISTER GOLD STANDARD** - Perfect safety profile. Ideal for investment.';
  }
  if (riskScore <= 2) {
    return '🥈 **MISTER APPROVED** - Excellent safety profile. Highly recommended for investment.';
  }
  if (riskScore <= 4) {
    return '🥉 **MISTER ACCEPTABLE** - Good safety profile. Suitable for most investors.';
  }
  if (riskScore <= 6) {
    return '⚠️ **MISTER CAUTIOUS** - Moderate risk detected. Monitor closely and invest carefully.';
  }
  if (riskScore <= 8) {
    return '🔶 **MISTER CONCERNED** - High risk detected. Consider avoiding or very small position.';
  }
  return '❌ **MISTER REJECTED** - Extreme risk detected. AVOID investment completely.';
}

// Supply intelligence functions
function createSupplyIntelligence(analysisData) {
  const { raw } = analysisData;

  if (!raw) return null;

  const totalSupply = raw.assumedTotalSupply || 1000000000;
  const circulating = raw.circulatingSupply || totalSupply;
  const liquidity = raw.liquiditySupply || 0;
  const infrastructure = raw.infrastructureSupply || 0;
  const burned = totalSupply - circulating;

  // Calculate percentages
  const circulatingPct = ((circulating / totalSupply) * 100).toFixed(1);
  const liquidityPct = ((liquidity / totalSupply) * 100).toFixed(1);
  const infrastructurePct = ((infrastructure / totalSupply) * 100).toFixed(1);
  const burnedPct = ((burned / totalSupply) * 100).toFixed(1);

  let intelligence = '';
  intelligence += `**Total Supply:** ${formatNumber(totalSupply)}\n`;
  intelligence += `🔄 **Circulating:** ${formatNumber(circulating)} (${circulatingPct}%)\n`;

  if (liquidity > 0) {
    intelligence += `💧 **Liquidity Pools:** ${formatNumber(liquidity)} (${liquidityPct}%)\n`;
  }

  if (infrastructure > 0) {
    intelligence += `🏗️ **Infrastructure:** ${formatNumber(infrastructure)} (${infrastructurePct}%)\n`;
  }

  if (burned > 0) {
    intelligence += `🔥 **Burned/Locked:** ${formatNumber(burned)} (${burnedPct}%)\n`;
  }

  return intelligence;
}

function calculateTop20Percentage(raw) {
  if (!raw?.holders || raw.holders.length === 0) return '0.0';

  const totalSupply = raw.circulatingSupply || raw.assumedTotalSupply || 1000000000;
  const top20Holders = raw.holders.slice(0, 20);
  const top20Total = top20Holders.reduce((sum, holder) => sum + holder.quantity, 0);

  return ((top20Total / totalSupply) * 100).toFixed(1);
}

function formatNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Get top holders with ADA handles for display
function getTopHoldersWithHandles(holders, limit = 5) {
  if (!holders || holders.length === 0) {
    return '';
  }

  const topHolders = holders.slice(0, limit);
  const holdersList = topHolders.map((holder, index) => {
    const percentage = holder.percentage ? holder.percentage.toFixed(2) : '0.00';
    const shortAddr = `${holder.address.substring(0, 8)}...${holder.address.substring(-4)}`;
    const handle = holder.adaHandle || 'No handle';
    const handleDisplay = handle !== 'No handle' ? `$${handle}` : shortAddr;

    return `**${index + 1}.** ${handleDisplay} • ${percentage}%`;
  }).join('\n');

  return holdersList || 'No holder data available';
}

// Get user settings
function getUserSettings(userId, guildId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT user_id, guild_id, gif_safe, gif_moderate, gif_risky,
             alerts_enabled, alert_threshold
      FROM user_settings
      WHERE user_id = ? AND guild_id = ?
    `;

    db.get(query, [userId, guildId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        resolve(null);
        return;
      }

      resolve({
        userId: row.user_id,
        guildId: row.guild_id,
        gifConfig: {
          safe: row.gif_safe,
          moderate: row.gif_moderate,
          risky: row.gif_risky
        },
        alertsEnabled: Boolean(row.alerts_enabled),
        alertThreshold: row.alert_threshold
      });
    });
  });
}

// Helper function to convert ticker to hex
function tickerToHex(ticker) {
  if (!ticker) return '';

  // Convert ticker to hex (ASCII to hex)
  return Buffer.from(ticker.toUpperCase(), 'utf8').toString('hex');
}

// Helper functions for risk analysis
function getVerdictFromRiskScore(riskScore) {
  if (riskScore <= 3) return 'SAFE';
  if (riskScore <= 6) return 'CAUTION';
  return 'AVOID';
}

function getRiskLevelFromScore(riskScore) {
  if (riskScore <= 2) return 'very low';
  if (riskScore <= 4) return 'low';
  if (riskScore <= 6) return 'medium';
  if (riskScore <= 8) return 'high';
  return 'very high';
}

// Watchlist functions
function addToWatchlist(userId, policyId, ticker = '') {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT OR REPLACE INTO watchlist (user_id, policy_id, ticker)
      VALUES (?, ?, ?)
    `;

    db.run(query, [userId, policyId, ticker], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
}

function removeFromWatchlist(userId, policyId) {
  return new Promise((resolve, reject) => {
    const query = `
      DELETE FROM watchlist
      WHERE user_id = ? AND policy_id = ?
    `;

    db.run(query, [userId, policyId], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
}

function getWatchlist(userId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT policy_id, ticker, added_at
      FROM watchlist
      WHERE user_id = ?
      ORDER BY added_at DESC
      LIMIT 20
    `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows || []);
    });
  });
}

// Alert system functions
function updateUserAlerts(userId, guildId, alertsEnabled, alertThreshold) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT OR REPLACE INTO user_settings
      (user_id, guild_id, alerts_enabled, alert_threshold)
      VALUES (?, ?, ?, ?)
    `;

    db.run(query, [userId, guildId, alertsEnabled ? 1 : 0, alertThreshold], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

// API functions
async function analyzeToken(policyIdOrUnit, ticker = '') {
  try {
    // First, try to get token info from token database
    let policyId, tokenInfo = null;

    // If ticker provided, try to get policy ID from token database
    if (ticker) {
      try {
        const tokenResponse = await axios.get(`${process.env.TOKEN_API_URL}/api/token/find?ticker=${ticker}`, {
          timeout: 10000
        });

        if (tokenResponse.data.success && tokenResponse.data.token?.policyId) {
          policyId = tokenResponse.data.token.policyId;
          tokenInfo = tokenResponse.data.token;
          console.log(`🔍 Found ${ticker} in database: ${policyId.substring(0, 8)}...`);
        }
      } catch (tokenError) {
        console.log(`🔍 Token ${ticker} not found in database, using provided policy ID`);
      }
    }

    // If no policy ID from database, use provided value
    if (!policyId) {
      if (policyIdOrUnit.length === 56) {
        policyId = policyIdOrUnit;
      } else if (policyIdOrUnit.length > 56) {
        policyId = policyIdOrUnit.substring(0, 56);
      } else {
        return { success: false, error: 'Invalid policy ID format. Please provide a valid 56-character policy ID.' };
      }
    }

    // Use the wallet network endpoint for enhanced analysis with handles
    const unit = tokenInfo?.unit || policyId + (ticker ? tickerToHex(ticker) : '');
    const url = `${process.env.RISK_API_URL}/api/wallet-network/${unit}`;
    console.log(`🔍 Analyzing token with enhanced wallet network analysis: ${policyId.substring(0, 8)}...`);

    const response = await axios.get(url, {
      timeout: 30000
    });

    if (response.data.error) {
      return { success: false, error: response.data.error };
    }

    // Transform the wallet network response to match expected format
    const analysisData = response.data;
    const metadata = analysisData.metadata || {};

    // Calculate risk score based on clustering and concentration
    let riskScore = 5; // Default for new tokens
    if (metadata.stakeConnections > 10) riskScore += 2;
    if (metadata.topHolderPercentage > 20) riskScore += 2;
    if (metadata.clusteredPercentage > 30) riskScore += 1;
    riskScore = Math.min(10, Math.max(0, riskScore));

    const transformedData = {
      summary: {
        tokenName: ticker || tokenInfo?.name || 'Unknown Token',
        riskScore: riskScore,
        topHolderPercentage: metadata.topHolderPercentage || 0,
        verdict: getVerdictFromRiskScore(riskScore),
        riskLevel: getRiskLevelFromScore(riskScore),
        holderCount: metadata.totalHolders || 0,
        stakeConnections: metadata.stakeConnections || 0,
        clusteredPercentage: metadata.clusteredPercentage || 0
      },
      raw: {
        totalHolders: metadata.totalHolders || 0,
        holders: analysisData.holders || [],
        clusters: analysisData.clusters || [],
        connections: analysisData.connections || [],
        circulatingSupply: 1000000000, // Default assumption
        assumedTotalSupply: 1000000000
      },
      formatted: `Enhanced wallet network analysis complete for ${ticker || 'token'} with ${metadata.stakeConnections || 0} stake connections and ${(analysisData.clusters || []).length} clusters detected.`,
      networkData: analysisData // Include full network data
    };

    // Try to get TapTools social links
    let socialLinks = null;
    try {
      const unit = tokenInfo?.unit || policyId + (ticker ? tickerToHex(ticker) : '');
      const linksResponse = await axios.get('https://openapi.taptools.io/api/v1/token/links', {
        params: { unit },
        headers: {
          'X-API-KEY': process.env.TAPTOOLS_API_KEY || 'WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO'
        },
        timeout: 10000
      });

      if (linksResponse.data && typeof linksResponse.data === 'object') {
        socialLinks = formatTokenLinks(linksResponse.data);
        console.log(`🔗 Found social links for ${ticker || 'token'}`);
      }
    } catch (linkError) {
      console.log(`🔗 No social links found for ${ticker || 'token'}`);
    }

    // Add social links to response
    const result = { success: true, data: transformedData };
    if (socialLinks) {
      result.data.socialLinks = socialLinks;
    }

    return result;
  } catch (error) {
    console.error('Risk API Error:', error.message);

    if (error.code === 'ECONNREFUSED') {
      return { success: false, error: 'Risk analysis API is not available. Please try again later.' };
    }

    if (error.response?.status === 404) {
      return { success: false, error: 'Token not found or invalid policy ID. Please check the policy ID and ticker symbol.' };
    }

    return { success: false, error: 'Failed to analyze token. Please try again later.' };
  }
}

// Format token social links for Discord
function formatTokenLinks(links) {
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

async function checkApiHealth() {
  try {
    const response = await axios.get(`${process.env.RISK_API_URL}/health`, {
      timeout: 5000
    });

    return response.data.status === 'ready';
  } catch (error) {
    return false;
  }
}

async function getApiStats() {
  try {
    const response = await axios.get(`${process.env.RISK_API_URL}/stats`, {
      timeout: 10000
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to fetch statistics.' };
  }
}

async function getSafeTokens(limit = 10) {
  try {
    const response = await axios.get(`${process.env.RISK_API_URL}/safe-tokens?limit=${limit}`, {
      timeout: 10000
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to fetch safe tokens.' };
  }
}

async function getRiskyTokens(limit = 10) {
  try {
    const response = await axios.get(`${process.env.RISK_API_URL}/risky-tokens?limit=${limit}`, {
      timeout: 10000
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: 'Failed to fetch risky tokens.' };
  }
}

// Enhanced visualization functions with full holder analysis
function createTextVisualization(analysisData, type) {
  const { summary, raw } = analysisData;

  if (type === 'pie') {
    // Get top 5 holders from raw data
    const holders = raw?.holders?.slice(0, 5) || [];
    const totalSupply = raw?.circulatingSupply || raw?.assumedTotalSupply || 1000000000;

    let pieChart = `🥧 **Holder Distribution (Pie Chart)**\n\n`;

    if (holders.length > 0) {
      holders.forEach((holder, index) => {
        const percentage = ((holder.quantity / totalSupply) * 100).toFixed(1);
        const bars = '█'.repeat(Math.max(1, Math.floor(percentage / 2)));
        const emoji = index === 0 ? '🔴' : index === 1 ? '🟠' : index === 2 ? '🟡' : index === 3 ? '🔵' : '🟢';
        const shortAddr = `${holder.address.substring(0, 8)}...${holder.address.substring(-8)}`;
        pieChart += `${emoji} Holder ${index + 1}: ${percentage}% ${bars}\n   \`${shortAddr}\`\n`;
      });

      const topHoldersTotal = holders.reduce((sum, h) => sum + (h.quantity / totalSupply) * 100, 0);
      const remaining = (100 - topHoldersTotal).toFixed(1);
      const remainingBars = '█'.repeat(Math.max(1, Math.floor(remaining / 2)));
      pieChart += `⚪ Other ${(raw?.totalHolders || 100) - 5} Holders: ${remaining}% ${remainingBars}\n`;
    } else {
      pieChart += `🔵 Top Holder: ${summary.topHolderPercentage}% ${'█'.repeat(Math.floor(summary.topHolderPercentage / 2))}\n`;
      pieChart += `🟢 Other Holders: ${(100 - summary.topHolderPercentage).toFixed(1)}% ${'█'.repeat(Math.floor((100 - summary.topHolderPercentage) / 2))}\n`;
    }

    pieChart += `\n📊 **Risk Assessment:** ${getMisterComparison(summary.riskScore)}`;
    return pieChart;
  }

  if (type === 'bar') {
    const holders = raw?.holders?.slice(0, 10) || [];
    const totalSupply = raw?.circulatingSupply || raw?.assumedTotalSupply || 1000000000;

    let barChart = `📊 **Top 10 Holders Bar Chart**\n\n`;

    if (holders.length > 0) {
      holders.forEach((holder, index) => {
        const percentage = ((holder.quantity / totalSupply) * 100).toFixed(1);
        const bars = '█'.repeat(Math.max(1, Math.floor(percentage / 1.5))) + '░'.repeat(Math.max(0, 15 - Math.floor(percentage / 1.5)));
        const shortAddr = `${holder.address.substring(0, 6)}...${holder.address.substring(-4)}`;
        barChart += `${index + 1}. ${shortAddr}: ${percentage}%\n${bars}\n\n`;
      });
    } else {
      const riskBars = '█'.repeat(summary.riskScore) + '░'.repeat(10 - summary.riskScore);
      const holderBars = '█'.repeat(Math.floor(summary.topHolderPercentage / 5)) + '░'.repeat(20 - Math.floor(summary.topHolderPercentage / 5));

      barChart += `**Risk Score (${summary.riskScore}/10):**\n${riskBars}\n\n`;
      barChart += `**Top Holder (${summary.topHolderPercentage}%):**\n${holderBars}\n\n`;
    }

    barChart += `🎯 **MISTER Rating:** ${getMisterRating(summary.riskScore)}`;
    return barChart;
  }

  if (type === 'heatmap') {
    const holders = raw?.holders?.slice(0, 20) || [];
    const totalSupply = raw?.circulatingSupply || raw?.assumedTotalSupply || 1000000000;
    const riskLevel = summary.riskScore;

    let heatmap = `🌡️ **Holder Risk Heatmap (Top 20)**\n\n`;

    if (holders.length > 0) {
      // Create 4x5 grid of holders
      for (let row = 0; row < 4; row++) {
        let rowText = '';
        for (let col = 0; col < 5; col++) {
          const index = row * 5 + col;
          if (index < holders.length) {
            const percentage = ((holders[index].quantity / totalSupply) * 100);
            let emoji;
            if (percentage > 10) emoji = '❌';      // Very high concentration
            else if (percentage > 5) emoji = '⚠️';  // High concentration
            else if (percentage > 2) emoji = '🟡';  // Medium concentration
            else emoji = '🟢';                      // Low concentration
            rowText += emoji;
          } else {
            rowText += '⚪'; // Empty slot
          }
        }
        heatmap += `${rowText}\n`;
      }

      heatmap += `\n**Legend:**\n`;
      heatmap += `🟢 <2% (Safe) | 🟡 2-5% (Medium) | ⚠️ 5-10% (High) | ❌ >10% (Very High)\n`;
      heatmap += `⚪ No holder data\n\n`;
    } else {
      const riskHeatmap = riskLevel <= 2 ? '🟢🟢🟢🟢🟢' :
                         riskLevel <= 4 ? '🟢🟢🟡🟡🟡' :
                         riskLevel <= 6 ? '🟡🟡🟡⚠️⚠️' :
                         riskLevel <= 8 ? '⚠️⚠️⚠️❌❌' : '❌❌❌❌❌';
      heatmap += `${riskHeatmap}\n\n`;
    }

    heatmap += `**Temperature:** ${riskLevel <= 2 ? 'COOL 🧊' : riskLevel <= 4 ? 'WARM 🌤️' : riskLevel <= 6 ? 'HOT 🔥' : 'BURNING 🌋'}\n`;
    heatmap += `**MISTER Verdict:** ${getMisterComparison(summary.riskScore)}`;

    return heatmap;
  }

  return 'Visualization type not supported yet.';
}

function createPortfolioVisualization(watchlist) {
  const tokenCount = watchlist.length;
  const recentTokens = watchlist.slice(0, 5);

  const visualization = `📊 **Portfolio Overview**\n\n` +
    `**Total Tokens:** ${tokenCount}/20\n` +
    `**Portfolio Health:** ${tokenCount <= 5 ? '🟢 Focused' : tokenCount <= 15 ? '🟡 Diversified' : '⚠️ Overloaded'}\n\n` +
    `**Recent Additions:**\n` +
    recentTokens.map((token, i) =>
      `${i + 1}. ${token.ticker || 'Token'} - ${new Date(token.added_at).toLocaleDateString()}`
    ).join('\n') +
    `\n\n📈 Use \`/portfolio risk\` for detailed risk analysis\n🎯 Use \`/watchlist analyze\` for batch analysis`;

  return visualization;
}

// Enhanced cluster analysis function with advanced bundling detection
function createClusterVisualization(analysisData) {
  const { summary, raw } = analysisData;
  const holders = raw?.holders || [];
  const totalSupply = raw?.circulatingSupply || raw?.assumedTotalSupply || 1000000000;

  if (holders.length === 0) {
    return `🔗 **Cluster Analysis**\n\nNo detailed holder data available for clustering analysis.`;
  }

  // Advanced bundling analysis
  const bundleAnalysis = performAdvancedBundling(holders, totalSupply);

  let clusterViz = `🔗 **${summary.tokenName} Advanced Cluster Intelligence**\n\n`;

  // Overview section (like competitor)
  const top3Percentage = holders.slice(0, 3).reduce((sum, h) => sum + (h.quantity / totalSupply) * 100, 0);
  const top10Percentage = holders.slice(0, 10).reduce((sum, h) => sum + (h.quantity / totalSupply) * 100, 0);

  clusterViz += `📊 **Overview**\n`;
  clusterViz += `Top 3: ${top3Percentage.toFixed(2)}%\n`;
  clusterViz += `Top 10: ${top10Percentage.toFixed(2)}%\n\n`;

  // Bundling section
  clusterViz += `🌾 **Bundling**\n`;
  clusterViz += `Clusters: ${bundleAnalysis.bundleCount}\n`;
  clusterViz += `Bundle %: ${bundleAnalysis.bundlePercentage.toFixed(2)}%\n`;
  clusterViz += `Farming Risk: ${bundleAnalysis.bundlePercentage > 40 ? '🔴 HIGH' : bundleAnalysis.bundlePercentage > 20 ? '🟡 MEDIUM' : '🟢 LOW'}\n\n`;

  // Special wallets section
  clusterViz += `🔥 **Special Wallets**\n`;
  clusterViz += `Burned: ${bundleAnalysis.burnedPercentage.toFixed(2)}%\n`;
  clusterViz += `Vested: ${bundleAnalysis.vestedPercentage.toFixed(2)}%\n\n`;

  // Bundle breakdown
  clusterViz += `📦 **Bundle Breakdown**\n`;
  bundleAnalysis.topBundles.forEach((bundle, index) => {
    const bundleEmoji = bundle.type === 'stake' ? '🪙' : '🔗';
    const bundleType = bundle.type === 'stake' ? 'Bundle' : 'Linked Bundle';

    clusterViz += `${bundleEmoji} **${bundleType} ${index + 1}** - ${bundle.percentage.toFixed(2)}%\n`;
    if (bundle.fundingSource) {
      clusterViz += `Funded by ${bundle.fundingSource.substring(0, 12)}...\n`;
    }

    bundle.holders.slice(0, 5).forEach(holder => {
      const holderPercentage = ((holder.quantity / totalSupply) * 100).toFixed(1);
      const shortAddr = `${holder.address.substring(0, 8)}...${holder.address.substring(-3)}`;
      const amount = formatTokenAmount(holder.quantity);
      clusterViz += `${bundleEmoji} ${shortAddr}: ${amount}\n`;
    });

    if (bundle.holders.length > 5) {
      clusterViz += `${bundleEmoji} +${bundle.holders.length - 5} more wallets\n`;
    }
    clusterViz += '\n';
  });

  // Risk assessment
  let riskAssessment = '';
  if (bundleAnalysis.bundlePercentage > 50) {
    riskAssessment = '🔴 **HIGH RISK**: Excessive bundling detected - potential manipulation';
  } else if (bundleAnalysis.bundlePercentage > 30) {
    riskAssessment = '🟡 **MEDIUM RISK**: Moderate bundling - monitor closely';
  } else {
    riskAssessment = '🟢 **LOW RISK**: Healthy distribution across independent wallets';
  }

  clusterViz += `🎯 **MISTER Bundle Verdict:**\n${riskAssessment}\n\n`;
  clusterViz += `**MISTER Rating:** ${getMisterRating(summary.riskScore)} | **Overall Risk:** ${summary.riskScore}/10`;

  return clusterViz;
}

// Advanced bundling detection algorithm
function performAdvancedBundling(holders, totalSupply) {
  const bundles = {};
  const specialWallets = {
    burned: [],
    vested: [],
    liquidity: []
  };

  // Known special addresses
  const burnAddresses = ['addr1w8qmxkacjdffxah0l3qg8hq2pmvs58q8lcy42zy9kda2ylc6dy5r4'];
  const vestingPatterns = ['addr1zyupekdkyr8f6lrnm4zulcs8juwv080hjfgsqvgkp98kkdkrxp0e2m4utglc7hmzkuta3e2td72cdjq9m9xlfn6rz8vq86l65l'];

  // Group by stake address (funding source)
  holders.forEach(holder => {
    // Check for special wallet types
    if (burnAddresses.includes(holder.address)) {
      specialWallets.burned.push(holder);
      return;
    }

    if (vestingPatterns.some(pattern => holder.address.includes(pattern.substring(0, 20)))) {
      specialWallets.vested.push(holder);
      return;
    }

    // Check for liquidity pools (script addresses without stake)
    if (!holder.stake_address && holder.quantity > totalSupply * 0.05) {
      specialWallets.liquidity.push(holder);
      return;
    }

    // Group by stake address for bundling
    const stakeAddr = holder.stake_address || 'no_stake';
    if (!bundles[stakeAddr]) {
      bundles[stakeAddr] = {
        holders: [],
        totalQuantity: 0,
        type: holder.stake_address ? 'stake' : 'linked',
        fundingSource: holder.stake_address
      };
    }
    bundles[stakeAddr].holders.push(holder);
    bundles[stakeAddr].totalQuantity += parseInt(holder.quantity);
  });

  // Calculate percentages and sort bundles
  const bundleArray = Object.values(bundles).map(bundle => ({
    ...bundle,
    percentage: (bundle.totalQuantity / totalSupply) * 100
  })).sort((a, b) => b.percentage - a.percentage);

  // Calculate special wallet percentages
  const burnedSupply = specialWallets.burned.reduce((sum, h) => sum + parseInt(h.quantity), 0);
  const vestedSupply = specialWallets.vested.reduce((sum, h) => sum + parseInt(h.quantity), 0);
  const liquiditySupply = specialWallets.liquidity.reduce((sum, h) => sum + parseInt(h.quantity), 0);

  // Calculate total bundle percentage (excluding single-wallet bundles)
  const significantBundles = bundleArray.filter(bundle => bundle.holders.length > 1 || bundle.percentage > 5);
  const bundlePercentage = significantBundles.reduce((sum, bundle) => sum + bundle.percentage, 0);

  return {
    bundleCount: significantBundles.length,
    bundlePercentage,
    burnedPercentage: (burnedSupply / totalSupply) * 100,
    vestedPercentage: (vestedSupply / totalSupply) * 100,
    liquidityPercentage: (liquiditySupply / totalSupply) * 100,
    topBundles: bundleArray.slice(0, 3),
    specialWallets
  };
}

// Format token amounts for display
function formatTokenAmount(quantity) {
  const num = parseInt(quantity);
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Advanced relationship visualization function
function createRelationshipVisualization(advancedAnalysis, token) {
  const { relationships, nonBuyers, suspiciousPatterns, analysisStats } = advancedAnalysis;

  let relationshipViz = `🕵️ **${token.tokenName} Advanced Wallet Intelligence**\n\n`;

  // Analysis overview
  relationshipViz += `📊 **Analysis Overview**\n`;
  relationshipViz += `• Wallets Analyzed: ${analysisStats.totalHoldersAnalyzed}\n`;
  relationshipViz += `• Relationships Found: ${analysisStats.relationshipsFound}\n`;
  relationshipViz += `• Non-Buyers Detected: ${analysisStats.nonBuyersFound}\n`;
  relationshipViz += `• Suspicious Patterns: ${analysisStats.suspiciousPatternsFound}\n\n`;

  // Non-buyer analysis (like competitor's feature)
  if (nonBuyers.length > 0) {
    relationshipViz += `💰 **Non-Buyers**\n`;
    relationshipViz += `${nonBuyers.length} wallet(s) received tokens without buying\n`;

    nonBuyers.slice(0, 5).forEach(nonBuyer => {
      const shortAddr = `${nonBuyer.address.substring(0, 8)}...${nonBuyer.address.substring(-4)}`;
      const amount = formatTokenAmount(nonBuyer.quantity);
      relationshipViz += `🎁 ${shortAddr}: ${amount} (${nonBuyer.receivedSources.length} sources)\n`;
    });

    if (nonBuyers.length > 5) {
      relationshipViz += `🎁 +${nonBuyers.length - 5} more non-buyers...\n`;
    }
    relationshipViz += '\n';
  }

  // Wallet-to-wallet transfers
  if (relationships.length > 0) {
    relationshipViz += `🔗 **Wallet Relationships**\n`;
    relationshipViz += `Direct transfers between top holders detected:\n\n`;

    relationships.slice(0, 3).forEach((relationship, index) => {
      const fromAddr = `${relationship.from.substring(0, 8)}...${relationship.from.substring(-4)}`;
      relationshipViz += `📤 **Sender ${index + 1}**: ${fromAddr}\n`;

      relationship.transfers.slice(0, 3).forEach(transfer => {
        const toAddr = `${transfer.to.substring(0, 8)}...${transfer.to.substring(-4)}`;
        const amount = formatTokenAmount(transfer.amount);
        relationshipViz += `   └── 📥 ${toAddr}: ${amount}\n`;
      });

      if (relationship.transfers.length > 3) {
        relationshipViz += `   └── +${relationship.transfers.length - 3} more transfers\n`;
      }
      relationshipViz += '\n';
    });
  }

  // Coordinated behavior patterns
  if (suspiciousPatterns.length > 0) {
    relationshipViz += `⚠️ **Suspicious Patterns**\n`;

    suspiciousPatterns.forEach(pattern => {
      if (pattern.type === 'coordinated_timing') {
        const riskEmoji = pattern.suspicionLevel === 'high' ? '🔴' : '🟡';
        relationshipViz += `${riskEmoji} **Coordinated Activity**: ${pattern.walletsInvolved.length} wallets active simultaneously\n`;
        relationshipViz += `   • Time Window: ${new Date(pattern.timeWindow * 1000).toLocaleString()}\n`;
        relationshipViz += `   • Transactions: ${pattern.transactionCount}\n`;
        relationshipViz += `   • Risk Level: ${pattern.suspicionLevel.toUpperCase()}\n\n`;
      }
    });
  }

  // Risk assessment
  let riskAssessment = '';
  const totalSuspiciousActivity = nonBuyers.length + relationships.length + suspiciousPatterns.length;

  if (totalSuspiciousActivity >= 10) {
    riskAssessment = '🔴 **HIGH RISK**: Multiple suspicious patterns detected - potential manipulation network';
  } else if (totalSuspiciousActivity >= 5) {
    riskAssessment = '🟡 **MEDIUM RISK**: Some suspicious activity detected - monitor closely';
  } else if (totalSuspiciousActivity >= 1) {
    riskAssessment = '🟠 **LOW-MEDIUM RISK**: Minor suspicious activity detected';
  } else {
    riskAssessment = '🟢 **LOW RISK**: No significant suspicious patterns detected';
  }

  relationshipViz += `🎯 **MISTER Intelligence Verdict:**\n${riskAssessment}\n\n`;
  relationshipViz += `**Analysis Depth:** Top ${analysisStats.totalHoldersAnalyzed} holders analyzed\n`;
  relationshipViz += `**Detection Accuracy:** Premium Blockfrost data with transaction analysis`;

  return relationshipViz;
}

// Enhanced GIF system with categories
function getEnhancedGifConfig(userSettings) {
  const baseConfig = userSettings?.gifConfig || DEFAULT_GIFS;

  return {
    ...baseConfig,
    mister: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', // Special MISTER celebration
    gold: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',   // Gold standard
    silver: 'https://media.giphy.com/media/3o7aCRloybJlXpNjSU/giphy.gif', // Silver approval
    bronze: 'https://media.giphy.com/media/3o7abAHdYvw33jLjWM/giphy.gif'  // Bronze caution
  };
}

// Bot ready event
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🎯 MISTER Risk Analysis Bot ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} servers with MISTER standards`);
  console.log(`🔗 Connected to Risk Analysis API`);
  console.log(`🏆 MISTER: The Gold Standard for Cardano Safety`);

  // Initialize smart command handler
  await smartHandler.init();
  console.log(`🧠 AI-powered smart commands ready!`);

  readyClient.user.setActivity('MISTER Risk Standards 🎯', { type: 3 });
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    console.log(`🔍 Executing command: ${interaction.commandName} by ${interaction.user.tag}`);

    if (interaction.commandName === 'analyze') {
      await interaction.deferReply();

      const ticker = interaction.options.getString('ticker');

      if (!ticker) {
        const errorEmbed = createErrorEmbed(
          'Missing Ticker',
          '**Please provide a token ticker:**\n\n' +
          '**Examples:**\n' +
          '• `/analyze ticker:SNEK`\n' +
          '• `/analyze ticker:HOSKY`\n' +
          '• `/analyze ticker:MIN`\n\n' +
          '💡 **Tip:** Use `/monitor test` to discover new tokens!'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      try {
        // Try to find token by ticker in our database
        const axios = require('axios');
        const tokenResponse = await axios.get('http://localhost:3456/api/token/find', {
          params: { ticker },
          timeout: 10000
        });

        if (!tokenResponse.data.success || !tokenResponse.data.token) {
          const errorEmbed = createErrorEmbed(
            'Token Not Found',
            `❌ **${ticker}** not found in our database.\n\n` +
            `**Available tokens:** Use \`/market safe\` to see available tokens\n\n` +
            `💡 **Tip:** Use \`/monitor test\` to discover new tokens automatically!`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        const tokenInfo = tokenResponse.data.token;
        console.log(`✅ Found ${ticker} in database, analyzing...`);

        // Get user's GIF configuration
        const userId = interaction.user.id;
        const guildId = interaction.guildId || 'dm';
        let userSettings = await getUserSettings(userId, guildId);
        let gifConfig = userSettings?.gifConfig || DEFAULT_GIFS;

        // Analyze the token using policy ID from database
        const result = await analyzeToken(tokenInfo.policyId, ticker);

        if (!result.success || !result.data) {
          const errorEmbed = createErrorEmbed(
            'Analysis Failed',
            result.error || `Unable to analyze ${ticker}. Please try again later.`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        // Create beautiful embed with analysis results
        const analysisEmbed = createRiskAnalysisEmbed(result.data, gifConfig);
        await interaction.editReply({ embeds: [analysisEmbed] });

        console.log(`✅ Analysis completed for ${ticker} by ${interaction.user.tag}`);

      } catch (error) {
        console.error('Error analyzing token:', error);
        const errorEmbed = createErrorEmbed(
          'Analysis Error',
          `❌ Unable to analyze **${ticker}**.\n\n` +
          `**Please try:**\n` +
          `• Check if the ticker is correct\n` +
          `• Use \`/monitor test\` to discover new tokens\n` +
          `• Try again in a few moments`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }

    else if (interaction.commandName === 'deep') {
      await interaction.deferReply();

      const ticker = interaction.options.getString('ticker');

      if (!ticker) {
        const errorEmbed = createErrorEmbed(
          'Missing Ticker',
          '**Please provide a token ticker for deep analysis:**\n\n' +
          '**Examples:**\n' +
          '• `/deep ticker:SNEK`\n' +
          '• `/deep ticker:HOSKY`\n\n' +
          '💡 **Deep analysis includes clustering and ADA handles**'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      try {
        // Find token in database
        const axios = require('axios');
        const tokenResponse = await axios.get('http://localhost:3456/api/token/find', {
          params: { ticker },
          timeout: 10000
        });

        if (!tokenResponse.data.success || !tokenResponse.data.token) {
          const errorEmbed = createErrorEmbed(
            'Token Not Found',
            `❌ **${ticker}** not found in our database.\n\n` +
            `Use \`/monitor test\` to discover new tokens!`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        const tokenInfo = tokenResponse.data.token;
        console.log(`🕵️ Running deep analysis for ${ticker}...`);

        // Run deep analysis via auto-monitor force analysis
        const deepResponse = await axios.post(`http://localhost:4001/force-analysis`, {
          ticker: ticker
        }, {
          timeout: 10000 // Shorter timeout since we get immediate response
        });

        if (!deepResponse.data.success) {
          const errorEmbed = createErrorEmbed(
            'Deep Analysis Failed',
            `Unable to start deep analysis on ${ticker}. Please try again later.`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        // Check if this is the new background processing response
        if (deepResponse.data.status === 'processing') {
          // Create processing notification embed
          const processingEmbed = createMisterEmbed(
            `🕵️ SUPER DEEP ANALYSIS STARTED: ${ticker}`,
            `${deepResponse.data.message}\n\n` +
            `📊 **What's Being Analyzed:**\n` +
            `• Comprehensive holder analysis (top 100)\n` +
            `• Stake address clustering & connected wallets\n` +
            `• ADA handle resolution for all holders\n` +
            `• Liquidity pool analysis & risk assessment\n` +
            `• Social links & market data verification\n\n` +
            `🎯 **Token:** ${ticker}\n` +
            `🎯 **Policy ID:** \`${tokenInfo.policyId.substring(0, 8)}...\`\n\n` +
            `⏰ **Results will be posted to this channel when complete**\n` +
            `💡 Analysis includes enhanced ADA handle resolution and clustering!`
          );

          await interaction.editReply({ embeds: [processingEmbed] });
          console.log(`✅ Deep analysis started for ${ticker} by ${interaction.user.tag} - results will be posted when complete`);
          return;
        }

        // Handle legacy response format (if analysis completes immediately)
        if (deepResponse.data.data && deepResponse.data.data.summary) {
          const deepEmbed = createMisterEmbed(
            `🕵️ SUPER DEEP ANALYSIS: ${ticker}`,
            `Comprehensive risk analysis with holder clustering and ADA handle resolution\n\n` +
            `📊 **Executive Summary**\n` +
            `Risk Score: ${deepResponse.data.data.summary.riskScore}/10 (${deepResponse.data.data.summary.verdict})\n` +
            `Recommendation: ${deepResponse.data.data.summary.recommendation}\n\n` +
            `👥 **Holder Analysis**\n` +
            `Total Holders: ${deepResponse.data.data.details.holderAnalysis.totalHolders}\n` +
            `Top Holder: ${deepResponse.data.data.summary.topHolderPercentage.toFixed(2)}%\n\n` +
            `🔗 **Cluster Analysis**\n` +
            `Total Clusters: ${deepResponse.data.data.summary.clusterCount}\n` +
            `Suspicious: ${deepResponse.data.data.summary.suspiciousClusters}\n\n` +
            `💧 **Liquidity Analysis**\n` +
            `Liquidity Risk: ${deepResponse.data.data.summary.liquidityRisk}`
          );

          await interaction.editReply({ embeds: [deepEmbed] });
          console.log(`✅ Deep analysis completed for ${ticker} by ${interaction.user.tag}`);
        } else {
          // Fallback for unexpected response format
          const successEmbed = createMisterEmbed(
            `🕵️ Deep Analysis Initiated: ${ticker}`,
            `Deep analysis has been started for ${ticker}.\n\nResults will be posted to the monitoring channel when complete.`
          );
          await interaction.editReply({ embeds: [successEmbed] });
          console.log(`✅ Deep analysis initiated for ${ticker} by ${interaction.user.tag}`);
        }

      } catch (error) {
        console.error('Error in deep analysis:', error);
        const errorEmbed = createErrorEmbed(
          'Deep Analysis Error',
          `❌ Unable to perform deep analysis on **${ticker}**.\n\nPlease try again later.`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }

    else if (interaction.commandName === 'gold') {
      await interaction.deferReply();

      const ticker = interaction.options.getString('ticker');

      if (!ticker) {
        const errorEmbed = createErrorEmbed(
          'Missing Ticker',
          '**Please provide a token ticker for GOLD STANDARD analysis:**\n\n' +
          '**Examples:**\n' +
          '• `/gold ticker:SNEK`\n' +
          '• `/gold ticker:HOSKY`\n\n' +
          '🏆 **GOLD STANDARD includes free token detection and insider analysis**'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      try {
        // Find token in database
        const axios = require('axios');
        const tokenResponse = await axios.get('http://localhost:3456/api/token/find', {
          params: { ticker },
          timeout: 10000
        });

        if (!tokenResponse.data.success || !tokenResponse.data.token) {
          const errorEmbed = createErrorEmbed(
            'Token Not Found',
            `❌ **${ticker}** not found in our database.\n\n` +
            `Use \`/monitor test\` to discover new tokens!`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        const tokenInfo = tokenResponse.data.token;
        console.log(`🏆 Running GOLD STANDARD analysis for ${ticker}...`);

        // Run gold standard analysis via auto-monitor
        const goldResponse = await axios.post(`http://localhost:4001/gold-analysis`, {
          ticker: ticker
        }, {
          timeout: 10000 // Shorter timeout since we get immediate response
        });

        if (!goldResponse.data.success) {
          const errorEmbed = createErrorEmbed(
            'Gold Standard Analysis Failed',
            `Unable to start GOLD STANDARD analysis on ${ticker}. Please try again later.`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        // Check if this is the new background processing response
        if (goldResponse.data.status === 'processing') {
          // Create processing notification embed
          const processingEmbed = createMisterEmbed(
            `🏆 GOLD STANDARD ANALYSIS STARTED: ${ticker}`,
            `${goldResponse.data.message}\n\n` +
            `🏆 **GOLD STANDARD FEATURES:**\n` +
            `• 🕵️ Complete super deep analysis with clustering\n` +
            `• 🎁 FREE TOKEN DETECTION - See who got tokens without buying\n` +
            `• 💰 Advanced acquisition intelligence\n` +
            `• 🕵️ Insider network detection\n` +
            `• 🏷️ ADA handle resolution for all holders\n` +
            `• 🚫 Liquidity pool exclusion\n\n` +
            `🎯 **Token:** ${ticker}\n` +
            `🎯 **Policy ID:** \`${tokenInfo.policyId.substring(0, 8)}...\`\n\n` +
            `⏰ **Results will be posted to this channel when complete (10-15 minutes)**\n` +
            `🏆 This analysis provides intelligence that competitors CANNOT match!`
          );

          await interaction.editReply({ embeds: [processingEmbed] });
          console.log(`✅ GOLD STANDARD analysis started for ${ticker} by ${interaction.user.tag} - results will be posted when complete`);
          return;
        }

        // Handle immediate completion (unlikely for gold standard)
        const successEmbed = createMisterEmbed(
          `🏆 Gold Standard Analysis Initiated: ${ticker}`,
          `GOLD STANDARD analysis has been started for ${ticker}.\n\nResults will be posted to the monitoring channel when complete.`
        );
        await interaction.editReply({ embeds: [successEmbed] });
        console.log(`✅ GOLD STANDARD analysis initiated for ${ticker} by ${interaction.user.tag}`);

      } catch (error) {
        console.error('Error running GOLD STANDARD analysis:', error);
        const errorEmbed = createErrorEmbed(
          'Gold Standard Analysis Error',
          `❌ Unable to run GOLD STANDARD analysis for **${ticker}**.\n\n` +
          `**Please try:**\n` +
          `• Check if the ticker is correct\n` +
          `• Try again in a few moments\n` +
          `• Use \`/deep ticker:${ticker}\` for deep analysis`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }

    else if (interaction.commandName === 'visualize') {
      await interaction.deferReply();

      const ticker = interaction.options.getString('ticker');

      if (!ticker) {
        const errorEmbed = createErrorEmbed(
          'Missing Ticker',
          '**Please provide a token ticker for visualization:**\n\n' +
          '**Examples:**\n' +
          '• `/visualize ticker:SNEK`\n' +
          '• `/visualize ticker:HOSKY`\n\n' +
          '💡 **Creates beautiful bubble map visualization**'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      try {
        // Find token in database
        const axios = require('axios');
        const tokenResponse = await axios.get('http://localhost:3456/api/token/find', {
          params: { ticker },
          timeout: 10000
        });

        if (!tokenResponse.data.success || !tokenResponse.data.token) {
          const errorEmbed = createErrorEmbed(
            'Token Not Found',
            `❌ **${ticker}** not found in our database.\n\n` +
            `Use \`/monitor test\` to discover new tokens!`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        const tokenInfo = tokenResponse.data.token;
        console.log(`🫧 Creating visualization for ${ticker}...`);

        // Create visualization embed
        const visualEmbed = createMisterEmbed(
          `🫧 ${ticker} Bubble Map Visualization`,
          `Beautiful holder distribution visualization\n\n` +
          `📊 **Token:** ${ticker}\n` +
          `🎯 **Policy ID:** \`${tokenInfo.policyId.substring(0, 8)}...\`\n\n` +
          `💡 **Bubble Map Features:**\n` +
          `• Holder concentration analysis\n` +
          `• Risk distribution mapping\n` +
          `• Interactive bubble visualization\n\n` +
          `🔗 **View Full Analysis:** Use \`/analyze ticker:${ticker}\``
        );

        // Add bubble map GIF
        visualEmbed.setImage('https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif');

        await interaction.editReply({ embeds: [visualEmbed] });
        console.log(`✅ Visualization created for ${ticker} by ${interaction.user.tag}`);

      } catch (error) {
        console.error('Error creating visualization:', error);
        const errorEmbed = createErrorEmbed(
          'Visualization Error',
          `❌ Unable to create visualization for **${ticker}**.\n\nPlease try again later.`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }

    else if (interaction.commandName === 'price') {
      await interaction.deferReply();

      const ticker = interaction.options.getString('ticker');

      if (!ticker) {
        const errorEmbed = createErrorEmbed(
          'Missing Ticker',
          '**Please provide a token ticker for price data:**\n\n' +
          '**Examples:**\n' +
          '• `/price ticker:SNEK`\n' +
          '• `/price ticker:HOSKY`\n\n' +
          '💡 **Shows current price and market data**'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      try {
        // Find token in database
        const axios = require('axios');
        const tokenResponse = await axios.get('http://localhost:3456/api/token/find', {
          params: { ticker },
          timeout: 10000
        });

        if (!tokenResponse.data.success || !tokenResponse.data.token) {
          const errorEmbed = createErrorEmbed(
            'Token Not Found',
            `❌ **${ticker}** not found in our database.\n\n` +
            `Use \`/monitor test\` to discover new tokens!`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        const tokenInfo = tokenResponse.data.token;
        console.log(`💰 Getting price data for ${ticker}...`);

        // Create price embed
        const priceEmbed = createSuccessEmbed(
          `💰 ${ticker} Price & Market Data`,
          `**Current Price:** $${tokenInfo.price || 'N/A'}\n` +
          `**Market Cap:** ${tokenInfo.marketCap ? '$' + tokenInfo.marketCap.toLocaleString() : 'N/A'}\n` +
          `**Volume (24h):** ${tokenInfo.volume ? tokenInfo.volume.toLocaleString() + ' ADA' : 'N/A'}\n` +
          `**Circulating Supply:** ${tokenInfo.circulatingSupply ? tokenInfo.circulatingSupply.toLocaleString() : 'N/A'}\n\n` +
          `🎯 **Policy ID:** \`${tokenInfo.policyId.substring(0, 8)}...\`\n\n` +
          `🔍 **Quick Actions:**\n` +
          `• \`/analyze ticker:${ticker}\` - Risk analysis\n` +
          `• \`/deep ticker:${ticker}\` - Deep analysis\n` +
          `• \`/visualize ticker:${ticker}\` - Bubble map`
        );

        await interaction.editReply({ embeds: [priceEmbed] });
        console.log(`✅ Price data shown for ${ticker} by ${interaction.user.tag}`);

      } catch (error) {
        console.error('Error getting price data:', error);
        const errorEmbed = createErrorEmbed(
          'Price Data Error',
          `❌ Unable to get price data for **${ticker}**.\n\nPlease try again later.`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }

    else if (interaction.commandName === 'smart') {
      const userInput = interaction.options.getString('query');
      await smartHandler.handleSmartCommand(interaction, userInput);
    }

    else if (interaction.commandName === 'health') {
      await interaction.deferReply();

      const apiHealthy = await checkApiHealth();
      const botUptime = process.uptime();
      const uptimeHours = Math.floor(botUptime / 3600);
      const uptimeMinutes = Math.floor((botUptime % 3600) / 60);

      const healthEmbed = createInfoEmbed(
        'System Health Status',
        `**Bot Status:** 🟢 Online\n**Uptime:** ${uptimeHours}h ${uptimeMinutes}m\n\n**API Status:** ${apiHealthy ? '🟢 Online' : '❌ Offline'}`
      );

      await interaction.editReply({ embeds: [healthEmbed] });
    }

    else if (interaction.commandName === 'config') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'show') {
        const userId = interaction.user.id;
        const guildId = interaction.guildId || 'dm';
        const userSettings = await getUserSettings(userId, guildId);
        const gifConfig = userSettings?.gifConfig || DEFAULT_GIFS;

        const configEmbed = createInfoEmbed(
          'Your Current Configuration',
          `**Safe Token GIF:** [Preview](${gifConfig.safe})\n**Moderate Risk GIF:** [Preview](${gifConfig.moderate})\n**High Risk GIF:** [Preview](${gifConfig.risky})`
        );

        configEmbed.setImage(gifConfig.safe);
        await interaction.editReply({ embeds: [configEmbed] });
      }

      else if (subcommand === 'gif') {
        const type = interaction.options.getString('type');
        const url = interaction.options.getString('url');
        const userId = interaction.user.id;
        const guildId = interaction.guildId || 'dm';

        if (type === 'reset') {
          try {
            // Reset to default GIFs
            const query = `
              INSERT OR REPLACE INTO user_settings
              (user_id, guild_id, gif_safe, gif_moderate, gif_risky)
              VALUES (?, ?, ?, ?, ?)
            `;

            await new Promise((resolve, reject) => {
              db.run(query, [userId, guildId, DEFAULT_GIFS.safe, DEFAULT_GIFS.moderate, DEFAULT_GIFS.risky], function(err) {
                if (err) reject(err);
                else resolve();
              });
            });

            const successEmbed = createSuccessEmbed(
              'GIFs Reset to Defaults',
              '🔄 All GIFs have been reset to MISTER default settings!\n\nUse `/config show` to see your current configuration.'
            );
            await interaction.editReply({ embeds: [successEmbed] });
            console.log(`🔄 ${interaction.user.tag} reset GIFs to defaults`);
          } catch (error) {
            console.error('Error resetting GIFs:', error);
            const errorEmbed = createErrorEmbed('Configuration Error', 'Failed to reset GIFs. Please try again.');
            await interaction.editReply({ embeds: [errorEmbed] });
          }
          return;
        }

        if (!url) {
          const errorEmbed = createErrorEmbed(
            'Missing GIF URL',
            'Please provide a GIF URL for the selected risk level.'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        // Validate URL format
        if (!url.match(/^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i)) {
          const errorEmbed = createErrorEmbed(
            'Invalid GIF URL',
            'Please provide a valid image URL (GIF, PNG, JPG, JPEG, or WebP format).'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        try {
          // Get current settings or create new ones
          let userSettings = await getUserSettings(userId, guildId);
          let currentGifs = userSettings?.gifConfig || DEFAULT_GIFS;

          // Update the specific GIF type
          const updatedGifs = { ...currentGifs };
          updatedGifs[type] = url;

          const query = `
            INSERT OR REPLACE INTO user_settings
            (user_id, guild_id, gif_safe, gif_moderate, gif_risky, alerts_enabled, alert_threshold)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          await new Promise((resolve, reject) => {
            db.run(query, [
              userId,
              guildId,
              updatedGifs.safe,
              updatedGifs.moderate,
              updatedGifs.risky,
              userSettings?.alertsEnabled ? 1 : 1,
              userSettings?.alertThreshold || 7
            ], function(err) {
              if (err) reject(err);
              else resolve();
            });
          });

          const typeNames = {
            safe: 'Safe Tokens',
            moderate: 'Moderate Risk',
            risky: 'High Risk'
          };

          const successEmbed = createSuccessEmbed(
            'GIF Configuration Updated',
            `✅ **${typeNames[type]}** GIF has been updated!\n\n[Preview your new GIF](${url})\n\nUse \`/config show\` to see all your current settings.`
          );

          successEmbed.setImage(url);
          await interaction.editReply({ embeds: [successEmbed] });
          console.log(`🎨 ${interaction.user.tag} updated ${type} GIF`);
        } catch (error) {
          console.error('Error updating GIF configuration:', error);
          const errorEmbed = createErrorEmbed('Configuration Error', 'Failed to update GIF configuration. Please try again.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    }

    else if (interaction.commandName === 'watchlist') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === 'add') {
        const ticker = interaction.options.getString('ticker');

        if (!ticker) {
          const errorEmbed = createErrorEmbed(
            'Missing Ticker',
            '**Please provide a token ticker:**\n\n' +
            '**Examples:**\n' +
            '• `/watchlist add ticker:SNEK`\n' +
            '• `/watchlist add ticker:HOSKY`'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        try {
          // Find token in database
          const axios = require('axios');
          const tokenResponse = await axios.get('http://localhost:3456/api/token/find', {
            params: { ticker },
            timeout: 10000
          });

          if (!tokenResponse.data.success || !tokenResponse.data.token) {
            const errorEmbed = createErrorEmbed(
              'Token Not Found',
              `❌ **${ticker}** not found in our database.\n\n` +
              `Use \`/monitor test\` to discover new tokens!`
            );
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
          }

          const tokenInfo = tokenResponse.data.token;
          await addToWatchlist(userId, tokenInfo.policyId, ticker);

          const successEmbed = createSuccessEmbed(
            'Token Added to Watchlist',
            `**${ticker}** has been added to your watchlist!\n\n` +
            `🎯 **Policy ID:** \`${tokenInfo.policyId.substring(0, 8)}...\`\n` +
            `💰 **Price:** $${tokenInfo.price || 'N/A'}\n\n` +
            `Use \`/watchlist view\` to see all your tokens.`
          );

          await interaction.editReply({ embeds: [successEmbed] });
          console.log(`📝 ${interaction.user.tag} added ${ticker} to watchlist`);
        } catch (error) {
          console.error('Error adding to watchlist:', error);
          const errorEmbed = createErrorEmbed(
            'Watchlist Error',
            `Failed to add **${ticker}** to watchlist. Please try again.`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'remove') {
        const ticker = interaction.options.getString('ticker');

        if (!ticker) {
          const errorEmbed = createErrorEmbed(
            'Missing Ticker',
            '**Please provide a token ticker to remove:**\n\n' +
            '**Examples:**\n' +
            '• `/watchlist remove ticker:SNEK`\n' +
            '• `/watchlist remove ticker:HOSKY`'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        try {
          // Find token in database to get policy ID
          const axios = require('axios');
          const tokenResponse = await axios.get('http://localhost:3456/api/token/find', {
            params: { ticker },
            timeout: 10000
          });

          if (!tokenResponse.data.success || !tokenResponse.data.token) {
            const errorEmbed = createErrorEmbed(
              'Token Not Found',
              `❌ **${ticker}** not found in our database.`
            );
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
          }

          const tokenInfo = tokenResponse.data.token;
          const removed = await removeFromWatchlist(userId, tokenInfo.policyId);

          if (removed) {
            const successEmbed = createSuccessEmbed(
              'Token Removed',
              `**${ticker}** has been removed from your watchlist.\n\n` +
              `Use \`/watchlist view\` to see your remaining tokens.`
            );
            await interaction.editReply({ embeds: [successEmbed] });
            console.log(`🗑️ ${interaction.user.tag} removed ${ticker} from watchlist`);
          } else {
            const errorEmbed = createErrorEmbed(
              'Token Not Found',
              `**${ticker}** is not in your watchlist.`
            );
            await interaction.editReply({ embeds: [errorEmbed] });
          }
        } catch (error) {
          console.error('Error removing from watchlist:', error);
          const errorEmbed = createErrorEmbed(
            'Watchlist Error',
            `Failed to remove **${ticker}** from watchlist. Please try again.`
          );
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'view') {
        try {
          const watchlist = await getWatchlist(userId);

          if (watchlist.length === 0) {
            const infoEmbed = createInfoEmbed(
              'Your Watchlist',
              'Your watchlist is empty. Use `/watchlist add` to add tokens!'
            );
            await interaction.editReply({ embeds: [infoEmbed] });
            return;
          }

          const watchlistText = watchlist.map((item, index) => {
            const shortPolicy = `${item.policy_id.substring(0, 8)}...${item.policy_id.substring(-8)}`;
            const ticker = item.ticker ? ` (${item.ticker})` : '';
            const date = new Date(item.added_at).toLocaleDateString();
            return `${index + 1}. **${item.ticker || 'Token'}**${ticker}\n   \`${shortPolicy}\` - Added ${date}`;
          }).join('\n\n');

          const watchlistEmbed = createInfoEmbed(
            `📋 Your Watchlist (${watchlist.length}/20)`,
            watchlistText
          );

          await interaction.editReply({ embeds: [watchlistEmbed] });
        } catch (error) {
          console.error('Error showing watchlist:', error);
          const errorEmbed = createErrorEmbed(
            'Watchlist Error',
            'Failed to retrieve your watchlist. Please try again.'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'analyze') {
        try {
          const watchlist = await getWatchlist(userId);

          if (watchlist.length === 0) {
            const infoEmbed = createInfoEmbed(
              'Empty Watchlist',
              'Your watchlist is empty. Use `/watchlist add` to add tokens first!'
            );
            await interaction.editReply({ embeds: [infoEmbed] });
            return;
          }

          // Analyze first 5 tokens (to avoid rate limits)
          const tokensToAnalyze = watchlist.slice(0, 5);
          const analysisPromises = tokensToAnalyze.map(item =>
            analyzeToken(item.policy_id, item.ticker)
          );

          const results = await Promise.allSettled(analysisPromises);

          let safeCount = 0;
          let cautionCount = 0;
          let avoidCount = 0;
          let errorCount = 0;

          const summaryText = results.map((result, index) => {
            const item = tokensToAnalyze[index];
            const tokenName = item.ticker || `Token ${index + 1}`;

            if (result.status === 'fulfilled' && result.value.success) {
              const verdict = result.value.data.summary.verdict;
              const riskScore = result.value.data.summary.riskScore;

              if (verdict === 'SAFE') safeCount++;
              else if (verdict === 'CAUTION') cautionCount++;
              else if (verdict === 'AVOID') avoidCount++;

              const emoji = verdict === 'SAFE' ? '🟢' : verdict === 'CAUTION' ? '⚠️' : '❌';
              return `${emoji} **${tokenName}** - Risk: ${riskScore}/10 (${verdict})`;
            } else {
              errorCount++;
              return `❓ **${tokenName}** - Analysis failed`;
            }
          }).join('\n');

          const overallText = `**Portfolio Summary:**\n🟢 Safe: ${safeCount} | ⚠️ Caution: ${cautionCount} | ❌ Avoid: ${avoidCount} | ❓ Errors: ${errorCount}`;

          const analysisEmbed = createInfoEmbed(
            `📊 Watchlist Analysis (${tokensToAnalyze.length}/${watchlist.length} tokens)`,
            `${overallText}\n\n**Individual Results:**\n${summaryText}`
          );

          await interaction.editReply({ embeds: [analysisEmbed] });
          console.log(`📊 ${interaction.user.tag} analyzed watchlist (${tokensToAnalyze.length} tokens)`);
        } catch (error) {
          console.error('Error analyzing watchlist:', error);
          const errorEmbed = createErrorEmbed(
            'Analysis Error',
            'Failed to analyze your watchlist. Please try again.'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    }

    else if (interaction.commandName === 'alerts') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;
      const guildId = interaction.guildId || 'dm';

      if (subcommand === 'on') {
        try {
          await updateUserAlerts(userId, guildId, true, 7);
          const successEmbed = createSuccessEmbed(
            'Alerts Enabled',
            '🔔 Risk alerts are now **enabled** for your watchlist!\n\nYou\'ll be notified when tokens exceed risk threshold 7/10.\nUse `/alerts threshold` to adjust the sensitivity.'
          );
          await interaction.editReply({ embeds: [successEmbed] });
          console.log(`🔔 ${interaction.user.tag} enabled alerts`);
        } catch (error) {
          console.error('Error enabling alerts:', error);
          const errorEmbed = createErrorEmbed('Alert Error', 'Failed to enable alerts. Please try again.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'off') {
        try {
          await updateUserAlerts(userId, guildId, false, 7);
          const successEmbed = createSuccessEmbed(
            'Alerts Disabled',
            '🔕 Risk alerts are now **disabled**.\n\nYou won\'t receive notifications for watchlist changes.\nUse `/alerts on` to re-enable them.'
          );
          await interaction.editReply({ embeds: [successEmbed] });
          console.log(`🔕 ${interaction.user.tag} disabled alerts`);
        } catch (error) {
          console.error('Error disabling alerts:', error);
          const errorEmbed = createErrorEmbed('Alert Error', 'Failed to disable alerts. Please try again.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'threshold') {
        const level = interaction.options.getInteger('level');
        try {
          await updateUserAlerts(userId, guildId, true, level);
          const successEmbed = createSuccessEmbed(
            'Alert Threshold Updated',
            `🎯 Alert threshold set to **${level}/10**\n\nYou'll be notified when tokens in your watchlist exceed this risk level.`
          );
          await interaction.editReply({ embeds: [successEmbed] });
          console.log(`🎯 ${interaction.user.tag} set alert threshold to ${level}`);
        } catch (error) {
          console.error('Error setting threshold:', error);
          const errorEmbed = createErrorEmbed('Alert Error', 'Failed to update threshold. Please try again.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'status') {
        try {
          const userSettings = await getUserSettings(userId, guildId);
          const alertsEnabled = userSettings?.alertsEnabled ?? true;
          const threshold = userSettings?.alertThreshold ?? 7;

          const statusEmbed = createInfoEmbed(
            'Alert Settings',
            `**Status:** ${alertsEnabled ? '🔔 Enabled' : '🔕 Disabled'}\n**Threshold:** ${threshold}/10\n**Watchlist Monitoring:** ${alertsEnabled ? 'Active' : 'Inactive'}\n\n${alertsEnabled ? `You'll be notified when tokens exceed risk level ${threshold}.` : 'Use `/alerts on` to enable notifications.'}`
          );
          await interaction.editReply({ embeds: [statusEmbed] });
        } catch (error) {
          console.error('Error showing alert status:', error);
          const errorEmbed = createErrorEmbed('Alert Error', 'Failed to retrieve alert settings.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    }

    else if (interaction.commandName === 'portfolio') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === 'risk') {
        try {
          const watchlist = await getWatchlist(userId);

          if (watchlist.length === 0) {
            const infoEmbed = createInfoEmbed(
              'Empty Portfolio',
              'Your watchlist is empty. Use `/watchlist add` to add tokens first!'
            );
            await interaction.editReply({ embeds: [infoEmbed] });
            return;
          }

          // Analyze up to 10 tokens for portfolio risk
          const tokensToAnalyze = watchlist.slice(0, 10);
          const analysisPromises = tokensToAnalyze.map(item =>
            analyzeToken(item.policy_id, item.ticker)
          );

          const results = await Promise.allSettled(analysisPromises);

          let totalRisk = 0;
          let successCount = 0;
          let riskDistribution = { safe: 0, caution: 0, avoid: 0 };

          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.success) {
              const riskScore = result.value.data.summary.riskScore;
              const verdict = result.value.data.summary.verdict;

              totalRisk += riskScore;
              successCount++;

              if (verdict === 'SAFE') riskDistribution.safe++;
              else if (verdict === 'CAUTION') riskDistribution.caution++;
              else if (verdict === 'AVOID') riskDistribution.avoid++;
            }
          });

          const avgRisk = successCount > 0 ? (totalRisk / successCount).toFixed(1) : 0;
          const riskLevel = avgRisk <= 3 ? 'LOW' : avgRisk <= 6 ? 'MODERATE' : 'HIGH';
          const riskColor = avgRisk <= 3 ? '🟢' : avgRisk <= 6 ? '⚠️' : '❌';

          const portfolioEmbed = createInfoEmbed(
            `📊 Portfolio Risk Analysis`,
            `**Overall Risk Score:** ${riskColor} **${avgRisk}/10** (${riskLevel})\n**Tokens Analyzed:** ${successCount}/${watchlist.length}\n\n**Risk Distribution:**\n🟢 Safe: ${riskDistribution.safe} tokens\n⚠️ Caution: ${riskDistribution.caution} tokens\n❌ Avoid: ${riskDistribution.avoid} tokens\n\n**Recommendation:** ${avgRisk <= 3 ? 'Portfolio looks safe for investment' : avgRisk <= 6 ? 'Monitor portfolio closely for changes' : 'Consider reducing exposure to high-risk tokens'}`
          );

          await interaction.editReply({ embeds: [portfolioEmbed] });
          console.log(`📊 ${interaction.user.tag} analyzed portfolio risk: ${avgRisk}/10`);
        } catch (error) {
          console.error('Error calculating portfolio risk:', error);
          const errorEmbed = createErrorEmbed('Portfolio Error', 'Failed to calculate portfolio risk.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'summary') {
        try {
          const watchlist = await getWatchlist(userId);
          const userSettings = await getUserSettings(userId, interaction.guildId || 'dm');

          const summaryEmbed = createInfoEmbed(
            '📋 Portfolio Summary',
            `**Watchlist:** ${watchlist.length}/20 tokens\n**Alerts:** ${userSettings?.alertsEnabled ? '🔔 Enabled' : '🔕 Disabled'}\n**Alert Threshold:** ${userSettings?.alertThreshold || 7}/10\n\n**Recent Additions:**\n${watchlist.slice(0, 3).map((item, i) => `${i + 1}. ${item.ticker || 'Token'} - ${new Date(item.added_at).toLocaleDateString()}`).join('\n') || 'No tokens added yet'}\n\n**Quick Actions:**\n• Use \`/watchlist analyze\` for batch analysis\n• Use \`/portfolio risk\` for risk calculation\n• Use \`/alerts on\` to enable notifications`
          );

          await interaction.editReply({ embeds: [summaryEmbed] });
        } catch (error) {
          console.error('Error showing portfolio summary:', error);
          const errorEmbed = createErrorEmbed('Portfolio Error', 'Failed to retrieve portfolio summary.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'compare') {
        const policy1 = interaction.options.getString('policy1');
        const ticker1 = interaction.options.getString('ticker1') || '';
        const policy2 = interaction.options.getString('policy2');
        const ticker2 = interaction.options.getString('ticker2') || '';

        try {
          const [result1, result2] = await Promise.allSettled([
            analyzeToken(policy1, ticker1),
            analyzeToken(policy2, ticker2)
          ]);

          let comparison = '**Token Comparison:**\n\n';

          if (result1.status === 'fulfilled' && result1.value.success) {
            const data1 = result1.value.data.summary;
            const emoji1 = data1.verdict === 'SAFE' ? '🟢' : data1.verdict === 'CAUTION' ? '⚠️' : '❌';
            comparison += `${emoji1} **${data1.tokenName}**\n• Risk Score: ${data1.riskScore}/10\n• Top Holder: ${data1.topHolderPercentage}%\n• Verdict: ${data1.verdict}\n\n`;
          } else {
            comparison += `❓ **${ticker1 || 'Token 1'}** - Analysis failed\n\n`;
          }

          if (result2.status === 'fulfilled' && result2.value.success) {
            const data2 = result2.value.data.summary;
            const emoji2 = data2.verdict === 'SAFE' ? '🟢' : data2.verdict === 'CAUTION' ? '⚠️' : '❌';
            comparison += `${emoji2} **${data2.tokenName}**\n• Risk Score: ${data2.riskScore}/10\n• Top Holder: ${data2.topHolderPercentage}%\n• Verdict: ${data2.verdict}\n\n`;
          } else {
            comparison += `❓ **${ticker2 || 'Token 2'}** - Analysis failed\n\n`;
          }

          // Add recommendation
          if (result1.status === 'fulfilled' && result1.value.success &&
              result2.status === 'fulfilled' && result2.value.success) {
            const risk1 = result1.value.data.summary.riskScore;
            const risk2 = result2.value.data.summary.riskScore;
            const safer = risk1 < risk2 ? result1.value.data.summary.tokenName : result2.value.data.summary.tokenName;
            comparison += `**Recommendation:** ${safer} appears to be the safer choice.`;
          }

          const compareEmbed = createInfoEmbed('⚖️ Token Comparison', comparison);
          await interaction.editReply({ embeds: [compareEmbed] });
          console.log(`⚖️ ${interaction.user.tag} compared tokens`);
        } catch (error) {
          console.error('Error comparing tokens:', error);
          const errorEmbed = createErrorEmbed('Comparison Error', 'Failed to compare tokens.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    }

    else if (interaction.commandName === 'market') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'safe') {
        const limit = interaction.options.getInteger('limit') || 10;
        try {
          const result = await getSafeTokens(limit);

          if (!result.success || !result.data || result.data.length === 0) {
            const infoEmbed = createInfoEmbed(
              'No Safe Tokens',
              'No safe tokens found in the database yet. Try analyzing some tokens first!'
            );
            await interaction.editReply({ embeds: [infoEmbed] });
            return;
          }

          const tokenList = result.data.slice(0, limit).map((token, index) => {
            const shortPolicy = `${token.policy_id.substring(0, 8)}...${token.policy_id.substring(-8)}`;
            return `${index + 1}. **${token.token_name || 'Token'}** - Risk: ${token.risk_score}/10\n   \`${shortPolicy}\``;
          }).join('\n\n');

          const safeEmbed = createSuccessEmbed(
            `🟢 Top ${limit} Safe Tokens`,
            `${tokenList}\n\n*These tokens have been analyzed and deemed safe for investment.*`
          );

          await interaction.editReply({ embeds: [safeEmbed] });
          console.log(`🟢 ${interaction.user.tag} viewed safe tokens`);
        } catch (error) {
          console.error('Error fetching safe tokens:', error);
          const errorEmbed = createErrorEmbed('Market Error', 'Failed to fetch safe tokens.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'risky') {
        const limit = interaction.options.getInteger('limit') || 10;
        try {
          const result = await getRiskyTokens(limit);

          if (!result.success || !result.data || result.data.length === 0) {
            const infoEmbed = createInfoEmbed(
              'No Risky Tokens',
              'No risky tokens found in the database yet. Try analyzing some tokens first!'
            );
            await interaction.editReply({ embeds: [infoEmbed] });
            return;
          }

          const tokenList = result.data.slice(0, limit).map((token, index) => {
            const shortPolicy = `${token.policy_id.substring(0, 8)}...${token.policy_id.substring(-8)}`;
            return `${index + 1}. **${token.token_name || 'Token'}** - Risk: ${token.risk_score}/10\n   \`${shortPolicy}\``;
          }).join('\n\n');

          const riskyEmbed = createErrorEmbed(
            `❌ Top ${limit} Risky Tokens`,
            `${tokenList}\n\n*⚠️ These tokens have high risk scores. Invest with caution!*`
          );

          await interaction.editReply({ embeds: [riskyEmbed] });
          console.log(`❌ ${interaction.user.tag} viewed risky tokens`);
        } catch (error) {
          console.error('Error fetching risky tokens:', error);
          const errorEmbed = createErrorEmbed('Market Error', 'Failed to fetch risky tokens.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'stats') {
        try {
          const result = await getApiStats();

          if (!result.success) {
            const errorEmbed = createErrorEmbed('Stats Error', result.error || 'Failed to fetch market statistics.');
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
          }

          const stats = result.data;
          const avgRisk = stats.averageRiskScore?.toFixed(1) || '0.0';
          const lastAnalysis = stats.lastAnalysis ? new Date(stats.lastAnalysis).toLocaleString() : 'Never';

          const statsEmbed = createInfoEmbed(
            '📈 Market Statistics',
            `**Total Analyses:** ${stats.totalAnalyses || 0}\n**Safe Tokens:** 🟢 ${stats.safeTokens || 0}\n**Risky Tokens:** ❌ ${stats.riskyTokens || 0}\n**Average Risk Score:** ${avgRisk}/10\n**Last Analysis:** ${lastAnalysis}\n\n**Market Health:** ${avgRisk <= 4 ? '🟢 Healthy' : avgRisk <= 6 ? '⚠️ Moderate Risk' : '❌ High Risk Environment'}\n\n*Statistics based on analyzed tokens in the database.*`
          );

          await interaction.editReply({ embeds: [statsEmbed] });
          console.log(`📈 ${interaction.user.tag} viewed market stats`);
        } catch (error) {
          console.error('Error fetching market stats:', error);
          const errorEmbed = createErrorEmbed('Market Error', 'Failed to fetch market statistics.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    }

    else if (interaction.commandName === 'mister') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'stats') {
        // MISTER token analysis
        const misterPolicyId = '7529bed52d81a20e69c6dd447dd9cc0293daf4577f08d7ed2d8ab081';
        try {
          const result = await analyzeToken(misterPolicyId, 'MISTER');

          if (result.success && result.data) {
            const misterEmbed = createMisterEmbed(
              'MISTER Token - The Gold Standard',
              `🏆 **Risk Score:** ${result.data.summary.riskScore}/10 - **${result.data.summary.riskLevel.toUpperCase()}**\n\n🎯 **Why MISTER is the Standard:**\n• Perfect holder distribution\n• No coordinated manipulation\n• Community-driven ownership\n• Transparent tokenomics\n• Proven track record\n\n**MISTER sets the benchmark for what a safe Cardano token should look like.**`
            );

            await interaction.editReply({ embeds: [misterEmbed] });
            console.log(`🎯 ${interaction.user.tag} viewed MISTER stats`);
          } else {
            const errorEmbed = createErrorEmbed('MISTER Analysis Error', 'Unable to analyze MISTER token at this time.');
            await interaction.editReply({ embeds: [errorEmbed] });
          }
        } catch (error) {
          console.error('Error analyzing MISTER:', error);
          const errorEmbed = createErrorEmbed('MISTER Error', 'Failed to retrieve MISTER statistics.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'standard') {
        const standardEmbed = createMisterEmbed(
          'The MISTER Safety Standard',
          `🏆 **What Makes MISTER the Gold Standard?**\n\n` +
          `🎯 **Perfect Risk Score:** 0/10 - No red flags detected\n` +
          `👥 **Healthy Distribution:** Low concentration, no whale dominance\n` +
          `🛡️ **No Manipulation:** Zero coordinated trading patterns\n` +
          `🌟 **Community Driven:** Organic holder growth\n` +
          `📊 **Transparent:** All metrics publicly verifiable\n\n` +
          `**MISTER Rating System:**\n` +
          `🏆 **GOLD (0-2):** MISTER-level safety\n` +
          `🥈 **SILVER (3-4):** MISTER-approved\n` +
          `🥉 **BRONZE (5-6):** MISTER-cautious\n` +
          `⚠️ **CAUTION (7-8):** MISTER-concerned\n` +
          `❌ **AVOID (9-10):** MISTER-rejected\n\n` +
          `*When in doubt, ask: "Would MISTER approve?"*`
        );

        await interaction.editReply({ embeds: [standardEmbed] });
        console.log(`🎯 ${interaction.user.tag} learned about MISTER standard`);
      }

      else if (subcommand === 'compare') {
        const policyId = interaction.options.getString('policy_id');
        const ticker = interaction.options.getString('ticker') || '';

        try {
          // Analyze the provided token
          const result = await analyzeToken(policyId, ticker);

          if (!result.success || !result.data) {
            const errorEmbed = createErrorEmbed(
              'Analysis Failed',
              result.error || 'Unable to analyze token for MISTER comparison.'
            );
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
          }

          const tokenData = result.data.summary;
          const misterPolicyId = '7529bed52d81a20e69c6dd447dd9cc0293daf4577f08d7ed2d8ab081';

          // Get MISTER data for comparison
          const misterResult = await analyzeToken(misterPolicyId, 'MISTER');
          const misterData = misterResult.success ? misterResult.data.summary : null;

          // Create comparison
          let comparison = `🎯 **${tokenData.tokenName} vs MISTER Comparison**\n\n`;

          // Risk Score Comparison
          const riskDiff = tokenData.riskScore - (misterData?.riskScore || 0);
          const riskComparison = riskDiff === 0 ? '🟢 EQUAL' :
                                riskDiff > 0 ? `🔴 +${riskDiff} HIGHER` :
                                `🟢 ${riskDiff} LOWER`;

          comparison += `**Risk Score:**\n`;
          comparison += `• ${tokenData.tokenName}: ${tokenData.riskScore}/10\n`;
          comparison += `• MISTER: ${misterData?.riskScore || 0}/10\n`;
          comparison += `• Difference: ${riskComparison}\n\n`;

          // Holder Concentration Comparison
          const holderDiff = tokenData.topHolderPercentage - (misterData?.topHolderPercentage || 0);
          const holderComparison = holderDiff === 0 ? '🟢 EQUAL' :
                                  holderDiff > 0 ? `🔴 +${holderDiff.toFixed(1)}% MORE CONCENTRATED` :
                                  `🟢 ${Math.abs(holderDiff).toFixed(1)}% LESS CONCENTRATED`;

          comparison += `**Top Holder Concentration:**\n`;
          comparison += `• ${tokenData.tokenName}: ${tokenData.topHolderPercentage}%\n`;
          comparison += `• MISTER: ${misterData?.topHolderPercentage || 0}%\n`;
          comparison += `• Difference: ${holderComparison}\n\n`;

          // Verdict Comparison
          const verdictEmoji = tokenData.verdict === 'SAFE' ? '🟢' :
                              tokenData.verdict === 'CAUTION' ? '⚠️' : '❌';

          comparison += `**Safety Verdict:**\n`;
          comparison += `• ${tokenData.tokenName}: ${verdictEmoji} ${tokenData.verdict}\n`;
          comparison += `• MISTER: 🏆 GOLD STANDARD\n\n`;

          // MISTER Rating
          const misterRating = getMisterRating(tokenData.riskScore);
          comparison += `**MISTER Rating:** ${misterRating}\n`;
          comparison += `**MISTER Approval:** ${getMisterComparison(tokenData.riskScore)}\n\n`;

          // Recommendation
          if (tokenData.riskScore <= 2) {
            comparison += `🏆 **Verdict:** ${tokenData.tokenName} meets MISTER standards! Excellent choice.`;
          } else if (tokenData.riskScore <= 4) {
            comparison += `🥈 **Verdict:** ${tokenData.tokenName} is MISTER-approved but not quite gold standard.`;
          } else if (tokenData.riskScore <= 6) {
            comparison += `🥉 **Verdict:** ${tokenData.tokenName} is acceptable but MISTER would be cautious.`;
          } else {
            comparison += `❌ **Verdict:** ${tokenData.tokenName} does not meet MISTER standards. Consider MISTER instead.`;
          }

          const compareEmbed = createMisterEmbed(
            `🎯 MISTER Comparison Analysis`,
            comparison
          );

          await interaction.editReply({ embeds: [compareEmbed] });
          console.log(`🎯 ${interaction.user.tag} compared ${tokenData.tokenName} to MISTER`);
        } catch (error) {
          console.error('Error comparing to MISTER:', error);
          const errorEmbed = createErrorEmbed('Comparison Error', 'Failed to compare token with MISTER standard.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    }

    else if (interaction.commandName === 'visualize') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'holders') {
        const policyId = interaction.options.getString('policy_id');
        const ticker = interaction.options.getString('ticker') || '';
        const type = interaction.options.getString('type') || 'pie';

        try {
          const result = await analyzeToken(policyId, ticker);

          if (result.success && result.data) {
            const token = result.data.summary;

            // Create text-based visualization
            const visualization = createTextVisualization(result.data, type);

            const vizEmbed = createInfoEmbed(
              `📊 ${token.tokenName} Holder Visualization (${type.toUpperCase()})`,
              visualization
            );

            vizEmbed.addFields(
              {
                name: '🎯 MISTER Rating',
                value: getMisterRating(token.riskScore),
                inline: true
              },
              {
                name: '📊 Risk Score',
                value: `${token.riskScore}/10`,
                inline: true
              },
              {
                name: '👥 Top Holder',
                value: `${token.topHolderPercentage}%`,
                inline: true
              }
            );

            await interaction.editReply({ embeds: [vizEmbed] });
            console.log(`📊 ${interaction.user.tag} visualized ${token.tokenName} holders`);
          } else {
            const errorEmbed = createErrorEmbed('Visualization Error', 'Unable to create visualization for this token.');
            await interaction.editReply({ embeds: [errorEmbed] });
          }
        } catch (error) {
          console.error('Error creating visualization:', error);
          const errorEmbed = createErrorEmbed('Visualization Error', 'Failed to generate holder visualization.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'portfolio') {
        const userId = interaction.user.id;

        try {
          const watchlist = await getWatchlist(userId);

          if (watchlist.length === 0) {
            const infoEmbed = createInfoEmbed(
              'Empty Portfolio',
              'Your watchlist is empty. Use `/watchlist add` to add tokens first!'
            );
            await interaction.editReply({ embeds: [infoEmbed] });
            return;
          }

          // Create portfolio visualization
          const portfolioViz = createPortfolioVisualization(watchlist);

          const vizEmbed = createInfoEmbed(
            `📊 Your Portfolio Visualization`,
            portfolioViz
          );

          await interaction.editReply({ embeds: [vizEmbed] });
          console.log(`📊 ${interaction.user.tag} visualized portfolio`);
        } catch (error) {
          console.error('Error creating portfolio visualization:', error);
          const errorEmbed = createErrorEmbed('Visualization Error', 'Failed to generate portfolio visualization.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'clusters') {
        const policyId = interaction.options.getString('policy_id');
        const ticker = interaction.options.getString('ticker') || '';

        try {
          const result = await analyzeToken(policyId, ticker);

          if (result.success && result.data) {
            const token = result.data.summary;

            // Create cluster visualization
            const clusterViz = createClusterVisualization(result.data);

            const vizEmbed = createMisterEmbed(
              `🔗 ${token.tokenName} Cluster Intelligence`,
              clusterViz
            );

            await interaction.editReply({ embeds: [vizEmbed] });
            console.log(`🔗 ${interaction.user.tag} analyzed ${token.tokenName} clusters`);
          } else {
            const errorEmbed = createErrorEmbed('Cluster Analysis Error', 'Unable to analyze clusters for this token.');
            await interaction.editReply({ embeds: [errorEmbed] });
          }
        } catch (error) {
          console.error('Error creating cluster analysis:', error);
          const errorEmbed = createErrorEmbed('Cluster Analysis Error', 'Failed to generate cluster analysis.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'relationships') {
        const policyId = interaction.options.getString('policy_id');
        const ticker = interaction.options.getString('ticker') || '';

        try {
          // Call the advanced relationship analysis endpoint
          const response = await fetch(`${process.env.RISK_API_URL}/analyze/${policyId}/relationships?assetName=${encodeURIComponent(ticker ? tickerToHex(ticker) : '')}`);
          const result = await response.json();

          if (result.error) {
            const errorEmbed = createErrorEmbed('Relationship Analysis Error', result.error);
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
          }

          if (result.advancedAnalysis) {
            const token = result.summary || { tokenName: ticker || 'Unknown Token' };

            // Create relationship analysis visualization
            const relationshipViz = createRelationshipVisualization(result.advancedAnalysis, token);

            const vizEmbed = createMisterEmbed(
              `🕵️ ${token.tokenName} Wallet Intelligence`,
              relationshipViz
            );

            await interaction.editReply({ embeds: [vizEmbed] });
            console.log(`🕵️ ${interaction.user.tag} analyzed ${token.tokenName} relationships`);
          } else {
            const errorEmbed = createErrorEmbed('Relationship Analysis Error', 'No relationship data available.');
            await interaction.editReply({ embeds: [errorEmbed] });
          }
        } catch (error) {
          console.error('Error creating relationship analysis:', error);
          const errorEmbed = createErrorEmbed('Relationship Analysis Error', 'Failed to generate relationship analysis.');
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    }

    else if (interaction.commandName === 'help') {
      await interaction.deferReply();

      const category = interaction.options.getString('category');

      if (!category) {
        // Show general help overview
        const helpEmbed = createMisterEmbed(
          '🎯 MISTER Risk Analysis Bot - Command Guide',
          `**🔍 Core Analysis:**\n` +
          `• \`/analyze\` - Analyze any Cardano token for rug pull risks\n` +
          `• \`/health\` - Check bot and API status\n\n` +

          `**📋 Portfolio Management:**\n` +
          `• \`/watchlist\` - Manage your token watchlist\n` +
          `• \`/portfolio\` - Portfolio risk analysis and comparison\n\n` +

          `**🔔 Alerts & Settings:**\n` +
          `• \`/alerts\` - Configure risk alerts\n` +
          `• \`/config\` - Customize GIFs and settings\n\n` +

          `**📈 Market Intelligence:**\n` +
          `• \`/market\` - View safe/risky tokens and market stats\n\n` +

          `**🎯 MISTER Features:**\n` +
          `• \`/mister\` - MISTER token analysis and comparisons\n\n` +

          `**📊 Visualizations:**\n` +
          `• \`/visualize\` - Create holder and cluster visualizations\n\n` +

          `**💡 Quick Start:**\n` +
          `1. Try \`/analyze policy_id:YOUR_TOKEN\`\n` +
          `2. Add safe tokens with \`/watchlist add\`\n` +
          `3. Enable alerts with \`/alerts on\`\n\n` +

          `Use \`/help category:CATEGORY\` for detailed command help!`
        );

        await interaction.editReply({ embeds: [helpEmbed] });
        console.log(`❓ ${interaction.user.tag} viewed general help`);
        return;
      }

      // Category-specific help
      let helpContent = '';
      let helpTitle = '';

      switch (category) {
        case 'analysis':
          helpTitle = '🔍 Analysis Commands';
          helpContent = `**\`/analyze policy_id:TOKEN [ticker:SYMBOL]\`**\n` +
            `Comprehensive rug pull risk analysis for any Cardano token.\n\n` +

            `**Examples:**\n` +
            `• \`/analyze policy_id:279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f ticker:SNEK\`\n` +
            `• \`/analyze policy_id:8fef2d34078659493ce161a6c7fba4b56afefa8535296a5743f69587\`\n\n` +

            `**What it analyzes:**\n` +
            `• Holder concentration and distribution\n` +
            `• Whale dominance patterns\n` +
            `• Liquidity pool detection\n` +
            `• Burn wallet identification\n` +
            `• Risk scoring (0-10 scale)\n` +
            `• MISTER safety rating\n\n` +

            `**\`/health\`**\n` +
            `Check bot status, API connectivity, and system health.`;
          break;

        case 'portfolio':
          helpTitle = '📋 Watchlist & Portfolio';
          helpContent = `**\`/watchlist add policy_id:TOKEN [ticker:SYMBOL]\`**\n` +
            `Add tokens to your personal watchlist (max 20).\n\n` +

            `**\`/watchlist remove ticker:SYMBOL\`**\n` +
            `Remove tokens from your watchlist.\n\n` +

            `**\`/watchlist show\`**\n` +
            `Display your current watchlist with risk scores.\n\n` +

            `**\`/watchlist analyze\`**\n` +
            `Batch analyze all tokens in your watchlist.\n\n` +

            `**\`/portfolio risk\`**\n` +
            `Calculate overall portfolio risk score.\n\n` +

            `**\`/portfolio summary\`**\n` +
            `Show portfolio overview and quick actions.\n\n` +

            `**\`/portfolio compare policy1:TOKEN1 policy2:TOKEN2\`**\n` +
            `Side-by-side comparison of two tokens.`;
          break;

        case 'config':
          helpTitle = '🔔 Alerts & Configuration';
          helpContent = `**\`/alerts on\`** / **\`/alerts off\`**\n` +
            `Enable or disable risk alert notifications.\n\n` +

            `**\`/alerts threshold:NUMBER\`**\n` +
            `Set risk threshold for alerts (1-10). Get notified when tokens exceed this risk level.\n\n` +

            `**\`/alerts status\`**\n` +
            `Check your current alert settings.\n\n` +

            `**\`/config show\`**\n` +
            `Display your current GIF and alert configuration.\n\n` +

            `**\`/config gif type:RISK_LEVEL url:GIF_URL\`**\n` +
            `Customize GIFs for different risk levels:\n` +
            `• \`type:safe\` - For safe tokens (risk 0-3)\n` +
            `• \`type:moderate\` - For moderate risk (risk 4-6)\n` +
            `• \`type:risky\` - For high risk (risk 7-10)\n\n` +

            `**\`/config gif type:reset\`**\n` +
            `Reset all GIFs to MISTER defaults.`;
          break;

        case 'market':
          helpTitle = '📈 Market Intelligence';
          helpContent = `**\`/market safe [limit:NUMBER]\`**\n` +
            `View top safe tokens from the database (default: 10).\n\n` +

            `**\`/market risky [limit:NUMBER]\`**\n` +
            `View top risky tokens to avoid (default: 10).\n\n` +

            `**\`/market stats\`**\n` +
            `Market overview with analysis statistics:\n` +
            `• Total tokens analyzed\n` +
            `• Safe vs risky token counts\n` +
            `• Average market risk score\n` +
            `• Market health assessment\n` +
            `• Last analysis timestamp\n\n` +

            `**Use Cases:**\n` +
            `• Find safe investment opportunities\n` +
            `• Avoid known risky tokens\n` +
            `• Monitor overall market health`;
          break;

        case 'mister':
          helpTitle = '🎯 MISTER Features';
          helpContent = `**\`/mister stats\`**\n` +
            `Analyze MISTER token - the gold standard for Cardano safety.\n\n` +

            `**\`/mister standard\`**\n` +
            `Learn about the MISTER safety rating system:\n` +
            `• 🏆 GOLD (0-2): MISTER-level safety\n` +
            `• 🥈 SILVER (3-4): MISTER-approved\n` +
            `• 🥉 BRONZE (5-6): MISTER-cautious\n` +
            `• ⚠️ CAUTION (7-8): MISTER-concerned\n` +
            `• ❌ AVOID (9-10): MISTER-rejected\n\n` +

            `**\`/mister compare policy_id:TOKEN [ticker:SYMBOL]\`**\n` +
            `Compare any token directly to MISTER standards:\n` +
            `• Risk score comparison\n` +
            `• Holder concentration analysis\n` +
            `• Safety verdict comparison\n` +
            `• MISTER approval rating\n` +
            `• Investment recommendation\n\n` +

            `**Philosophy:** "When in doubt, ask: Would MISTER approve?"`;
          break;

        case 'visualize':
          helpTitle = '📊 Visualizations';
          helpContent = `**\`/visualize holders policy_id:TOKEN [type:CHART_TYPE]\`**\n` +
            `Create holder distribution visualizations:\n` +
            `• \`type:pie\` - Pie chart of top holders\n` +
            `• \`type:bar\` - Bar chart distribution\n` +
            `• \`type:bubble\` - Bubble map visualization\n\n` +

            `**\`/visualize portfolio\`**\n` +
            `Visualize your watchlist portfolio distribution.\n\n` +

            `**\`/visualize clusters policy_id:TOKEN\`**\n` +
            `Advanced cluster analysis showing:\n` +
            `• Wallet relationship mapping\n` +
            `• Coordinated holder detection\n` +
            `• Manipulation pattern analysis\n` +
            `• Entity clustering intelligence\n\n` +

            `**\`/visualize relationships policy_id:TOKEN\`**\n` +
            `Deep wallet intelligence analysis:\n` +
            `• Connected wallet networks\n` +
            `• Transaction pattern analysis\n` +
            `• Suspicious relationship detection\n` +
            `• Advanced forensic insights`;
          break;

        default:
          helpContent = 'Invalid category selected.';
      }

      const categoryEmbed = createInfoEmbed(helpTitle, helpContent);
      await interaction.editReply({ embeds: [categoryEmbed] });
      console.log(`❓ ${interaction.user.tag} viewed ${category} help`);
    }

    else if (interaction.commandName === 'monitor') {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'test') {
        const hours = interaction.options.getInteger('hours') || 1;
        const limit = interaction.options.getInteger('limit') || 5;

        try {
          const testEmbed = createInfoEmbed(
            '🧪 Testing Top Volume Tokens',
            `**Timeframe:** ${hours} hour(s)\n**Testing:** Top ${limit} tokens\n\n⏳ Fetching and analyzing tokens...`
          );
          await interaction.editReply({ embeds: [testEmbed] });

          // Get top volume tokens from TapTools
          const tapToolsResponse = await axios.get('https://openapi.taptools.io/api/v1/token/top/volume', {
            params: {
              timeframe: `${hours}h`,
              limit: limit
            },
            headers: {
              'X-API-KEY': process.env.TAPTOOLS_API_KEY || 'WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO'
            },
            timeout: 15000
          });

          const topTokens = tapToolsResponse.data || [];

          if (topTokens.length === 0) {
            const noTokensEmbed = createInfoEmbed(
              'No Tokens Found',
              `No top volume tokens found for the ${hours} hour timeframe.`
            );
            await interaction.editReply({ embeds: [noTokensEmbed] });
            return;
          }

          let results = `📊 **Found ${topTokens.length} top volume tokens**\n\n`;

          for (let i = 0; i < Math.min(topTokens.length, limit); i++) {
            const token = topTokens[i];
            const tokenName = token.name || 'Unknown Token';
            const volume = token.volume ? `${token.volume.toLocaleString()} ADA` : 'Unknown';

            results += `**${i + 1}. ${tokenName}**\n`;
            results += `   📈 Volume: ${volume}\n`;
            results += `   🔗 Unit: \`${token.unit.substring(0, 20)}...\`\n`;

            // Try to get social links
            try {
              const linksResponse = await axios.get('https://openapi.taptools.io/api/v1/token/links', {
                params: { unit: token.unit },
                headers: {
                  'X-API-KEY': process.env.TAPTOOLS_API_KEY || 'WghkJaZlDWYdQFsyt3uiLdTIOYnR5uhO'
                },
                timeout: 5000
              });

              if (linksResponse.data) {
                const socialLinks = formatTokenLinks(linksResponse.data);
                if (socialLinks) {
                  results += `   🔗 Links: ${socialLinks}\n`;
                }
              }
            } catch (linkError) {
              // Ignore link errors
            }

            results += '\n';

            // Rate limiting
            if (i < topTokens.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          const resultEmbed = createSuccessEmbed(
            `🧪 Top Volume Token Test Complete`,
            results
          );

          await interaction.editReply({ embeds: [resultEmbed] });
          console.log(`🧪 ${interaction.user.tag} tested top volume tokens (${hours}h, ${limit} tokens)`);

        } catch (error) {
          console.error('Error testing top volume tokens:', error);
          const errorEmbed = createErrorEmbed(
            'Monitoring Test Error',
            'Failed to test top volume tokens. Please try again later.'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }

      else if (subcommand === 'start') {
        const hours = interaction.options.getInteger('hours') || 1;
        const limit = interaction.options.getInteger('limit') || 10;

        const startEmbed = createMisterEmbed(
          '🚀 Monitoring Started',
          `**Timeframe:** ${hours} hour(s)\n**Monitoring:** Top ${limit} tokens\n**Frequency:** Every 5 minutes\n**Duration:** 1 hour (12 cycles)\n\n🔄 Monitoring is now running in the background!\n\nUse \`/monitor status\` to check progress.\n\n**Note:** This is a demonstration. In production, monitoring would run on the server.`
        );

        await interaction.editReply({ embeds: [startEmbed] });
        console.log(`🚀 ${interaction.user.tag} started monitoring (${hours}h, ${limit} tokens)`);
      }

      else if (subcommand === 'status') {
        try {
          // Get real monitoring status from auto-monitor
          const statusResponse = await axios.get('http://localhost:4001/status', {
            timeout: 5000
          });

          if (statusResponse.data.success) {
            const status = statusResponse.data.status;
            const lastCheck = status.lastCheck !== 'Never' ?
              new Date(status.lastCheck).toLocaleString() : 'Never';
            const nextCheck = status.nextCheck !== 'Not scheduled' ?
              new Date(status.nextCheck).toLocaleString() : 'Not scheduled';

            const statusEmbed = createSuccessEmbed(
              '📊 Monitoring Status',
              `**Current Status:** ${status.isRunning ? '🟢 Active' : '🔴 Stopped'}\n` +
              `**Mode:** ${status.mode}\n` +
              `**Tokens Monitored:** ${status.tokensMonitored.toLocaleString()}\n` +
              `**Alerts Triggered:** ${status.alertsTriggered}\n` +
              `**Last Check:** ${lastCheck}\n` +
              `**Next Check:** ${nextCheck}\n` +
              `**Uptime:** ${Math.floor(status.uptime / 3600)}h ${Math.floor((status.uptime % 3600) / 60)}m\n\n` +
              `**Available Commands:**\n` +
              `• \`/monitor test\` - Quick test of top volume tokens\n` +
              `• \`/analyze ticker:TICKER\` - Force deep analysis for any known token\n\n` +
              `**🎯 Comprehensive Degen Coverage:** Monitoring volume + market cap tokens (30k-175k ADA)`
            );

            await interaction.editReply({ embeds: [statusEmbed] });
            console.log(`📊 ${interaction.user.tag} checked monitoring status - ${status.tokensMonitored} tokens monitored`);
          } else {
            throw new Error('Failed to get monitoring status');
          }
        } catch (error) {
          console.error('Error getting monitoring status:', error);

          // Fallback to demo mode message
          const statusEmbed = createInfoEmbed(
            '📊 Monitoring Status',
            `**Current Status:** 🔴 Auto-monitor not connected\n**Last Check:** Unknown\n**Tokens Monitored:** Unknown\n**Alerts Triggered:** Unknown\n\n**Available Commands:**\n• \`/monitor test\` - Quick test of top volume tokens\n• \`/monitor start\` - Start monitoring session\n\n**Note:** Auto-monitor service may be starting up. Try again in a moment.`
          );

          await interaction.editReply({ embeds: [statusEmbed] });
          console.log(`📊 ${interaction.user.tag} checked monitoring status - auto-monitor not available`);
        }
      }
    }

  } catch (error) {
    console.error(`❌ Error executing command ${interaction.commandName}:`, error);

    const errorMessage = {
      content: '❌ There was an error while executing this command!',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Handle errors
client.on(Events.Error, (error) => {
  console.error('❌ Discord client error:', error);
});

// Login to Discord
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ DISCORD_TOKEN is not set in environment variables');
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error('❌ Failed to login to Discord:', error);
  process.exit(1);
});

console.log('🚀 Starting Cardano Risk Analysis Discord Bot...');
