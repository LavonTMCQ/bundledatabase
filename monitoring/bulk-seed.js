const TapToolsService = require('./taptools-service');
const TokenDatabase = require('./token-database');

class BulkSeeder {
  constructor() {
    this.tapTools = new TapToolsService();
    this.tokenDb = new TokenDatabase();
  }

  async init() {
    try {
      await this.tokenDb.init();
      await this.tapTools.init();
      console.log('🚀 Bulk Seeder initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Bulk Seeder:', error);
      throw error;
    }
  }

  async seedTopVolumeTokens(limit = 200) {
    console.log(`🌱 Seeding database with top ${limit} volume tokens...`);
    
    try {
      // Get top volume tokens from different timeframes for variety
      const timeframes = ['1h', '24h', '7d'];
      const allTokens = new Map(); // Use Map to avoid duplicates
      
      for (const timeframe of timeframes) {
        console.log(`📊 Fetching top tokens for ${timeframe}...`);
        
        const tokens = await this.tapTools.getTopVolumeTokens(timeframe, Math.ceil(limit / timeframes.length));
        
        if (tokens && tokens.length > 0) {
          console.log(`✅ Found ${tokens.length} tokens for ${timeframe}`);
          
          tokens.forEach(token => {
            if (!allTokens.has(token.unit)) {
              allTokens.set(token.unit, {
                ...token,
                timeframe,
                policyId: token.unit.substring(0, 56),
                assetNameHex: token.unit.substring(56)
              });
            }
          });
        }
        
        // Rate limiting between timeframes
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const uniqueTokens = Array.from(allTokens.values());
      console.log(`🎯 Found ${uniqueTokens.length} unique tokens to seed`);

      // Limit to requested amount
      const tokensToSeed = uniqueTokens.slice(0, limit);
      
      let successCount = 0;
      let errorCount = 0;
      
      console.log(`\n🔄 Starting bulk seeding of ${tokensToSeed.length} tokens...`);
      
      for (let i = 0; i < tokensToSeed.length; i++) {
        const token = tokensToSeed[i];
        const progress = `${i + 1}/${tokensToSeed.length}`;
        
        try {
          console.log(`\n📦 [${progress}] Processing: ${token.ticker || 'Unknown'} (${token.timeframe})`);
          console.log(`   Unit: ${token.unit.substring(0, 20)}...`);
          console.log(`   Volume: ${token.volume?.toLocaleString() || 'Unknown'} ADA`);
          console.log(`   Price: $${token.price || 'Unknown'}`);

          // Save token to database with enhanced data
          const saved = await this.tapTools.saveTokenToDatabase({
            unit: token.unit,
            ticker: token.ticker,
            name: token.name,
            price: token.price,
            volume: token.volume,
            policyId: token.policyId,
            assetNameHex: token.assetNameHex
          });

          if (saved) {
            successCount++;
            console.log(`   ✅ Saved successfully`);
          } else {
            errorCount++;
            console.log(`   ❌ Save failed`);
          }

          // Rate limiting - be gentle with APIs
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (error) {
          errorCount++;
          console.error(`   ❌ Error processing ${token.ticker || 'Unknown'}:`, error.message);
        }

        // Progress update every 10 tokens
        if ((i + 1) % 10 === 0) {
          console.log(`\n📊 Progress: ${i + 1}/${tokensToSeed.length} (${Math.round(((i + 1) / tokensToSeed.length) * 100)}%)`);
          console.log(`✅ Success: ${successCount}, ❌ Errors: ${errorCount}`);
        }
      }

      console.log(`\n🎉 BULK SEEDING COMPLETE!`);
      console.log(`✅ Successfully seeded: ${successCount} tokens`);
      console.log(`❌ Errors: ${errorCount} tokens`);
      console.log(`📊 Success rate: ${Math.round((successCount / tokensToSeed.length) * 100)}%`);

      // Show final database stats
      const stats = await this.tokenDb.getStats();
      console.log(`\n📈 FINAL DATABASE STATS:`);
      console.log(`   Total Tokens: ${stats.totalTokens}`);
      console.log(`   Total Mappings: ${stats.totalMappings}`);
      console.log(`   Recent Tokens: ${stats.recentTokens}`);

      return { successCount, errorCount, totalProcessed: tokensToSeed.length };

    } catch (error) {
      console.error('❌ Error in bulk seeding:', error);
      throw error;
    }
  }

  async testRandomTokens(count = 10) {
    console.log(`🧪 Testing ${count} random tokens from database...`);
    
    try {
      const tokens = await this.tokenDb.getAllTokens(1, count, 'RANDOM()');
      
      if (tokens.length === 0) {
        console.log('❌ No tokens found in database');
        return;
      }

      console.log(`\n🔍 Testing ${tokens.length} random tokens:`);
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        console.log(`\n${i + 1}. ${token.ticker || 'Unknown'} (${token.name || 'No name'})`);
        console.log(`   Unit: ${token.unit.substring(0, 20)}...`);
        console.log(`   Price: $${token.price || 'Unknown'}`);
        console.log(`   Volume: ${token.volume_24h?.toLocaleString() || 'Unknown'} ADA`);
        console.log(`   Risk Score: ${token.risk_score || 'Not analyzed'}/10`);
        console.log(`   Social Links: ${token.website ? '🌐' : ''}${token.twitter ? '🐦' : ''}${token.telegram ? '💬' : ''}${token.discord ? '💭' : ''}`);
      }

    } catch (error) {
      console.error('❌ Error testing tokens:', error);
    }
  }

  async close() {
    this.tokenDb.close();
  }
}

// CLI interface
if (require.main === module) {
  const seeder = new BulkSeeder();
  const command = process.argv[2];
  const limit = parseInt(process.argv[3]) || 200;

  switch (command) {
    case 'seed':
      (async () => {
        try {
          await seeder.init();
          await seeder.seedTopVolumeTokens(limit);
          await seeder.testRandomTokens(5);
          await seeder.close();
          process.exit(0);
        } catch (error) {
          console.error('❌ Bulk seeding failed:', error);
          process.exit(1);
        }
      })();
      break;

    case 'test':
      (async () => {
        try {
          await seeder.init();
          await seeder.testRandomTokens(limit);
          await seeder.close();
          process.exit(0);
        } catch (error) {
          console.error('❌ Test failed:', error);
          process.exit(1);
        }
      })();
      break;

    default:
      console.log('🌱 Bulk Seeder - Populate Database with Top Volume Tokens');
      console.log('\nUsage: node bulk-seed.js [command] [limit]');
      console.log('\nCommands:');
      console.log('  seed [limit]  - Seed database with top volume tokens (default: 200)');
      console.log('  test [count]  - Test random tokens from database (default: 10)');
      console.log('\nExamples:');
      console.log('  node bulk-seed.js seed 200    # Seed with top 200 tokens');
      console.log('  node bulk-seed.js seed 500    # Seed with top 500 tokens');
      console.log('  node bulk-seed.js test 10     # Test 10 random tokens');
      process.exit(0);
  }
}

module.exports = BulkSeeder;
