const TapToolsService = require('./taptools-service.js');

async function testTrades() {
  const service = new TapToolsService();
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const stakeAddress = 'stake1u8rphunzxm9lr4m688peqmnthmap35yt38rgvaqgsk5jcrqdr2vuc';
  
  console.log('🧪 Testing trade history with full stake address...');
  console.log(`Address: ${stakeAddress}`);
  
  try {
    const tradeHistory = await service.getWalletTradeHistory(stakeAddress, null, 365);
    
    if (tradeHistory && tradeHistory.totalTrades > 0) {
      console.log(`\n📊 TRADE ANALYSIS SUCCESS!`);
      console.log(`Period: ${tradeHistory.period}`);
      console.log(`Total trades: ${tradeHistory.totalTrades}`);
      console.log(`Buy trades: ${tradeHistory.buyTrades}`);
      console.log(`Sell trades: ${tradeHistory.sellTrades}`);
      console.log(`Total volume: ${tradeHistory.totalVolume.toFixed(2)} ADA`);
      console.log(`Average trade: ${tradeHistory.avgTradeSize.toFixed(2)} ADA`);
      console.log(`Largest trade: ${tradeHistory.largestTrade.toFixed(2)} ADA`);
      console.log(`Tokens traded: ${tradeHistory.tokens.join(', ')}`);
      
      if (tradeHistory.suspiciousPatterns.length > 0) {
        console.log(`🚨 Suspicious patterns: ${tradeHistory.suspiciousPatterns.join(', ')}`);
      }
      
      if (tradeHistory.recentTrades.length > 0) {
        console.log(`\n📈 RECENT TRADES:`);
        tradeHistory.recentTrades.slice(0, 5).forEach((trade, i) => {
          const date = new Date(trade.time * 1000).toLocaleDateString();
          const isBuy = trade.tokenB === 'lovelace' || trade.tokenBName === 'ADA';
          const action = isBuy ? 'BUY' : 'SELL';
          const token = isBuy ? trade.tokenAName : trade.tokenBName;
          const amount = isBuy ? trade.tokenBAmount / 1000000 : trade.tokenAAmount / 1000000;
          
          console.log(`${i + 1}. ${action} ${token} - ${amount.toFixed(2)} ADA (${date})`);
        });
      }
    } else {
      console.log('❌ No trade history found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

testTrades();
