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

      // Send raw data to backend for processing
      const result = await computeEmbedding({
        real_data: realData.data,
        synthetic_data: syntheticData.data,
        method: params.method,
        params: params.params,
        n_samples: null,
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
        realData: realData.metadata,
        syntheticData: syntheticData.metadata
      });
    } catch (err) {
      setError(`Error computing embedding: ${err.message}`);
      setEmbeddingData(null);
      setEmbeddingMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    embeddingData,
    embeddingMetadata,
    loading,
    error,
    setError,
    handleVisualize
  };
}; 