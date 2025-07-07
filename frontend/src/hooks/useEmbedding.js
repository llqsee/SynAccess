import { useState } from 'react';
import { computeEmbedding } from '../services/api';
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
  const [processingStatus, setProcessingStatus] = useState(null); // For async feedback

  const handleVisualize = async (realData, syntheticData, params, backendConnected) => {
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
      setEmbeddingData(null);
      setEmbeddingMetadata(null);
      setProcessingStatus(null);

      // Sample data based on user selection
      const realSampleSize = params.n_real_samples || realData.data.length;
      const synthSampleSize = params.n_synth_samples || syntheticData.data.length;
      
      const sampledRealData = realData.data.slice(0, Math.min(realSampleSize, realData.data.length));
      const sampledSynthData = syntheticData.data.slice(0, Math.min(synthSampleSize, syntheticData.data.length));

      const totalSamples = sampledRealData.length + sampledSynthData.length;
      console.log(`Sending ${sampledRealData.length} real samples and ${sampledSynthData.length} synthetic samples to backend`);

      // Show appropriate status message based on dataset size
      if (totalSamples > 5000) {
        setProcessingStatus('Large dataset detected. Processing in background...');
      } else {
        setProcessingStatus('Processing embedding...');
      }

      // Send sampled data to backend for processing
      const result = await computeEmbedding({
        real_data: sampledRealData,
        synthetic_data: sampledSynthData,
        method: params.method,
        params: params.params,
        real_headers: realData.headers,
        synthetic_headers: syntheticData.headers
      });

      if (!result.embeddings?.real || !result.embeddings?.synthetic || !result.metadata) {
        throw new Error('Invalid response from server: missing embeddings or metadata');
      }

      const combinedEmbeddings = combineEmbeddings(
        result.embeddings.real, 
        result.embeddings.synthetic
      );

      const labels = createEmbeddingLabels(
        result.embeddings.real.length,
        result.embeddings.synthetic.length
      );

      setEmbeddingData(combinedEmbeddings);
      setEmbeddingMetadata({
        ...result.metadata,
        labels,
        realData: {
          data: realData.data,
          headers: realData.headers,
          metadata: realData.metadata
        },
        syntheticData: {
          data: syntheticData.data,
          headers: syntheticData.headers,
          metadata: syntheticData.metadata
        }
      });
      setProcessingStatus('Embedding completed successfully!');
    } catch (err) {
      setError(`Error computing embedding: ${err.message}`);
      setEmbeddingData(null);
      setEmbeddingMetadata(null);
      setProcessingStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (embeddings, metadata) => {
    try {
      setError(null);
      setProcessingStatus(null);
      
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

      setEmbeddingData(combinedEmbeddings);
      setEmbeddingMetadata({
        ...metadata,
        labels
      });
    } catch (err) {
      setError(`Error loading embedding from history: ${err.message}`);
      setEmbeddingData(null);
      setEmbeddingMetadata(null);
    }
  };

  return {
    embeddingData,
    embeddingMetadata,
    loading,
    error,
    processingStatus,
    setError,
    handleVisualize,
    loadFromHistory
  };
}; 
