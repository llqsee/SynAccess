import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Assessment,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Lightbulb,
  TrendingUp,
  ExpandMore,
  Refresh,
  Description,
  PictureAsPdf
} from '@mui/icons-material';
import ResultsPane from './ResultsPane';
import AiReportDialog from './AiReportDialog';
import pdfGenerator from '../services/pdfGenerator';
import logger from '../utils/logger';
// No date utilities needed

const SummaryTab = ({ 
  realData, 
  syntheticData, 
  embeddingData,
  embeddingMetadata,
  validationResults, 
  validating, 
  onRunValidation 
}) => {
  const [showAiReportDialog, setShowAiReportDialog] = useState(false);

  // Manual validation - users must click "Run Validation Analysis" button
  // This prevents automatic validation that could freeze the UI

  const dataUploaded = realData && syntheticData;
  const embeddingGenerated = embeddingData && embeddingMetadata;

  const exportRawValidationResults = () => {
    const dataStr = JSON.stringify(validationResults, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'validation-report.json';
    link.click();
  };



  const exportPDFReport = async () => {
    if (!validationResults?.aiAnalysis) return;
    
    try {
      const datasetInfo = {
        real: {
          rows: realData?.data?.length || 0,
          columns: realData?.headers?.length || 0,
          headers: realData?.headers || []
        },
        synthetic: {
          rows: syntheticData?.data?.length || 0,
          columns: syntheticData?.headers?.length || 0,
          headers: syntheticData?.headers || []
        }
      };

      const success = await pdfGenerator.generateAndDownloadPDF(
        validationResults.aiAnalysis, 
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

  const getValidationStatusChip = () => {
    // Don't show any chip during validation
    if (validating) {
      return null;
    }

    if (validationResults) {
      const summary = validationResults.summary;

      return (
        <Chip
          icon={<Assessment />}
          label={`${summary.totalTests} Tests Completed`}
          color="primary"
          size="small"
          variant="outlined"
        />
      );
    }

    // Show "Not Run" chip when data is uploaded but validation hasn't been run
    if (dataUploaded) {
      return (
        <Chip
          icon={<Warning />}
          label="Validation Not Run"
          color="warning"
          size="small"
          variant="outlined"
        />
      );
    }

    return null;
  };

  const renderValidationInsights = () => {
    if (!validationResults) {
      return (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<Assessment />}
            onClick={() => onRunValidation(realData, syntheticData, { enableAdvancedTests: true })}
            disabled={validating || !dataUploaded}
            fullWidth
            sx={{ mb: 2 }}
          >
            {validating ? 'Running Analysis...' : 'Run Data Validation Analysis'}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {validating ? 'AI analysis will be available once validation completes' : 
             !dataUploaded ? 'Upload real and synthetic data files to enable validation' :
             'Get comprehensive quality assessment and recommendations for your synthetic data.'}
          </Typography>
        </Box>
      );
    }

    const summary = validationResults.summary;

    return (
      <Box sx={{ mt: 2 }}>
        {/* Validation Status Card */}
        <Card sx={{ mb: 2, bgcolor: 'primary.light' }}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                {summary.totalTests} Statistical Tests Completed
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 'medium' }}>
              Raw statistical results available for AI expert analysis
            </Typography>
            
            {/* Export Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => onRunValidation(realData, syntheticData, { enableAdvancedTests: true })}
                  disabled={validating}
                sx={{ 
                  color: 'white',
                  borderColor: 'white',
                  '&:hover': {
                    backgroundColor: 'white',
                    color: 'primary.main'
                  }
                }}
                variant="outlined"
                >
                  Re-run
                </Button>
                <Button
                  size="small"
                startIcon={<Description />}
                onClick={exportRawValidationResults}
                sx={{ 
                  color: 'white',
                  borderColor: 'white',
                  '&:hover': {
                    backgroundColor: 'white',
                    color: 'primary.main'
                  }
                }}
                variant="outlined"
                >
                Export Raw
                </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Test Categories Summary */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment color="primary" />
              <Typography variant="h6" color="primary.main">
                Test Categories
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Expand each category to view detailed test results and statistics.
            </Typography>
            <Box sx={{ mt: 2 }}>
              {Object.entries(validationResults.tests).map(([category, testGroup]) => (
                <Accordion key={category} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                        {testGroup.testType}
                      </Typography>
                      <Chip 
                        label={`${testGroup.summary?.total || 0} tests`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {testGroup.description}
                    </Typography>
                    {testGroup.tests && testGroup.tests.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Test Results:
                        </Typography>
                        <List dense>
                          {testGroup.tests.slice(0, 5).map((test, index) => (
                            <ListItem key={index} sx={{ py: 0.5 }}>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <Assessment fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={test.column || `Test ${index + 1}`}
                      secondary={
                        test.type === 'ks_test' ? `KS Statistic: ${test.statistic?.toFixed(4) || 'N/A'}` :
                        test.type === 'welch_t_test' ? `T-Statistic: ${test.statistic?.toFixed(4) || 'N/A'}` :
                        test.type === 'chi_square_test' ? `Chi-Square: ${test.statistic?.toFixed(4) || 'N/A'}` :
                        test.type === 'range_test' ? `Range Analysis` :
                        test.type === 'outlier_test' ? `Outlier Detection` :
                        test.type === 'completeness_test' ? `Test Type: completeness test` :
                        test.type === 'consistency_test' ? `Test Type: consistency test` :
                        test.type === 'DCRBaselineProtection' ? `Test Type: privacy test` :
                        (test.type === 'NNDR' || test.type === 'NN_Distance' || test.type === 'ExactMatchRate' || test.type === 'SynthEval' || test.type === 'FastPrivacy') ? `Test Type: privacy test` :
                        `Test Type: ${test.type}`
                      }
                    />
                  </ListItem>
                ))}
                          {testGroup.tests.length > 5 && (
                            <ListItem>
                              <ListItemText
                                secondary={`... and ${testGroup.tests.length - 5} more tests`}
                                sx={{ fontStyle: 'italic' }}
                              />
                            </ListItem>
                )}
              </List>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
            </AccordionDetails>
          </Accordion>

        {/* AI Analysis Section */}
        {validationResults.aiAnalysis && (
          <Card sx={{ mb: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Assessment color="primary" />
                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                  ✅ AI Expert Analysis Ready
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Professional AI analysis completed. View detailed insights and recommendations.
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Description />}
                onClick={() => setShowAiReportDialog(true)}
              >
                View AI Report
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Processing Info */}
        <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
                            <strong>Analysis completed:</strong> {validationResults.timestamp || 'N/A'}<br />
            <strong>Processing time:</strong> {validationResults.processingTime}s<br />
            <strong>Tests performed:</strong> Range validation, distribution testing, correlation analysis, outlier detection
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Analysis Summary
        </Typography>
        {getValidationStatusChip()}
      </Box>
      
      {dataUploaded ? (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, minHeight: '70vh' }}>
              <Typography variant="subtitle1" gutterBottom>
                Data Statistics
              </Typography>
              <Box sx={{ height: '100%', overflow: 'auto' }}>
                <ResultsPane
                  realData={realData?.data}
                  syntheticData={syntheticData?.data}
                  embeddingMetadata={embeddingMetadata}
                  compact={false}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, minHeight: '70vh' }}>
              <Typography variant="subtitle1" gutterBottom>
                Quick Insights & Validation
              </Typography>
              <Box sx={{ color: 'text.secondary', lineHeight: 1.6, height: '100%', overflow: 'auto' }}>
                {embeddingGenerated && (
                  <Typography paragraph>
                    ✓ Embedding visualization shows the relationship between real and synthetic data points
                  </Typography>
                )}
                <Typography paragraph>
                  ✓ Distribution analysis compares statistical properties across all variables
                </Typography>
                <Typography paragraph>
                  ✓ Use the tabs above to explore different aspects of your data comparison
                </Typography>
                
                {realData && syntheticData && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                    <Typography variant="body2">
                      <strong>Dataset Info:</strong><br />
                      Real data: {realData.data?.length || 0} rows<br />
                      Synthetic data: {syntheticData.data?.length || 0} rows<br />
                      Variables: {realData.headers?.length || 0}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />
                
                {/* Enhanced validation section */}
                <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Assessment /> Data Quality Assessment
                </Typography>
                
                {validating && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress sx={{ mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      🔄 Running comprehensive validation analysis...
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      AI analysis will be available once validation completes
                    </Typography>
                  </Box>
                )}

                {!validating && !validationResults && dataUploaded && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.200' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Warning color="warning" fontSize="small" />
                      <strong>Validation Not Run</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Click "Run Data Validation Analysis" above to perform comprehensive quality assessment of your synthetic data.
                    </Typography>
                  </Box>
                )}

                {renderValidationInsights()}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box>
            <Assessment sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Analysis Available
            </Typography>
            <Typography color="text.secondary">
              Upload datasets and generate visualizations to see the analysis summary.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* AI Report Dialog */}
      <AiReportDialog
        open={showAiReportDialog}
        onClose={() => setShowAiReportDialog(false)}
        aiAnalysis={validationResults?.aiAnalysis}
        validationResults={validationResults}
      />
    </Box>
  );
};

export default SummaryTab; 