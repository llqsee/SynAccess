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

  // Try to convert to numbers
  const realNumeric = realSample.map(val => {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  }).filter(val => val !== null);

  const syntheticNumeric = syntheticSample.map(val => {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  }).filter(val => val !== null);

  // If more than 50% of values can be converted to numbers, consider it numeric
  const realNumericRatio = realSample.length > 0 ? realNumeric.length / realSample.length : 0;
  const syntheticNumericRatio = syntheticSample.length > 0 ? syntheticNumeric.length / syntheticSample.length : 0;

  const isNumeric = (realNumericRatio > 0.5 && syntheticNumericRatio > 0.5);
  
  return isNumeric ? 'numeric' : 'categorical';
};

// Shared function to get available plot types (extracted from duplicate code)
export const getAvailablePlotTypes = (dataType) => {
  if (dataType === 'numeric') {
    return [
      { value: 'histogram', label: 'Histogram' },
      { value: 'violin', label: 'Violin' },
      { value: 'histogram_comparison', label: 'Histogram Comparison' }
    ];
  } else {
    return [
      { value: 'bar', label: 'Bar Plot' }
    ];
  }
}; 