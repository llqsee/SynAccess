import pdfGenerator from '../pdfGenerator';

// Simple mock for jsPDF
jest.mock('jspdf', () => ({
  __esModule: true,
  jsPDF: jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn().mockReturnThis(),
    setFont: jest.fn().mockReturnThis(),
    setTextColor: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    splitTextToSize: jest.fn().mockReturnValue(['test']),
    save: jest.fn().mockReturnThis()
  }))
}));

// Mock file-saver
jest.mock('file-saver', () => ({
  saveAs: jest.fn()
}));

describe('PDFGenerator', () => {
  const mockAiAnalysis = {
    analysis: { result_summary: 'Test AI analysis', timestamp: '2024-01-01T00:00:00' }
  };

  const mockValidationResults = { summary: { totalTests: 10, passed: 8, warnings: 1, failures: 1 } };
  const mockDatasetInfo = { real: { rows: 1000, columns: 5 }, synthetic: { rows: 1000, columns: 5 } };

  test('exports pdfGenerator instance', () => {
    expect(pdfGenerator).toBeDefined();
    expect(typeof pdfGenerator.generateAndDownloadPDF).toBe('function');
  });

  test('handles PDF generation errors gracefully', async () => {
    // Mock jsPDF to throw an error
    const { jsPDF } = require('jspdf');
    jsPDF.mockImplementationOnce(() => {
      throw new Error('PDF generation failed');
    });

    const result = await pdfGenerator.generateAndDownloadPDF(mockAiAnalysis, mockValidationResults, mockDatasetInfo);
    expect(result).toBe(false);
  });
});