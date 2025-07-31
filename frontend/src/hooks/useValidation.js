import { useState, useCallback } from 'react';
import { validationService } from '../services/validationService';
import aiAnalysisService from '../services/aiAnalysisService';

export const useValidation = () => {
  const [validationResults, setValidationResults] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [criticalIssues, setCriticalIssues] = useState([]);
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const runValidation = useCallback(async (realData, syntheticData, options = {}) => {
    if (!realData || !syntheticData) {
      setValidationError('Both real and synthetic datasets are required for validation');
      return null;
    }

    try {
      setValidating(true);
      setValidationError(null);
      setAiAnalysis(null);
      
      // Step 1: Get raw validation statistics
      const rawResults = await validationService.computeValidationStatistics(
        realData, 
        syntheticData, 
        {
          enableAdvancedTests: options.enableAdvancedTests || false,
          ...options
        }
      );
      
      // Step 2: Get AI analysis of the results
      const datasetInfo = {
        real: {
          rows: realData.data?.length || 0,
          columns: realData.headers?.length || 0,
          headers: realData.headers || []
        },
        synthetic: {
          rows: syntheticData.data?.length || 0,
          columns: syntheticData.headers?.length || 0,
          headers: syntheticData.headers || []
        }
      };
      
      const aiResults = await aiAnalysisService.analyzeValidationResults(rawResults, datasetInfo);
      
      // Step 3: Combine raw results with AI analysis
      const combinedResults = {
        ...rawResults,
        aiAnalysis: aiResults
      };
      
      setValidationResults(combinedResults);
      setAiAnalysis(aiResults);
      
      // Check for critical issues that need immediate attention
      const critical = [];
      Object.values(rawResults.tests).forEach(testGroup => {
        if (testGroup.tests) {
          testGroup.tests.forEach(test => {
            if (test.issues) {
              test.issues.forEach(issue => {
                if (issue.severity === 'HIGH') {
                  critical.push({
                    column: test.column,
                    type: test.type,
                    ...issue
                  });
                }
              });
            }
          });
        }
      });
      
      setCriticalIssues(critical);
      
      // Show popup if there are critical issues
      if (critical.length > 0) {
        setShowValidationPopup(true);
      }
      

      
      return combinedResults;
    } catch (error) {
      setValidationError(error.message);
      return null;
    } finally {
      setValidating(false);
    }
  }, []);

  const dismissValidationPopup = useCallback(() => {
    setShowValidationPopup(false);
  }, []);

  const clearValidation = useCallback(() => {
    setValidationResults(null);
    setValidationError(null);
    setCriticalIssues([]);
    setShowValidationPopup(false);
    setAiAnalysis(null);
  }, []);

  const getValidationSummary = useCallback(() => {
    if (!validationResults) return null;
    
    const { summary } = validationResults;
    
    // Use AI analysis for expert assessment if available
    let overallStatus = 'UNKNOWN';
    if (aiAnalysis && aiAnalysis.result_summary) {
      // AI analysis is available, mark as completed
      overallStatus = 'COMPLETED';
    } else {
      overallStatus = 'COMPLETED'; // Default status since no quality metrics
    }
    
    return {
      overallStatus,
      totalTests: summary.totalTests,
      recommendations: 0, // AI provides recommendations in text format, not structured
      aiAnalysis: aiAnalysis
    };
  }, [validationResults, aiAnalysis]);

  const getIssuesByCategory = useCallback(() => {
    if (!validationResults) return {};
    
    const categories = {};
    
    Object.entries(validationResults.tests).forEach(([category, testGroup]) => {
      categories[category] = {
        name: testGroup.testType || category,
        description: testGroup.description || '',
        issues: [],
        summary: testGroup.summary || { total: 0, passed: 0, warnings: 0, failures: 0 }
      };
      
      if (testGroup.tests) {
        testGroup.tests.forEach(test => {
          if (test.issues && test.issues.length > 0) {
            categories[category].issues.push({
              column: test.column,
              testType: test.type,
              issues: test.issues
            });
          }
        });
      }
    });
    
    return categories;
  }, [validationResults]);

  return {
    validationResults,
    validating,
    validationError,
    criticalIssues,
    showValidationPopup,
    aiAnalysis,
    runValidation,
    dismissValidationPopup,
    clearValidation,
    getValidationSummary,
    getIssuesByCategory
  };
}; 