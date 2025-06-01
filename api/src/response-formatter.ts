interface TokenAnalysis {
  policyId: string;
  assetName: string;
  riskScore: number;
  patterns: string[];
  topHolderPercentage: number;
  stakeClusters: number;
  coordinatedBlocks: number;
  totalHolders: number;
  regularHolders: number;
  liquidityPools: number;
  infrastructureHolders: number;
  assumedTotalSupply: number;
  observedSupply: number;
  circulatingSupply: number;
  liquiditySupply: number;
  infrastructureSupply: number;
  holders: Array<{
    address: string;
    quantity: string;
    stake_address?: string | null;
  }>;
}

export class ResponseFormatter {
  static formatTokenAnalysis(analysis: TokenAnalysis): string {
    const tokenName = analysis.assetName ? this.hexToString(analysis.assetName) : 'Unknown Token';
    const riskLevel = this.getRiskLevel(analysis.riskScore, analysis.topHolderPercentage);
    const emoji = this.getRiskEmoji(riskLevel);

    let response = `🔍 **${tokenName} Token Risk Analysis**\n\n`;

    // Risk Score Header
    response += `${emoji} **Risk Score: ${analysis.riskScore}/10** - **${riskLevel.toUpperCase()}**\n\n`;

    // Key Metrics
    response += `📊 **Key Metrics:**\n`;
    response += `${this.getCheckmark(analysis.topHolderPercentage < 9)} Top Regular Holder: **${analysis.topHolderPercentage}%** ${analysis.topHolderPercentage < 9 ? '(Safe)' : '(⚠️ Above 9%)'}\n`;
    response += `${this.getCheckmark(analysis.stakeClusters > 50)} Stake Clusters: **${analysis.stakeClusters}** ${analysis.stakeClusters > 50 ? '(Well Distributed)' : '(Centralized)'}\n`;
    response += `${this.getCheckmark(analysis.coordinatedBlocks === 0)} Coordinated Blocks: **${analysis.coordinatedBlocks}** ${analysis.coordinatedBlocks === 0 ? '(No Manipulation)' : '(⚠️ Suspicious)'}\n`;
    response += `${this.getCheckmark(analysis.regularHolders > 80)} Regular Holders: **${analysis.regularHolders}** ${analysis.regularHolders > 80 ? '(Good Distribution)' : '(Limited Distribution)'}\n\n`;

    // Supply Breakdown
    response += `💰 **Supply Analysis:**\n`;
    response += `• **Total Supply:** ${this.formatNumber(analysis.assumedTotalSupply)} tokens\n`;
    response += `• **Circulating Supply:** ${this.formatNumber(analysis.circulatingSupply)} tokens (${((analysis.circulatingSupply / analysis.assumedTotalSupply) * 100).toFixed(1)}%)\n`;

    if (analysis.infrastructureSupply > 0) {
      response += `• **Infrastructure Locked:** ${this.formatNumber(analysis.infrastructureSupply)} tokens (${((analysis.infrastructureSupply / analysis.assumedTotalSupply) * 100).toFixed(1)}%) ✅\n`;
    }

    if (analysis.liquiditySupply > 0) {
      response += `• **Liquidity Pools:** ${this.formatNumber(analysis.liquiditySupply)} tokens (${((analysis.liquiditySupply / analysis.assumedTotalSupply) * 100).toFixed(1)}%) ✅\n`;
    }
    response += `\n`;

    // Risk Patterns
    if (analysis.patterns.length > 0) {
      response += `🚨 **Risk Patterns Detected:**\n`;
      analysis.patterns.forEach(pattern => {
        const isGood = pattern.includes('EXCLUDED') || pattern.includes('Infrastructure') || pattern.includes('Liquidity');
        response += `${isGood ? '✅' : '⚠️'} ${pattern}\n`;
      });
      response += `\n`;
    } else {
      response += `✅ **No Risk Patterns Detected** - Clean token distribution!\n\n`;
    }

    // Top Holders
    response += `👥 **Top 5 Holders:**\n`;
    analysis.holders.slice(0, 5).forEach((holder, index) => {
      const percentage = ((parseInt(holder.quantity) / analysis.circulatingSupply) * 100).toFixed(2);
      const isInfrastructure = this.isKnownInfrastructure(holder.address);
      const holderType = isInfrastructure ? '(Infrastructure)' : holder.stake_address ? '(Regular User)' : '(Script/Pool)';

      response += `${index + 1}. **${percentage}%** - ${holder.address.slice(0, 20)}... ${holderType}\n`;
    });
    response += `\n`;

    // Final Verdict
    response += `🎯 **Final Verdict:**\n`;
    response += this.getFinalVerdict(analysis);

    return response;
  }

  private static hexToString(hex: string): string {
    try {
      return Buffer.from(hex, 'hex').toString('utf8').replace(/[^\w\s$]/g, '');
    } catch {
      return 'Unknown';
    }
  }

  private static getRiskLevel(riskScore: number, topHolderPercentage: number): string {
    if (riskScore === 0 && topHolderPercentage < 5) return 'extremely safe';
    if (riskScore < 3 && topHolderPercentage < 9) return 'safe';
    if (riskScore < 6 || topHolderPercentage < 15) return 'moderate risk';
    if (riskScore < 8 || topHolderPercentage < 25) return 'high risk';
    return 'extreme risk';
  }

  private static getRiskEmoji(riskLevel: string): string {
    switch (riskLevel) {
      case 'extremely safe': return '🟢';
      case 'safe': return '✅';
      case 'moderate risk': return '⚠️';
      case 'high risk': return '🚨';
      case 'extreme risk': return '🔴';
      default: return '❓';
    }
  }

  private static getCheckmark(condition: boolean): string {
    return condition ? '✅' : '❌';
  }

  private static formatNumber(num: number): string {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  private static isKnownInfrastructure(address: string): boolean {
    const knownInfrastructure = [
      'addr1w8qmxkacjdffxah0l3qg8hq2pmvs58q8lcy42zy9kda2ylc6dy5r4', // burn wallet
      'addr1zyupekdkyr8f6lrnm4zulcs8juwv080hjfgsqvgkp98kkdkrxp0e2m4utglc7hmzkuta3e2td72cdjq9m9xlfn6rz8vq86l65l' // vesting wallet
    ];
    return knownInfrastructure.includes(address);
  }

  private static getFinalVerdict(analysis: TokenAnalysis): string {
    const riskLevel = this.getRiskLevel(analysis.riskScore, analysis.topHolderPercentage);

    switch (riskLevel) {
      case 'extremely safe':
        return `🟢 **EXTREMELY SAFE** - Perfect distribution with no red flags. Top holder only ${analysis.topHolderPercentage}% and ${analysis.stakeClusters} different stake clusters. **RECOMMENDED FOR INVESTMENT**.`;

      case 'safe':
        return `✅ **SAFE** - Good distribution with minimal risks. Top holder ${analysis.topHolderPercentage}% is acceptable and well decentralized. **LOW RISK INVESTMENT**.`;

      case 'moderate risk':
        return `⚠️ **MODERATE RISK** - Some concentration concerns. Top holder ${analysis.topHolderPercentage}% requires monitoring. **PROCEED WITH CAUTION**.`;

      case 'high risk':
        return `🚨 **HIGH RISK** - Significant concentration detected. Top holder ${analysis.topHolderPercentage}% is concerning. **AVOID OR MINIMAL INVESTMENT**.`;

      case 'extreme risk':
        return `🔴 **EXTREME RISK** - Dangerous concentration levels. Top holder ${analysis.topHolderPercentage}% indicates potential rug pull risk. **AVOID COMPLETELY**.`;

      default:
        return `❓ **UNKNOWN RISK** - Unable to determine risk level. **INVESTIGATE FURTHER**.`;
    }
  }
}
