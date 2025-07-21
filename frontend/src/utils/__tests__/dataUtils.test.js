import {
  validateDataCompatibility,
  combineEmbeddings,
  createEmbeddingLabels,
  isDiscreteVariable,
  classifyColumnType,
  getAvailablePlotTypes
} from '../dataUtils';

describe('dataUtils', () => {
  describe('validateDataCompatibility', () => {
    it('should return invalid when realData is null', () => {
      const result = validateDataCompatibility(null, { data: [] });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please upload both real and synthetic data files first.');
    });

    it('should return invalid when syntheticData is null', () => {
      const result = validateDataCompatibility({ data: [] }, null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please upload both real and synthetic data files first.');
    });

    it('should return invalid when both datasets are null', () => {
      const result = validateDataCompatibility(null, null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please upload both real and synthetic data files first.');
    });

    it('should return valid when both datasets are provided', () => {
      const realData = { data: [[1, 2], [3, 4]], headers: ['col1', 'col2'] };
      const syntheticData = { data: [[5, 6], [7, 8]], headers: ['col1', 'col2'] };
      
      const result = validateDataCompatibility(realData, syntheticData);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('combineEmbeddings', () => {
    it('should combine two embedding arrays', () => {
      const realEmbeddings = [[1, 2], [3, 4]];
      const syntheticEmbeddings = [[5, 6], [7, 8]];
      
      const result = combineEmbeddings(realEmbeddings, syntheticEmbeddings);
      expect(result).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]]);
    });

    it('should handle empty arrays', () => {
      const result = combineEmbeddings([], []);
      expect(result).toEqual([]);
    });

    it('should handle one empty array', () => {
      const realEmbeddings = [[1, 2], [3, 4]];
      const result = combineEmbeddings(realEmbeddings, []);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('createEmbeddingLabels', () => {
    it('should create labels for real and synthetic data', () => {
      const result = createEmbeddingLabels(2, 3);
      expect(result).toEqual(['Real', 'Real', 'Synthetic', 'Synthetic', 'Synthetic']);
    });

    it('should handle zero counts', () => {
      const result = createEmbeddingLabels(0, 2);
      expect(result).toEqual(['Synthetic', 'Synthetic']);
    });

    it('should handle both zero counts', () => {
      const result = createEmbeddingLabels(0, 0);
      expect(result).toEqual([]);
    });
  });

  describe('isDiscreteVariable', () => {
    const createMockData = (realValues, syntheticValues) => ({
      headers: ['col1', 'col2'],
      data: [
        ...realValues.map(val => [val, 'other']),
        ...syntheticValues.map(val => [val, 'other'])
      ],
      labels: [
        ...Array(realValues.length).fill('Real'),
        ...Array(syntheticValues.length).fill('Synthetic')
      ]
    });

    it('should return false for invalid data', () => {
      expect(isDiscreteVariable(0, null)).toBe(false);
      expect(isDiscreteVariable(5, createMockData([1, 2], [3, 4]))).toBe(false);
    });

    it('should return true for integer discrete variables', () => {
      const data = createMockData([1, 2, 3, 1, 2], [1, 2, 3, 2, 1]);
      expect(isDiscreteVariable(0, data)).toBe(true);
    });

    it('should return true for float discrete variables with whole numbers', () => {
      const data = createMockData([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]);
      expect(isDiscreteVariable(0, data)).toBe(true);
    });

    it('should return false for continuous variables', () => {
      const data = createMockData([1.5, 2.7, 3.9], [1.1, 2.3, 3.8]);
      expect(isDiscreteVariable(0, data)).toBe(false);
    });

    it('should return false for too many unique values', () => {
      const realValues = Array.from({length: 25}, (_, i) => i);
      const syntheticValues = Array.from({length: 25}, (_, i) => i + 25);
      const data = createMockData(realValues, syntheticValues);
      expect(isDiscreteVariable(0, data)).toBe(false);
    });

    it('should work with column names', () => {
      const data = createMockData([1, 2, 3], [1, 2, 3]);
      expect(isDiscreteVariable(null, data, 'col1')).toBe(true);
      expect(isDiscreteVariable(null, data, 'nonexistent')).toBe(false);
    });

    it('should handle mostly non-numeric data', () => {
      const data = createMockData(['a', 'b', 1], ['a', 'b', 2]);
      expect(isDiscreteVariable(0, data)).toBe(false);
    });
  });

  describe('classifyColumnType', () => {
    const createMockData = (realValues, syntheticValues) => ({
      headers: ['col1', 'col2'],
      data: [
        ...realValues.map(val => [val, 'other']),
        ...syntheticValues.map(val => [val, 'other'])
      ],
      labels: [
        ...Array(realValues.length).fill('Real'),
        ...Array(syntheticValues.length).fill('Synthetic')
      ]
    });

    it('should return categorical for invalid data', () => {
      expect(classifyColumnType(0, null)).toBe('categorical');
      expect(classifyColumnType(5, createMockData([1, 2], [3, 4]))).toBe('categorical');
    });

    it('should return numeric for numeric data', () => {
      const data = createMockData([1.5, 2.7, 3.9], [1.1, 2.3, 3.8]);
      expect(classifyColumnType(0, data)).toBe('numeric');
    });

    it('should return categorical for string data', () => {
      const data = createMockData(['a', 'b', 'c'], ['d', 'e', 'f']);
      expect(classifyColumnType(0, data)).toBe('categorical');
    });

    it('should return categorical for mixed data with low numeric ratio', () => {
      const data = createMockData(['a', 'b', 1], ['c', 'd', 2]);
      expect(classifyColumnType(0, data)).toBe('categorical');
    });

    it('should return numeric for integer data', () => {
      const data = createMockData([1, 2, 3], [4, 5, 6]);
      expect(classifyColumnType(0, data)).toBe('numeric');
    });

    it('should work with column names', () => {
      const data = createMockData([1.5, 2.7], [1.1, 2.3]);
      expect(classifyColumnType(null, data, 'col1')).toBe('numeric');
      expect(classifyColumnType(null, data, 'nonexistent')).toBe('categorical');
    });

    it('should handle empty values', () => {
      const data = createMockData([1, '', null, 2], [3, undefined, 4, '']);
      expect(classifyColumnType(0, data)).toBe('numeric');
    });
  });

  describe('getAvailablePlotTypes', () => {
    it('should return histogram and violin for numeric data', () => {
      const result = getAvailablePlotTypes('numeric');
      expect(result).toEqual([
        { value: 'histogram', label: 'Histogram' },
        { value: 'violin', label: 'Violin' }
      ]);
    });

    it('should return bar plot for categorical data', () => {
      const result = getAvailablePlotTypes('categorical');
      expect(result).toEqual([
        { value: 'bar', label: 'Bar Plot' }
      ]);
    });

    it('should return bar plot for any non-numeric data type', () => {
      const result = getAvailablePlotTypes('other');
      expect(result).toEqual([
        { value: 'bar', label: 'Bar Plot' }
      ]);
    });
  });
}); 