import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const computeEmbedding = async ({
  real_data,
  synthetic_data,
  method = 'umap',
  params = {},
  n_samples = null,
  real_headers = null,
  synthetic_headers = null
}) => {
  try {
    // Basic validation
    if (!Array.isArray(real_data) || !Array.isArray(synthetic_data)) {
      throw new Error('Input data must be arrays');
    }

    if (real_data.length === 0 || synthetic_data.length === 0) {
      throw new Error('Data arrays cannot be empty');
    }

    if (!['umap', 'tsne'].includes(method)) {
      throw new Error('Invalid method. Must be either "umap" or "tsne"');
    }

    const response = await api.post('/embed', {
      real_data,
      synthetic_data,
      method,
      params,
      n_samples,
      real_headers,
      synthetic_headers
    });

    const { embeddings, metadata } = response.data;
    
    if (!embeddings?.real || !embeddings?.synthetic || !metadata) {
      throw new Error('Invalid response from server');
    }

    return { embeddings, metadata };
  } catch (error) {
    if (error.response) {
      if (error.response.status === 422) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          const errors = detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('; ');
          throw new Error(`Validation error: ${errors}`);
        }
        throw new Error(`Validation error: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(
        error.response.data.detail || 
        `Server error: ${error.response.status}`
      );
    } else if (error.request) {
      throw new Error('No response from server. Please check if the backend is running.');
    } else {
      throw error;
    }
  }
};

export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw new Error('Backend server is not responding');
  }
}; 