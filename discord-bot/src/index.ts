import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import dotenv from 'dotenv';
import { BotClient, Command } from './types';
import { analyzeCommand } from './commands/analyze';
import { healthCommand } from './commands/health';
import { configCommand } from './commands/config';

// Load environment variables
dotenv.config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
}) as BotClient;

// Initialize commands collection
client.commands = new Collection<string, Command>();

// Register commands
const commands = [
  analyzeCommand,
  healthCommand,
  configCommand,
];

commands.forEach(command => {
  client.commands.set(command.data.name, command);
});

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 Bot ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} servers`);
  console.log(`🔗 Connected to Risk Analysis API`);
  
  // Set bot status
  readyClient.user.setActivity('Cardano token risks 🔍', { type: 3 }); // Watching activity
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    console.log(`🔍 Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
    await command.execute(interaction);
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

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
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

export default client;
