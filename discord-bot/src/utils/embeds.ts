import { EmbedBuilder } from 'discord.js';
import { RiskAnalysis, GifConfig } from '../types';

export function createRiskAnalysisEmbed(analysis: RiskAnalysis, gifConfig: GifConfig): EmbedBuilder {
  const { summary, formatted } = analysis;
  
  // Determine color based on risk level
  let color: number;
  let gifUrl: string;
  
  switch (summary.verdict) {
    case 'SAFE':
      color = 0x00ff00; // Green
      gifUrl = gifConfig.safe;
      break;
    case 'CAUTION':
      color = 0xffff00; // Yellow
      gifUrl = gifConfig.moderate;
      break;
    case 'AVOID':
      color = 0xff0000; // Red
      gifUrl = gifConfig.risky;
      break;
    default:
      color = 0x808080; // Gray
      gifUrl = gifConfig.moderate;
  }

  // Extract key information for fields
  const riskScoreText = `${summary.riskScore}/10`;
  const riskLevelText = summary.riskLevel.toUpperCase();
  const topHolderText = `${summary.topHolderPercentage}%`;
  const verdictEmoji = summary.verdict === 'SAFE' ? '🟢' : 
                      summary.verdict === 'CAUTION' ? '⚠️' : '❌';

  const embed = new EmbedBuilder()
    .setTitle(`🔍 ${summary.tokenName} Token Risk Analysis`)
    .setDescription(`${verdictEmoji} **${summary.verdict}** - ${riskLevelText}`)
    .setColor(color)
    .addFields(
      {
        name: '📊 Risk Score',
        value: riskScoreText,
        inline: true
      },
      {
        name: '👥 Top Holder',
        value: topHolderText,
        inline: true
      },
      {
        name: '🎯 Verdict',
        value: `${verdictEmoji} ${summary.verdict}`,
        inline: true
      }
    )
    .setImage(gifUrl)
    .setFooter({
      text: 'Powered by Cabal Risk Analysis • Real-time Cardano data',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();

  // Add detailed analysis in a code block for readability
  const detailedAnalysis = formatted
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting for code block
    .replace(/🟢|⚠️|❌|✅|📊|💰|🎯/g, '') // Remove emojis for cleaner code block
    .trim();

  if (detailedAnalysis.length > 0) {
    embed.addFields({
      name: '📋 Detailed Analysis',
      value: `\`\`\`${detailedAnalysis.substring(0, 1000)}\`\`\``,
      inline: false
    });
  }

  return embed;
}

export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(0xff0000)
    .setFooter({
      text: 'Cabal Risk Analysis Bot',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(0x00ff00)
    .setFooter({
      text: 'Cabal Risk Analysis Bot',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setColor(0x0099ff)
    .setFooter({
      text: 'Cabal Risk Analysis Bot',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

export function createStatsEmbed(stats: any): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📊 Risk Analysis Statistics')
    .setColor(0x0099ff)
    .addFields(
      {
        name: '🔍 Total Analyses',
        value: stats.totalAnalyses?.toString() || '0',
        inline: true
      },
      {
        name: '🟢 Safe Tokens',
        value: stats.safeTokens?.toString() || '0',
        inline: true
      },
      {
        name: '❌ Risky Tokens',
        value: stats.riskyTokens?.toString() || '0',
        inline: true
      },
      {
        name: '📈 Average Risk Score',
        value: stats.averageRiskScore?.toFixed(1) || '0.0',
        inline: true
      },
      {
        name: '⏱️ Last Analysis',
        value: stats.lastAnalysis ? new Date(stats.lastAnalysis).toLocaleString() : 'Never',
        inline: true
      },
      {
        name: '🔄 API Status',
        value: '🟢 Online',
        inline: true
      }
    )
    .setFooter({
      text: 'Real-time statistics from Cabal database',
      iconURL: 'https://cryptologos.cc/logos/cardano-ada-logo.png'
    })
    .setTimestamp();
}

export const DEFAULT_GIFS: GifConfig = {
  safe: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
  moderate: 'https://media.giphy.com/media/3o7abAHdYvw33jLjWM/giphy.gif',
  risky: 'https://media.giphy.com/media/3o7absbD7PbTFQa0c8/giphy.gif'
};
