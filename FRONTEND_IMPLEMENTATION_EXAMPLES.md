# 💻 MISTER Frontend Implementation Examples

## Overview
Practical code examples for integrating your frontend with the MISTER API system for data visualization and analytics.

---

## 🔧 **Frontend SDK/Client Library**

### **JavaScript/TypeScript Client**

```typescript
// mister-api-client.ts
export class MisterApiClient {
  private baseUrl: string;
  private tokenApiUrl: string;
  private apiKey?: string;

  constructor(config: {
    baseUrl?: string;
    tokenApiUrl?: string;
    apiKey?: string;
  } = {}) {
    this.baseUrl = config.baseUrl || 'https://risk-api-production.up.railway.app';
    this.tokenApiUrl = config.tokenApiUrl || 'https://token-api-production.up.railway.app';
    this.apiKey = config.apiKey;
  }

  private async request(url: string, options: RequestInit = {}): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Token Distribution for Charts
  async getTokenDistribution(policyId: string, options: {
    includeHandles?: boolean;
    limit?: number;
  } = {}): Promise<TokenDistributionResponse> {
    const params = new URLSearchParams();
    if (options.includeHandles !== undefined) params.set('includeHandles', String(options.includeHandles));
    if (options.limit) params.set('limit', String(options.limit));

    const url = `${this.baseUrl}/api/frontend/tokens/distribution/${policyId}?${params}`;
    return this.request(url);
  }

  // Risk Analytics for Dashboard
  async getRiskAnalytics(timeframe: string = '30d'): Promise<RiskAnalyticsResponse> {
    const url = `${this.baseUrl}/api/frontend/analytics/risk-distribution?timeframe=${timeframe}`;
    return this.request(url);
  }

  // Advanced Token Search
  async searchTokens(query: string, filters: SearchFilters = {}): Promise<TokenSearchResponse> {
    const params = new URLSearchParams({ q: query });
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });

    const url = `${this.tokenApiUrl}/api/frontend/search/tokens?${params}`;
    return this.request(url);
  }

  // Portfolio Analysis
  async analyzePortfolio(portfolio: PortfolioToken[]): Promise<PortfolioAnalysisResponse> {
    const url = `${this.tokenApiUrl}/api/frontend/portfolio/analyze`;
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify({ tokens: portfolio }),
    });
  }

  // Network Graph Data
  async getNetworkData(policyId: string, depth: number = 2): Promise<NetworkDataResponse> {
    const url = `${this.baseUrl}/api/frontend/network/${policyId}?depth=${depth}`;
    return this.request(url);
  }

  // Time Series Data
  async getTimeSeriesData(
    policyId: string,
    metric: 'risk' | 'volume' | 'holders' | 'price',
    timeframe: string
  ): Promise<TimeSeriesResponse> {
    const url = `${this.baseUrl}/api/frontend/timeseries/${policyId}?metric=${metric}&timeframe=${timeframe}`;
    return this.request(url);
  }

  // Real-time WebSocket Connection
  connectToLiveUpdates(
    onMessage: (data: any) => void,
    channels: string[] = ['monitoring', 'alerts']
  ): WebSocket {
    const wsUrl = this.baseUrl.replace('https://', 'wss://') + '/api/frontend/ws/live-updates';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    return ws;
  }
}

// Type Definitions
export interface TokenDistributionResponse {
  success: boolean;
  data: {
    tokenInfo: {
      policyId: string;
      ticker: string;
      name: string;
      totalSupply: number;
      riskScore: number;
    };
    holders: Array<{
      rank: number;
      stakeAddress: string;
      adaHandle?: string;
      amount: number;
      percentage: number;
      isPool: boolean;
    }>;
    chartData: {
      pieChart: Array<{
        label: string;
        value: number;
        color: string;
      }>;
    };
  };
}

export interface SearchFilters {
  riskMin?: number;
  riskMax?: number;
  volumeMin?: number;
  sortBy?: 'volume' | 'risk' | 'marketCap';
  limit?: number;
}

export interface PortfolioToken {
  policyId: string;
  ticker: string;
  allocation: number;
}
```

---

## 📊 **Chart.js Integration Examples**

### **1. Token Distribution Pie Chart**

```typescript
// components/TokenDistributionChart.tsx
import React, { useEffect, useRef } from 'react';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import { MisterApiClient } from '../lib/mister-api-client';

interface Props {
  policyId: string;
  ticker: string;
}

export const TokenDistributionChart: React.FC<Props> = ({ policyId, ticker }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    const loadChart = async () => {
      if (!chartRef.current) return;

      const client = new MisterApiClient();
      const data = await client.getTokenDistribution(policyId);

      // Destroy existing chart
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const config: ChartConfiguration = {
        type: 'pie',
        data: {
          labels: data.data.chartData.pieChart.map(item => item.label),
          datasets: [{
            data: data.data.chartData.pieChart.map(item => item.value),
            backgroundColor: data.data.chartData.pieChart.map(item => item.color),
            borderWidth: 2,
            borderColor: '#ffffff',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: `${ticker} Holder Distribution`,
              font: { size: 16, weight: 'bold' }
            },
            legend: {
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.parsed;
                  return `${label}: ${value.toFixed(2)}%`;
                }
              }
            }
          }
        }
      };

      chartInstance.current = new Chart(chartRef.current, config);
    };

    loadChart();

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [policyId, ticker]);

  return (
    <div className="chart-container" style={{ height: '400px' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};
```

### **2. Risk Analytics Dashboard**

```typescript
// components/RiskAnalyticsDashboard.tsx
import React, { useEffect, useState } from 'react';
import { Chart } from 'chart.js/auto';
import { MisterApiClient, RiskAnalyticsResponse } from '../lib/mister-api-client';

export const RiskAnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<RiskAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const client = new MisterApiClient();
        const data = await client.getRiskAnalytics('30d');
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (loading) return <div>Loading analytics...</div>;
  if (!analytics) return <div>Failed to load analytics</div>;

  const { overview, riskDistribution, trendData } = analytics.data;

  return (
    <div className="risk-dashboard">
      <div className="overview-cards">
        <div className="card">
          <h3>Total Tokens</h3>
          <p className="metric">{overview.totalTokens.toLocaleString()}</p>
        </div>
        <div className="card">
          <h3>Average Risk</h3>
          <p className="metric">{overview.averageRiskScore.toFixed(1)}/10</p>
        </div>
        <div className="card">
          <h3>Safe Tokens</h3>
          <p className="metric text-green">{overview.safeTokens}</p>
        </div>
        <div className="card">
          <h3>Risky Tokens</h3>
          <p className="metric text-red">{overview.riskyTokens}</p>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-section">
          <h3>Risk Distribution</h3>
          <RiskDistributionChart distribution={riskDistribution} />
        </div>
        <div className="chart-section">
          <h3>Risk Trend (30 Days)</h3>
          <RiskTrendChart trendData={trendData} />
        </div>
      </div>
    </div>
  );
};
```

---

## 🌐 **D3.js Network Visualization**

### **Wallet Network Graph**

```typescript
// components/NetworkGraph.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MisterApiClient } from '../lib/mister-api-client';

interface Props {
  policyId: string;
  width?: number;
  height?: number;
}

export const NetworkGraph: React.FC<Props> = ({ 
  policyId, 
  width = 800, 
  height = 600 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const loadNetworkData = async () => {
      if (!svgRef.current) return;

      const client = new MisterApiClient();
      const networkData = await client.getNetworkData(policyId);
      
      const { nodes, edges } = networkData.data;

      // Clear previous visualization
      d3.select(svgRef.current).selectAll("*").remove();

      const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height);

      // Create force simulation
      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

      // Create links
      const link = svg.append('g')
        .selectAll('line')
        .data(edges)
        .enter()
        .append('line')
        .attr('stroke', d => d.color || '#999')
        .attr('stroke-width', d => Math.sqrt(d.weight) * 2);

      // Create nodes
      const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('r', d => d.size)
        .attr('fill', d => d.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      // Add labels
      const label = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .text(d => d.label)
        .attr('font-size', 12)
        .attr('dx', 15)
        .attr('dy', 4);

      // Add tooltips
      node.append('title')
        .text(d => `${d.label}\nPercentage: ${d.properties.percentage}%\nAmount: ${d.properties.amount.toLocaleString()}`);

      // Update positions on simulation tick
      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);

        label
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      });

      // Drag functions
      function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
    };

    loadNetworkData();
  }, [policyId, width, height]);

  return (
    <div className="network-graph">
      <svg ref={svgRef}></svg>
    </div>
  );
};
```

---

## 🔄 **Real-time Updates Hook**

### **React Hook for Live Data**

```typescript
// hooks/useLiveUpdates.ts
import { useEffect, useState, useCallback } from 'react';
import { MisterApiClient } from '../lib/mister-api-client';

interface LiveUpdate {
  type: string;
  timestamp: string;
  data: any;
}

export const useLiveUpdates = (channels: string[] = ['monitoring', 'alerts']) => {
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const addUpdate = useCallback((update: LiveUpdate) => {
    setUpdates(prev => [update, ...prev.slice(0, 99)]); // Keep last 100 updates
  }, []);

  useEffect(() => {
    const client = new MisterApiClient();
    
    const websocket = client.connectToLiveUpdates(
      (data: LiveUpdate) => {
        addUpdate(data);
      },
      channels
    );

    websocket.onopen = () => setIsConnected(true);
    websocket.onclose = () => setIsConnected(false);
    websocket.onerror = () => setIsConnected(false);

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [channels, addUpdate]);

  const clearUpdates = useCallback(() => {
    setUpdates([]);
  }, []);

  return {
    updates,
    isConnected,
    clearUpdates,
  };
};

// Usage in component
export const LiveUpdatesComponent: React.FC = () => {
  const { updates, isConnected } = useLiveUpdates(['monitoring', 'alerts']);

  return (
    <div className="live-updates">
      <div className="status">
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      <div className="updates-list">
        {updates.map((update, index) => (
          <div key={index} className={`update update-${update.type}`}>
            <span className="timestamp">{new Date(update.timestamp).toLocaleTimeString()}</span>
            <span className="type">{update.type}</span>
            <span className="data">{JSON.stringify(update.data)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 🎨 **CSS Styling Examples**

```css
/* Dashboard Styles */
.risk-dashboard {
  padding: 20px;
  background: #f8f9fa;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.metric {
  font-size: 2em;
  font-weight: bold;
  margin: 10px 0;
}

.text-green { color: #28a745; }
.text-red { color: #dc3545; }

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.chart-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Network Graph Styles */
.network-graph {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

/* Live Updates Styles */
.live-updates {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.update {
  padding: 10px;
  border-bottom: 1px solid #eee;
  display: flex;
  gap: 10px;
}

.update-new_analysis { background: #e8f5e8; }
.update-risk_alert { background: #ffeaa7; }
```

This implementation guide provides everything needed to create rich, interactive visualizations using your MISTER API system!
