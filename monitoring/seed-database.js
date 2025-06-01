const TokenDatabase = require('./token-database');

// Popular Cardano tokens to seed the database
const POPULAR_TOKENS = [
  {
    ticker: 'SNEK',
    policyId: '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f',
    assetNameHex: '534e454b',
    name: 'SNEK',
    description: 'The most popular meme token on Cardano',
    isVerified: true
  },
  {
    ticker: 'MISTER',
    policyId: '7529bed52d81a20e69c6dd447dd9cc0293daf4577f08d7ed2d8ab081',
    assetNameHex: '4d4953544552',
    name: 'MISTER - The Gold Standard',
    description: 'The gold standard for Cardano token safety',
    isVerified: true
  },
  {
    ticker: 'HOSKY',
    policyId: 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235',
    assetNameHex: '484f534b59',
    name: 'HOSKY Token',
    description: 'Popular Cardano meme token',
    isVerified: true
  },
  {
    ticker: 'WMT',
    policyId: '1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e',
    assetNameHex: '776f726c646d6f62696c65746f6b656e',
    name: 'World Mobile Token',
    description: 'Connecting the unconnected',
    isVerified: true
  },
  {
    ticker: 'WMTX',
    policyId: 'e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a',
    assetNameHex: '576f726c644d6f62696c65546f6b656e58',
    name: 'WorldMobileTokenX',
    description: 'World Mobile Token X',
    isVerified: true
  },
  {
    ticker: 'iUSD',
    policyId: 'f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880',
    assetNameHex: '69555344',
    name: 'Indigo USD',
    description: 'Indigo Protocol synthetic USD',
    isVerified: true
  },
  {
    ticker: 'USDA',
    policyId: 'fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae456',
    assetNameHex: '55534441',
    name: 'USDA Stablecoin',
    description: 'Anzens USDA stablecoin',
    isVerified: true
  },
  {
    ticker: 'DJED',
    policyId: '8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61',
    assetNameHex: '446a65644d6963726f555344',
    name: 'Djed MicroUSD',
    description: 'Djed algorithmic stablecoin',
    isVerified: true
  },
  {
    ticker: 'USDM',
    policyId: 'c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad',
    assetNameHex: '0014df105553444d',
    name: 'Moneta USDM',
    description: 'Moneta USD stablecoin',
    isVerified: true
  },
  {
    ticker: 'IAG',
    policyId: '5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114',
    assetNameHex: '494147',
    name: 'Iagon Token',
    description: 'Iagon decentralized storage and computing',
    isVerified: true
  },
  {
    ticker: 'C3',
    policyId: '8e51398904a5d3fc129fbf4f1589701de23c7824d5c90fdb9490e15a',
    assetNameHex: '434841524c4933',
    name: 'Charli3 Token',
    description: 'Charli3 oracle network token',
    isVerified: true
  },
  {
    ticker: 'AGIX',
    policyId: '2c6b4b5b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b',
    assetNameHex: '41474958',
    name: 'SingularityNET',
    description: 'AI marketplace token',
    isVerified: true
  },
  {
    ticker: 'SUNDAE',
    policyId: '9a9693a9a37912a5097918f97918c117b58d56300e93f8b8b8b8b8b8',
    assetNameHex: '53554e444145',
    name: 'SundaeSwap Token',
    description: 'SundaeSwap DEX token',
    isVerified: true
  },
  {
    ticker: 'MIN',
    policyId: '29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6',
    assetNameHex: '4d494e',
    name: 'Minswap Token',
    description: 'Minswap DEX token',
    isVerified: true
  },
  {
    ticker: 'MILK',
    policyId: '8a1cfae21368b8bebbbed9800fec304e95cce39a2a57dc35e6e3d9b8',
    assetNameHex: '4d494c4b',
    name: 'MuesliSwap MILK',
    description: 'MuesliSwap DEX token',
    isVerified: true
  }
];

class DatabaseSeeder {
  constructor() {
    this.tokenDb = new TokenDatabase();
  }

  async init() {
    try {
      await this.tokenDb.init();
      console.log('✅ Database seeder initialized');
    } catch (error) {
      console.error('❌ Failed to initialize database seeder:', error);
      throw error;
    }
  }

  async seedPopularTokens() {
    console.log('🌱 Seeding database with popular Cardano tokens...');
    
    let successCount = 0;
    let errorCount = 0;

    for (const tokenData of POPULAR_TOKENS) {
      try {
        const unit = tokenData.policyId + tokenData.assetNameHex;
        
        // Save token
        await this.tokenDb.saveToken({
          policyId: tokenData.policyId,
          assetNameHex: tokenData.assetNameHex,
          unit: unit,
          ticker: tokenData.ticker,
          name: tokenData.name,
          description: tokenData.description,
          isVerified: tokenData.isVerified,
          socialLinks: {}
        });

        // Save ticker mapping
        await this.tokenDb.saveTickerMapping(
          tokenData.ticker,
          unit,
          tokenData.policyId,
          tokenData.assetNameHex,
          1.0,
          'manual_seed'
        );

        successCount++;
        console.log(`✅ Seeded: ${tokenData.ticker} (${tokenData.name})`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to seed ${tokenData.ticker}:`, error.message);
      }
    }

    console.log(`\n🎯 Seeding complete!`);
    console.log(`✅ Success: ${successCount} tokens`);
    console.log(`❌ Errors: ${errorCount} tokens`);
    
    return { successCount, errorCount };
  }

  async checkDatabase() {
    try {
      const stats = await this.tokenDb.getStats();
      console.log('📊 DATABASE STATS:');
      console.log(`   Total Tokens: ${stats.totalTokens}`);
      console.log(`   Total Mappings: ${stats.totalMappings}`);
      console.log(`   Recent Tokens: ${stats.recentTokens}`);
      
      if (stats.topVolumeTokens && stats.topVolumeTokens.length > 0) {
        console.log('   Top Volume Tokens:');
        stats.topVolumeTokens.forEach((token, i) => {
          console.log(`     ${i + 1}. ${token.ticker || token.name} - ${token.volume_24h || 0} ADA`);
        });
      }

      return stats;
    } catch (error) {
      console.error('❌ Error checking database:', error);
      return null;
    }
  }

  async testTokenLookup() {
    console.log('\n🔍 Testing token lookups...');
    
    const testTickers = ['SNEK', 'MISTER', 'HOSKY', 'WMT', 'iUSD'];
    
    for (const ticker of testTickers) {
      try {
        const token = await this.tokenDb.findTokenByTicker(ticker);
        if (token) {
          console.log(`✅ ${ticker}: Found - ${token.name} (${token.unit.substring(0, 20)}...)`);
        } else {
          console.log(`❌ ${ticker}: Not found`);
        }
      } catch (error) {
        console.log(`❌ ${ticker}: Error - ${error.message}`);
      }
    }
  }

  async close() {
    this.tokenDb.close();
  }
}

// CLI interface
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  const command = process.argv[2];

  switch (command) {
    case 'seed':
      (async () => {
        try {
          await seeder.init();
          await seeder.seedPopularTokens();
          await seeder.checkDatabase();
          await seeder.testTokenLookup();
          await seeder.close();
          process.exit(0);
        } catch (error) {
          console.error('❌ Seeding failed:', error);
          process.exit(1);
        }
      })();
      break;

    case 'check':
      (async () => {
        try {
          await seeder.init();
          await seeder.checkDatabase();
          await seeder.testTokenLookup();
          await seeder.close();
          process.exit(0);
        } catch (error) {
          console.error('❌ Check failed:', error);
          process.exit(1);
        }
      })();
      break;

    case 'test':
      (async () => {
        try {
          await seeder.init();
          await seeder.testTokenLookup();
          await seeder.close();
          process.exit(0);
        } catch (error) {
          console.error('❌ Test failed:', error);
          process.exit(1);
        }
      })();
      break;

    default:
      console.log('🌱 Database Seeder - Populate with Popular Cardano Tokens');
      console.log('\nUsage: node seed-database.js [command]');
      console.log('\nCommands:');
      console.log('  seed   - Seed database with popular tokens');
      console.log('  check  - Check database stats and test lookups');
      console.log('  test   - Test token lookups only');
      console.log('\nExample: node seed-database.js seed');
      process.exit(0);
  }
}

module.exports = DatabaseSeeder;
