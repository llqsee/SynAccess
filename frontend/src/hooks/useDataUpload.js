import { useState } from 'react';
import { readFile } from '../utils/fileReader';

export const useDataUpload = () => {
  const [realData, setRealData] = useState(null);
  const [syntheticData, setSyntheticData] = useState(null);
  const [error, setError] = useState(null);

  const handleDataUpload = async (file, indexColumn, isReal = true) => {
    try {
      setError(null);
      const result = await readFile(file);
      
      const dataPackage = {
        data: result.data,
        headers: result.headers,
        metadata: {
          fileName: result.fileName,
          rowCount: result.rowCount,
          columnCount: result.columnCount,
          headers: result.headers
        }
      };

      if (isReal) {
        setRealData(dataPackage);
      } else {
        setSyntheticData(dataPackage);
      }

      return dataPackage;
    } catch (err) {
      const errorMessage = `Error processing ${isReal ? 'real' : 'synthetic'} data: ${err.message}`;
      setError(errorMessage);
      
      if (isReal) {
        setRealData(null);
      } else {
        setSyntheticData(null);
      }
      
      throw new Error(errorMessage);
    }
  };

  const handleRealDataUpload = (file, indexColumn) => 
    handleDataUpload(file, indexColumn, true);

  const handleSyntheticDataUpload = (file, indexColumn) => 
    handleDataUpload(file, indexColumn, false);

  return {
    realData,
    syntheticData,
    error,
    setError,
    handleRealDataUpload,
    handleSyntheticDataUpload
  };
}; 