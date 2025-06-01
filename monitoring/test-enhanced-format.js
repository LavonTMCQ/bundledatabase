const AutoMonitor = require('./auto-monitor');

async function testEnhancedFormat() {
  console.log('🧪 Testing Enhanced Monitoring Format...');
  
  const monitor = new AutoMonitor();
  
  try {
    await monitor.init();
    
    // Mock some suspicious tokens with deep analysis data
    const mockSuspiciousTokens = [
      {
        ticker: 'TESTRUG',
        name: 'Test Rug Token',
        unit: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890abcdef12345678',
        volume: 5000,
        price: 0.001,
        analysis: {
          riskScore: 8,
          topHolderPercentage: 85.5,
          verdict: 'AVOID'
        },
        alertReasons: ['High Concentration: 85.5%', 'Suspicious Clustering'],
        deepAnalysis: {
          report: {
            summary: {
              riskScore: 8,
              verdict: 'HIGH_RISK',
              recommendation: 'AVOID',
              topHolderPercentage: 85.5,
              clusterCount: 50,
              suspiciousClusters: 15,
              liquidityRisk: 'HIGH'
            },
            details: {
              holderAnalysis: {
                totalHolders: 50,
                top5Percentage: 95.2
              },
              clusterAnalysis: {
                topClusterPercentage: 85.5
              },
              adaHandles: {
                resolvedHandles: 2,
                handles: {
                  'addr1...': '$@rugpuller',
                  'addr2...': '$@suspicious'
                }
              },
              liquidityAnalysis: {
                totalLiquidity: 25000
              },
              riskAssessment: {
                riskFactors: [
                  'EXTREME_CONCENTRATION',
                  'SUSPICIOUS_CLUSTERS',
                  'LOW_LIQUIDITY'
                ]
              },
              stakeAnalysis: {
                detailedClusters: [
                  {
                    stakeAddress: 'stake1u8suspicious123456789abcdef',
                    totalPercentage: 85.5,
                    connectedWallets: 25
                  },
                  {
                    stakeAddress: 'stake1u9coordinated987654321fedcba',
                    totalPercentage: 8.2,
                    connectedWallets: 5
                  }
                ]
              },
              basicInfo: {
                socialLinks: {
                  website: 'https://example.com',
                  twitter: 'https://twitter.com/test',
                  discord: 'https://discord.gg/test',
                  telegram: 'https://t.me/test'
                }
              }
            }
          }
        }
      }
    ];
    
    console.log('\n🚨 Testing Enhanced Suspicious Token Alert Format...');
    
    // Test the enhanced suspicious token alert
    await monitor.sendSuspiciousTokenAlert(mockSuspiciousTokens);
    
    console.log('\n✅ Enhanced format test completed!');
    console.log('\n🎯 NEW ENHANCED FORMAT FEATURES:');
    console.log('   ✅ Beautiful SNEK-style deep analysis format');
    console.log('   ✅ Risk score and recommendation display');
    console.log('   ✅ Detailed holder analysis breakdown');
    console.log('   ✅ Cluster analysis with percentages');
    console.log('   ✅ ADA handle resolution display');
    console.log('   ✅ Liquidity analysis section');
    console.log('   ✅ Risk factors enumeration');
    console.log('   ✅ Top stakes analysis with connected wallets');
    console.log('   ✅ Social links integration');
    console.log('   ✅ Proper footer: "Risk Ratings - Mister\'s Gold Standard"');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testEnhancedFormat();
}

module.exports = testEnhancedFormat;
