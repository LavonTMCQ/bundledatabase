const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  // Core Analysis Commands
  new SlashCommandBuilder()
    .setName('analyze')
    .setDescription('🔍 Analyze Cardano token risk with beautiful formatting')
    .addStringOption(option =>
      option
        .setName('ticker')
        .setDescription('Token ticker (e.g., SNEK, HOSKY, MIN, AGIX)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('deep')
    .setDescription('🕵️ Super deep analysis with clustering and ADA handles')
    .addStringOption(option =>
      option
        .setName('ticker')
        .setDescription('Token ticker (e.g., SNEK, HOSKY, MIN, AGIX)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('gold')
    .setDescription('🏆 GOLD STANDARD risk analysis with free token detection')
    .addStringOption(option =>
      option
        .setName('ticker')
        .setDescription('Token ticker (e.g., SNEK, HOSKY, MIN, AGIX)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('visualize')
    .setDescription('🫧 Generate beautiful bubble map visualization')
    .addStringOption(option =>
      option
        .setName('ticker')
        .setDescription('Token ticker (e.g., SNEK, HOSKY, MIN, AGIX)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('price')
    .setDescription('💰 Get current token price and market data')
    .addStringOption(option =>
      option
        .setName('ticker')
        .setDescription('Token ticker (e.g., SNEK, HOSKY, MIN, AGIX)')
        .setRequired(true)
    ),

  // Watchlist Management
  new SlashCommandBuilder()
    .setName('watchlist')
    .setDescription('📋 Manage your token watchlist')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a token to your watchlist')
        .addStringOption(option =>
          option
            .setName('ticker')
            .setDescription('Token ticker (e.g., SNEK, HOSKY, MIN)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your current watchlist')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a token from your watchlist')
        .addStringOption(option =>
          option
            .setName('ticker')
            .setDescription('Token ticker to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('analyze')
        .setDescription('Analyze all tokens in your watchlist')
    ),

  // System Commands
  new SlashCommandBuilder()
    .setName('health')
    .setDescription('🏥 Check bot and API health status'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('📊 Show system status and statistics'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('❓ Show comprehensive help and command guide'),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Configure bot settings and preferences')
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show current configuration')
    ),

  // Market Intelligence
  new SlashCommandBuilder()
    .setName('market')
    .setDescription('📈 Market intelligence and token discovery')
    .addSubcommand(subcommand =>
      subcommand
        .setName('safe')
        .setDescription('Show safest tokens')
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
        .setDescription('Show riskiest tokens')
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
        .setDescription('Show market statistics')
    ),

  // Monitoring Commands
  new SlashCommandBuilder()
    .setName('monitor')
    .setDescription('🔍 Monitor top volume tokens for risk analysis')
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check monitoring status and recent findings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Quick test of top volume tokens')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of tokens to test (default: 5)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    ),

  // AI Smart Command
  new SlashCommandBuilder()
    .setName('smart')
    .setDescription('🤖 AI-powered natural language token analysis')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Ask anything about tokens in natural language')
        .setRequired(true)
    ),
].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

async function deployFixedCommands() {
  try {
    console.log('🚀 Deploying FIXED Discord commands with ticker support...');
    console.log('📋 Including all essential commands with proper parameters...');

    const clientId = process.env.CLIENT_ID;

    if (!clientId) {
      throw new Error('CLIENT_ID is not set in environment variables');
    }

    // Deploy all commands globally
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log('✅ Successfully deployed FIXED application commands!');
    console.log(`📝 Deployed ${commands.length} commands:`);

    console.log('\n🔍 CORE ANALYSIS COMMANDS:');
    console.log('   • /analyze ticker:SNEK - Basic risk analysis');
    console.log('   • /deep ticker:SNEK - Super deep analysis with clustering');
    console.log('   • /visualize ticker:SNEK - Beautiful bubble map visualization');
    console.log('   • /price ticker:SNEK - Current price and market data');

    console.log('\n📋 WATCHLIST COMMANDS:');
    console.log('   • /watchlist add ticker:SNEK - Add token to watchlist');
    console.log('   • /watchlist view - View your watchlist');
    console.log('   • /watchlist remove ticker:SNEK - Remove from watchlist');
    console.log('   • /watchlist analyze - Analyze all watchlist tokens');

    console.log('\n📈 MARKET & SYSTEM COMMANDS:');
    console.log('   • /market safe - Show safest tokens');
    console.log('   • /market risky - Show riskiest tokens');
    console.log('   • /health - System health check');
    console.log('   • /status - Bot status and stats');
    console.log('   • /help - Comprehensive help guide');

    console.log('\n🔍 MONITORING COMMANDS:');
    console.log('   • /monitor start - Start volume monitoring');
    console.log('   • /monitor status - Check monitoring status');
    console.log('   • /monitor test - Quick volume test');

    console.log('\n🤖 AI COMMANDS:');
    console.log('   • /smart query:"analyze SNEK token" - Natural language AI');

    console.log('\n🎉 ALL COMMANDS NOW SUPPORT TICKER-BASED INPUT!');
    console.log('💡 Users can now use simple tickers instead of policy IDs.');
    console.log('🏆 Ready for testing with MR\'s Gold Standard Intelligence!');

  } catch (error) {
    console.error('❌ Error deploying fixed commands:', error);
  }
}

deployFixedCommands();
