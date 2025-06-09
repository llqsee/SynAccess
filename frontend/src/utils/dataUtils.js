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