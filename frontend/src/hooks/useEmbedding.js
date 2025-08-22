import { useState, useCallback, useRef } from 'react';
import { 
  submitEmbeddingJob, 
  submitPretrainedModelJob, 
  submitPretrainedModelFromHistoryJob,
  getJobStatus, 
  getJobResults, 
  cancelJob 
} from '../services/api';
import { 
  validateDataCompatibility, 
  combineEmbeddings, 
  createEmbeddingLabels 
} from '../utils/dataUtils';
import logger from '../utils/logger';

// Debug helper
const dbg = (...args) => {
  if (process.env.REACT_APP_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export const useEmbedding = () => {
  const [embeddingData, setEmbeddingData] = useState(null);
  const [embeddingMetadata, setEmbeddingMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Background job tracking
  const [processingStatus, setProcessingStatus] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [queuePosition, setQueuePosition] = useState(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(null);
  const [canCancel, setCanCancel] = useState(false);
  
  // Keep original data around for distribution plots
  const [originalRealData, setOriginalRealData] = useState(null);
  const [originalSyntheticData, setOriginalSyntheticData] = useState(null);
  
  // Handle polling and cancellation
  const pollingIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setEmbeddingData(null);
    setEmbeddingMetadata(null);
    setCurrentJobId(null);
    setCurrentTaskId(null);
    setProgress(0);
    setQueuePosition(null);
    setEstimatedWaitTime(null);
    setCanCancel(false);
    setProcessingStatus(null);
    // DON'T clear original data here - we need it to persist until job completes
    // setOriginalRealData(null);
    // setOriginalSyntheticData(null);
    clearPolling();
  }, [clearPolling]);

  const pollJobStatus = useCallback(async (jobId) => {
    try {
      const status = await getJobStatus(jobId);
      
      // Update progress state
      setProgress(status.progress || 0);
      setQueuePosition(status.queue_position);
      setEstimatedWaitTime(status.estimated_time_remaining);
      
      // Update status message based on job state
      switch (status.status) {
        case 'running':
          setProcessingStatus('Processing');
          setCanCancel(true);
          break;
        case 'completed':
          // Job completed - get results with retry logic
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              const results = await getJobResults(jobId);
              
              const combinedEmbeddings = combineEmbeddings(
                results.embeddings.real, 
                results.embeddings.synthetic
              );
              const labels = createEmbeddingLabels(
                results.embeddings.real.length,
                results.embeddings.synthetic.length
              );
              
              setEmbeddingData(combinedEmbeddings);
              
              // Include original data in metadata for fresh embeddings (enables distribution plots)
              const enhancedMetadata = { ...results.metadata, labels };
              
              // Add original data if available (for fresh embeddings)
              if (originalRealData && originalSyntheticData) {
                enhancedMetadata.realData = originalRealData;
                enhancedMetadata.syntheticData = originalSyntheticData;
                enhancedMetadata.hasCompressedData = true; // Mark as having original data for distribution plots
              }
              
              setEmbeddingMetadata(enhancedMetadata);
              
              // Clear original data now that it's been added to metadata
              setOriginalRealData(null);
              setOriginalSyntheticData(null);
              
              setProcessingStatus('Completed successfully');
              setCanCancel(false);
              clearPolling();
              setLoading(false);
              
              return; // Exit polling
            } catch (err) {
              retryCount++;
              if (retryCount >= maxRetries) {
                setError(`Job completed but failed to load results after ${maxRetries} attempts: ${err.message}`);
                clearPolling();
                setLoading(false);
                resetState();
                return;
              }
              // Wait a bit before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        case 'failed':
        case 'cancelled':
          setError(status.error_message || status.status === 'cancelled' ? 'Job was cancelled' : 'Embedding computation failed');
          setCanCancel(false);
          clearPolling();
          setLoading(false);
          resetState();
          return;
        default:
          setProcessingStatus(`Status: ${status.status}`);
          break;
      }
      
      return status;
      
    } catch (statusError) {
      clearPolling();
      throw statusError;
    }
  }, [clearPolling, originalRealData, originalSyntheticData]);

  const startPolling = useCallback((jobId) => {
    clearPolling(); // Clear any existing polling
    
    const pollInterval = 1000; // Poll every 1 second
    const maxPollTime = 360000; // 6 minutes max (longer than backend timeout)
    const startTime = Date.now();
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Check if we've exceeded max poll time
        if (Date.now() - startTime > maxPollTime) {
          clearPolling();
          setError('Job timed out. Please check the history tab for results.');
          setLoading(false);
          return;
        }
        
        await pollJobStatus(jobId);
        
      } catch (pollError) {
        clearPolling();
        // More specific error handling
        if (pollError.message.includes('Network Error') || pollError.message.includes('fetch')) {
          setError('Connection lost. Please check if the backend is running and try again.');
        } else {
          setError(`Error polling job status: ${pollError.message}`);
        }
        setLoading(false);
      }
    }, pollInterval);
  }, [pollJobStatus, clearPolling]);

  const handleVisualize = useCallback(async (realData, syntheticData, params, backendConnected) => {
    if (!backendConnected) {
      setError('Backend server is not connected. Please ensure it is running.');
      return;
    }

    const validation = validateDataCompatibility(realData, syntheticData);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Reset other state first
      setEmbeddingData(null);
      setEmbeddingMetadata(null);
      setCurrentJobId(null);
      setCurrentTaskId(null);
      setProgress(0);
      setQueuePosition(null);
      setEstimatedWaitTime(null);
      setCanCancel(false);
      setProcessingStatus(null);
      clearPolling();

      // Sample data based on user selection
      const realSampleSize = params.params?.n_real_samples || realData.data.length;
      const synthSampleSize = params.params?.n_synth_samples || syntheticData.data.length;
      
      const sampledRealData = realData.data.slice(0, Math.min(realSampleSize, realData.data.length));
      const sampledSynthData = syntheticData.data.slice(0, Math.min(synthSampleSize, syntheticData.data.length));
      
      // Store SAMPLED data for fresh embeddings (for distribution plots)
      // This ensures distribution plots match exactly what was embedded
      setOriginalRealData({
        data: sampledRealData,
        headers: realData.headers,
        metadata: realData.metadata
      });
      setOriginalSyntheticData({
        data: sampledSynthData,
        headers: syntheticData.headers,
        metadata: syntheticData.metadata
      });
      
      // Store data in sessionStorage for EmbeddingPlot component access
      try {
        // Compress data by sampling if it's too large
        const maxStorageSize = 5000000; // 5MB limit
        const compressData = (data, headers, metadata) => {
          const compressed = {
            data: data.slice(0, 1000), // Limit to 1000 samples for storage
            headers: headers,
            metadata: { ...metadata, compressed: true, originalSize: data.length }
          };
          return compressed;
        };

        const realDataForStorage = sampledRealData.length > 1000 ? 
          compressData(sampledRealData, realData.headers, realData.metadata) :
          { data: sampledRealData, headers: realData.headers, metadata: realData.metadata };

        const syntheticDataForStorage = sampledSynthData.length > 1000 ? 
          compressData(sampledSynthData, syntheticData.headers, syntheticData.metadata) :
          { data: sampledSynthData, headers: syntheticData.headers, metadata: syntheticData.metadata };

        window.sessionStorage.setItem('realData', JSON.stringify(realDataForStorage));
        window.sessionStorage.setItem('syntheticData', JSON.stringify(syntheticDataForStorage));
      } catch (error) {
        console.warn('Failed to store data in sessionStorage:', error);
        // Clear sessionStorage and try with minimal data
        try {
          window.sessionStorage.clear();
          window.sessionStorage.setItem('realData', JSON.stringify({
            data: sampledRealData.slice(0, 100),
            headers: realData.headers,
            metadata: { ...realData.metadata, compressed: true, originalSize: sampledRealData.length }
          }));
          window.sessionStorage.setItem('syntheticData', JSON.stringify({
            data: sampledSynthData.slice(0, 100),
            headers: syntheticData.headers,
            metadata: { ...syntheticData.metadata, compressed: true, originalSize: sampledSynthData.length }
          }));
        } catch (fallbackError) {
          console.warn('Failed to store even minimal data in sessionStorage:', fallbackError);
        }
      }
      
      const totalSamples = sampledRealData.length + sampledSynthData.length;
      logger.info('Submitting samples to backend', { real: sampledRealData.length, synthetic: sampledSynthData.length });

      // Show appropriate status message based on dataset size
      if (totalSamples > 5000) {
        setProcessingStatus('Large dataset detected. Submitting to queue...');
      } else {
        setProcessingStatus('Submitting embedding job...');
      }

      // Submit job to backend
      let jobSubmission;
      
      if (params.pretrainedModel) {
        // Use pre-trained model
        jobSubmission = await submitPretrainedModelJob({
          real_data: sampledRealData,
          synthetic_data: sampledSynthData,
          method: params.method,
          model_data: params.pretrainedModel,
          model_format: params.modelFormat || 'pickle',
          real_headers: realData.headers,
          synthetic_headers: syntheticData.headers,
          real_dataset_name: realData.metadata?.fileName,
          synthetic_dataset_name: syntheticData.metadata?.fileName
        });
      } else {
        // Use regular training
        jobSubmission = await submitEmbeddingJob({
          real_data: sampledRealData,
          synthetic_data: sampledSynthData,
          method: params.method,
          params: params.params,
          real_headers: realData.headers,
          synthetic_headers: syntheticData.headers,
          real_dataset_name: realData.metadata?.fileName,
          synthetic_dataset_name: syntheticData.metadata?.fileName
        });
      }

      // Store job information
      setCurrentJobId(jobSubmission.job_id);
      setCurrentTaskId(jobSubmission.task_id);
      setCanCancel(true);
      
      // Handle original data from response if available (for immediate distribution plot access)
      if (jobSubmission.original_data) {
        // Use the original data from the response for distribution plots
        // This ensures we have the exact data that was submitted to the backend
        setOriginalRealData({
          data: jobSubmission.original_data.real_data,
          headers: jobSubmission.original_data.real_headers,
          metadata: realData.metadata
        });
        setOriginalSyntheticData({
          data: jobSubmission.original_data.synthetic_data,
          headers: jobSubmission.original_data.synthetic_headers,
          metadata: syntheticData.metadata
        });
      }
      
      // Update status with queue information
      if (jobSubmission.queue_position !== null) {
        setQueuePosition(jobSubmission.queue_position);
        setProcessingStatus('Processing');
      } else {
        setProcessingStatus('Processing');
      }

      // Start polling for job status
      startPolling(jobSubmission.job_id);

    } catch (err) {
      setError(`Error submitting embedding job: ${err.message}`);
      setLoading(false);
      resetState();
    }
  }, [resetState, startPolling]);

  const handleVisualizeWithPretrainedModel = useCallback(async (realData, syntheticData, params, backendConnected) => {
    if (!backendConnected) {
      setError('Backend not connected. Please check the server status.');
      return;
    }

    if (!realData || !syntheticData) {
      setError('Both real and synthetic data are required.');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      resetState();

      // Store original data for distribution plots
      setOriginalRealData(realData);
      setOriginalSyntheticData(syntheticData);

      // Validate data compatibility
      const compatibilityResult = validateDataCompatibility(realData, syntheticData);
      if (!compatibilityResult.compatible) {
        setError(`Data compatibility error: ${compatibilityResult.reason}`);
        setLoading(false);
        return;
      }

      // Submit pretrained model job from history
      const jobResponse = await submitPretrainedModelFromHistoryJob({
        real_data: realData.data,
        synthetic_data: syntheticData.data,
        method: params.method,
        pretrained_model_job_id: params.pretrainedModelJobId,
        real_headers: realData.headers,
        synthetic_headers: syntheticData.headers,
        real_dataset_name: realData.metadata?.fileName,
        synthetic_dataset_name: syntheticData.metadata?.fileName,
        n_real_samples: params.params.n_real_samples || 1000,
        n_synth_samples: params.params.n_synth_samples || 1000
      });

      if (jobResponse.status === 'completed') {
        // Direct completion - process results immediately
        const combinedEmbeddings = combineEmbeddings(
          jobResponse.result.embeddings.real,
          jobResponse.result.embeddings.synthetic
        );
        const labels = createEmbeddingLabels(
          jobResponse.result.embeddings.real.length,
          jobResponse.result.embeddings.synthetic.length
        );

        setEmbeddingData(combinedEmbeddings);
        
        // Include original data in metadata for distribution plots
        const enhancedMetadata = { 
          ...jobResponse.result.metadata, 
          labels,
          realData: realData,
          syntheticData: syntheticData
        };
        
        setEmbeddingMetadata(enhancedMetadata);
        setLoading(false);
      } else {
        // Async processing - start polling
        setCurrentJobId(jobResponse.job_id);
        setProcessingStatus('Submitted');
        setCanCancel(true);
        
        // Start polling for status updates
        startPolling(jobResponse.job_id);
      }

    } catch (error) {
      console.error('Error in handleVisualizeWithPretrainedModel:', error);
      setError(error.message || 'Failed to generate embeddings with pretrained model');
      setLoading(false);
    }
  }, [resetState]);

  const handleCancel = useCallback(async () => {
    if (!currentJobId || !canCancel) return;
    
    try {
      await cancelJob(currentJobId);
      clearPolling();
      setError('Job cancelled by user');
      setLoading(false);
      resetState();
    } catch (err) {
      setError(`Failed to cancel job: ${err.message}`);
    }
  }, [currentJobId, canCancel, clearPolling, resetState]);

  const loadFromHistory = useCallback((embeddings, metadata, sessionState) => {
    try {
      setError(null);
      resetState();
      
      // Clear original data when loading from history (shouldn't use data from previous fresh embedding)
      setOriginalRealData(null);
      setOriginalSyntheticData(null);
      
      // Clear session storage to avoid conflicts with history data
      try {
        window.sessionStorage.removeItem('realData');
        window.sessionStorage.removeItem('syntheticData');
      } catch (error) {
        console.warn('Failed to clear sessionStorage:', error);
      }
      
      if (!embeddings?.real || !embeddings?.synthetic) {
        throw new Error('Invalid embeddings data from history');
      }

      const combinedEmbeddings = combineEmbeddings(
        embeddings.real, 
        embeddings.synthetic
      );

      const labels = createEmbeddingLabels(
        embeddings.real.length,
        embeddings.synthetic.length
      );

      // Include session state data if available for distribution plots
      const enhancedMetadata = {
        ...metadata,
        labels
      };

      // If we have compressed data from history, include it in metadata
      if (sessionState?.realData && sessionState?.syntheticData) {
        enhancedMetadata.realData = sessionState.realData;
        enhancedMetadata.syntheticData = sessionState.syntheticData;
        enhancedMetadata.hasCompressedData = true;
      }

      setEmbeddingData(combinedEmbeddings);
      setEmbeddingMetadata(enhancedMetadata);
    } catch (err) {
      setError(`Error loading embedding from history: ${err.message}`);
      resetState();
    }
  }, [resetState]);

  return {
    // Data state
    embeddingData,
    embeddingMetadata,
    loading,
    error,
    
    // Original data for distribution plots (for real-time embeddings)
    originalRealData,
    originalSyntheticData,
    
    // Async processing state
    processingStatus,
    currentJobId,
    currentTaskId,
    progress,
    queuePosition,
    estimatedWaitTime,
    canCancel,
    
    // Actions
    setError,
    handleVisualize,
    handleVisualizeWithPretrainedModel,
    handleCancel,
    loadFromHistory,
    resetState
  };
}; 
