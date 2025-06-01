const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Import all traditional commands from deploy-simple.js
const traditionalCommands = [
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
        .setName('show')
        .setDescription('Show your current watchlist')
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
    ),

  new SlashCommandBuilder()
    .setName('market')
    .setDescription('Market intelligence and trending analysis')
    .addSubcommand(subcommand =>
      subcommand
        .setName('safe')
        .setDescription('Show trending safe tokens')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('risky')
        .setDescription('Show trending risky tokens')
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
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check monitoring status')
    ),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('show')
        .setDescription('Show current configuration')
    ),

  new SlashCommandBuilder()
    .setName('health')
    .setDescription('Check bot and API health status'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show comprehensive help and command guide'),

  // AI Smart Command
  new SlashCommandBuilder()
    .setName('smart')
    .setDescription('🤖 AI-powered natural language token analysis')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Ask anything about tokens in natural language')
        .setRequired(true)
    ),
];

const commands = traditionalCommands.map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function deployAllCommands() {
  try {
    console.log('🚀 Started refreshing ALL application (/) commands.');
    console.log('📋 Including both traditional and AI-powered commands...');

    const clientId = process.env.CLIENT_ID;

    if (!clientId) {
      throw new Error('CLIENT_ID is not set in environment variables');
    }

    // Deploy all commands globally
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log('✅ Successfully reloaded ALL application (/) commands.');
    console.log(`📝 Deployed ${commands.length} commands:`);
    
    console.log('\n🔧 TRADITIONAL COMMANDS:');
    commands.slice(0, -1).forEach((cmd) => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });
    
    console.log('\n🤖 AI-POWERED COMMANDS:');
    console.log(`   • /${commands[commands.length - 1].name} - ${commands[commands.length - 1].description}`);
    
    console.log('\n🎉 ALL COMMANDS ARE NOW AVAILABLE IN DISCORD!');
    console.log('💡 Users can now use both traditional commands and natural language AI commands.');

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deployAllCommands();
