import axios from 'axios';
import { RiskAnalysis, ApiResponse } from '../types';

export class RiskApiService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  async analyzeToken(policyId: string, assetName: string = ''): Promise<ApiResponse<RiskAnalysis>> {
    try {
      const url = `${this.baseUrl}/analyze/${policyId}`;
      const params = new URLSearchParams();
      
      if (assetName) {
        params.append('assetName', assetName);
      }
      params.append('format', 'beautiful');

      const response = await axios.get(`${url}?${params.toString()}`, {
        timeout: 30000 // 30 second timeout
      });

      if (response.data.error) {
        return {
          success: false,
          error: response.data.error
        };
      }

      return {
        success: true,
        data: response.data as RiskAnalysis
      };
    } catch (error: any) {
      console.error('Risk API Error:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Risk analysis API is not available. Please try again later.'
        };
      }

      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Token not found or invalid policy ID.'
        };
      }

      return {
        success: false,
        error: 'Failed to analyze token. Please try again later.'
      };
    }
  }

  async getStats(): Promise<ApiResponse<any>> {
    try {
      const response = await axios.get(`${this.baseUrl}/stats`, {
        timeout: 10000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Failed to fetch statistics.'
      };
    }
  }

  async getSafeTokens(limit: number = 10): Promise<ApiResponse<any[]>> {
    try {
      const response = await axios.get(`${this.baseUrl}/safe-tokens?limit=${limit}`, {
        timeout: 10000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Failed to fetch safe tokens.'
      };
    }
  }

  async getRiskyTokens(limit: number = 10): Promise<ApiResponse<any[]>> {
    try {
      const response = await axios.get(`${this.baseUrl}/risky-tokens?limit=${limit}`, {
        timeout: 10000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Failed to fetch risky tokens.'
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      
      return response.data.status === 'ready';
    } catch (error) {
      return false;
    }
  }
}
