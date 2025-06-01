const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('analyze')
    .setDescription('Analyze Cardano token risk with beautiful formatting')
    .addStringOption(option =>
      option
        .setName('policy_id')
        .setDescription('The policy ID of the token to analyze')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('ticker')
        .setDescription('The token ticker/symbol (e.g., MISTER, SNEK, HOSKY)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('health')
    .setDescription('Check bot and API health status'),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings and GIFs')
    .addSubcommand(subcommand =>
      subcommand
        .setName('gif')
        .setDescription('Configure GIFs for different risk levels')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Risk level type')
            .setRequired(true)
            .addChoices(
              { name: 'Safe Tokens', value: 'safe' },
              { name: 'Moderate Risk', value: 'moderate' },
              { name: 'High Risk', value: 'risky' },
              { name: 'Reset to Defaults', value: 'reset' }
            )
        )
        .addStringOption(option =>
          option
            .setName('url')
            .setDescription('GIF URL (not required for reset)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show current configuration')
    ),

  new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('Manage your token watchlist')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a token to your watchlist')
        .addStringOption(option =>
          option
            .setName('policy_id')
            .setDescription('The policy ID of the token')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('ticker')
            .setDescription('The token ticker/symbol (e.g., MISTER, SNEK)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a token from your watchlist')
        .addStringOption(option =>
          option
            .setName('policy_id')
            .setDescription('The policy ID of the token to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show your current watchlist')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('analyze')
        .setDescription('Analyze all tokens in your watchlist')
    ),

  new SlashCommandBuilder()
    .setName('alerts')
    .setDescription('Manage risk alerts and notifications')
    .addSubcommand(subcommand =>
      subcommand
        .setName('on')
        .setDescription('Enable risk alerts for your watchlist')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('off')
        .setDescription('Disable risk alerts')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('threshold')
        .setDescription('Set risk alert threshold')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('Risk level (1-10) to trigger alerts')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Show current alert settings')
    ),

  new SlashCommandBuilder()
    .setName('portfolio')
    .setDescription('Advanced portfolio analysis and tracking')
    .addSubcommand(subcommand =>
      subcommand
        .setName('risk')
        .setDescription('Calculate overall portfolio risk score')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('summary')
        .setDescription('Get detailed portfolio summary')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('compare')
        .setDescription('Compare two tokens side by side')
        .addStringOption(option =>
          option
            .setName('policy1')
            .setDescription('First token policy ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('policy2')
            .setDescription('Second token policy ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('ticker1')
            .setDescription('First token ticker')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('ticker2')
            .setDescription('Second token ticker')
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName('market')
    .setDescription('Market intelligence and trending analysis')
    .addSubcommand(subcommand =>
      subcommand
        .setName('safe')
        .setDescription('Show trending safe tokens')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of tokens to show (default: 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('risky')
        .setDescription('Show trending risky tokens')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of tokens to show (default: 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show overall market statistics')
    ),

  new SlashCommandBuilder()
    .setName('mister')
    .setDescription('MISTER token special features and analysis')
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show MISTER token statistics and analysis')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('compare')
        .setDescription('Compare any token against MISTER standard')
        .addStringOption(option =>
          option
            .setName('policy_id')
            .setDescription('Policy ID of token to compare with MISTER')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('ticker')
            .setDescription('Token ticker/symbol')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('standard')
        .setDescription('Learn about the MISTER safety standard')
    ),

  new SlashCommandBuilder()
    .setName('visualize')
    .setDescription('Generate visual analysis charts and graphs')
    .addSubcommand(subcommand =>
      subcommand
        .setName('holders')
        .setDescription('Create holder distribution visualization')
        .addStringOption(option =>
          option
            .setName('policy_id')
            .setDescription('Policy ID of token to visualize')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('ticker')
            .setDescription('Token ticker/symbol')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Visualization type')
            .setRequired(false)
            .addChoices(
              { name: 'Pie Chart', value: 'pie' },
              { name: 'Bar Chart', value: 'bar' },
              { name: 'Risk Heatmap', value: 'heatmap' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('portfolio')
        .setDescription('Visualize your portfolio risk distribution')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('clusters')
        .setDescription('Analyze stake clusters and connected wallets')
        .addStringOption(option =>
          option
            .setName('policy_id')
            .setDescription('Policy ID of token to analyze clusters')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('ticker')
            .setDescription('Token ticker/symbol')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('relationships')
        .setDescription('Advanced wallet relationship and non-buyer analysis')
        .addStringOption(option =>
          option
            .setName('policy_id')
            .setDescription('Policy ID of token to analyze relationships')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('ticker')
            .setDescription('Token ticker/symbol')
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show comprehensive help and command guide')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Get help for a specific category')
        .setRequired(false)
        .addChoices(
          { name: 'Analysis Commands', value: 'analysis' },
          { name: 'Watchlist & Portfolio', value: 'portfolio' },
          { name: 'Alerts & Configuration', value: 'config' },
          { name: 'Market Intelligence', value: 'market' },
          { name: 'MISTER Features', value: 'mister' },
          { name: 'Visualizations', value: 'visualize' }
        )
    ),

  new SlashCommandBuilder()
    .setName('monitor')
    .setDescription('Monitor top volume tokens for risk analysis')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start monitoring top volume tokens')
        .addIntegerOption(option =>
          option
            .setName('hours')
            .setDescription('Timeframe in hours (default: 1)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(24)
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of tokens to monitor (default: 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Quick test of top volume tokens')
        .addIntegerOption(option =>
          option
            .setName('hours')
            .setDescription('Timeframe in hours (default: 1)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(24)
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of tokens to test (default: 5)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check monitoring status and recent findings')
    )
].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log('🚀 Started refreshing application (/) commands.');

    const clientId = process.env.CLIENT_ID;

    if (!clientId) {
      throw new Error('CLIENT_ID is not set in environment variables');
    }

    // Deploy commands globally
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log('✅ Successfully reloaded application (/) commands.');
    console.log(`📝 Deployed ${commands.length} commands:`);
    commands.forEach((cmd) => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deployCommands();
