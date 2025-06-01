const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration
const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
const BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';
const RISK_API_URL = process.env.RISK_API_URL || 'http://localhost:4000';
const MONITOR_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DATA_DIR = './data';
const KNOWN_TOKENS_FILE = path.join(DATA_DIR, 'known_tokens.json');

class TokenMonitor {
  constructor() {
    this.knownTokens = new Set();
    this.isRunning = false;
    this.init();
  }

  async init() {
    // Create data directory if it doesn't exist
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    // Load known tokens
    await this.loadKnownTokens();
    
    console.log('🔍 Token Monitor initialized');
    console.log(`📊 Tracking ${this.knownTokens.size} known tokens`);
  }

  async loadKnownTokens() {
    try {
      const data = await fs.readFile(KNOWN_TOKENS_FILE, 'utf8');
      const tokens = JSON.parse(data);
      this.knownTokens = new Set(tokens);
      console.log(`📚 Loaded ${this.knownTokens.size} known tokens from file`);
    } catch (error) {
      console.log('📝 No existing token database found, starting fresh');
      this.knownTokens = new Set();
    }
  }

  async saveKnownTokens() {
    try {
      const tokens = Array.from(this.knownTokens);
      await fs.writeFile(KNOWN_TOKENS_FILE, JSON.stringify(tokens, null, 2));
      console.log(`💾 Saved ${tokens.length} known tokens to file`);
    } catch (error) {
      console.error('❌ Error saving known tokens:', error);
    }
  }

  async makeBlockfrostRequest(endpoint) {
    try {
      const response = await axios.get(`${BLOCKFROST_BASE_URL}${endpoint}`, {
        headers: {
          'project_id': BLOCKFROST_API_KEY
        },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Blockfrost API error for ${endpoint}:`, error.message);
      return null;
    }
  }

  async getLatestBlocks(count = 5) {
    console.log('🔍 Fetching latest blocks...');
    const blocks = await this.makeBlockfrostRequest(`/blocks/latest?count=${count}`);
    return blocks || [];
  }

  async getBlockTransactions(blockHash) {
    const transactions = await this.makeBlockfrostRequest(`/blocks/${blockHash}/txs`);
    return transactions || [];
  }

  async getTransactionUtxos(txHash) {
    const utxos = await this.makeBlockfrostRequest(`/txs/${txHash}/utxos`);
    return utxos;
  }

  async analyzeNewToken(policyId, assetName = '') {
    try {
      console.log(`🔍 Analyzing new token: ${policyId}${assetName ? '.' + assetName : ''}`);
      
      const response = await axios.get(`${RISK_API_URL}/analyze/${policyId}`, {
        params: {
          assetName: assetName,
          format: 'beautiful'
        },
        timeout: 60000
      });

      if (response.data.error) {
        console.log(`⚠️ Analysis error: ${response.data.error}`);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error(`❌ Error analyzing token ${policyId}:`, error.message);
      return null;
    }
  }

  extractTokensFromTransaction(utxos) {
    const tokens = new Set();
    
    if (!utxos || !utxos.outputs) return tokens;

    for (const output of utxos.outputs) {
      if (!output.amount) continue;
      
      for (const amount of output.amount) {
        if (amount.unit !== 'lovelace' && amount.unit.length > 56) {
          // This looks like a token (policy_id + asset_name)
          const policyId = amount.unit.substring(0, 56);
          const assetName = amount.unit.substring(56);
          
          // Only track tokens with reasonable asset names (not too long)
          if (assetName.length <= 64) {
            tokens.add(`${policyId}.${assetName}`);
          }
        }
      }
    }
    
    return tokens;
  }

  async scanForNewTokens() {
    console.log('🔍 Scanning for new tokens...');
    
    try {
      const blocks = await this.getLatestBlocks(3);
      const newTokens = new Set();
      
      for (const block of blocks) {
        console.log(`📦 Scanning block ${block.slot}...`);
        
        const transactions = await this.getBlockTransactions(block.hash);
        
        // Limit to first 10 transactions to avoid rate limits
        for (const tx of transactions.slice(0, 10)) {
          const utxos = await this.getTransactionUtxos(tx);
          
          if (utxos) {
            const tokens = this.extractTokensFromTransaction(utxos);
            
            for (const token of tokens) {
              if (!this.knownTokens.has(token)) {
                newTokens.add(token);
                this.knownTokens.add(token);
              }
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Rate limiting between blocks
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (newTokens.size > 0) {
        console.log(`🆕 Found ${newTokens.size} new tokens!`);
        
        for (const token of newTokens) {
          const [policyId, assetName] = token.split('.');
          console.log(`🎯 New token detected: ${policyId}.${assetName}`);
          
          // Analyze the new token
          const analysis = await this.analyzeNewToken(policyId, assetName);
          
          if (analysis && analysis.summary) {
            const { tokenName, riskScore, verdict } = analysis.summary;
            const riskEmoji = verdict === 'SAFE' ? '🟢' : verdict === 'CAUTION' ? '⚠️' : '🔴';
            
            console.log(`${riskEmoji} ${tokenName || 'Unknown'}: Risk ${riskScore}/10 (${verdict})`);
            
            // Save high-risk tokens for alerts
            if (riskScore >= 7) {
              await this.saveHighRiskToken(policyId, assetName, analysis);
            }
          }
          
          // Rate limiting between analyses
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Save updated known tokens
        await this.saveKnownTokens();
      } else {
        console.log('✅ No new tokens found in latest blocks');
      }
      
    } catch (error) {
      console.error('❌ Error scanning for new tokens:', error);
    }
  }

  async saveHighRiskToken(policyId, assetName, analysis) {
    try {
      const alertsFile = path.join(DATA_DIR, 'high_risk_alerts.json');
      let alerts = [];
      
      try {
        const data = await fs.readFile(alertsFile, 'utf8');
        alerts = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet
      }
      
      alerts.push({
        policyId,
        assetName,
        tokenName: analysis.summary.tokenName,
        riskScore: analysis.summary.riskScore,
        verdict: analysis.summary.verdict,
        detectedAt: new Date().toISOString(),
        topHolderPercentage: analysis.summary.topHolderPercentage
      });
      
      await fs.writeFile(alertsFile, JSON.stringify(alerts, null, 2));
      console.log(`🚨 High-risk token alert saved: ${analysis.summary.tokenName}`);
      
    } catch (error) {
      console.error('❌ Error saving high-risk alert:', error);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Monitor is already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Starting token monitor...');
    console.log(`⏰ Scanning every ${MONITOR_INTERVAL / 1000 / 60} minutes`);
    
    // Initial scan
    await this.scanForNewTokens();
    
    // Set up interval
    this.intervalId = setInterval(async () => {
      await this.scanForNewTokens();
    }, MONITOR_INTERVAL);
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Monitor is not running');
      return;
    }
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    console.log('🛑 Token monitor stopped');
  }

  async getStats() {
    const stats = {
      knownTokens: this.knownTokens.size,
      isRunning: this.isRunning,
      monitorInterval: MONITOR_INTERVAL / 1000 / 60 + ' minutes'
    };
    
    try {
      const alertsFile = path.join(DATA_DIR, 'high_risk_alerts.json');
      const data = await fs.readFile(alertsFile, 'utf8');
      const alerts = JSON.parse(data);
      stats.highRiskAlertsToday = alerts.filter(alert => {
        const alertDate = new Date(alert.detectedAt);
        const today = new Date();
        return alertDate.toDateString() === today.toDateString();
      }).length;
    } catch (error) {
      stats.highRiskAlertsToday = 0;
    }
    
    return stats;
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new TokenMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      monitor.start();
      break;
    case 'stop':
      monitor.stop();
      process.exit(0);
      break;
    case 'scan':
      monitor.scanForNewTokens().then(() => process.exit(0));
      break;
    case 'stats':
      monitor.getStats().then(stats => {
        console.log('📊 Token Monitor Stats:');
        console.log(JSON.stringify(stats, null, 2));
        process.exit(0);
      });
      break;
    default:
      console.log('Usage: node token-monitor.js [start|stop|scan|stats]');
      process.exit(1);
  }
}

module.exports = TokenMonitor;
