import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import {
  Assessment,
  Close,
  PictureAsPdf
} from '@mui/icons-material';
import pdfGenerator from '../services/pdfGenerator';
import logger from '../utils/logger';

const AiReportDialog = ({ open, onClose, aiAnalysis, validationResults }) => {
  if (!aiAnalysis) return null;

  const exportPDFReport = async () => {
    try {
      const datasetInfo = {
        real: {
          rows: validationResults?.datasetInfo?.real?.rows || 0,
          columns: validationResults?.datasetInfo?.real?.columns || 0,
          headers: validationResults?.datasetInfo?.real?.headers || []
        },
        synthetic: {
          rows: validationResults?.datasetInfo?.synthetic?.rows || 0,
          columns: validationResults?.datasetInfo?.synthetic?.columns || 0,
          headers: validationResults?.datasetInfo?.synthetic?.headers || []
        }
      };

      const success = await pdfGenerator.generateAndDownloadPDF(
        aiAnalysis, 
        validationResults, 
        datasetInfo
      );

      if (success) {
        logger.info('PDF report generated successfully');
      } else {
        console.error('PDF generation failed');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return timestamp;
    }
  };

  // Extract the actual analysis data from the response structure
  const getAnalysisData = () => {
    // Handle different possible response structures
    if (aiAnalysis.analysis) {
      // If the response has an 'analysis' wrapper (old structure)
      return aiAnalysis.analysis;
    } else if (aiAnalysis.timestamp && aiAnalysis.result_summary) {
      // If the response is the analysis directly (new structure)
      return aiAnalysis;
    } else {
      // Fallback
      return aiAnalysis;
    }
  };

  const analysisData = getAnalysisData();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            <Typography variant="h6">AI Expert Analysis Report</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          {/* Analysis Timestamp */}
          <Card sx={{ mb: 2, bgcolor: 'grey.50' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Analysis Generated
              </Typography>
              <Typography variant="body2">
                {formatTimestamp(analysisData.timestamp)}
              </Typography>
            </CardContent>
          </Card>

          {/* AI Analysis Content */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Expert Analysis Report
              </Typography>
              
              {analysisData.result_summary ? (
                <Typography 
                  variant="body1" 
                  paragraph 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    textAlign: 'justify'
                  }}
                >
                  {analysisData.result_summary}
                </Typography>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  No analysis content available.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Dataset Information */}
          {validationResults?.datasetInfo && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Dataset Information
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`Real Data: ${validationResults.datasetInfo.real?.rows || 0} rows, ${validationResults.datasetInfo.real?.columns || 0} columns`}
                    variant="outlined"
                    color="primary"
                  />
                  <Chip 
                    label={`Synthetic Data: ${validationResults.datasetInfo.synthetic?.rows || 0} rows, ${validationResults.datasetInfo.synthetic?.columns || 0} columns`}
                    variant="outlined"
                    color="secondary"
                  />
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Analysis Status */}
          {analysisData.status && (
            <Card sx={{ mb: 2, bgcolor: analysisData.status === 'success' ? 'success.50' : 'error.50' }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Analysis Status
                </Typography>
                <Chip 
                  label={analysisData.status === 'success' ? 'Success' : 'Error'}
                  color={analysisData.status === 'success' ? 'success' : 'error'}
                  size="small"
                />
                {analysisData.error && (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    Error: {analysisData.error}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button 
          onClick={exportPDFReport}
          startIcon={<PictureAsPdf />}
          variant="contained"
          color="primary"
        >
          Download PDF Report
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AiReportDialog; 