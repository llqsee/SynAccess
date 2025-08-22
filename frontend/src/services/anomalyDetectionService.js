import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

class AnomalyDetectionService {
  /**
   * Detect anomalies using histogram-based grid sizing with binomial proportion tests.
   * 
   * This service performs:
   * 1. Histogram-based grid cell determination for X and Y dimensions separately
   * 2. Two one-sided binomial proportion tests (real vs synthetic overpopulation)
   * 3. False Discovery Rate (FDR) correction applied separately to positive and negative tests
   * 4. Binary red/blue coloring based on FDR-corrected significance
   */
  
  /**
   * Detect anomalies in real and synthetic data
   * @param {Array} realData - Array of real data points (2D coordinates)
   * @param {Array} syntheticData - Array of synthetic data points (2D coordinates)
   * @param {number} xBins - Number of bins for X dimension (default: 20)
   * @param {number} yBins - Number of bins for Y dimension (default: 20)
   * @param {number} fdrAlpha - Significance level for FDR correction (default: 0.05)
   * @returns {Promise<Object>} Anomaly detection results
   */
  async detectAnomalies(realData, syntheticData, xBins = 20, yBins = 20, fdrAlpha = 0.05) {
    try {
      // Validate input data
      if (!realData || realData.length === 0) {
        throw new Error('Real data cannot be empty');
      }
      
      if (!syntheticData || syntheticData.length === 0) {
        throw new Error('Synthetic data cannot be empty');
      }
      
      // Validate data dimensions
      if (realData[0] && realData[0].length !== 2) {
        throw new Error('Real data must be 2D coordinates');
      }
      
      if (syntheticData[0] && syntheticData[0].length !== 2) {
        throw new Error('Synthetic data must be 2D coordinates');
      }
      
      const response = await api.post('/anomaly/detect-anomalies', {
        real_data: realData,
        synthetic_data: syntheticData,
        x_bins: xBins,
        y_bins: yBins,
        fdr_alpha: fdrAlpha
      });
      
      return response.data;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw new Error(`Anomaly detection failed: ${error.response?.data?.detail || error.message}`);
    }
  }
  
  /**
   * Detect anomalies using data from a previously completed embedding job
   * @param {number} jobId - ID of the completed embedding job
   * @param {number} xBins - Number of bins for X dimension (default: 20)
   * @param {number} yBins - Number of bins for Y dimension (default: 20)
   * @param {number} fdrAlpha - Significance level for FDR correction (default: 0.05)
   * @returns {Promise<Object>} Anomaly detection results
   */
  async detectAnomaliesFromJob(jobId, xBins = 20, yBins = 20, fdrAlpha = 0.05) {
    try {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      
      const response = await api.post('/anomaly/detect-anomalies-from-job', {
        job_id: jobId,
        x_bins: xBins,
        y_bins: yBins,
        fdr_alpha: fdrAlpha
      });
      
      return response.data;
    } catch (error) {
      console.error('Error detecting anomalies from job:', error);
      throw new Error(`Anomaly detection from job failed: ${error.response?.data?.detail || error.message}`);
    }
  }
  
  /**
   * Generate CSV content for anomaly detection results
   * @param {Array} realData - Array of real data points (2D coordinates)
   * @param {Array} syntheticData - Array of synthetic data points (2D coordinates)
   * @param {number} xBins - Number of bins for X dimension (default: 20)
   * @param {number} yBins - Number of bins for Y dimension (default: 20)
   * @param {number} fdrAlpha - Significance level for FDR correction (default: 0.05)
   * @returns {Promise<string>} CSV content as string
   */
  async generateAnomalyCSV(realData, syntheticData, xBins = 20, yBins = 20, fdrAlpha = 0.05) {
    try {
      // Validate input data
      if (!realData || realData.length === 0) {
        throw new Error('Real data cannot be empty');
      }
      
      if (!syntheticData || syntheticData.length === 0) {
        throw new Error('Synthetic data cannot be empty');
      }
      
      const response = await axios.post(`${API_BASE_URL}/anomaly/generate-anomaly-csv`, {
        real_data: realData,
        synthetic_data: syntheticData,
        x_bins: xBins,
        y_bins: yBins,
        fdr_alpha: fdrAlpha
      });
      
      return {
        status: 'success',
        csv_content: response.data.csv_content,
        filename: response.data.filename || 'anomaly_detection_results.csv'
      };
    } catch (error) {
      console.error('Error generating anomaly CSV:', error);
      throw new Error(`CSV generation failed: ${error.response?.data?.detail || error.message}`);
    }
  }
  
  /**
   * Generate CSV content for anomaly detection results using data from a job
   * @param {number} jobId - ID of the completed embedding job
   * @param {number} xBins - Number of bins for X dimension (default: 20)
   * @param {number} yBins - Number of bins for Y dimension (default: 20)
   * @param {number} fdrAlpha - Significance level for FDR correction (default: 0.05)
   * @returns {Promise<string>} CSV content as string
   */
  async generateAnomalyCSVFromJob(jobId, xBins = 20, yBins = 20, fdrAlpha = 0.05) {
    try {
      if (!jobId) {
        throw new Error('Job ID is required');
      }
      
      const response = await axios.post(`${API_BASE_URL}/anomaly/generate-anomaly-csv-from-job`, {
        job_id: jobId,
        x_bins: xBins,
        y_bins: yBins,
        fdr_alpha: fdrAlpha
      });
      
      return {
        status: 'success',
        csv_content: response.data.csv_content,
        filename: response.data.filename || 'anomaly_detection_results.csv'
      };
    } catch (error) {
      console.error('Error generating anomaly CSV from job:', error);
      throw new Error(`CSV generation from job failed: ${error.response?.data?.detail || error.message}`);
    }
  }
  
  /**
   * Download CSV file with anomaly detection results
   * @param {string} csvContent - CSV content as string
   * @param {string} filename - Filename for the downloaded file (default: 'anomaly_detection_results.csv')
   */
  downloadCSV(csvContent, filename = 'anomaly_detection_results.csv') {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
      throw new Error('Failed to download CSV file');
    }
  }
  
  /**
   * Get validation messages for anomaly detection parameters
   * @param {number} xBins - Number of bins for X dimension
   * @param {number} yBins - Number of bins for Y dimension
   * @param {number} fdrAlpha - Significance level for FDR correction
   * @returns {Array<string>} Array of validation messages
   */
  getValidationMessages(xBins, yBins, fdrAlpha) {
    const messages = [];
    
    if (xBins < 5 || xBins > 100) {
      messages.push('X bins must be between 5 and 100');
    }
    
    if (yBins < 5 || yBins > 100) {
      messages.push('Y bins must be between 5 and 100');
    }
    
    if (fdrAlpha < 0.001 || fdrAlpha > 0.5) {
      messages.push('FDR alpha must be between 0.001 and 0.5');
    }
    
    return messages;
  }
  
  /**
   * Get default parameters for histogram-based anomaly detection
   * @returns {Object} Default parameters
   */
  getDefaultParameters() {
    return {
      xBins: 20,
      yBins: 20,
      fdrAlpha: 0.05
    };
  }
  
  /**
   * Get description of the anomaly detection method
   * @returns {string} Method description
   */
  getMethodDescription() {
    return `Histogram-based anomaly detection using binomial proportion tests:
    
1. **Grid Creation**: Creates histogram-based grid cells for X and Y dimensions separately
2. **Proportion Calculation**: Calculates cell proportions (real/total) and global proportion
3. **Statistical Testing**: Performs two one-sided binomial proportion tests:
   - Test A: cell_proportion > global_proportion (real overpopulation)
   - Test B: cell_proportion < global_proportion (synthetic overpopulation)
4. **FDR Correction**: Applies False Discovery Rate correction separately to positive and negative tests
5. **Coloring**: Colors significant cells red (real overpopulation) or blue (synthetic overpopulation)`;
  }
  
  /**
   * Validate data for anomaly detection
   * @param {Array} realData - Array of real data points
   * @param {Array} syntheticData - Array of synthetic data points
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateData(realData, syntheticData) {
    const errors = [];
    
    // Check if data exists
    if (!realData || !Array.isArray(realData) || realData.length === 0) {
      errors.push('Real data must be a non-empty array');
    }
    
    if (!syntheticData || !Array.isArray(syntheticData) || syntheticData.length === 0) {
      errors.push('Synthetic data must be a non-empty array');
    }
    
    // Check minimum data requirements
    if (realData && realData.length < 10) {
      errors.push('Real data must have at least 10 points for reliable anomaly detection');
    }
    
    // Check data dimensions (must be 2D for grid-based approach)
    if (realData && realData.length > 0 && realData[0] && realData[0].length !== 2) {
      errors.push('Real data must be 2D coordinates for grid-based anomaly detection');
    }
    
    if (syntheticData && syntheticData.length > 0 && syntheticData[0] && syntheticData[0].length !== 2) {
      errors.push('Synthetic data must be 2D coordinates for grid-based anomaly detection');
    }
    
    // Check data type consistency
    if (realData && syntheticData && realData.length > 0 && syntheticData.length > 0) {
      const realDim = realData[0] ? realData[0].length : 0;
      const syntheticDim = syntheticData[0] ? syntheticData[0].length : 0;
      
      if (realDim !== syntheticDim) {
        errors.push(`Data dimension mismatch: Real data has ${realDim} features, Synthetic data has ${syntheticDim} features`);
      }
    }
    
    // Check for valid numeric data
    if (realData && realData.length > 0) {
      for (let i = 0; i < Math.min(realData.length, 5); i++) {
        if (!Array.isArray(realData[i])) {
          errors.push(`Real data[${i}] must be an array`);
          break;
        }
        for (let j = 0; j < realData[i].length; j++) {
          if (typeof realData[i][j] !== 'number' || isNaN(realData[i][j])) {
            errors.push(`Real data[${i}][${j}] must be a number, got ${typeof realData[i][j]}: ${realData[i][j]}`);
            break;
          }
        }
      }
    }
    
    if (syntheticData && syntheticData.length > 0) {
      for (let i = 0; i < Math.min(syntheticData.length, 5); i++) {
        if (!Array.isArray(syntheticData[i])) {
          errors.push(`Synthetic data[${i}] must be an array`);
          break;
        }
        for (let j = 0; j < syntheticData[i].length; j++) {
          if (typeof syntheticData[i][j] !== 'number' || isNaN(syntheticData[i][j])) {
            errors.push(`Synthetic data[${i}][${j}] must be a number, got ${typeof syntheticData[i][j]}: ${syntheticData[i][j]}`);
            break;
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
  
  /**
   * Prepare data for anomaly detection by separating real and synthetic data
   * @param {Array} embeddingData - Array of embedding coordinates
   * @param {Array} labels - Array of labels ('Real' or 'Synthetic')
   * @returns {Object} Object with realData and syntheticData arrays
   */
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
}

export default new AnomalyDetectionService(); 