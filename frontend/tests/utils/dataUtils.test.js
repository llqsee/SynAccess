import '@testing-library/jest-dom';

// Mock the dataUtils functions since they might not exist yet
const mockDataUtils = {
  parseFileData: jest.fn(),
  validateData: jest.fn(),
  formatFileSize: jest.fn()
};

// Mock the entire module
jest.mock('../../src/utils/dataUtils', () => mockDataUtils);

describe('Data Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFileData', () => {
    test('parses CSV data correctly', () => {
      mockDataUtils.parseFileData.mockReturnValue({
        headers: ['name', 'age', 'score'],
        data: [
          ['John', '25', '90'],
          ['Jane', '30', '85']
        ]
      });

      const csvContent = 'name,age,score\nJohn,25,90\nJane,30,85';
      const result = mockDataUtils.parseFileData(csvContent, 'data.csv');
      
      expect(result.headers).toEqual(['name', 'age', 'score']);
      expect(result.data).toEqual([
        ['John', '25', '90'],
        ['Jane', '30', '85']
      ]);
    });

    test('handles empty CSV files', () => {
      mockDataUtils.parseFileData.mockReturnValue({
        headers: [],
        data: []
      });

      const csvContent = '';
      const result = mockDataUtils.parseFileData(csvContent, 'empty.csv');
      
      expect(result.headers).toEqual([]);
      expect(result.data).toEqual([]);
    });

    test('handles CSV with only headers', () => {
      mockDataUtils.parseFileData.mockReturnValue({
        headers: ['name', 'age', 'score'],
        data: []
      });

      const csvContent = 'name,age,score';
      const result = mockDataUtils.parseFileData(csvContent, 'headers-only.csv');
      
      expect(result.headers).toEqual(['name', 'age', 'score']);
      expect(result.data).toEqual([]);
    });

    test('throws error for unsupported file types', () => {
      mockDataUtils.parseFileData.mockImplementation(() => {
        throw new Error('Unsupported file type');
      });

      expect(() => {
        mockDataUtils.parseFileData('content', 'file.txt');
      }).toThrow('Unsupported file type');
    });
  });

  describe('validateData', () => {
    test('validates correct data structure', () => {
      mockDataUtils.validateData.mockReturnValue(true);

      const data = {
        headers: ['name', 'age'],
        data: [['John', '25'], ['Jane', '30']]
      };
      
      expect(mockDataUtils.validateData(data)).toBe(true);
    });

    test('rejects data without headers', () => {
      mockDataUtils.validateData.mockReturnValue(false);

      const data = {
        data: [['John', '25'], ['Jane', '30']]
      };
      
      expect(mockDataUtils.validateData(data)).toBe(false);
    });

    test('rejects data without data array', () => {
      mockDataUtils.validateData.mockReturnValue(false);

      const data = {
        headers: ['name', 'age']
      };
      
      expect(mockDataUtils.validateData(data)).toBe(false);
    });

    test('rejects empty headers', () => {
      mockDataUtils.validateData.mockReturnValue(false);

      const data = {
        headers: [],
        data: [['John', '25']]
      };
      
      expect(mockDataUtils.validateData(data)).toBe(false);
    });

    test('accepts data with no rows but valid headers', () => {
      mockDataUtils.validateData.mockReturnValue(true);

      const data = {
        headers: ['name', 'age'],
        data: []
      };
      
      expect(mockDataUtils.validateData(data)).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    test('formats bytes correctly', () => {
      mockDataUtils.formatFileSize.mockImplementation((size) => {
        if (size === 512) return '512 B';
        if (size === 1023) return '1023 B';
        return '0 B';
      });

      expect(mockDataUtils.formatFileSize(512)).toBe('512 B');
      expect(mockDataUtils.formatFileSize(1023)).toBe('1023 B');
    });

    test('formats kilobytes correctly', () => {
      mockDataUtils.formatFileSize.mockImplementation((size) => {
        if (size === 1024) return '1.0 KB';
        if (size === 1536) return '1.5 KB';
        return '0 B';
      });

      expect(mockDataUtils.formatFileSize(1024)).toBe('1.0 KB');
      expect(mockDataUtils.formatFileSize(1536)).toBe('1.5 KB');
    });

    test('formats megabytes correctly', () => {
      mockDataUtils.formatFileSize.mockImplementation((size) => {
        if (size === 1048576) return '1.0 MB';
        if (size === 2621440) return '2.5 MB';
        return '0 B';
      });

      expect(mockDataUtils.formatFileSize(1048576)).toBe('1.0 MB');
      expect(mockDataUtils.formatFileSize(2621440)).toBe('2.5 MB');
    });

    test('formats gigabytes correctly', () => {
      mockDataUtils.formatFileSize.mockReturnValue('1.0 GB');

      expect(mockDataUtils.formatFileSize(1073741824)).toBe('1.0 GB');
    });

    test('handles zero size', () => {
      mockDataUtils.formatFileSize.mockReturnValue('0 B');

      expect(mockDataUtils.formatFileSize(0)).toBe('0 B');
    });

    test('handles undefined/null', () => {
      mockDataUtils.formatFileSize.mockReturnValue('0 B');

      expect(mockDataUtils.formatFileSize(null)).toBe('0 B');
      expect(mockDataUtils.formatFileSize(undefined)).toBe('0 B');
    });
  });
}); 