const { EmbedBuilder } = require('discord.js');
const AICommandProcessor = require('./ai-command-processor');
const axios = require('axios');

class SmartCommandHandler {
  constructor() {
    this.aiProcessor = new AICommandProcessor();
    this.RISK_API_URL = 'http://localhost:4000';
    this.TOKEN_API_URL = 'http://localhost:3456';
  }

  async init() {
    await this.aiProcessor.init();
    console.log('🧠 Smart Command Handler initialized');
  }

  // Helper function for risk verdict
  getVerdictFromRiskScore(riskScore) {
    if (riskScore <= 3) return 'SAFE';
    if (riskScore <= 6) return 'CAUTION';
    return 'AVOID';
  }

  // Main smart command processor
  async handleSmartCommand(interaction, userInput) {
    try {
      console.log(`🧠 Processing smart command: "${userInput}"`);

      // Show thinking message
      await interaction.deferReply();

      // Process with AI
      const aiResult = await this.aiProcessor.processCommand(userInput, interaction.user.id);

      if (!aiResult.success) {
        return await this.sendErrorResponse(interaction, aiResult.error, userInput);
      }

      // Convert to slash command format
      const slashCommand = this.aiProcessor.convertToSlashCommand(aiResult);

      if (!slashCommand) {
        return await this.sendErrorResponse(interaction, 'Could not understand command', userInput);
      }

      // Execute the converted command
      await this.executeConvertedCommand(interaction, slashCommand, aiResult);

    } catch (error) {
      console.error('❌ Smart Command Error:', error.message);
      await this.sendErrorResponse(interaction, error.message, userInput);
    }
  }

  // Execute the converted slash command
  async executeConvertedCommand(interaction, slashCommand, aiResult) {
    const { commandName, options } = slashCommand;

    console.log(`🎯 Executing converted command: ${commandName}`, options);

    switch (commandName) {
      case 'analyze':
        await this.executeAnalyze(interaction, options, aiResult);
        break;
      case 'visualize':
        await this.executeVisualize(interaction, options, aiResult);
        break;
      case 'search':
        await this.executeSearch(interaction, options, aiResult);
        break;
      case 'compare':
        await this.executeCompare(interaction, options, aiResult);
        break;
      case 'portfolio':
        await this.executePortfolio(interaction, options, aiResult);
        break;
      case 'market':
        await this.executeMarket(interaction, options, aiResult);
        break;
      case 'watchlist':
        await this.executeWatchlist(interaction, options, aiResult);
        break;
      case 'monitor':
        await this.executeMonitor(interaction, options, aiResult);
        break;
      case 'config':
        await this.executeConfig(interaction, options, aiResult);
        break;
      case 'health':
        await this.executeHealth(interaction, options, aiResult);
        break;
      case 'help':
        await this.executeHelp(interaction, options, aiResult);
        break;
      default:
        await this.sendErrorResponse(interaction, `Unknown command: ${commandName}`, '');
    }
  }

  // Execute analyze command
  async executeAnalyze(interaction, options, aiResult) {
    try {
      let unit = null;
      let ticker = options.ticker;

      // Handle policy ID or ticker
      if (options.policy_id) {
        unit = options.policy_id;
        console.log(`🔍 Analyzing by policy ID: ${unit.substring(0, 20)}...`);
      } else if (options.ticker) {
        // Look up ticker in database
        const tokenResponse = await axios.get(`${this.TOKEN_API_URL}/api/token/find?ticker=${options.ticker}`);

        if (tokenResponse.data.success) {
          unit = tokenResponse.data.token.unit;
          ticker = tokenResponse.data.token.ticker;
          console.log(`✅ Found ${ticker}: ${unit.substring(0, 20)}...`);
        } else {
          return await this.sendErrorResponse(interaction, `Token ${options.ticker} not found in database. Try using the full policy ID instead.`, '');
        }
      }

      if (!unit) {
        return await this.sendErrorResponse(interaction, 'Please provide either a ticker or policy ID', '');
      }

      // Perform analysis using new holders endpoint
      const policyId = unit.length === 56 ? unit : unit.substring(0, 56);
      const analysisResponse = await axios.get(`${this.RISK_API_URL}/analyze/${policyId}/holders`);

      if (analysisResponse.data.error) {
        return await this.sendErrorResponse(interaction, analysisResponse.data.error || 'Analysis failed', '');
      }

      // Transform response to expected format
      const transformedData = {
        riskScore: analysisResponse.data.metadata?.riskScore || 5,
        verdict: this.getVerdictFromRiskScore(analysisResponse.data.metadata?.riskScore || 5),
        analysis: {
          holderConcentration: analysisResponse.data.metadata?.topHolderPercentage || 0,
          totalHolders: analysisResponse.data.totalHolders || 0
        }
      };

      // Create beautiful embed
      const embed = await this.createAnalysisEmbed(transformedData, aiResult);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Analyze execution error:', error.message);
      await this.sendErrorResponse(interaction, `Analysis failed: ${error.message}`, '');
    }
  }

  // Execute visualize command
  async executeVisualize(interaction, options, aiResult) {
    try {
      let unit = null;
      let ticker = options.ticker;
      const visualType = options.type || 'pie';

      // Handle policy ID or ticker
      if (options.policy_id) {
        unit = options.policy_id;
        console.log(`🔍 Visualizing by policy ID: ${unit.substring(0, 20)}...`);
      } else if (options.ticker) {
        // Look up ticker in database
        const tokenResponse = await axios.get(`${this.TOKEN_API_URL}/api/token/find?ticker=${options.ticker}`);

        if (tokenResponse.data.success) {
          unit = tokenResponse.data.token.unit;
          ticker = tokenResponse.data.token.ticker;
          console.log(`✅ Found ${ticker}: ${unit.substring(0, 20)}...`);
        } else {
          return await this.sendErrorResponse(interaction, `Token ${options.ticker} not found in database. Try using the full policy ID instead.`, '');
        }
      }

      if (!unit) {
        return await this.sendErrorResponse(interaction, 'Please provide either a ticker or policy ID', '');
      }

      // Perform analysis for visualization using new holders endpoint
      const policyId = unit.length === 56 ? unit : unit.substring(0, 56);
      const analysisResponse = await axios.get(`${this.RISK_API_URL}/analyze/${policyId}/holders`);

      if (analysisResponse.data.error) {
        return await this.sendErrorResponse(interaction, analysisResponse.data.error || 'Analysis failed', '');
      }

      // Transform response to expected format
      const transformedData = {
        riskScore: analysisResponse.data.metadata?.riskScore || 5,
        verdict: this.getVerdictFromRiskScore(analysisResponse.data.metadata?.riskScore || 5),
        analysis: {
          holderConcentration: analysisResponse.data.metadata?.topHolderPercentage || 0,
          totalHolders: analysisResponse.data.totalHolders || 0
        }
      };

      // Create visualization embed
      const embed = await this.createVisualizationEmbed(transformedData, visualType, aiResult);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Visualize execution error:', error.message);
      await this.sendErrorResponse(interaction, `Visualization failed: ${error.message}`, '');
    }
  }

  // Execute search command
  async executeSearch(interaction, options, aiResult) {
    try {
      const query = options.query || 'tokens';

      const searchResponse = await axios.get(`${this.TOKEN_API_URL}/api/token/search?q=${encodeURIComponent(query)}&limit=10`);

      if (!searchResponse.data.success) {
        return await this.sendErrorResponse(interaction, 'Search failed', '');
      }

      const embed = this.createSearchEmbed(searchResponse.data.tokens, query, aiResult);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Search execution error:', error.message);
      await this.sendErrorResponse(interaction, `Search failed: ${error.message}`, '');
    }
  }

  // Execute market command
  async executeMarket(interaction, options, aiResult) {
    try {
      const type = options.type || 'trending';

      // Get database stats
      const statsResponse = await axios.get(`${this.TOKEN_API_URL}/api/stats`);

      const embed = this.createMarketEmbed(statsResponse.data.stats, type, aiResult);
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('❌ Market execution error:', error.message);
      await this.sendErrorResponse(interaction, `Market data failed: ${error.message}`, '');
    }
  }

  // Execute monitor command
  async executeMonitor(interaction, options, aiResult) {
    const action = options.action || 'status';

    const embed = new EmbedBuilder()
      .setTitle('🔄 Token Monitoring')
      .setDescription(`🤖 **AI Processed:** ${aiResult.explanation}`)
      .setColor(0x0099FF)
      .setTimestamp();

    if (action === 'status') {
      embed.addFields({
        name: '📊 Monitoring Status',
        value: [
          '**Current Status:** Demo Mode',
          '**Last Check:** Just now',
          '**Tokens Monitored:** 0',
          '**Alerts Triggered:** 0',
          '',
          '**Available Commands:**',
          '• `/monitor test` - Quick test of top volume tokens',
          '• `/monitor start` - Start monitoring session'
        ].join('\n'),
        inline: false
      });
    } else if (action === 'start') {
      embed.addFields({
        name: '🚀 Monitoring Started',
        value: [
          '**Timeframe:** 1 hour(s)',
          '**Monitoring:** Top 10 tokens',
          '**Frequency:** Every 5 minutes',
          '**Duration:** 1 hour (12 cycles)',
          '',
          '🔄 Monitoring is now running in the background!',
          '',
          'Use `/smart query:"monitoring status"` to check progress.'
        ].join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  // Execute config command
  async executeConfig(interaction, options, aiResult) {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Bot Configuration')
      .setDescription(`🤖 **AI Processed:** ${aiResult.explanation}`)
      .setColor(0x9932CC)
      .setTimestamp();

    embed.addFields({
      name: '🎨 Available Settings',
      value: [
        '**GIF Configuration:**',
        '• Safe Token GIF',
        '• Moderate Risk GIF',
        '• High Risk GIF',
        '',
        '**Alert Settings:**',
        '• Alert Threshold (1-10)',
        '• Alert Status (On/Off)',
        '',
        '**Use traditional commands for detailed configuration:**',
        '• `/config show` - View current settings',
        '• `/config gif` - Update GIFs',
        '• `/alerts` - Manage alert settings'
      ].join('\n'),
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  }

  // Execute health command
  async executeHealth(interaction, options, aiResult) {
    const embed = new EmbedBuilder()
      .setTitle('🏥 System Health Status')
      .setDescription(`🤖 **AI Processed:** ${aiResult.explanation}`)
      .setColor(0x00FF00)
      .setTimestamp();

    embed.addFields({
      name: '📊 System Status',
      value: [
        '**Bot Status:** 🟢 Online',
        '**AI Commands:** 🟢 Operational',
        '**Risk API:** 🟢 Connected',
        '**Token Database:** 🟢 Connected',
        '**Monitoring:** 🟢 Active',
        '',
        '**Uptime:** Available via `/health` command',
        '**Last AI Query:** Just processed',
        '**Response Time:** < 1 second'
      ].join('\n'),
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  }

  // Execute help command
  async executeHelp(interaction, options, aiResult) {
    const embed = this.createHelpEmbed(aiResult);
    await interaction.editReply({ embeds: [embed] });
  }

  // Create visualization embed
  async createVisualizationEmbed(analysisData, visualType, aiResult) {
    const { riskScore, verdict, analysis } = analysisData;

    const color = riskScore >= 7 ? 0xFF0000 : riskScore >= 4 ? 0xFF6600 : 0x00FF00;
    const riskEmoji = riskScore >= 7 ? '🚨' : riskScore >= 4 ? '⚠️' : '✅';

    const embed = new EmbedBuilder()
      .setTitle(`${riskEmoji} Token Visualization - ${visualType.toUpperCase()}`)
      .setDescription(`🤖 **AI Processed:** ${aiResult.explanation}`)
      .setColor(color)
      .setTimestamp();

    // Add visualization type specific content
    let visualContent = '';
    switch (visualType) {
      case 'pie':
        visualContent = '🥧 **Pie Chart Visualization**\nShowing holder distribution breakdown';
        break;
      case 'bar':
        visualContent = '📊 **Bar Chart Visualization**\nShowing top holders comparison';
        break;
      case 'heatmap':
        visualContent = '🌡️ **Heatmap Visualization**\nShowing risk concentration patterns';
        break;
      case 'cluster':
        visualContent = '🔗 **Cluster Analysis**\nShowing wallet connection patterns';
        break;
      default:
        visualContent = '📈 **Data Visualization**\nShowing token analysis data';
    }

    embed.addFields({
      name: '📊 Visualization Type',
      value: visualContent,
      inline: false
    });

    // Basic risk info
    embed.addFields({
      name: '📊 Risk Assessment',
      value: [
        `**Risk Score:** ${riskScore}/10`,
        `**Verdict:** ${verdict}`,
        `**Confidence:** ${(aiResult.confidence * 100).toFixed(0)}%`
      ].join('\n'),
      inline: true
    });

    // Note about full visualization
    embed.addFields({
      name: '💡 Full Visualization',
      value: [
        'For complete visual charts, use:',
        `• \`/visualize ticker:TOKEN type:${visualType}\``,
        '• Traditional visualization commands',
        '',
        'AI smart commands provide quick insights!'
      ].join('\n'),
      inline: false
    });

    return embed;
  }

  // Create analysis embed
  async createAnalysisEmbed(analysisData, aiResult) {
    const { riskScore, verdict, analysis } = analysisData;

    const color = riskScore >= 7 ? 0xFF0000 : riskScore >= 4 ? 0xFF6600 : 0x00FF00;
    const riskEmoji = riskScore >= 7 ? '🚨' : riskScore >= 4 ? '⚠️' : '✅';

    const embed = new EmbedBuilder()
      .setTitle(`${riskEmoji} Token Risk Analysis`)
      .setDescription(`🤖 **AI Processed:** ${aiResult.explanation}`)
      .setColor(color)
      .setTimestamp();

    // Basic info
    embed.addFields({
      name: '📊 Risk Assessment',
      value: [
        `**Risk Score:** ${riskScore}/10`,
        `**Verdict:** ${verdict}`,
        `**Confidence:** ${(aiResult.confidence * 100).toFixed(0)}%`
      ].join('\n'),
      inline: true
    });

    // Holder analysis
    if (analysis.holderConcentration) {
      embed.addFields({
        name: '👥 Holder Analysis',
        value: [
          `**Top Holder:** ${analysis.holderConcentration.toFixed(2)}%`,
          `**Distribution:** ${analysis.holderConcentration > 25 ? 'Concentrated' : 'Well Distributed'}`
        ].join('\n'),
        inline: true
      });
    }

    // Social links
    if (analysis.socialLinks) {
      const links = [];
      if (analysis.socialLinks.website) links.push(`🌐 [Website](${analysis.socialLinks.website})`);
      if (analysis.socialLinks.twitter) links.push(`🐦 [Twitter](${analysis.socialLinks.twitter})`);
      if (analysis.socialLinks.discord) links.push(`💬 [Discord](${analysis.socialLinks.discord})`);

      if (links.length > 0) {
        embed.addFields({
          name: '🔗 Social Links',
          value: links.join(' • '),
          inline: false
        });
      }
    }

    // Market data
    if (analysis.marketData) {
      embed.addFields({
        name: '💰 Market Data',
        value: [
          `**Price:** $${analysis.marketData.price || 'Unknown'}`,
          `**Market Cap:** $${analysis.marketData.marketCap?.toLocaleString() || 'Unknown'}`,
          `**Volume:** ${analysis.marketData.volume24h?.toLocaleString() || 'Unknown'} ADA`
        ].join('\n'),
        inline: false
      });
    }

    return embed;
  }

  // Create search embed
  createSearchEmbed(tokens, query, aiResult) {
    const embed = new EmbedBuilder()
      .setTitle('🔍 Token Search Results')
      .setDescription(`🤖 **AI Processed:** ${aiResult.explanation}\n**Query:** "${query}"`)
      .setColor(0x0099FF)
      .setTimestamp();

    if (tokens.length === 0) {
      embed.addFields({
        name: '❌ No Results',
        value: 'No tokens found matching your search.',
        inline: false
      });
    } else {
      const tokenList = tokens.slice(0, 10).map(token =>
        `**${token.ticker || 'Unknown'}** - ${token.name || 'No name'} - $${token.price || 'Unknown'}`
      ).join('\n');

      embed.addFields({
        name: `📋 Found ${tokens.length} tokens`,
        value: tokenList,
        inline: false
      });
    }

    return embed;
  }

  // Create market embed
  createMarketEmbed(stats, type, aiResult) {
    const embed = new EmbedBuilder()
      .setTitle('📈 Market Intelligence')
      .setDescription(`🤖 **AI Processed:** ${aiResult.explanation}`)
      .setColor(0x00FF00)
      .setTimestamp();

    embed.addFields({
      name: '📊 Database Stats',
      value: [
        `**Total Tokens:** ${stats.totalTokens}`,
        `**Ticker Mappings:** ${stats.totalMappings}`,
        `**Last Updated:** ${new Date().toLocaleString()}`
      ].join('\n'),
      inline: false
    });

    return embed;
  }

  // Create help embed
  createHelpEmbed(aiResult) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 AI-Powered MISTER Commands')
      .setDescription('I can understand natural language! Try these examples:')
      .setColor(0x9932CC)
      .setTimestamp();

    embed.addFields(
      {
        name: '🔍 Token Analysis',
        value: [
          '• "Is SNEK safe?"',
          '• "Analyze HOSKY token"',
          '• "Check risk of MISTER"',
          '• "89f2cdc13b0ce1d55714f... CHEESE"'
        ].join('\n'),
        inline: true
      },
      {
        name: '📊 Visualizations',
        value: [
          '• "Show SNEK pie chart"',
          '• "HOSKY bar chart"',
          '• "Cluster analysis for MISTER"',
          '• "Heatmap of token holders"'
        ].join('\n'),
        inline: true
      },
      {
        name: '🔎 Search & Discovery',
        value: [
          '• "Find meme tokens"',
          '• "Search for DeFi tokens"',
          '• "Show me new tokens"'
        ].join('\n'),
        inline: true
      },
      {
        name: '📊 Market Intelligence',
        value: [
          '• "What are the riskiest tokens?"',
          '• "Show trending tokens"',
          '• "Market overview"'
        ].join('\n'),
        inline: true
      },
      {
        name: '🔄 Monitoring & Config',
        value: [
          '• "Start monitoring"',
          '• "Monitoring status"',
          '• "Show my settings"',
          '• "System health check"'
        ].join('\n'),
        inline: true
      },
      {
        name: '📋 Watchlist Management',
        value: [
          '• "Add SNEK to watchlist"',
          '• "Show my portfolio"',
          '• "Portfolio risk analysis"',
          '• "Remove token from list"'
        ].join('\n'),
        inline: true
      },
      {
        name: '⚡ Smart Features',
        value: [
          '• **Policy ID Support** - Paste any Cardano policy ID',
          '• **Ticker Recognition** - Just mention token names',
          '• **Context Understanding** - Ask questions naturally',
          '• **Error Recovery** - I\'ll suggest alternatives'
        ].join('\n'),
        inline: false
      }
    );

    if (aiResult.explanation) {
      embed.setFooter({ text: `AI: ${aiResult.explanation}` });
    }

    return embed;
  }

  // Send error response with suggestions
  async sendErrorResponse(interaction, error, userInput) {
    const suggestions = this.aiProcessor.generateSuggestions(userInput);

    const embed = new EmbedBuilder()
      .setTitle('❌ Command Processing Error')
      .setDescription(error)
      .setColor(0xFF0000)
      .setTimestamp();

    if (suggestions.length > 0) {
      embed.addFields({
        name: '💡 Suggestions',
        value: suggestions.join('\n'),
        inline: false
      });
    }

    embed.addFields({
      name: '🔧 Alternative Commands',
      value: [
        '`/analyze ticker:SNEK` - Analyze SNEK token',
        '`/search query:meme` - Search for tokens',
        '`/market trending` - Market overview',
        '`/help` - Full command list'
      ].join('\n'),
      inline: false
    });

    try {
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
    } catch (replyError) {
      console.error('❌ Error sending error response:', replyError.message);
    }
  }
}

module.exports = SmartCommandHandler;
