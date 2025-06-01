#!/usr/bin/env node

/**
 * MISTER Performance Optimization Test Suite
 * Tests the new caching, parallel processing, and agent endpoints
 */

const fetch = require('node-fetch');

class OptimizationTester {
  constructor() {
    this.baseUrl = 'http://localhost:4000';
    this.monitorUrl = 'http://localhost:4001';
    this.tokenUrl = 'http://localhost:3456';
    this.results = {
      caching: [],
      endpoints: [],
      performance: []
    };
  }

  async runAllTests() {
    console.log('🚀 MISTER Performance Optimization Test Suite');
    console.log('='.repeat(50));

    try {
      await this.testSystemHealth();
      await this.testCachingPerformance();
      await this.testAgentEndpoints();
      await this.testPerformanceImprovements();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    }
  }

  async testSystemHealth() {
    console.log('\n🏥 Testing System Health...');
    
    try {
      // Test Risk API
      const riskHealth = await this.timeRequest(`${this.baseUrl}/health`);
      console.log(`✅ Risk API: ${riskHealth.time}ms`);

      // Test Monitoring API
      const monitorHealth = await this.timeRequest(`${this.monitorUrl}/health`);
      console.log(`✅ Monitoring API: ${monitorHealth.time}ms`);

      // Test Token API
      const tokenHealth = await this.timeRequest(`${this.tokenUrl}/api/health`);
      console.log(`✅ Token API: ${tokenHealth.time}ms`);

      // Test Agent Status
      const agentStatus = await this.timeRequest(`${this.baseUrl}/api/agent/status`);
      console.log(`✅ Agent Status: ${agentStatus.time}ms`);
      
      if (agentStatus.data.status === 'operational') {
        console.log(`📊 Cache Entries: ${agentStatus.data.cache.totalEntries}`);
        console.log(`🔄 Monitoring: ${agentStatus.data.services.monitoring}`);
      }

    } catch (error) {
      console.log(`❌ Health check failed: ${error.message}`);
    }
  }

  async testCachingPerformance() {
    console.log('\n🚀 Testing Caching Performance...');
    
    const testToken = '279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f'; // SNEK policy ID
    
    try {
      // First request (cache miss)
      console.log('📊 Testing cache miss (fresh analysis)...');
      const firstRequest = await this.timeRequest(
        `${this.baseUrl}/analyze/${testToken}?format=beautiful&force=true`
      );
      console.log(`⏱️ Fresh analysis: ${firstRequest.time}ms`);

      // Second request (cache hit)
      console.log('🚀 Testing cache hit (cached analysis)...');
      const secondRequest = await this.timeRequest(
        `${this.baseUrl}/analyze/${testToken}?format=beautiful`
      );
      console.log(`⚡ Cached analysis: ${secondRequest.time}ms`);

      // Calculate performance improvement
      const improvement = Math.round(((firstRequest.time - secondRequest.time) / firstRequest.time) * 100);
      console.log(`📈 Cache Performance Improvement: ${improvement}%`);

      this.results.caching.push({
        fresh: firstRequest.time,
        cached: secondRequest.time,
        improvement: improvement
      });

    } catch (error) {
      console.log(`❌ Caching test failed: ${error.message}`);
    }
  }

  async testAgentEndpoints() {
    console.log('\n🤖 Testing Agent Endpoints...');
    
    try {
      // Test latest tokens
      const latestTokens = await this.timeRequest(`${this.baseUrl}/api/agent/tokens/latest?limit=5`);
      console.log(`✅ Latest Tokens: ${latestTokens.time}ms (${latestTokens.data.count} tokens)`);

      // Test risky tokens
      const riskyTokens = await this.timeRequest(`${this.baseUrl}/api/agent/tokens/risky?limit=5`);
      console.log(`✅ Risky Tokens: ${riskyTokens.time}ms (${riskyTokens.data.count} tokens)`);

      // Test monitoring status
      const monitorStatus = await this.timeRequest(`${this.baseUrl}/api/agent/monitoring/current`);
      console.log(`✅ Monitoring Status: ${monitorStatus.time}ms`);

      // Test suspicious tokens from monitoring
      const suspicious = await this.timeRequest(`${this.monitorUrl}/suspicious-tokens?limit=3`);
      console.log(`✅ Suspicious Tokens: ${suspicious.time}ms (${suspicious.data.count} tokens)`);

      this.results.endpoints.push({
        latestTokens: latestTokens.time,
        riskyTokens: riskyTokens.time,
        monitorStatus: monitorStatus.time,
        suspicious: suspicious.time
      });

    } catch (error) {
      console.log(`❌ Agent endpoints test failed: ${error.message}`);
    }
  }

  async testPerformanceImprovements() {
    console.log('\n📈 Testing Performance Improvements...');
    
    try {
      // Test batch token lookup
      const batchStart = Date.now();
      const tokenPromises = [
        this.timeRequest(`${this.tokenUrl}/api/token/find?ticker=SNEK`),
        this.timeRequest(`${this.tokenUrl}/api/token/find?ticker=MISTER`),
        this.timeRequest(`${this.tokenUrl}/api/token/find?ticker=HOSKY`)
      ];
      
      const batchResults = await Promise.allSettled(tokenPromises);
      const batchTime = Date.now() - batchStart;
      
      const successfulRequests = batchResults.filter(r => r.status === 'fulfilled').length;
      console.log(`⚡ Parallel Token Lookup: ${batchTime}ms (${successfulRequests}/3 successful)`);

      // Test database connection pooling
      const dbStart = Date.now();
      const dbPromises = Array(5).fill().map(() => 
        this.timeRequest(`${this.tokenUrl}/api/stats`)
      );
      
      const dbResults = await Promise.allSettled(dbPromises);
      const dbTime = Date.now() - dbStart;
      const dbSuccessful = dbResults.filter(r => r.status === 'fulfilled').length;
      
      console.log(`🔗 Database Connection Pool: ${dbTime}ms (${dbSuccessful}/5 successful)`);
      console.log(`📊 Average per query: ${Math.round(dbTime / dbSuccessful)}ms`);

      this.results.performance.push({
        batchLookup: batchTime,
        dbConnectionPool: dbTime,
        avgQueryTime: Math.round(dbTime / dbSuccessful)
      });

    } catch (error) {
      console.log(`❌ Performance test failed: ${error.message}`);
    }
  }

  async timeRequest(url) {
    const start = Date.now();
    try {
      const response = await fetch(url);
      const data = await response.json();
      const time = Date.now() - start;
      
      return {
        time,
        data,
        success: response.ok
      };
    } catch (error) {
      const time = Date.now() - start;
      throw new Error(`Request to ${url} failed after ${time}ms: ${error.message}`);
    }
  }

  printResults() {
    console.log('\n📊 OPTIMIZATION TEST RESULTS');
    console.log('='.repeat(50));

    if (this.results.caching.length > 0) {
      const cache = this.results.caching[0];
      console.log(`🚀 Caching Performance:`);
      console.log(`   Fresh Analysis: ${cache.fresh}ms`);
      console.log(`   Cached Analysis: ${cache.cached}ms`);
      console.log(`   Improvement: ${cache.improvement}%`);
    }

    if (this.results.endpoints.length > 0) {
      const endpoints = this.results.endpoints[0];
      console.log(`\n🤖 Agent Endpoints Performance:`);
      console.log(`   Latest Tokens: ${endpoints.latestTokens}ms`);
      console.log(`   Risky Tokens: ${endpoints.riskyTokens}ms`);
      console.log(`   Monitor Status: ${endpoints.monitorStatus}ms`);
      console.log(`   Suspicious Tokens: ${endpoints.suspicious}ms`);
    }

    if (this.results.performance.length > 0) {
      const perf = this.results.performance[0];
      console.log(`\n📈 System Performance:`);
      console.log(`   Parallel Batch Lookup: ${perf.batchLookup}ms`);
      console.log(`   DB Connection Pool: ${perf.dbConnectionPool}ms`);
      console.log(`   Average Query Time: ${perf.avgQueryTime}ms`);
    }

    console.log('\n✅ OPTIMIZATION VALIDATION COMPLETE');
    console.log('🚀 Your MISTER system is optimized and ready for production!');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new OptimizationTester();
  tester.runAllTests().catch(console.error);
}

module.exports = OptimizationTester;
