import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types';
import { Database } from '../database';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed, DEFAULT_GIFS } from '../utils/embeds';

const db = new Database(process.env.DATABASE_PATH || './data/bot.db');

export const configCommand: Command = {
  data: new SlashCommandBuilder()
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

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.data[0].name;
      const userId = interaction.user.id;
      const guildId = interaction.guildId || 'dm';

      if (subcommand === 'show') {
        // Show current configuration
        const userSettings = await db.getUserSettings(userId, guildId);
        const gifConfig = userSettings?.gifConfig || DEFAULT_GIFS;

        const configEmbed = createInfoEmbed(
          'Your Current Configuration',
          `**Safe Token GIF:** [Preview](${gifConfig.safe})\n**Moderate Risk GIF:** [Preview](${gifConfig.moderate})\n**High Risk GIF:** [Preview](${gifConfig.risky})\n\n**Alerts:** ${userSettings?.alertsEnabled ? '🟢 Enabled' : '❌ Disabled'}\n**Alert Threshold:** ${userSettings?.alertThreshold || 7}/10`
        );

        configEmbed.setImage(gifConfig.safe); // Show safe GIF as preview

        await interaction.editReply({ embeds: [configEmbed] });
        return;
      }

      if (subcommand === 'gif') {
        const type = interaction.options.get('type')?.value as string;
        const url = interaction.options.get('url')?.value as string;

        if (type === 'reset') {
          // Reset to default GIFs
          await db.updateGifConfig(userId, guildId, DEFAULT_GIFS);

          const successEmbed = createSuccessEmbed(
            'GIFs Reset',
            'All GIFs have been reset to default values.'
          );

          await interaction.editReply({ embeds: [successEmbed] });
          return;
        }

        if (!url) {
          const errorEmbed = createErrorEmbed(
            'Missing URL',
            'Please provide a GIF URL for the selected risk level.'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        // Validate URL format
        if (!isValidUrl(url)) {
          const errorEmbed = createErrorEmbed(
            'Invalid URL',
            'Please provide a valid URL. URLs should start with http:// or https://'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        // Update GIF configuration
        const updateConfig: any = {};
        updateConfig[type] = url;

        await db.updateGifConfig(userId, guildId, updateConfig);

        const riskLevelName = type === 'safe' ? 'Safe Tokens' :
                             type === 'moderate' ? 'Moderate Risk' : 'High Risk';

        const successEmbed = createSuccessEmbed(
          'GIF Updated',
          `${riskLevelName} GIF has been updated successfully!`
        );

        successEmbed.setImage(url);

        await interaction.editReply({ embeds: [successEmbed] });
      }

    } catch (error) {
      console.error('Error in config command:', error);

      const errorEmbed = createErrorEmbed(
        'Configuration Error',
        'Unable to update configuration. Please try again later.'
      );

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}
