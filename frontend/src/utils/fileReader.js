import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Simple file reader utility - only handles file I/O and raw data extraction
 * All data processing and validation is handled by the backend
 */

export const readFile = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase();
  const fileName = file.name;

  return new Promise((resolve, reject) => {
    try {
      if (extension === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
              return;
            }

            const headers = Object.keys(results.data[0] || {});
            const rawData = results.data.map(row => 
              headers.map(header => row[header])
            );

            resolve({
              data: rawData,
              headers,
              fileName,
              rowCount: rawData.length,
              columnCount: headers.length
            });
          },
          error: (error) => reject(new Error(`CSV parsing error: ${error.message}`))
        });

      } else if (extension === 'xlsx' || extension === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (jsonData.length === 0) {
              reject(new Error('Empty Excel file'));
              return;
            }

            const headers = jsonData[0];
            const rawData = jsonData.slice(1);

            resolve({
              data: rawData,
              headers,
              fileName,
              rowCount: rawData.length,
              columnCount: headers.length
            });
          } catch (error) {
            reject(new Error(`Excel parsing error: ${error.message}`));
          }
        };
        reader.onerror = () => reject(new Error('Error reading Excel file'));
        reader.readAsBinaryString(file);

      } else if (extension === 'json') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const jsonData = JSON.parse(e.target.result);
            
            if (!Array.isArray(jsonData) || jsonData.length === 0) {
              throw new Error('JSON must be an array of objects or arrays');
            }

            let headers, rawData;
            
            if (Array.isArray(jsonData[0])) {
              // Array of arrays format
              headers = jsonData[0];
              rawData = jsonData.slice(1);
            } else {
              // Array of objects format
              headers = Object.keys(jsonData[0]);
              rawData = jsonData.map(obj => headers.map(key => obj[key]));
            }

            resolve({
              data: rawData,
              headers,
              fileName,
              rowCount: rawData.length,
              columnCount: headers.length
            });
          } catch (error) {
            reject(new Error(`JSON parsing error: ${error.message}`));
          }
        };
        reader.onerror = () => reject(new Error('Error reading JSON file'));
        reader.readAsText(file);

      } else {
        reject(new Error('Unsupported file format. Supported formats: CSV, Excel (.xlsx, .xls), JSON'));
      }
    } catch (error) {
      reject(new Error(`File processing error: ${error.message}`));
    }
  });
}; 