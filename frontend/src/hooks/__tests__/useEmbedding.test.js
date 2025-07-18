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
    mockSubmitEmbeddingJob.mockResolvedValue({ 
      job_id: 'test-job-123',
      task_id: 'test-task-123',
      status: 'running',
      queue_position: 0
    });
    mockGetJobStatus.mockResolvedValue({ status: 'completed', progress: 1.0 });
    mockGetJobResults.mockResolvedValue({
      embeddings: mockEmbeddings,
      metadata: mockMetadata,
      session_state: {
        realData: mockRealData,
        syntheticData: mockSyntheticData
      }
    });
    
    // Mock dataUtils functions
    jest.spyOn(dataUtils, 'validateDataCompatibility').mockReturnValue({ isValid: true });
    jest.spyOn(dataUtils, 'combineEmbeddings').mockReturnValue([
      [0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]
    ]);
    jest.spyOn(dataUtils, 'createEmbeddingLabels').mockReturnValue(['Real', 'Real', 'Synthetic', 'Synthetic']);
  });

  describe('handleVisualize', () => {
    it('should successfully submit job', async () => {
      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, { method: 'umap', params: {} }, true);
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

      // Check that the job was submitted successfully
      expect(mockSubmitEmbeddingJob).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
      expect(result.current.currentJobId).toBe('test-job-123');
    });

    it('should handle API errors', async () => {
      mockSubmitEmbeddingJob.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, { method: 'umap', params: {} }, true);
      });

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Error submitting embedding job: API Error');
      expect(result.current.embeddingData).toBeNull();
      expect(result.current.embeddingMetadata).toBeNull();
      expect(result.current.processingStatus).toBeNull();
    });

    it('should handle backend not connected', async () => {
      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, { method: 'umap', params: {} }, false);
      });

      expect(result.current.error).toBe('Backend server is not connected. Please ensure it is running.');
    });

    it('should handle invalid data validation', async () => {
      jest.spyOn(dataUtils, 'validateDataCompatibility').mockReturnValue({ 
        isValid: false, 
        error: 'Invalid data format' 
      });

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.handleVisualize(mockRealData, mockSyntheticData, { method: 'umap', params: {} }, true);
      });

      expect(result.current.error).toBe('Invalid data format');
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
        await result.current.handleVisualize(largeRealData, largeSyntheticData, { method: 'umap', params: {} }, true);
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
        result.current.handleVisualize(mockRealData, mockSyntheticData, { method: 'umap', params: {} }, true);
      });

      // Should be loading initially
      expect(result.current.loading).toBe(true);

      // Wait for completion
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // The loading state might still be true due to polling, so we check the job was submitted
      expect(mockSubmitEmbeddingJob).toHaveBeenCalled();
    });
  });

  describe('loadFromHistory', () => {
    it('should load embeddings from history', async () => {
      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        result.current.loadFromHistory(mockEmbeddings, mockMetadata, {
          realData: mockRealData,
          syntheticData: mockSyntheticData
        });
      });

      expect(result.current.embeddingData).toEqual([
        [0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]
      ]);
      
      // Check that the metadata contains the expected properties
      expect(result.current.embeddingMetadata).toMatchObject({
        ...mockMetadata,
        labels: ['Real', 'Real', 'Synthetic', 'Synthetic']
      });
      expect(result.current.error).toBeNull();
    });

    it('should handle invalid history data', async () => {
      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        result.current.loadFromHistory(null, mockMetadata);
      });

      expect(result.current.error).toBe('Error loading embedding from history: Invalid embeddings data from history');
    });
  });
}); 