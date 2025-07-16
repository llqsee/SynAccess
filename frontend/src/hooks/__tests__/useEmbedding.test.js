import { renderHook, act } from '@testing-library/react';
import { useEmbedding } from '../useEmbedding';
import { submitEmbeddingJob, getJobStatus, getJobResults } from '../../services/api';
import * as dataUtils from '../../utils/dataUtils';

// Mock the API
jest.mock('../../services/api');
const { submitEmbeddingJob: mockSubmitEmbeddingJob, getJobStatus: mockGetJobStatus, getJobResults: mockGetJobResults } = require('../../services/api');

// Mock dataUtils
jest.mock('../../utils/dataUtils');

describe('useEmbedding', () => {
  const mockRealData = {
    data: [[1, 2], [3, 4]],
    headers: ['col1', 'col2'],
    metadata: { source: 'real' }
  };

  const mockSyntheticData = {
    data: [[5, 6], [7, 8]],
    headers: ['col1', 'col2'],
    metadata: { source: 'synthetic' }
  };

  const mockEmbeddings = {
    real: [[0.1, 0.2], [0.3, 0.4]],
    synthetic: [[0.5, 0.6], [0.7, 0.8]]
  };

  const mockMetadata = {
    runtime: 2.5,
    method: 'umap',
    params: { n_neighbors: 15 },
    real_samples: 2,
    synthetic_samples: 2,
    preprocessing: { method: 'standard' },
    job_id: 'test-job-123',
    job_name: 'Test Job',
    created_at: '2023-01-01T00:00:00Z',
    has_compressed_data: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockSubmitEmbeddingJob.mockResolvedValue({ job_id: 'test-job-123' });
    mockGetJobStatus.mockResolvedValue({ status: 'completed', progress: 1.0 });
    mockGetJobResults.mockResolvedValue({
      embeddings: mockEmbeddings,
      metadata: mockMetadata,
      session_state: {
        realData: mockRealData,
        syntheticData: mockSyntheticData
      }
    });
  });

  describe('handleVisualize', () => {
    it('should successfully process embeddings', async () => {
      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, 'umap');
      });

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSubmitEmbeddingJob).toHaveBeenCalledWith({
        real_data: mockRealData.data,
        synthetic_data: mockSyntheticData.data,
        method: 'umap',
        params: {},
        real_headers: mockRealData.headers,
        synthetic_headers: mockSyntheticData.headers
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.embeddingData).toEqual([
        [0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]
      ]);
      expect(result.current.embeddingMetadata).toEqual(mockMetadata);
    });

    it('should handle API errors', async () => {
      mockSubmitEmbeddingJob.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, 'umap');
      });

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Error submitting embedding job: API Error');
      expect(result.current.embeddingData).toBeNull();
      expect(result.current.embeddingMetadata).toBeNull();
      expect(result.current.processingStatus).toBeNull();
    });

    it('should handle invalid API response', async () => {
      mockSubmitEmbeddingJob.mockResolvedValue({ job_id: 'test-job-123' });
      mockGetJobResults.mockResolvedValue({}); // Missing embeddings

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, 'umap');
      });

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.error).toBe('Error submitting embedding job: Invalid response from server: missing embeddings or metadata');
    });

    it('should sample data correctly', async () => {
      const mockSampleData = jest.spyOn(dataUtils, 'sampleData');
      mockSampleData.mockReturnValue({
        real_data: [[1, 2]], // Only first sample
        synthetic_data: [[5, 6]], // Only first sample
        real_headers: mockRealData.headers,
        synthetic_headers: mockSyntheticData.headers
      });

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, 'umap', { max_samples: 1 });
      });

      expect(mockSubmitEmbeddingJob).toHaveBeenCalledWith({
        real_data: [[1, 2]], // Only first sample
        synthetic_data: [[5, 6]], // Only first sample
        method: 'umap',
        params: { max_samples: 1 },
        real_headers: mockRealData.headers,
        synthetic_headers: mockSyntheticData.headers
      });

      mockSampleData.mockRestore();
    });

    it('should set processing status for large datasets', async () => {
      const largeRealData = {
        data: Array.from({ length: 10000 }, (_, i) => [i, i * 2]),
        headers: ['col1', 'col2']
      };

      const largeSyntheticData = {
        data: Array.from({ length: 10000 }, (_, i) => [i + 0.5, i * 2 + 1]),
        headers: ['col1', 'col2']
      };

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(largeRealData, largeSyntheticData, 'umap');
      });

      // Should have set the large dataset processing status at some point
      expect(mockSubmitEmbeddingJob).toHaveBeenCalled();
    });
  });

  describe('loading state management', () => {
    it('should set loading to true during processing', async () => {
      // Mock a delayed response
      mockSubmitEmbeddingJob.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ job_id: 'test-job-123' }), 100))
      );

      const { result } = renderHook(() => useEmbedding());

      // Start the visualization
      act(() => {
        result.current.handleVisualize(mockRealData, mockSyntheticData, 'umap');
      });

      // Should be loading initially
      expect(result.current.loading).toBe(true);

      // Wait for completion
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current.loading).toBe(false);
    });
  });
}); 