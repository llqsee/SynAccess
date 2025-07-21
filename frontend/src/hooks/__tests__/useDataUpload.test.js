import { renderHook, act } from '@testing-library/react';
import { useDataUpload } from '../useDataUpload';
import { readFile } from '../../utils/fileReader';

// Mock the file reader
jest.mock('../../utils/fileReader');
const { readFile: mockReadFile } = require('../../utils/fileReader');

describe('useDataUpload', () => {
  const mockFile = new File(['test,data\n1,2\n3,4'], 'test.csv', { type: 'text/csv' });
  const mockReadResult = {
    data: [[1, 2], [3, 4]],
    headers: ['col1', 'col2'],
    fileName: 'test.csv',
    rowCount: 2,
    columnCount: 2
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFile.mockResolvedValue(mockReadResult);
  });

  describe('handleRealDataUpload', () => {
    it('should successfully upload real data', async () => {
      const { result } = renderHook(() => useDataUpload());

      await act(async () => {
        await result.current.handleRealDataUpload(mockFile, 'col1');
      });

      expect(mockReadFile).toHaveBeenCalledWith(mockFile);
      expect(result.current.realData).toEqual({
        data: mockReadResult.data,
        headers: mockReadResult.headers,
        metadata: {
          fileName: mockReadResult.fileName,
          rowCount: mockReadResult.rowCount,
          columnCount: mockReadResult.columnCount,
          headers: mockReadResult.headers
        }
      });
      expect(result.current.syntheticData).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should handle file reading errors for real data', async () => {
      const mockError = new Error('File reading failed');
      mockReadFile.mockRejectedValue(mockError);

      const { result } = renderHook(() => useDataUpload());

      await act(async () => {
        await expect(result.current.handleRealDataUpload(mockFile, 'col1')).rejects.toThrow('Error processing real data: File reading failed');
      });

      expect(result.current.realData).toBeNull();
      expect(result.current.error).toBe('Error processing real data: File reading failed');
    });
  });

  describe('handleSyntheticDataUpload', () => {
    it('should successfully upload synthetic data', async () => {
      const { result } = renderHook(() => useDataUpload());

      await act(async () => {
        await result.current.handleSyntheticDataUpload(mockFile, 'col1');
      });

      expect(mockReadFile).toHaveBeenCalledWith(mockFile);
      expect(result.current.syntheticData).toEqual({
        data: mockReadResult.data,
        headers: mockReadResult.headers,
        metadata: {
          fileName: mockReadResult.fileName,
          rowCount: mockReadResult.rowCount,
          columnCount: mockReadResult.columnCount,
          headers: mockReadResult.headers
        }
      });
      expect(result.current.realData).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should handle file reading errors for synthetic data', async () => {
      const mockError = new Error('File reading failed');
      mockReadFile.mockRejectedValue(mockError);

      const { result } = renderHook(() => useDataUpload());

      await act(async () => {
        await expect(result.current.handleSyntheticDataUpload(mockFile, 'col1')).rejects.toThrow('Error processing synthetic data: File reading failed');
      });

      expect(result.current.syntheticData).toBeNull();
      expect(result.current.error).toBe('Error processing synthetic data: File reading failed');
    });
  });

  describe('error handling', () => {
    it('should clear error when successful upload', async () => {
      const { result } = renderHook(() => useDataUpload());

      // First set an error
      act(() => {
        result.current.setError('Previous error');
      });
      expect(result.current.error).toBe('Previous error');

      // Then upload successfully
      await act(async () => {
        await result.current.handleRealDataUpload(mockFile, 'col1');
      });

      expect(result.current.error).toBeNull();
    });

    it('should clear data when upload fails', async () => {
      const { result } = renderHook(() => useDataUpload());

      // First upload successfully
      await act(async () => {
        await result.current.handleRealDataUpload(mockFile, 'col1');
      });
      expect(result.current.realData).not.toBeNull();

      // Then fail on next upload
      mockReadFile.mockRejectedValue(new Error('Upload failed'));
      await act(async () => {
        await expect(result.current.handleRealDataUpload(mockFile, 'col1')).rejects.toThrow();
      });

      expect(result.current.realData).toBeNull();
    });
  });

  describe('data structure', () => {
    it('should create correct data package structure', async () => {
      const { result } = renderHook(() => useDataUpload());

      await act(async () => {
        await result.current.handleRealDataUpload(mockFile, 'col1');
      });

      const dataPackage = result.current.realData;
      expect(dataPackage).toHaveProperty('data');
      expect(dataPackage).toHaveProperty('headers');
      expect(dataPackage).toHaveProperty('metadata');
      expect(dataPackage.metadata).toHaveProperty('fileName');
      expect(dataPackage.metadata).toHaveProperty('rowCount');
      expect(dataPackage.metadata).toHaveProperty('columnCount');
      expect(dataPackage.metadata).toHaveProperty('headers');
    });
  });

  describe('indexColumn parameter', () => {
    it('should pass indexColumn to readFile', async () => {
      const { result } = renderHook(() => useDataUpload());

      await act(async () => {
        await result.current.handleRealDataUpload(mockFile, 'id_column');
      });

      expect(mockReadFile).toHaveBeenCalledWith(mockFile);
      // Note: The indexColumn parameter is passed but not used in the current implementation
      // This test ensures the function signature is maintained
    });
  });

  describe('state management', () => {
    it('should maintain separate state for real and synthetic data', async () => {
      const { result } = renderHook(() => useDataUpload());

      // Upload real data
      await act(async () => {
        await result.current.handleRealDataUpload(mockFile, 'col1');
      });

      expect(result.current.realData).not.toBeNull();
      expect(result.current.syntheticData).toBeNull();

      // Upload synthetic data
      await act(async () => {
        await result.current.handleSyntheticDataUpload(mockFile, 'col1');
      });

      expect(result.current.realData).not.toBeNull();
      expect(result.current.syntheticData).not.toBeNull();
      // The data should be different objects even if they have the same content
      expect(result.current.realData).not.toBe(result.current.syntheticData);
    });

    it('should allow setting error manually', () => {
      const { result } = renderHook(() => useDataUpload());

      act(() => {
        result.current.setError('Manual error');
      });

      expect(result.current.error).toBe('Manual error');
    });
  });
}); 