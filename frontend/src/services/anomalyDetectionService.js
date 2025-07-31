const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

class AnomalyDetectionService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  }

  async detectAnomalies(realData, syntheticData, contamination = 'auto') {
    try {
      console.log('🔍 Sending anomaly detection request:');
      console.log('Real data sample:', realData.slice(0, 3));
      console.log('Synthetic data sample:', syntheticData.slice(0, 3));
      console.log('Contamination:', contamination);
      
      // Validate data types
      const validateNumericData = (data, name) => {
        if (!Array.isArray(data)) {
          throw new Error(`${name} must be an array`);
        }
        for (let i = 0; i < Math.min(data.length, 5); i++) {
          if (!Array.isArray(data[i])) {
            throw new Error(`${name}[${i}] must be an array`);
          }
          for (let j = 0; j < Math.min(data[i].length, 3); j++) {
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
        contamination: contamination
      };
      
      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${this.baseURL}/anomaly/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend error:', errorData);
        throw new Error(errorData.detail || 'Failed to detect anomalies');
      }

      const data = await response.json();
      console.log('✅ Anomaly detection response:', data);
      console.log('📊 Response keys:', Object.keys(data));
      console.log('📈 Response structure:', JSON.stringify(data, null, 2));
      
      // The response structure is different than expected
      // Return the entire response instead of looking for anomaly_detection property
      return data;
    } catch (error) {
      console.error('❌ Anomaly detection failed:', error);
      throw error;
    }
  }

  async detectAnomaliesFromJob(jobId, contamination = 'auto') {
    try {
      console.log('🔍 Sending anomaly detection request using preprocessed data from job:', jobId);
      console.log('Contamination:', contamination);
      
      const requestBody = {
        job_id: jobId,
        contamination: contamination
      };
      
      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${this.baseURL}/anomaly/detect-from-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend error:', errorData);
        throw new Error(errorData.detail || 'Failed to detect anomalies from job');
      }

      const data = await response.json();
      console.log('✅ Anomaly detection from job response:', data);
      console.log('📊 Response keys:', Object.keys(data));
      console.log('📈 Response structure:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('❌ Anomaly detection from job failed:', error);
      throw error;
    }
  }

  async generateAnomalyCSV(realData, syntheticData, contamination = 'auto') {
    try {
      const response = await fetch(`${this.baseURL}/anomaly/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          real_data: realData,
          synthetic_data: syntheticData,
          contamination: contamination
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate CSV');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('CSV generation failed:', error);
      throw error;
    }
  }

  async generateAnomalyCSVFromJob(jobId, contamination = 'auto') {
    try {
      const response = await fetch(`${this.baseURL}/anomaly/csv-from-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: jobId,
          contamination: contamination
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate CSV from job');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('CSV generation from job failed:', error);
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
      console.error('Health check failed:', error);
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
      console.error('Failed to download CSV:', error);
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
    
    if (!Array.isArray(realData) || realData.length === 0) {
      errors.push('Real data must be a non-empty array');
    }
    
    if (!Array.isArray(syntheticData) || syntheticData.length === 0) {
      errors.push('Synthetic data must be a non-empty array');
    }
    
    if (realData.length < 10) {
      errors.push('Real data must have at least 10 points');
    }
    
    if (realData.length > 0 && syntheticData.length > 0) {
      const realDim = realData[0].length;
      const syntheticDim = syntheticData[0].length;
      
      if (realDim !== syntheticDim) {
        errors.push(`Data dimension mismatch: Real data has ${realDim} features, Synthetic data has ${syntheticDim} features`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

export default new AnomalyDetectionService(); 