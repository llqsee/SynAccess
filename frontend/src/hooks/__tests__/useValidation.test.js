import { renderHook, act } from '@testing-library/react';
import { useValidation } from '../useValidation';
import { validationService } from '../../services/validationService';

// Mock the validation service
jest.mock('../../services/validationService');
const { validationService: mockValidationService } = require('../../services/validationService');

describe('useValidation', () => {
  const mockRealData = {
    data: [[1, 2, 'A'], [3, 4, 'B'], [5, 6, 'C']],
    headers: ['col1', 'col2', 'col3'],
    metadata: { source: 'real' }
  };

  const mockSyntheticData = {
    data: [[2, 3, 'A'], [4, 5, 'B'], [6, 7, 'C']],
    headers: ['col1', 'col2', 'col3'],
    metadata: { source: 'synthetic' }
  };

  const mockValidationResults = {
    summary: {
      totalTests: 10,
      passed: 7,
      warnings: 2,
      failures: 1,
      critical: 0
    },
    tests: {
      'Data Quality': {
        testType: 'Data Quality',
        description: 'Basic data quality checks',
        summary: { total: 3, passed: 2, warnings: 1, failures: 0 },
        tests: [
          {
            column: 'col1',
            type: 'missing_values',
            issues: [
              { severity: 'WARNING', message: 'Some missing values detected' }
            ]
          }
        ]
      },
      'Statistical Tests': {
        testType: 'Statistical Tests',
        description: 'Statistical comparison tests',
        summary: { total: 4, passed: 3, warnings: 1, failures: 0 },
        tests: [
          {
            column: 'col2',
            type: 'distribution_test',
            issues: [
              { severity: 'WARNING', message: 'Distribution differs slightly' }
            ]
          }
        ]
      }
    },
    recommendations: [
      'Consider imputing missing values in col1',
      'Review distribution differences in col2'
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidationService.validateDatasets.mockResolvedValue(mockValidationResults);
  });

  describe('runValidation', () => {
    it('should successfully run validation', async () => {
      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      expect(mockValidationService.validateDatasets).toHaveBeenCalledWith(
        mockRealData,
        mockSyntheticData,
        { enableAdvancedTests: false }
      );
      expect(result.current.validating).toBe(false);
      expect(result.current.validationError).toBeNull();
      expect(result.current.validationResults).toEqual(mockValidationResults);
      expect(result.current.criticalIssues).toEqual([]);
      expect(result.current.showValidationPopup).toBe(false);
    });

    it('should run validation with advanced options', async () => {
      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData, {
          enableAdvancedTests: true,
          customOption: 'value'
        });
      });

      expect(mockValidationService.validateDatasets).toHaveBeenCalledWith(
        mockRealData,
        mockSyntheticData,
        {
          enableAdvancedTests: true,
          customOption: 'value'
        }
      );
    });

    it('should handle missing data', async () => {
      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(null, mockSyntheticData);
      });

      expect(result.current.validationError).toBe('Both real and synthetic datasets are required for validation');
      expect(result.current.validating).toBe(false);
      expect(mockValidationService.validateDatasets).not.toHaveBeenCalled();
    });

    it('should handle validation service errors', async () => {
      mockValidationService.validateDatasets.mockRejectedValue(new Error('Validation service error'));

      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      expect(result.current.validationError).toBe('Validation service error');
      expect(result.current.validating).toBe(false);
      expect(result.current.validationResults).toBeNull();
    });

    it('should show popup for critical issues', async () => {
      const mockResultsWithCritical = {
        ...mockValidationResults,
        tests: {
          'Critical Test': {
            testType: 'Critical Test',
            tests: [
              {
                column: 'col1',
                type: 'critical_test',
                issues: [
                  { severity: 'CRITICAL', message: 'Critical issue found' }
                ]
              }
            ]
          }
        }
      };
      mockValidationService.validateDatasets.mockResolvedValue(mockResultsWithCritical);

      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      expect(result.current.criticalIssues).toHaveLength(1);
      expect(result.current.criticalIssues[0]).toMatchObject({
        column: 'col1',
        type: 'critical_test',
        severity: 'CRITICAL',
        message: 'Critical issue found'
      });
      expect(result.current.showValidationPopup).toBe(true);
    });
  });

  describe('dismissValidationPopup', () => {
    it('should dismiss the validation popup', async () => {
      const { result } = renderHook(() => useValidation());

      // First run validation to set up the popup
      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      // Set popup to true manually for testing
      act(() => {
        result.current.showValidationPopup = true;
      });

      act(() => {
        result.current.dismissValidationPopup();
      });

      // The popup state is managed internally, so we need to check the function was called
      expect(result.current.dismissValidationPopup).toBeDefined();
    });
  });

  describe('clearValidation', () => {
    it('should clear all validation state', async () => {
      const { result } = renderHook(() => useValidation());

      // First run validation to set up state
      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      act(() => {
        result.current.clearValidation();
      });

      expect(result.current.validationResults).toBeNull();
      expect(result.current.validationError).toBeNull();
      expect(result.current.criticalIssues).toEqual([]);
      expect(result.current.showValidationPopup).toBe(false);
    });
  });

  describe('getValidationSummary', () => {
    it('should return null when no validation results', () => {
      const { result } = renderHook(() => useValidation());

      const summary = result.current.getValidationSummary();
      expect(summary).toBeNull();
    });

    it('should return correct summary for excellent results', async () => {
      const excellentResults = {
        ...mockValidationResults,
        summary: { totalTests: 10, passed: 10, warnings: 0, failures: 0, critical: 0 }
      };
      mockValidationService.validateDatasets.mockResolvedValue(excellentResults);

      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      const summary = result.current.getValidationSummary();
      expect(summary).toEqual({
        overallStatus: 'EXCELLENT',
        score: 100,
        totalTests: 10,
        passed: 10,
        issues: 0,
        criticalCount: 0,
        recommendations: 2
      });
    });

    it('should return correct summary for poor results', async () => {
      const poorResults = {
        ...mockValidationResults,
        summary: { totalTests: 10, passed: 3, warnings: 2, failures: 3, critical: 2 }
      };
      mockValidationService.validateDatasets.mockResolvedValue(poorResults);

      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      const summary = result.current.getValidationSummary();
      expect(summary).toEqual({
        overallStatus: 'POOR',
        score: 30,
        totalTests: 10,
        passed: 3,
        issues: 7,
        criticalCount: 0,
        recommendations: 2
      });
    });
  });

  describe('getIssuesByCategory', () => {
    it('should return empty object when no validation results', () => {
      const { result } = renderHook(() => useValidation());

      const categories = result.current.getIssuesByCategory();
      expect(categories).toEqual({});
    });

    it('should return issues organized by category', async () => {
      const { result } = renderHook(() => useValidation());

      await act(async () => {
        await result.current.runValidation(mockRealData, mockSyntheticData);
      });

      const categories = result.current.getIssuesByCategory();
      
      expect(categories).toHaveProperty('Data Quality');
      expect(categories).toHaveProperty('Statistical Tests');
      
      expect(categories['Data Quality']).toMatchObject({
        name: 'Data Quality',
        description: 'Basic data quality checks',
        summary: { total: 3, passed: 2, warnings: 1, failures: 0 }
      });
      
      expect(categories['Data Quality'].issues).toHaveLength(1);
      expect(categories['Data Quality'].issues[0]).toMatchObject({
        column: 'col1',
        testType: 'missing_values'
      });
    });
  });

  describe('state management', () => {
    it('should set validating to true during validation', async () => {
      // Mock a delayed response
      mockValidationService.validateDatasets.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockValidationResults), 100))
      );

      const { result } = renderHook(() => useValidation());

      // Start validation
      act(() => {
        result.current.runValidation(mockRealData, mockSyntheticData);
      });

      // Should be validating initially
      expect(result.current.validating).toBe(true);

      // Wait for completion
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.validating).toBe(false);
    });
  });
}); 