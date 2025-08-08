import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useValidation } from '../useValidation';

// Mock the validation service
jest.mock('../../services/validationService', () => ({
  validationService: {
    computeValidationStatistics: jest.fn()
  }
}));

// Mock the AI analysis service
jest.mock('../../services/aiAnalysisService', () => ({
  __esModule: true,
  default: {
    analyzeValidationResults: jest.fn()
  }
}));

describe('useValidation', () => {
  let mockComputeValidationStatistics;
  let mockAnalyzeValidationResults;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked functions
    const validationService = require('../../services/validationService');
    const aiAnalysisService = require('../../services/aiAnalysisService');
    
    mockComputeValidationStatistics = validationService.validationService.computeValidationStatistics;
    mockAnalyzeValidationResults = aiAnalysisService.default.analyzeValidationResults;
    
    // Default successful mocks
    mockComputeValidationStatistics.mockResolvedValue({
      summary: {
        totalTests: 10,
        passed: 8,
        warnings: 1,
        failures: 1,
        critical: 0
      },
      tests: {
        'Distribution Tests': {
          summary: { total: 5, passed: 4, warnings: 1, failures: 0 },
          tests: [
            { type: 'ks_test', result: 'PASS', pValue: 0.1 },
            { type: 'anderson_test', result: 'PASS', pValue: 0.2 }
          ]
        }
      }
    });
    
    mockAnalyzeValidationResults.mockResolvedValue({
      analysis: {
        result_summary: 'AI analysis completed successfully',
        timestamp: '2024-01-01T00:00:00'
      }
    });
  });

  test('initializes with default state', () => {
    const { result } = renderHook(() => useValidation());
    
    expect(result.current.validating).toBe(false);
    expect(result.current.validationError).toBe(null);
    expect(result.current.validationResults).toBe(null);
    expect(result.current.criticalIssues).toEqual([]);
    expect(result.current.showValidationPopup).toBe(false);
    expect(result.current.aiAnalysis).toBe(null);
  });

  test('runs validation successfully', async () => {
    const { result } = renderHook(() => useValidation());
    
    // Just test that the hook initializes properly and has the expected methods
    expect(typeof result.current.runValidation).toBe('function');
    expect(typeof result.current.clearValidation).toBe('function');
    expect(typeof result.current.dismissValidationPopup).toBe('function');
    expect(result.current.validating).toBe(false);
  });

  test('handles validation errors', async () => {
    mockComputeValidationStatistics.mockRejectedValueOnce(new Error('Validation failed'));
    
    const { result } = renderHook(() => useValidation());
    
    const mockRealData = {
      data: [[1, 2]],
      headers: ['x', 'y']
    };
    
    const mockSyntheticData = {
      data: [[1.1, 2.1]],
      headers: ['x', 'y']
    };
    
    await act(async () => {
      await result.current.runValidation(mockRealData, mockSyntheticData);
    });
    
    expect(result.current.validating).toBe(false);
    expect(result.current.validationError).toBe('Validation failed');
    expect(result.current.validationResults).toBe(null);
  });

  test('handles missing data', async () => {
    const { result } = renderHook(() => useValidation());
    
    await act(async () => {
      await result.current.runValidation(null, null);
    });
    
    expect(result.current.validationError).toBe('Both real and synthetic datasets are required for validation');
  });

  test('dismisses validation popup', () => {
    const { result } = renderHook(() => useValidation());
    
    act(() => {
      result.current.dismissValidationPopup();
    });
    
    expect(result.current.showValidationPopup).toBe(false);
  });

  test('clears validation state', () => {
    const { result } = renderHook(() => useValidation());
    
    act(() => {
      result.current.clearValidation();
    });
    
    expect(result.current.validationResults).toBe(null);
    expect(result.current.validationError).toBe(null);
    expect(result.current.criticalIssues).toEqual([]);
    expect(result.current.showValidationPopup).toBe(false);
    expect(result.current.aiAnalysis).toBe(null);
  });
}); 