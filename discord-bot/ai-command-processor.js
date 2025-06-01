const axios = require('axios');

class AICommandProcessor {
  constructor() {
    // OpenRouter configuration
    this.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-or-v1-your-key-here';
    this.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

    // Use a fast, cheap model for command processing
    this.MODEL = 'anthropic/claude-3-haiku:beta';

    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      console.log('🤖 AI Command Processor initialized');
      this.initialized = true;
    }
  }

  // Main function to process natural language commands
  async processCommand(userInput, userId) {
    try {
      await this.init();

      console.log(`🤖 Processing AI command: "${userInput}" from user ${userId}`);

      const systemPrompt = this.getSystemPrompt();
      const response = await this.callOpenRouter(systemPrompt, userInput);

      if (!response) {
        return {
          success: false,
          error: 'AI processing failed',
          fallback: 'Please try using specific commands like `/analyze ticker:SNEK`'
        };
      }

      return this.parseAIResponse(response);

    } catch (error) {
      console.error('❌ AI Command Processing Error:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: 'Please try using specific commands like `/analyze ticker:SNEK`'
      };
    }
  }

  // System prompt for the AI
  getSystemPrompt() {
    return `You are MISTER, an AI assistant for Cardano token risk analysis. Your job is to interpret user requests and convert them into structured commands.

AVAILABLE COMMANDS:
1. ANALYZE - Risk analysis of tokens
2. VISUALIZE - Visual charts and graphs (pie, bar, heatmap, cluster)
3. SEARCH - Find tokens by name/ticker
4. COMPARE - Compare multiple tokens
5. PORTFOLIO - Portfolio analysis
6. MARKET - Market intelligence
7. WATCHLIST - Manage token watchlists
8. MONITOR - Token monitoring and alerts
9. CONFIG - Bot configuration
10. HEALTH - System status
11. HELP - Get help information

SUPPORTED TOKEN FORMATS:
- Ticker: SNEK, HOSKY, MISTER, GATOR, etc.
- Policy ID: 56-character hex string
- Unit: Policy ID + Asset Name (longer hex string)
- Token names: "Snek token", "Hosky coin", etc.

RESPONSE FORMAT (JSON only):
{
  "command": "ANALYZE|VISUALIZE|SEARCH|COMPARE|PORTFOLIO|MARKET|WATCHLIST|MONITOR|CONFIG|HEALTH|HELP",
  "parameters": {
    "tokens": ["SNEK", "HOSKY"],
    "action": "add|remove|show|analyze|test|start|status",
    "visualType": "pie|bar|heatmap|cluster",
    "options": {}
  },
  "confidence": 0.95,
  "explanation": "User wants to analyze SNEK token for risk"
}

EXAMPLES:
User: "Is SNEK safe?" → {"command": "ANALYZE", "parameters": {"tokens": ["SNEK"]}, "confidence": 0.9, "explanation": "User wants risk analysis of SNEK"}
User: "Show SNEK pie chart" → {"command": "VISUALIZE", "parameters": {"tokens": ["SNEK"], "visualType": "pie"}, "confidence": 0.95, "explanation": "User wants pie chart visualization of SNEK"}
User: "Compare SNEK vs HOSKY" → {"command": "COMPARE", "parameters": {"tokens": ["SNEK", "HOSKY"]}, "confidence": 0.95, "explanation": "User wants to compare two tokens"}
User: "Add MISTER to my watchlist" → {"command": "WATCHLIST", "parameters": {"action": "add", "tokens": ["MISTER"]}, "confidence": 0.9, "explanation": "User wants to add MISTER to watchlist"}
User: "What are the riskiest tokens?" → {"command": "MARKET", "parameters": {"action": "suspicious"}, "confidence": 0.8, "explanation": "User wants to see high-risk tokens"}
User: "Start monitoring" → {"command": "MONITOR", "parameters": {"action": "start"}, "confidence": 0.9, "explanation": "User wants to start token monitoring"}
User: "Show cluster analysis for HOSKY" → {"command": "VISUALIZE", "parameters": {"tokens": ["HOSKY"], "visualType": "cluster"}, "confidence": 0.95, "explanation": "User wants cluster visualization"}

POLICY ID HANDLING:
If user provides a policy ID or unit, extract it and include in tokens array.
Example: "89f2cdc13b0ce1d55714f6940cfa64353e0cfdccda1c60c3266b6cf554494d20434845455345 CHEESE"
→ {"command": "ANALYZE", "parameters": {"tokens": ["89f2cdc13b0ce1d55714f6940cfa64353e0cfdccda1c60c3266b6cf554494d20434845455345"], "ticker": "CHEESE"}, "confidence": 0.9}

IMPORTANT:
- Always respond with valid JSON only
- Set confidence between 0.1-1.0
- If unsure, use HELP command
- Extract all token identifiers (tickers, policy IDs, units)
- Be flexible with token name variations`;
  }

  // Call OpenRouter API
  async callOpenRouter(systemPrompt, userInput) {
    try {
      const response = await axios.post(this.OPENROUTER_BASE_URL, {
        model: this.MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        max_tokens: 500,
        temperature: 0.1, // Low temperature for consistent parsing
        top_p: 0.9
      }, {
        headers: {
          'Authorization': `Bearer ${this.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mister.cardano',
          'X-Title': 'MISTER Token Risk Analysis'
        },
        timeout: 10000
      });

      return response.data.choices[0]?.message?.content;

    } catch (error) {
      console.error('❌ OpenRouter API Error:', error.message);
      return null;
    }
  }

  // Parse AI response and validate
  parseAIResponse(aiResponse) {
    try {
      // Clean the response (remove markdown formatting if present)
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanResponse);

      // Validate required fields
      if (!parsed.command || !parsed.parameters) {
        throw new Error('Invalid AI response format');
      }

      // Validate command
      const validCommands = ['ANALYZE', 'VISUALIZE', 'SEARCH', 'COMPARE', 'PORTFOLIO', 'MARKET', 'WATCHLIST', 'MONITOR', 'CONFIG', 'HEALTH', 'HELP'];
      if (!validCommands.includes(parsed.command)) {
        throw new Error(`Invalid command: ${parsed.command}`);
      }

      // Validate confidence
      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        parsed.confidence = 0.5; // Default confidence
      }

      return {
        success: true,
        command: parsed.command,
        parameters: parsed.parameters,
        confidence: parsed.confidence,
        explanation: parsed.explanation || 'AI processed command',
        originalInput: aiResponse
      };

    } catch (error) {
      console.error('❌ AI Response Parsing Error:', error.message);
      return {
        success: false,
        error: `Failed to parse AI response: ${error.message}`,
        fallback: 'Please try using specific commands like `/analyze ticker:SNEK`',
        originalInput: aiResponse
      };
    }
  }

  // Convert AI command to Discord slash command format
  convertToSlashCommand(aiResult) {
    if (!aiResult.success) {
      return null;
    }

    const { command, parameters } = aiResult;

    switch (command) {
      case 'ANALYZE':
        if (parameters.tokens && parameters.tokens.length > 0) {
          const token = parameters.tokens[0];

          // Check if it's a policy ID/unit (long hex string)
          if (token.length >= 56 && /^[a-fA-F0-9]+$/.test(token)) {
            return {
              commandName: 'analyze',
              options: {
                policy_id: token,
                ticker: parameters.ticker || null
              }
            };
          } else {
            return {
              commandName: 'analyze',
              options: {
                ticker: token
              }
            };
          }
        }
        break;

      case 'VISUALIZE':
        if (parameters.tokens && parameters.tokens.length > 0) {
          const token = parameters.tokens[0];
          const visualType = parameters.visualType || 'pie';

          // Check if it's a policy ID/unit (long hex string)
          if (token.length >= 56 && /^[a-fA-F0-9]+$/.test(token)) {
            return {
              commandName: 'visualize',
              options: {
                policy_id: token,
                ticker: parameters.ticker || null,
                type: visualType
              }
            };
          } else {
            return {
              commandName: 'visualize',
              options: {
                ticker: token,
                type: visualType
              }
            };
          }
        }
        break;

      case 'SEARCH':
        return {
          commandName: 'search',
          options: {
            query: parameters.query || parameters.tokens?.join(' ') || 'tokens'
          }
        };

      case 'COMPARE':
        if (parameters.tokens && parameters.tokens.length >= 2) {
          return {
            commandName: 'compare',
            options: {
              token1: parameters.tokens[0],
              token2: parameters.tokens[1],
              token3: parameters.tokens[2] || null
            }
          };
        }
        break;

      case 'PORTFOLIO':
        return {
          commandName: 'portfolio',
          options: {
            action: parameters.action || 'show'
          }
        };

      case 'MARKET':
        return {
          commandName: 'market',
          options: {
            type: parameters.action || 'trending'
          }
        };

      case 'WATCHLIST':
        return {
          commandName: 'watchlist',
          options: {
            action: parameters.action || 'show',
            token: parameters.tokens?.[0] || null
          }
        };

      case 'MONITOR':
        return {
          commandName: 'monitor',
          options: {
            action: parameters.action || 'status'
          }
        };

      case 'CONFIG':
        return {
          commandName: 'config',
          options: {
            action: parameters.action || 'show'
          }
        };

      case 'HEALTH':
        return {
          commandName: 'health',
          options: {}
        };

      case 'HELP':
        return {
          commandName: 'help',
          options: {}
        };

      default:
        return null;
    }

    return null;
  }

  // Smart token identifier extraction
  extractTokenIdentifiers(text) {
    const identifiers = [];

    // Extract policy IDs (56 hex characters)
    const policyIdRegex = /\b[a-fA-F0-9]{56}\b/g;
    const policyIds = text.match(policyIdRegex) || [];
    identifiers.push(...policyIds);

    // Extract units (longer than 56 hex characters)
    const unitRegex = /\b[a-fA-F0-9]{57,}\b/g;
    const units = text.match(unitRegex) || [];
    identifiers.push(...units);

    // Extract tickers (2-10 uppercase letters)
    const tickerRegex = /\b[A-Z]{2,10}\b/g;
    const tickers = text.match(tickerRegex) || [];
    identifiers.push(...tickers);

    return [...new Set(identifiers)]; // Remove duplicates
  }

  // Generate helpful suggestions
  generateSuggestions(userInput) {
    const suggestions = [];

    if (userInput.toLowerCase().includes('safe') || userInput.toLowerCase().includes('risk')) {
      suggestions.push('Try: `/analyze ticker:SNEK` to check if SNEK is safe');
    }

    if (userInput.toLowerCase().includes('compare')) {
      suggestions.push('Try: `/compare token1:SNEK token2:HOSKY` to compare tokens');
    }

    if (userInput.toLowerCase().includes('watchlist') || userInput.toLowerCase().includes('track')) {
      suggestions.push('Try: `/watchlist add SNEK` to add SNEK to your watchlist');
    }

    if (userInput.toLowerCase().includes('market') || userInput.toLowerCase().includes('trending')) {
      suggestions.push('Try: `/market trending` to see trending tokens');
    }

    return suggestions;
  }
}

module.exports = AICommandProcessor;
