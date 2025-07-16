import { useState, useCallback, useRef } from 'react';
import { submitEmbeddingJob, getJobStatus, getJobResults, cancelJob } from '../services/api';
import { 
  validateDataCompatibility, 
  combineEmbeddings, 
  createEmbeddingLabels 
} from '../utils/dataUtils';

export const useEmbedding = () => {
  const [embeddingData, setEmbeddingData] = useState(null);
  const [embeddingMetadata, setEmbeddingMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Enhanced async processing state
  const [processingStatus, setProcessingStatus] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [queuePosition, setQueuePosition] = useState(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(null);
  const [canCancel, setCanCancel] = useState(false);
  
  // Store original data for fresh embeddings (for distribution plots)
  const [originalRealData, setOriginalRealData] = useState(null);
  const [originalSyntheticData, setOriginalSyntheticData] = useState(null);
  
  // Refs for polling management
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
          // Job completed - get results
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
            setError(`Job completed but failed to load results: ${err.message}`);
            clearPolling();
            setLoading(false);
            resetState();
            return;
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
        window.sessionStorage.setItem('realData', JSON.stringify({
          data: sampledRealData,
          headers: realData.headers,
          metadata: realData.metadata
        }));
        window.sessionStorage.setItem('syntheticData', JSON.stringify({
          data: sampledSynthData,
          headers: syntheticData.headers,
          metadata: syntheticData.metadata
        }));
      } catch (error) {
        console.warn('Failed to store data in sessionStorage:', error);
      }
      
      const totalSamples = sampledRealData.length + sampledSynthData.length;
      console.log(`Submitting ${sampledRealData.length} real samples and ${sampledSynthData.length} synthetic samples to backend`);

      // Show appropriate status message based on dataset size
      if (totalSamples > 5000) {
        setProcessingStatus('Large dataset detected. Submitting to queue...');
      } else {
        setProcessingStatus('Submitting embedding job...');
      }

      // Submit job to backend
      const jobSubmission = await submitEmbeddingJob({
        real_data: sampledRealData,
        synthetic_data: sampledSynthData,
        method: params.method,
        params: params.params,
        real_headers: realData.headers,
        synthetic_headers: syntheticData.headers
      });

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
    handleCancel,
    loadFromHistory,
    resetState
  };
}; 
