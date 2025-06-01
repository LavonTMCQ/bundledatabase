import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { analyzeCommand } from './commands/analyze';
import { healthCommand } from './commands/health';
import { configCommand } from './commands/config';

// Load environment variables
dotenv.config();

const commands = [
  analyzeCommand.data.toJSON(),
  healthCommand.data.toJSON(),
  configCommand.data.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

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
    commands.forEach((cmd: any) => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

deployCommands();
