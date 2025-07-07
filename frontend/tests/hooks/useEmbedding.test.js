import { renderHook, act } from '@testing-library/react';
import useEmbedding from '../../src/hooks/useEmbedding';
import * as api from '../../src/services/api';

// Mock the API
jest.mock('../../src/services/api');

describe('useEmbedding Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    test('returns initial state correctly', () => {
      const { result } = renderHook(() => useEmbedding());
      
      expect(result.current.embeddingData).toBeNull();
      expect(result.current.embeddingMetadata).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(0);
    });
  });

  describe('Generate Embedding', () => {
    const mockRealData = {
      data: [[1, 2, 3], [4, 5, 6]],
      headers: ['A', 'B', 'C']
    };
    
    const mockSyntheticData = {
      data: [[7, 8, 9], [10, 11, 12]],
      headers: ['A', 'B', 'C']
    };

    test('generates embedding successfully', async () => {
      const mockResponse = {
        real_embeddings: [[0.1, 0.2], [0.3, 0.4]],
        synthetic_embeddings: [[0.5, 0.6], [0.7, 0.8]],
        metadata: {
          method: 'umap',
          runtime: 15.5
        }
      };

      api.generateEmbedding.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.generateEmbedding(mockRealData, mockSyntheticData, 'umap');
      });

      expect(result.current.embeddingData).toEqual([
        [0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]
      ]);
      expect(result.current.embeddingMetadata).toEqual({
        method: 'umap',
        runtime: 15.5,
        labels: ['Real', 'Real', 'Synthetic', 'Synthetic'],
        realData: mockRealData,
        syntheticData: mockSyntheticData
      });
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    test('handles embedding generation errors', async () => {
      api.generateEmbedding.mockRejectedValue(new Error('Embedding failed'));

      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.generateEmbedding(mockRealData, mockSyntheticData, 'umap');
      });

      expect(result.current.embeddingData).toBeNull();
      expect(result.current.embeddingMetadata).toBeNull();
      expect(result.current.error).toBe('Error generating embedding: Embedding failed');
      expect(result.current.isLoading).toBe(false);
    });

    test('validates input data before generation', async () => {
      const { result } = renderHook(() => useEmbedding());

      await act(async () => {
        await result.current.generateEmbedding(null, mockSyntheticData, 'umap');
      });

      expect(result.current.error).toBe('Error generating embedding: Real data is required');
      expect(api.generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('Load From History', () => {
    test('loads embeddings from history successfully', () => {
      const mockEmbeddings = {
        real: [[0.1, 0.2], [0.3, 0.4]],
        synthetic: [[0.5, 0.6], [0.7, 0.8]]
      };

      const mockMetadata = {
        method: 'tsne',
        runtime: 25.3,
        job_id: 'test-job'
      };

      const { result } = renderHook(() => useEmbedding());

      act(() => {
        result.current.loadFromHistory(mockEmbeddings, mockMetadata);
      });

      expect(result.current.embeddingData).toEqual([
        [0.1, 0.2], [0.3, 0.4], [0.5, 0.6], [0.7, 0.8]
      ]);
      expect(result.current.embeddingMetadata).toEqual({
        method: 'tsne',
        runtime: 25.3,
        job_id: 'test-job',
        labels: ['Real', 'Real', 'Synthetic', 'Synthetic']
      });
      expect(result.current.error).toBeNull();
    });

    test('handles invalid embeddings data', () => {
      const invalidEmbeddings = {
        real: null,
        synthetic: [[0.5, 0.6]]
      };

      const { result } = renderHook(() => useEmbedding());

      act(() => {
        result.current.loadFromHistory(invalidEmbeddings, {});
      });

      expect(result.current.error).toBe('Error loading embedding from history: Invalid embeddings data from history');
      expect(result.current.embeddingData).toBeNull();
    });
  });

  describe('Clear Data', () => {
    test('clears all embedding data', () => {
      const { result } = renderHook(() => useEmbedding());

      act(() => {
        result.current.loadFromHistory(
          { real: [[0.1, 0.2]], synthetic: [[0.5, 0.6]] },
          { method: 'umap' }
        );
      });

      act(() => {
        result.current.clearEmbedding();
      });

      expect(result.current.embeddingData).toBeNull();
      expect(result.current.embeddingMetadata).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(0);
    });
  });
}); 