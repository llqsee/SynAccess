import axios from 'axios';
import * as api from '../../src/services/api';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn()
}));

const mockedAxios = axios;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    test('makes correct API call for embedding generation', async () => {
      const mockResponse = {
        data: {
          real_embeddings: [[0.1, 0.2]],
          synthetic_embeddings: [[0.5, 0.6]],
          metadata: { method: 'umap', runtime: 15.5 }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const realData = { data: [[1, 2]], headers: ['A', 'B'] };
      const syntheticData = { data: [[3, 4]], headers: ['A', 'B'] };

      const result = await api.generateEmbedding(realData, syntheticData, 'umap');

      expect(mockedAxios.post).toHaveBeenCalledWith('/embed', {
        real_data: realData,
        synthetic_data: syntheticData,
        method: 'umap'
      });

      expect(result).toEqual(mockResponse.data);
    });

    test('handles embedding generation errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));

      await expect(
        api.generateEmbedding(
          { data: [[1, 2]], headers: ['A'] },
          { data: [[3, 4]], headers: ['A'] },
          'umap'
        )
      ).rejects.toThrow('Network Error');
    });
  });

  describe('generateDistributionPlot', () => {
    test('makes correct API call for distribution plot', async () => {
      const mockResponse = {
        data: {
          plot_data: { data: [], layout: {} }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const selectedData = { real: [[1, 2]], synthetic: [[3, 4]] };

      const result = await api.generateDistributionPlot(selectedData, 'column1', 'histogram');

      expect(mockedAxios.post).toHaveBeenCalledWith('/distribution', {
        selected_data: selectedData,
        column: 'column1',
        plot_type: 'histogram'
      });

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Job History API', () => {
    test('getJobHistory makes correct API call', async () => {
      const mockResponse = {
        data: {
          jobs: [{ id: 1, method: 'umap' }],
          total: 1,
          page: 1,
          per_page: 10
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const params = { page: 1, per_page: 10, status: 'completed' };
      const result = await api.getJobHistory(params);

      expect(mockedAxios.get).toHaveBeenCalledWith('/history', { params });
      expect(result).toEqual(mockResponse.data);
    });

    test('getJobDetail makes correct API call', async () => {
      const mockResponse = {
        data: { id: 1, method: 'umap', status: 'completed' }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await api.getJobDetail(1);

      expect(mockedAxios.get).toHaveBeenCalledWith('/jobs/1');
      expect(result).toEqual(mockResponse.data);
    });

    test('loadJobEmbeddings makes correct API call', async () => {
      const mockResponse = {
        data: {
          embeddings: { real: [], synthetic: [] },
          metadata: { method: 'umap' }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.loadJobEmbeddings(1);

      expect(mockedAxios.post).toHaveBeenCalledWith('/jobs/1/load');
      expect(result).toEqual(mockResponse.data);
    });

    test('toggleJobFavorite makes correct API call', async () => {
      const mockResponse = { data: { is_favorite: true } };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.toggleJobFavorite(1);

      expect(mockedAxios.post).toHaveBeenCalledWith('/jobs/1/favorite');
      expect(result).toEqual(mockResponse.data);
    });

    test('deleteJob makes correct API call', async () => {
      const mockResponse = { data: { success: true } };

      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await api.deleteJob(1);

      expect(mockedAxios.delete).toHaveBeenCalledWith('/jobs/1');
      expect(result).toEqual(mockResponse.data);
    });

    test('getJobStats makes correct API call', async () => {
      const mockResponse = {
        data: {
          total_jobs: 5,
          completed_jobs: 3,
          running_jobs: 1,
          failed_jobs: 1
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await api.getJobStats();

      expect(mockedAxios.get).toHaveBeenCalledWith('/stats');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error Handling', () => {
    test('handles 401 unauthorized errors', async () => {
      const unauthorizedError = {
        response: { status: 401, data: { detail: 'Unauthorized' } }
      };

      mockedAxios.get.mockRejectedValue(unauthorizedError);

      await expect(api.getJobHistory()).rejects.toEqual(unauthorizedError);
    });

    test('handles 500 server errors', async () => {
      const serverError = {
        response: { status: 500, data: { detail: 'Internal Server Error' } }
      };

      mockedAxios.post.mockRejectedValue(serverError);

      await expect(
        api.generateEmbedding(
          { data: [[1]], headers: ['A'] },
          { data: [[2]], headers: ['A'] },
          'umap'
        )
      ).rejects.toEqual(serverError);
    });

    test('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.request = {};

      mockedAxios.get.mockRejectedValue(networkError);

      await expect(api.getJobStats()).rejects.toEqual(networkError);
    });
  });
}); 