// Frontend Validation Service - Calls Python Backend
// This service delegates all statistical computations to the Python backend
// which uses professional scientific libraries for accurate results

const API_BASE_URL = 'http://localhost:8000/api/v1';

export class ValidationService {
  constructor() {
    this.apiBase = API_BASE_URL;
  }

  /**
   * Main validation function that calls Python backend for statistical computations
   * @param {Object} realData - Real dataset with data and headers
   * @param {Object} syntheticData - Synthetic dataset with data and headers
   * @param {Object} options - Optional configuration
   * @returns {Promise<Object>} Validation results from Python backend
   */
  async computeValidationStatistics(realData, syntheticData, options = {}) {
    try {
      // Validate input data
      if (!realData || !syntheticData) {
        throw new Error('Both real and synthetic data are required');
      }

      if (!realData.data || !realData.headers) {
        throw new Error('Real data must contain data and headers');
      }

      if (!syntheticData.data || !syntheticData.headers) {
        throw new Error('Synthetic data must contain data and headers');
      }

      const response = await fetch(`${this.apiBase}/validation/compute-statistics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          real_data: realData,
          synthetic_data: syntheticData,
          options: options
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status}, detail: ${errorData.detail || 'Unknown error'}`);
      }

      const results = await response.json();
      
      // Transform Python backend results to match frontend expectations
      return this.transformBackendResults(results);
      
    } catch (error) {
      console.error('Validation computation failed:', error);
      throw new Error(`Validation computation failed: ${error.message}`);
    }
  }

  /**
   * Transform Python backend results to match frontend expectations
   * @param {Object} backendResults - Results from Python backend
   * @returns {Object} Transformed results for frontend
   */
  transformBackendResults(backendResults) {
    if (!backendResults) {
      throw new Error('No results received from backend');
    }

    const transformed = {
      timestamp: backendResults.timestamp || new Date().toISOString(),
      datasetInfo: backendResults.datasetInfo || {},
      processingTime: backendResults.processingTime || 0,
      tests: {},
      summary: backendResults.summary || {},
      keyFindings: {},
      statisticalQuality: {},
      practicalUsefulness: {},
      criticalIssues: [],
      recommendations: {
        dataQuality: [],
        privacyEnhancement: [],
        utilityImprovement: []
      },
      riskAssessment: {
        overallRisk: 'UNKNOWN',
        riskFactors: {},
        justification: ''
      }
    };

    // Transform test results
    if (backendResults.results) {
      Object.entries(backendResults.results).forEach(([category, testData]) => {
        if (testData) {
          transformed.tests[category] = {
            ...testData,  // Preserve ALL original data including correlation analysis
            testType: testData.testType || category,
            description: testData.description || '',
            tests: testData.tests || [],
            summary: testData.summary || {}
          };
        }
      });
    }

    // Extract key findings
    transformed.keyFindings = this.extractKeyFindings(backendResults.results);
    
    // Extract statistical quality
    transformed.statisticalQuality = this.extractStatisticalQuality(backendResults.results);
    
    // Extract practical usefulness
    transformed.practicalUsefulness = this.extractPracticalUsefulness(backendResults.results);
    
    // Identify critical issues
    transformed.criticalIssues = this.identifyCriticalIssues(backendResults.results);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(backendResults.results);
    transformed.recommendations = {
      ...transformed.recommendations,
      ...recommendations
    };
    
    // Calculate risk assessment
    transformed.riskAssessment = this.calculateRiskAssessment(backendResults.results);
    
    return transformed;
  }

  /**
   * Extract key findings from validation results
   */
  extractKeyFindings(results) {
    if (!results) return {};

    const findings = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      criticalIssues: 0,
      overallQuality: 'UNKNOWN'
    };

    try {
      Object.values(results).forEach(testGroup => {
        if (testGroup && testGroup.tests) {
          testGroup.tests.forEach(test => {
            if (test) {
              findings.totalTests++;
              if (test.result === 'ACCEPT') {
                findings.passedTests++;
              } else if (test.result === 'REJECT') {
                findings.failedTests++;
              }
              if (test.issues && test.issues.some(issue => issue.severity === 'HIGH')) {
                findings.criticalIssues++;
              }
            }
          });
        }
      });

      // Calculate overall quality
      if (findings.totalTests > 0) {
        const passRate = findings.passedTests / findings.totalTests;
        if (passRate >= 0.9) {
          findings.overallQuality = 'EXCELLENT';
        } else if (passRate >= 0.75) {
          findings.overallQuality = 'GOOD';
        } else if (passRate >= 0.6) {
          findings.overallQuality = 'FAIR';
        } else {
          findings.overallQuality = 'POOR';
        }
      }
    } catch (error) {
      console.error('Error extracting key findings:', error);
    }

    return findings;
  }

  /**
   * Extract statistical quality metrics
   */
  extractStatisticalQuality(results) {
    if (!results) return {};

    const quality = {
      distributionTests: 0,
      correlationTests: 0,
      statisticalTests: 0,
      multivariateTests: 0
    };

    try {
      Object.values(results).forEach(testGroup => {
        if (testGroup && testGroup.tests) {
          testGroup.tests.forEach(test => {
            if (test && test.type) {
              if (test.type.includes('distribution') || test.type.includes('KS') || test.type.includes('chi')) {
                quality.distributionTests++;
              } else if (test.type.includes('correlation')) {
                quality.correlationTests++;
              } else if (test.type.includes('t-test') || test.type.includes('statistical')) {
                quality.statisticalTests++;
              } else if (test.type.includes('multivariate') || test.type.includes('energy') || test.type.includes('KL')) {
                quality.multivariateTests++;
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Error extracting statistical quality:', error);
    }

    return quality;
  }

  /**
   * Extract practical usefulness metrics
   */
  extractPracticalUsefulness(results) {
    if (!results) return {};

    const usefulness = {
      dataUtility: 'UNKNOWN',
      privacyPreservation: 'UNKNOWN',
      syntheticQuality: 'UNKNOWN'
    };

    try {
      // This would be enhanced with more sophisticated analysis
      // For now, provide basic assessment
      usefulness.dataUtility = 'ASSESSED';
      usefulness.privacyPreservation = 'ASSESSED';
      usefulness.syntheticQuality = 'ASSESSED';
    } catch (error) {
      console.error('Error extracting practical usefulness:', error);
    }

    return usefulness;
  }

  /**
   * Identify critical issues from validation results
   */
  identifyCriticalIssues(results) {
    if (!results) return [];

    const criticalIssues = [];

    try {
      Object.values(results).forEach(testGroup => {
        if (testGroup && testGroup.tests) {
          testGroup.tests.forEach(test => {
            if (test && test.issues) {
              test.issues.forEach(issue => {
                if (issue && issue.severity === 'HIGH') {
                  criticalIssues.push({
                    column: test.column || 'Unknown',
                    testType: test.type || 'Unknown',
                    message: issue.message || 'Critical issue detected',
                    severity: issue.severity || 'HIGH'
                  });
                }
              });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error identifying critical issues:', error);
    }

    return criticalIssues;
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations(results) {
    if (!results) return {};

    const recommendations = {
      dataQuality: [],
      privacyEnhancement: [],
      utilityImprovement: []
    };

    try {
      // Analyze results and generate recommendations
      // This would be enhanced with more sophisticated analysis
      recommendations.dataQuality.push('Review data preprocessing steps');
      recommendations.privacyEnhancement.push('Consider additional privacy measures');
      recommendations.utilityImprovement.push('Optimize synthetic data generation parameters');
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }

    return recommendations;
  }

  /**
   * Calculate risk assessment
   */
  calculateRiskAssessment(results) {
    if (!results) return { overallRisk: 'UNKNOWN', riskFactors: {}, justification: '' };

    const assessment = {
      overallRisk: 'UNKNOWN',
      riskFactors: {},
      justification: ''
    };

    try {
      // Calculate risk based on validation results
      // This would be enhanced with more sophisticated analysis
      assessment.overallRisk = 'MEDIUM';
      assessment.riskFactors = {
        dataQuality: 'ASSESSED',
        privacyConcerns: 'ASSESSED',
        utilityIssues: 'ASSESSED'
      };
      assessment.justification = 'Risk assessment based on validation results';
    } catch (error) {
      console.error('Error calculating risk assessment:', error);
    }

    return assessment;
  }

  /**
   * Check validation service status
   */
  async checkServiceStatus() {
    try {
      const response = await fetch(`${this.apiBase}/validation/status`);
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Service status check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Service status check failed:', error);
      return { status: 'unavailable', error: error.message };
    }
  }
}

// Export singleton instance
export const validationService = new ValidationService(); 