/**
 * AI Analysis Service for Frontend
 * Provides interface to Claude AI analysis API
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class AIAnalysisService {
  constructor() {
    this.baseUrl = '/ai-analysis';  // Remove the duplicate /api/v1 prefix
  }

  /**
   * Analyze validation results using Claude AI
   */
  async analyzeValidationResults(validationResults, datasetInfo = null) {
    try {
      const response = await apiClient.post(`${this.baseUrl}/analyze`, {
        validation_results: validationResults,
        dataset_info: datasetInfo
      });

      return response.data;
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw new Error(`AI analysis failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Check if AI service is available
   */
  async checkServiceStatus() {
    try {
      const response = await apiClient.get(`${this.baseUrl}/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to check AI service status:', error);
      return {
        service_available: false,
        service_type: 'claude_ai',
        model: null,
        message: 'Failed to check service status'
      };
    }
  }

  /**
   * Get cached analysis or perform new analysis
   */
  async getAnalysis(validationResults, datasetInfo = null, forceRefresh = false) {
    const cacheKey = this.generateCacheKey(validationResults);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh && this.analysisCache && this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    // Perform new analysis
    const analysis = await this.analyzeValidationResults(validationResults, datasetInfo);
    
    // Cache the result
    if (!this.analysisCache) {
      this.analysisCache = new Map();
    }
    this.analysisCache.set(cacheKey, analysis);
    
    return analysis;
  }

  /**
   * Generate cache key for analysis results
   */
  generateCacheKey(validationResults) {
    const { summary, timestamp } = validationResults;
    return `${summary.totalTests}-${summary.failures}-${summary.warnings}-${timestamp}`;
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    if (this.analysisCache) {
      this.analysisCache.clear();
    }
  }
}

// Create global instance
const aiAnalysisService = new AIAnalysisService();
export default aiAnalysisService; 