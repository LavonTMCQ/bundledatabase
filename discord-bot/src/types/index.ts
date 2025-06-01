import { SlashCommandBuilder, CommandInteraction, Client, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

export interface BotClient extends Client {
  commands: Map<string, Command>;
}

export interface RiskAnalysis {
  raw: {
    policyId: string;
    assetName: string;
    riskScore: number;
    topHolderPercentage: number;
    stakeClusters: number;
    totalHolders: number;
    patterns: string[];
  };
  formatted: string;
  summary: {
    tokenName: string;
    riskLevel: string;
    riskScore: number;
    topHolderPercentage: number;
    verdict: 'SAFE' | 'CAUTION' | 'AVOID';
  };
}

export interface GifConfig {
  safe: string;
  moderate: string;
  risky: string;
}

export interface UserSettings {
  userId: string;
  guildId: string;
  gifConfig: GifConfig;
  alertsEnabled: boolean;
  alertThreshold: number;
}

export interface WatchlistItem {
  userId: string;
  policyId: string;
  assetName: string;
  addedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
