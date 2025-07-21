import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Submit embedding job for asynchronous processing
export const submitEmbeddingJob = async ({
  real_data,
  synthetic_data,
  method = 'umap',
  params = {},
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
      real_headers,
      synthetic_headers
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
    const response = await api.get(`/jobs/${jobId}`);
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
    const response = await api.delete(`/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete job:', error);
    throw new Error(error.response?.data?.detail || 'Failed to delete job');
  }
};

export const getJobStats = async () => {
  try {
    const response = await api.get('/stats');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch job stats:', error);
    throw new Error(error.response?.data?.detail || 'Failed to fetch job statistics');
  }
}; 
