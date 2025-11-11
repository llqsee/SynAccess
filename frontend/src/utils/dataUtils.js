// Helper functions for working with data

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

  const hasRealData = realValues.length > 0;
  const hasSyntheticData = syntheticValues.length > 0;

  if (!hasRealData && !hasSyntheticData) {
    return false;
  }

  const realNumericRatio = hasRealData ? realNumeric.length / realValues.length : 0;
  const syntheticNumericRatio = hasSyntheticData ? syntheticNumeric.length / syntheticValues.length : 0;

  const checkDiscrete = (numericValues) => {
    if (numericValues.length === 0) return false;
    const allIntegers = numericValues.every(val => Number.isInteger(val));
    if (allIntegers) {
      return new Set(numericValues).size <= maxUnique;
    }
    const allWholeNumbers = numericValues.every(val => val % 1 === 0);
    if (allWholeNumbers) {
      return new Set(numericValues).size <= maxUnique;
    }
    return false;
  };

  const realIsDiscrete = hasRealData && realNumericRatio > 0.5 ? checkDiscrete(realNumeric) : false;
  const syntheticIsDiscrete = hasSyntheticData && syntheticNumericRatio > 0.5 ? checkDiscrete(syntheticNumeric) : false;

  if (hasRealData && hasSyntheticData) {
    return realIsDiscrete && syntheticIsDiscrete;
  }
  if (hasRealData) {
    return realIsDiscrete;
  }
  return syntheticIsDiscrete;
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
      { value: 'violin', label: 'Violin' },
      { value: 'beeswarm', label: 'Beeswarm' }
    ];
  } else {
    return [
      { value: 'bar', label: 'Bar Plot' }
    ];
  }
};

 