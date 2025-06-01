import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types';
import { RiskApiService } from '../services/riskApi';
import { createInfoEmbed, createErrorEmbed } from '../utils/embeds';

const riskApi = new RiskApiService();

export const healthCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('Check bot and API health status'),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      // Check API health
      const apiHealthy = await riskApi.checkHealth();

      // Get API stats
      const statsResult = await riskApi.getStats();

      const botUptime = process.uptime();
      const uptimeHours = Math.floor(botUptime / 3600);
      const uptimeMinutes = Math.floor((botUptime % 3600) / 60);

      const healthEmbed = createInfoEmbed(
        'System Health Status',
        `**Bot Status:** 🟢 Online\n**Uptime:** ${uptimeHours}h ${uptimeMinutes}m\n\n**API Status:** ${apiHealthy ? '🟢 Online' : '❌ Offline'}\n**Database:** ${statsResult.success ? '🟢 Connected' : '❌ Error'}`
      );

      if (statsResult.success && statsResult.data) {
        healthEmbed.addFields(
          {
            name: '📊 API Statistics',
            value: `**Total Analyses:** ${statsResult.data.totalAnalyses || 0}\n**Safe Tokens:** ${statsResult.data.safeTokens || 0}\n**Risky Tokens:** ${statsResult.data.riskyTokens || 0}`,
            inline: true
          },
          {
            name: '⚡ Performance',
            value: `**Average Risk Score:** ${statsResult.data.averageRiskScore?.toFixed(1) || '0.0'}\n**Last Analysis:** ${statsResult.data.lastAnalysis ? 'Recent' : 'None'}`,
            inline: true
          }
        );
      }

      await interaction.editReply({ embeds: [healthEmbed] });

    } catch (error) {
      console.error('Error in health command:', error);

      const errorEmbed = createErrorEmbed(
        'Health Check Failed',
        'Unable to retrieve system health information.'
      );

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
