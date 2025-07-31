import pdfGenerator from '../pdfGenerator';

// Mock jsPDF and html2canvas
jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    text: jest.fn(),
    addPage: jest.fn(),
    save: jest.fn(),
    splitTextToSize: jest.fn().mockReturnValue(['Test text']),
  }));
});

jest.mock('html2canvas', () => {
  return jest.fn().mockResolvedValue({
    toDataURL: jest.fn().mockReturnValue('data:image/png;base64,test'),
  });
});

describe('PDFGenerator', () => {
  let mockAiAnalysis;
  let mockValidationResults;
  let mockDatasetInfo;

  beforeEach(() => {
    mockAiAnalysis = {
      timestamp: '2024-01-01T00:00:00Z',
      result_summary: `Executive Summary (250 words minimum)
This is a comprehensive analysis of the synthetic data quality assessment. The analysis reveals several key insights about the relationship between real and synthetic datasets.

Key Findings (250 words minimum)
The statistical analysis shows that the synthetic data maintains good fidelity to the original dataset across most variables. Distribution tests indicate strong similarity in shape and range for numerical variables.

Statistical Quality (250 words minimum)
Kolmogorov-Smirnov tests show significant differences in some variables, while others maintain strong statistical similarity. The overall quality score indicates acceptable synthetic data generation.

Practical Usefulness (250 words minimum)
The synthetic data demonstrates good utility for downstream applications while maintaining privacy protection. The balance between utility and privacy appears well-managed.

Critical Issues (if any)
No critical issues were identified in this analysis.

3–5 Actionable Recommendations (200 words minimum)
1. Consider additional privacy measures for sensitive variables
2. Validate synthetic data on downstream tasks
3. Monitor data drift over time
4. Implement regular quality assessments

Risk Level (LOW, MEDIUM, HIGH) with justification (50 words minimum)
MEDIUM - While the synthetic data shows good overall quality, some statistical differences warrant monitoring. The risk level is moderate due to potential utility-privacy trade-offs that require ongoing assessment.`
    };

    mockValidationResults = {
      summary: {
        totalTests: 10,
        passed: 8,
        warnings: 1,
        failures: 1,
        critical: 0
      },
      tests: {
        statistical: {
          testType: 'Statistical Tests',
          summary: { total: 5 }
        }
      },
      timestamp: '2024-01-01T00:00:00Z',
      processingTime: 1500
    };

    mockDatasetInfo = {
      real: {
        rows: 1000,
        columns: 10,
        headers: ['col1', 'col2']
      },
      synthetic: {
        rows: 1000,
        columns: 10,
        headers: ['col1', 'col2']
      }
    };
  });

  test('should generate PDF successfully', async () => {
    const result = await pdfGenerator.generateAndDownloadPDF(
      mockAiAnalysis,
      mockValidationResults,
      mockDatasetInfo
    );

    expect(result).toBe(true);
  });

  test('should handle missing AI analysis gracefully', async () => {
    const result = await pdfGenerator.generateAndDownloadPDF(
      null,
      mockValidationResults,
      mockDatasetInfo
    );

    expect(result).toBe(false);
  });

  test('should create PDF with all sections', async () => {
    const pdf = await pdfGenerator.generateAIReportPDF(
      mockAiAnalysis,
      mockValidationResults,
      mockDatasetInfo
    );

    expect(pdf).toBeDefined();
    expect(typeof pdf.save).toBe('function');
  });
}); 