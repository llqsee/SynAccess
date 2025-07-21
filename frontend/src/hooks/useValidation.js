import { useState, useCallback } from 'react';
import { validationService } from '../services/validationService';

export const useValidation = () => {
  const [validationResults, setValidationResults] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [criticalIssues, setCriticalIssues] = useState([]);
  const [showValidationPopup, setShowValidationPopup] = useState(false);

  const runValidation = useCallback(async (realData, syntheticData, options = {}) => {
    if (!realData || !syntheticData) {
      setValidationError('Both real and synthetic datasets are required for validation');
      return null;
    }

    try {
      setValidating(true);
      setValidationError(null);
      
      console.log('Starting validation analysis...');
      
      const results = await validationService.validateDatasets(
        realData, 
        syntheticData, 
        {
          enableAdvancedTests: options.enableAdvancedTests || false,
          ...options
        }
      );
      
      setValidationResults(results);
      
      // Check for critical issues that need immediate attention
      const critical = [];
      Object.values(results.tests).forEach(testGroup => {
        if (testGroup.tests) {
          testGroup.tests.forEach(test => {
            if (test.issues) {
              test.issues.forEach(issue => {
                if (issue.severity === 'CRITICAL' || issue.severity === 'HIGH') {
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
      
      console.log(`Validation completed: ${results.summary.totalTests} tests run, ${critical.length} critical issues found`);
      
      return results;
    } catch (error) {
      console.error('Validation failed:', error);
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
  }, []);

  const getValidationSummary = useCallback(() => {
    if (!validationResults) return null;
    
    const { summary } = validationResults;
    const totalIssues = summary.warnings + summary.failures + summary.critical;
    
    return {
      overallStatus: totalIssues === 0 ? 'EXCELLENT' : 
                    summary.failures === 0 ? 'GOOD' : 
                    summary.critical === 0 ? 'FAIR' : 'POOR',
      score: Math.round(((summary.passed / summary.totalTests) * 100)),
      totalTests: summary.totalTests,
      passed: summary.passed,
      issues: totalIssues,
      criticalCount: criticalIssues.length,
      recommendations: validationResults.recommendations?.length || 0
    };
  }, [validationResults, criticalIssues]);

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
    runValidation,
    dismissValidationPopup,
    clearValidation,
    getValidationSummary,
    getIssuesByCategory
  };
}; 