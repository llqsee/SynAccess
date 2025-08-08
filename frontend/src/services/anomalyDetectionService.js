import logger from '../utils/logger';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

class AnomalyDetectionService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  }

  async detectAnomalies(realData, syntheticData, gridSize = 20) {
    try {
      logger.debug('Sending adaptive logit-based anomaly detection request', { gridSize });
      logger.debug('AnomalyRequestSamples', {
        realSample: realData.slice(0, 3),
        synthSample: syntheticData.slice(0, 3)
      });

      // Validate data types
      const validateNumericData = (data, name) => {
        if (!Array.isArray(data)) {
          throw new Error(`${name} must be an array`);
        }
        for (let i = 0; i < Math.min(data.length, 5); i++) {
          if (!Array.isArray(data[i])) {
            throw new Error(`${name}[${i}] must be an array`);
          }
          if (data[i].length !== 2) {
            throw new Error(`${name}[${i}] must have exactly 2 dimensions for grid-based detection`);
          }
          for (let j = 0; j < data[i].length; j++) {
            if (typeof data[i][j] !== 'number' || isNaN(data[i][j])) {
              throw new Error(`${name}[${i}][${j}] must be a number, got ${typeof data[i][j]}: ${data[i][j]}`);
            }
          }
        }
      };

      validateNumericData(realData, 'realData');
      validateNumericData(syntheticData, 'syntheticData');

      const requestBody = {
        real_data: realData,
        synthetic_data: syntheticData,
        grid_size: gridSize
      };

      logger.apiRequest('POST', `${this.baseURL}/anomaly/detect`, requestBody);

      const response = await fetch(`${this.baseURL}/anomaly/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      logger.apiResponse('POST', `${this.baseURL}/anomaly/detect`, response.status);

      if (!response.ok) {
        const errorData = await response.json();
        logger.apiError('POST', `${this.baseURL}/anomaly/detect`, new Error('Backend error'), { errorData });
        throw new Error(errorData.detail || 'Failed to detect anomalies');
      }

      const data = await response.json();
      logger.debug('Anomaly detection response received');
      return data;
    } catch (error) {
      logger.error('Adaptive logit-based anomaly detection failed', error);
      throw error;
    }
  }

  async detectAnomaliesFromJob(jobId, gridSize = 20) {
    try {
      const requestBody = { job_id: jobId, grid_size: gridSize };
      logger.apiRequest('POST', `${this.baseURL}/anomaly/detect-from-job`, requestBody);

      const response = await fetch(`${this.baseURL}/anomaly/detect-from-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      logger.apiResponse('POST', `${this.baseURL}/anomaly/detect-from-job`, response.status);

      if (!response.ok) {
        const errorData = await response.json();
        logger.apiError('POST', `${this.baseURL}/anomaly/detect-from-job`, new Error('Backend error'), { errorData });
        throw new Error(errorData.detail || 'Failed to detect anomalies from job');
      }

      const data = await response.json();
      logger.debug('Anomaly detection from job response received');
      return data;
    } catch (error) {
      logger.error('Adaptive logit-based anomaly detection from job failed', error);
      throw error;
    }
  }

  async generateAnomalyCSV(realData, syntheticData, gridSize = 20) {
    try {
      const response = await fetch(`${this.baseURL}/anomaly/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ real_data: realData, synthetic_data: syntheticData, grid_size: gridSize }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate CSV');
      }

      return await response.json();
    } catch (error) {
      logger.error('CSV generation failed', error);
      throw error;
    }
  }

  async generateAnomalyCSVFromJob(jobId, gridSize = 20) {
    try {
      const response = await fetch(`${this.baseURL}/anomaly/csv-from-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, grid_size: gridSize }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate CSV from job');
      }

      return await response.json();
    } catch (error) {
      logger.error('CSV generation from job failed', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/anomaly/health`);
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      return await response.json();
    } catch (error) {
      logger.error('Health check failed', error);
      throw error;
    }
  }

  downloadCSV(csvContent, filename) {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      logger.error('Failed to download CSV', error);
      throw error;
    }
  }

  prepareDataForAnomalyDetection(embeddingData, labels) {
    const realData = [];
    const syntheticData = [];

    embeddingData.forEach((point, index) => {
      if (labels[index] === 'Real') {
        realData.push(point);
      } else if (labels[index] === 'Synthetic') {
        syntheticData.push(point);
      }
    });

    return { realData, syntheticData };
  }

  validateData(realData, syntheticData) {
    const errors = [];
    if (!Array.isArray(realData) || realData.length === 0) errors.push('Real data must be a non-empty array');
    if (!Array.isArray(syntheticData) || syntheticData.length === 0) errors.push('Synthetic data must be a non-empty array');
    if (realData.length < 10) errors.push('Real data must have at least 10 points');

    if (realData.length > 0 && syntheticData.length > 0) {
      const realDim = realData[0].length;
      const syntheticDim = syntheticData[0].length;
      if (realDim !== 2 || syntheticDim !== 2) errors.push('Adaptive logit-based anomaly detection requires 2D data (embedding coordinates)');
      if (realDim !== syntheticDim) errors.push(`Data dimension mismatch: Real data has ${realDim} features, Synthetic data has ${syntheticDim} features`);
    }

    return { isValid: errors.length === 0, errors };
  }
}

export default new AnomalyDetectionService(); 