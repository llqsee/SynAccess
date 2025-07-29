import jsPDF from 'jspdf';

class PDFGenerator {
  constructor() {
    this.pdf = null;
    this.currentY = 20;
    this.pageWidth = 210;
    this.margin = 20;
    this.lineHeight = 6; // Standard line height for better text flow
    this.maxContentWidth = this.pageWidth - 2 * this.margin;
  }

  async generateAndDownloadPDF(aiAnalysis, validationResults, datasetInfo) {
    try {
      this.pdf = new jsPDF('p', 'mm', 'a4');
      this.currentY = 20;

      // Title Page
      this.addTitlePage(datasetInfo);
      this.addNewPage();

      // Executive Summary (contains all AI analysis)
      this.addExecutiveSummary(aiAnalysis);
      this.addNewPage();

      // Metadata
      this.addMetadata(aiAnalysis, validationResults);

      // Download the PDF
      this.pdf.save('ai-validation-report.pdf');
      return true;
    } catch (error) {
      console.error('PDF generation error:', error);
      return false;
    }
  }

  addTitlePage(datasetInfo) {
    // Title
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('AI Data Quality Analysis Report', this.pageWidth / 2, 40, { align: 'center' });

    // Subtitle
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('Comprehensive Synthetic Data Validation', this.pageWidth / 2, 55, { align: 'center' });

    // Dataset Information
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Dataset Information:', this.margin, 80);

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.currentY = 90;

    if (datasetInfo) {
      this.addWrappedText(`Real Dataset: ${datasetInfo.real?.rows || 0} rows, ${datasetInfo.real?.columns || 0} columns`, this.margin, this.currentY, this.maxContentWidth);
      this.currentY += 10;
      this.addWrappedText(`Synthetic Dataset: ${datasetInfo.synthetic?.rows || 0} rows, ${datasetInfo.synthetic?.columns || 0} columns`, this.margin, this.currentY, this.maxContentWidth);
      this.currentY += 10;
      this.addWrappedText(`Analysis Date: ${new Date().toLocaleDateString()}`, this.margin, this.currentY, this.maxContentWidth);
    }
  }

  addExecutiveSummary(aiAnalysis) {
    this.addSectionTitle('Executive Summary');

    // Handle both direct AI response and nested structure from backend
    let resultSummary = null;
    
    if (aiAnalysis?.result_summary) {
      // Direct AI response format: { timestamp, result_summary }
      resultSummary = aiAnalysis.result_summary;
    } else if (aiAnalysis?.analysis?.result_summary) {
      // Nested backend response format: { success, analysis: { timestamp, result_summary }, service_available, message }
      resultSummary = aiAnalysis.analysis.result_summary;
    }
    
    if (resultSummary) {
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.addWrappedText(resultSummary, this.margin, this.currentY, this.maxContentWidth);
      this.currentY += 12;
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.addWrappedText('No AI analysis available.', this.margin, this.currentY, this.maxContentWidth);
      this.currentY += 12;
    }
  }

  addTechnicalAnalysis(aiAnalysis) {
    this.addSectionTitle('Technical Analysis');

    // Since the AI agent returns a single text response, we'll skip this section
    // or you could modify the AI agent to return structured data
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.addWrappedText('Technical analysis is included in the Executive Summary above.', this.margin, this.currentY, this.maxContentWidth);
    this.currentY += 12;
  }

  addExpertRecommendations(aiAnalysis) {
    this.addSectionTitle('Expert Recommendations');

    // Since the AI agent returns a single text response, recommendations are included in the main analysis
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.addWrappedText('Expert recommendations are included in the Executive Summary above.', this.margin, this.currentY, this.maxContentWidth);
    this.currentY += 12;
  }

  addRiskAssessment(aiAnalysis) {
    this.addSectionTitle('Risk Assessment');

    // Since the AI agent returns a single text response, risk assessment is included in the main analysis
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.addWrappedText('Risk assessment is included in the Executive Summary above.', this.margin, this.currentY, this.maxContentWidth);
    this.currentY += 12;
  }

  addMetadata(aiAnalysis, validationResults) {
    this.addSectionTitle('Report Metadata');

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');

    // AI Analysis Metadata - Handle both direct and nested formats
    let aiTimestamp = null;
    if (aiAnalysis?.timestamp) {
      // Direct AI response format
      aiTimestamp = aiAnalysis.timestamp;
    } else if (aiAnalysis?.analysis?.timestamp) {
      // Nested backend response format
      aiTimestamp = aiAnalysis.analysis.timestamp;
    }
    
    if (aiTimestamp) {
      this.addWrappedText(`AI Analysis Timestamp: ${aiTimestamp}`, this.margin, this.currentY, this.maxContentWidth);
      this.currentY += 6;
    }

    // Validation Results Metadata
    if (validationResults?.timestamp) {
      this.addWrappedText(`Validation Timestamp: ${validationResults.timestamp}`, this.margin, this.currentY, this.maxContentWidth);
      this.currentY += 6;
    }

    this.addWrappedText(`Report Generated: ${new Date().toISOString()}`, this.margin, this.currentY, this.maxContentWidth);
  }

  addSectionTitle(title) {
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margin, this.currentY);
    this.currentY += 12;
  }

  addNewPage() {
    this.pdf.addPage();
    this.currentY = 20;
  }

  addWrappedText(text, x, y, maxWidth) {
    if (!text) return;
    
    // Use jsPDF's built-in splitTextToSize method for proper text wrapping
    const lines = this.pdf.splitTextToSize(text, maxWidth);
    
    // Check if we need a page break before starting
    if (y > 270) {
      this.addNewPage();
      y = 20;
    }
    
    let currentY = y;
    
    for (let i = 0; i < lines.length; i++) {
      // Check if we need a page break for this line
      if (currentY > 270) {
        this.addNewPage();
        currentY = 20;
      }
      
      this.pdf.text(lines[i], x, currentY);
      currentY += this.lineHeight;
    }
    
    // Update currentY to the position after the last line
    this.currentY = currentY;
  }
}

export default new PDFGenerator(); 