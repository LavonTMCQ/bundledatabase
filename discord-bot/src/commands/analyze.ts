import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types';
import { RiskApiService } from '../services/riskApi';
import { Database } from '../database';
import { createRiskAnalysisEmbed, createErrorEmbed, DEFAULT_GIFS } from '../utils/embeds';

const riskApi = new RiskApiService();
const db = new Database(process.env.DATABASE_PATH || './data/bot.db');

export const analyzeCommand: Command = {
  data: new SlashCommandBuilder()
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
        .setName('asset_name')
        .setDescription('The asset name (hex encoded, optional)')
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      const policyId = interaction.options.get('policy_id')?.value as string;
      const assetName = interaction.options.get('asset_name')?.value as string || '';

      // Validate policy ID format (64 hex characters)
      if (!/^[a-fA-F0-9]{56}$/.test(policyId)) {
        const errorEmbed = createErrorEmbed(
          'Invalid Policy ID',
          'Policy ID must be exactly 56 hexadecimal characters.\n\nExample: `7529bed52d81a20e69c6dd447dd9cc0293daf4577f08d7ed2d8ab081`'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Get user's GIF configuration
      const userId = interaction.user.id;
      const guildId = interaction.guildId || 'dm';

      let userSettings = await db.getUserSettings(userId, guildId);
      let gifConfig = userSettings?.gifConfig || DEFAULT_GIFS;

      // Analyze the token
      const result = await riskApi.analyzeToken(policyId, assetName);

      if (!result.success || !result.data) {
        const errorEmbed = createErrorEmbed(
          'Analysis Failed',
          result.error || 'Unable to analyze token. Please check the policy ID and try again.'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Create beautiful embed with analysis results
      const analysisEmbed = createRiskAnalysisEmbed(result.data, gifConfig);

      await interaction.editReply({ embeds: [analysisEmbed] });

      // Log successful analysis
      console.log(`✅ Analysis completed for ${result.data.summary.tokenName} by ${interaction.user.tag}`);

    } catch (error) {
      console.error('Error in analyze command:', error);

      const errorEmbed = createErrorEmbed(
        'Unexpected Error',
        'An unexpected error occurred while analyzing the token. Please try again later.'
      );

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
