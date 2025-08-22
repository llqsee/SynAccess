import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Send embedding job to the backend
export const submitEmbeddingJob = async ({
  real_data,
  synthetic_data,
  method = 'umap',
  params = {},
  real_headers = null,
  synthetic_headers = null,
  real_dataset_name = null,
  synthetic_dataset_name = null
}) => {
  try {
    // Check the data looks good
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
      real_headers,
      synthetic_headers,
      real_dataset_name,
      synthetic_dataset_name
    });

    // Return job submission details
    return response.data;
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

// Submit embedding job with pre-trained model
export const submitPretrainedModelJob = async ({
  real_data,
  synthetic_data,
  method = 'umap',
  model_data,
  model_format = 'pickle',
  real_headers = null,
  synthetic_headers = null,
  real_dataset_name = null,
  synthetic_dataset_name = null,
}) => {
  try {
    // Validate inputs
    if (!Array.isArray(real_data) || !Array.isArray(synthetic_data)) {
      throw new Error('Input data must be arrays');
    }

    if (real_data.length === 0 || synthetic_data.length === 0) {
      throw new Error('Data arrays cannot be empty');
    }

    if (!['umap', 'tsne'].includes(method)) {
      throw new Error('Invalid method. Must be either "umap" or "tsne"');
    }

    if (!model_data) {
      throw new Error('Model data is required');
    }

    const response = await api.post('/embed-pretrained', {
      real_data,
      synthetic_data,
      method,
      model_data,
      model_format,
      real_headers,
      synthetic_headers,
      real_dataset_name,
      synthetic_dataset_name
    });

    return response.data;
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

export const submitPretrainedModelFromHistoryJob = async ({
  real_data,
  synthetic_data,
  method = 'umap',
  pretrained_model_job_id,
  real_headers = null,
  synthetic_headers = null,
  n_real_samples = 1000,
  n_synth_samples = 1000,
  real_dataset_name = null,
  synthetic_dataset_name = null
}) => {
  try {
    // Validate inputs
    if (!Array.isArray(real_data) || !Array.isArray(synthetic_data)) {
      throw new Error('Input data must be arrays');
    }

    if (real_data.length === 0 || synthetic_data.length === 0) {
      throw new Error('Data arrays cannot be empty');
    }

    if (!['umap', 'tsne'].includes(method)) {
      throw new Error('Invalid method. Must be either "umap" or "tsne"');
    }

    if (!pretrained_model_job_id) {
      throw new Error('pretrained_model_job_id is required');
    }

    const response = await api.post('/embed-pretrained-from-history', {
      real_data,
      synthetic_data,
      method,
      pretrained_model_job_id,
      real_headers,
      synthetic_headers,
      real_dataset_name,
      synthetic_dataset_name,
      params: {
        n_real_samples,
        n_synth_samples
      }
    });

    return response.data;
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

// Get job status by job ID
export const getJobStatus = async (jobId) => {
  try {
    const response = await api.get(`/jobs/${jobId}/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to get job status:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get job status');
  }
};

// Get completed job results (embeddings and metadata)
export const getJobResults = async (jobId) => {
  try {
    const response = await api.post(`/jobs/${jobId}/load`);
    return response.data;
  } catch (error) {
    console.error('Failed to get job results:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get job results');
  }
};

// Get queue status
export const getQueueStatus = async () => {
  try {
    const response = await api.get('/queue/status');
    return response.data;
  } catch (error) {
    console.error('Failed to get queue status:', error);
    throw new Error(error.response?.data?.detail || 'Failed to get queue status');
  }
};

// Cancel a job
export const cancelJob = async (jobId) => {
  try {
    const response = await api.post(`/jobs/${jobId}/cancel`);
    return response.data;
  } catch (error) {
    console.error('Failed to cancel job:', error);
    throw new Error(error.response?.data?.detail || 'Failed to cancel job');
  }
};

// Legacy function for backward compatibility - now wraps async flow
export const computeEmbedding = async (params) => {
  try {
    // Submit the job
    const jobSubmission = await submitEmbeddingJob(params);
    
    // Poll for completion
    const maxWaitTime = 300000; // 5 minutes max wait
    const pollInterval = 1000; // Poll every 1 second
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await getJobStatus(jobSubmission.job_id);
      
      if (status.status === 'completed') {
        // Get the results
        const results = await getJobResults(jobSubmission.job_id);
        return results; // This should have embeddings and metadata format
      } else if (status.status === 'failed') {
        throw new Error(status.error_message || 'Job failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Job timed out waiting for completion');
  } catch (error) {
    throw error;
  }
};

export const generateDistributionPlot = async ({
  real_data,
  synthetic_data,
  column,
  plot_type,
  real_headers = null,
  synthetic_headers = null
}, signal = null) => {
  try {
    // Basic validation
    if (!Array.isArray(real_data) || !Array.isArray(synthetic_data)) {
      throw new Error('Input data must be arrays');
    }

    if (real_data.length === 0 || synthetic_data.length === 0) {
      throw new Error('Data arrays cannot be empty');
    }

    if (!column) {
      throw new Error('Column name is required');
    }

    if (!plot_type) {
      throw new Error('Plot type is required');
    }

    const config = {
      signal // Add abort signal support
    };

    const response = await api.post('/distribution', {
      real_data,
      synthetic_data,
      column,
      plot_type,
      real_headers,
      synthetic_headers
    }, config);

    return response.data;
  } catch (error) {
    // Handle abort error
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      throw error;
    }
    
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

// History-related API functions
export const getJobHistory = async ({ page = 1, limit = 20, status = null, method = null, favorites_only = false } = {}) => {
  try {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    if (method) params.append('method', method);
    if (favorites_only) params.append('favorites_only', 'true');
    
    const response = await api.get(`/history?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch job history:', error);
    throw new Error(error.response?.data?.detail || 'Failed to fetch job history');
  }
};

export const getJobDetail = async (jobId) => {
  try {
    const response = await api.get(`/history/${jobId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch job details:', error);
    throw new Error(error.response?.data?.detail || 'Failed to fetch job details');
  }
};

export const loadJobEmbeddings = async (jobId) => {
  try {
    const response = await api.post(`/jobs/${jobId}/load`);
    return response.data;
  } catch (error) {
    console.error('Failed to load job embeddings:', error);
    throw new Error(error.response?.data?.detail || 'Failed to load embeddings');
  }
};

export const toggleJobFavorite = async (jobId) => {
  try {
    const response = await api.post(`/jobs/${jobId}/favorite`);
    return response.data;
  } catch (error) {
    console.error('Failed to toggle job favorite:', error);
    throw new Error(error.response?.data?.detail || 'Failed to toggle favorite');
  }
};

export const deleteJob = async (jobId) => {
  try {
    const response = await api.delete(`/history/${jobId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete job:', error);
    throw new Error(error.response?.data?.detail || 'Failed to delete job');
  }
};

// Download model for a job
export const downloadModel = async (jobId) => {
  try {
    const response = await api.get(`/jobs/${jobId}/model`);
    return response.data;
  } catch (error) {
    console.error('Failed to download model:', error);
    throw new Error(error.response?.data?.detail || 'Failed to download model');
  }
};

// Download model as binary file
export const downloadModelBinary = async (jobId) => {
  try {
    // Create a separate axios instance for blob downloads to avoid conflicts
    const blobApi = axios.create({
      baseURL: API_BASE_URL,
      responseType: 'blob',
      timeout: 30000, // 30 seconds timeout for large files
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
    
    const response = await blobApi.get(`/jobs/${jobId}/model/download`);
    return response.data;
  } catch (error) {
    console.error('Failed to download model binary:', error);
    
    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      throw new Error('Download timed out. The model file may be too large or the connection is slow.');
    }
    
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    
    if (error.response?.status === 404) {
      throw new Error('Model not found. The job may have been deleted or does not have a saved model.');
    }
    
    if (error.response?.data) {
      // If the response is a blob but contains error info, try to read it
      try {
        const errorText = await error.response.data.text();
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.detail || 'Failed to download model');
      } catch {
        // If we can't parse the error, provide a generic message
        if (error.response.status >= 500) {
          throw new Error('Server error occurred while downloading the model');
        }
        throw new Error('Failed to download model');
      }
    }
    
    throw new Error(error.message || 'Failed to download model');
  }
};

export const getJobStats = async () => {
  try {
    const response = await api.get('/history/stats');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Failed to get job statistics');
    }
    throw error;
  }
};

export const getAvailableModels = async () => {
  try {
    // Add timestamp to prevent caching
    const timestamp = Date.now();
    const response = await api.get(`/available-models?t=${timestamp}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Failed to get available models');
    }
    throw error;
  }
}; 
