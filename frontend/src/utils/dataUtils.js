// Utility functions for data processing

export const validateDataCompatibility = (realData, syntheticData) => {
  if (!realData || !syntheticData) {
    return { isValid: false, error: 'Please upload both real and synthetic data files first.' };
  }
  
  return { isValid: true };
};

export const combineEmbeddings = (realEmbeddings, syntheticEmbeddings) => {
  return [
    ...realEmbeddings,
    ...syntheticEmbeddings
  ];
};

export const createEmbeddingLabels = (realCount, syntheticCount) => {
  return [
    ...Array(realCount).fill('Real'),
    ...Array(syntheticCount).fill('Synthetic')
  ];
};

// Check if a column is discrete (integer or float with whole number values and limited unique values)
export const isDiscreteVariable = (columnIndex, originalData, columnName = null, maxUnique = 20) => {
  if (!originalData || (columnIndex !== null && columnIndex >= originalData.headers.length)) return false;
  
  // Support both index-based and name-based column identification
  let colIndex = columnIndex;
  if (columnName && originalData.headers) {
    colIndex = originalData.headers.indexOf(columnName);
    if (colIndex === -1) return false;
  }
  
  // Extract column values from both real and synthetic data
  const realData = originalData.data.filter((_, index) => originalData.labels[index] === 'Real');
  const syntheticData = originalData.data.filter((_, index) => originalData.labels[index] === 'Synthetic');
  
  // Get all values from both datasets
  const realValues = realData.map(row => row[colIndex]).filter(val => val !== null && val !== undefined && val !== '');
  const syntheticValues = syntheticData.map(row => row[colIndex]).filter(val => val !== null && val !== undefined && val !== '');
  
  // Convert to numbers
  const realNumeric = realValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
  const syntheticNumeric = syntheticValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
  
  // Must be mostly numeric
  const realNumericRatio = realValues.length > 0 ? realNumeric.length / realValues.length : 0;
  const syntheticNumericRatio = syntheticValues.length > 0 ? syntheticNumeric.length / syntheticValues.length : 0;
  
  if (realNumericRatio <= 0.5 || syntheticNumericRatio <= 0.5) {
    return false;
  }
  
  // Check each dataset separately - if EITHER passes the discrete test, consider it discrete
  
  // Test real data
  const realAllIntegers = realNumeric.every(val => Number.isInteger(val));
  const realIsDiscrete = (() => {
    if (realAllIntegers) {
      // For integers, check unique count
      const realUniqueValues = new Set(realNumeric);
      return realUniqueValues.size <= maxUnique;
    }
    
    // For floats, check if all are whole numbers
    const realAllWholeNumbers = realNumeric.every(val => val % 1 === 0);
    if (realAllWholeNumbers) {
      const realUniqueValues = new Set(realNumeric);
      return realUniqueValues.size <= maxUnique;
    }
    
    return false;
  })();
  
  // Test synthetic data
  const syntheticAllIntegers = syntheticNumeric.every(val => Number.isInteger(val));
  const syntheticIsDiscrete = (() => {
    if (syntheticAllIntegers) {
      // For integers, check unique count
      const syntheticUniqueValues = new Set(syntheticNumeric);
      return syntheticUniqueValues.size <= maxUnique;
    }
    
    // For floats, check if all are whole numbers
    const syntheticAllWholeNumbers = syntheticNumeric.every(val => val % 1 === 0);
    if (syntheticAllWholeNumbers) {
      const syntheticUniqueValues = new Set(syntheticNumeric);
      return syntheticUniqueValues.size <= maxUnique;
    }
    
    return false;
  })();
  
  // Return true if EITHER real OR synthetic data is discrete
  return realIsDiscrete || syntheticIsDiscrete;
};

// Shared function to classify column data type (extracted from duplicate code in DistributionPlot.js and EmbeddingPlot.js)
export const classifyColumnType = (columnIndex, originalData, columnName = null) => {
  if (!originalData || (columnIndex !== null && columnIndex >= originalData.headers.length)) return 'categorical';
  
  // Support both index-based and name-based column identification
  let colIndex = columnIndex;
  if (columnName && originalData.headers) {
    colIndex = originalData.headers.indexOf(columnName);
    if (colIndex === -1) return 'categorical';
  }
  
  // Extract column values from both real and synthetic data
  const realData = originalData.data.filter((_, index) => originalData.labels[index] === 'Real');
  const syntheticData = originalData.data.filter((_, index) => originalData.labels[index] === 'Synthetic');
  
  // Sample some values from both datasets
  const realSample = realData.slice(0, Math.min(100, realData.length))
    .map(row => row[colIndex])
    .filter(val => val !== null && val !== undefined && val !== '');
  
  const syntheticSample = syntheticData.slice(0, Math.min(100, syntheticData.length))
    .map(row => row[colIndex])
    .filter(val => val !== null && val !== undefined && val !== '');

  // Combine all samples for comprehensive analysis
  const allSamples = [...realSample, ...syntheticSample];
  
  // Try to convert to numbers
  const realNumeric = realSample.map(val => {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  }).filter(val => val !== null);

  const syntheticNumeric = syntheticSample.map(val => {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  }).filter(val => val !== null);

  // Check if more than 50% of values can be converted to numbers
  const realNumericRatio = realSample.length > 0 ? realNumeric.length / realSample.length : 0;
  const syntheticNumericRatio = syntheticSample.length > 0 ? syntheticNumeric.length / syntheticSample.length : 0;

  const isNumeric = (realNumericRatio > 0.5 && syntheticNumericRatio > 0.5);
  
  // If not numeric, return categorical
  if (!isNumeric) {
    return 'categorical';
  }
  

  
  return 'numeric';
};

// Shared function to get available plot types (extracted from duplicate code)
export const getAvailablePlotTypes = (dataType) => {
  if (dataType === 'numeric') {
    return [
      { value: 'histogram', label: 'Histogram' },
      { value: 'violin', label: 'Violin' }
    ];
  } else {
    return [
      { value: 'bar', label: 'Bar Plot' }
    ];
  }
};

 