const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('smart')
    .setDescription('🤖 AI-powered natural language token analysis')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Ask anything about tokens in natural language')
        .setRequired(true)
    ),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🤖 Registering AI smart command...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('✅ Smart command registered successfully!');
    console.log('🎯 Users can now use: /smart query:"Is SNEK safe?"');
    console.log('🧠 AI will process natural language and execute appropriate commands');
  } catch (error) {
    console.error('❌ Error registering smart command:', error);
  }
})();
