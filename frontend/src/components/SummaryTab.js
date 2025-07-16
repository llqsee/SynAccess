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
  Download
} from '@mui/icons-material';
import ResultsPane from './ResultsPane';
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
  // Note: Removed automatic validation to prevent freezing issues
  // Users can manually trigger validation using the "Run Validation Analysis" button

  const dataUploaded = realData && syntheticData;
  const embeddingGenerated = embeddingData && embeddingMetadata;

  const getValidationStatusChip = () => {
    if (validating) {
      return (
        <Chip
          icon={<CircularProgress size={16} />}
          label="Validating..."
          color="info"
          size="small"
          variant="outlined"
        />
      );
    }

    if (validationResults) {
      const summary = validationResults.summary;
      const overallScore = Math.round((summary.passed / summary.totalTests) * 100);
      
      let color = 'success';
      let icon = <CheckCircle />;
      let label = `${overallScore}% Quality Score`;
      
      if (overallScore < 70) {
        color = 'error';
        icon = <ErrorIcon />;
      } else if (overallScore < 90) {
        color = 'warning';
        icon = <Warning />;
      }

      return (
        <Chip
          icon={icon}
          label={label}
          color={color}
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
            disabled={validating}
            fullWidth
            sx={{ mb: 2 }}
          >
            Run Data Validation Analysis
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Get comprehensive quality assessment and recommendations for your synthetic data.
          </Typography>
        </Box>
      );
    }

    const summary = validationResults.summary;
    const overallScore = Math.round((summary.passed / summary.totalTests) * 100);
    
    // Get top issues for quick insights
    const criticalIssues = [];
    Object.values(validationResults.tests).forEach(testGroup => {
      if (testGroup.tests) {
        testGroup.tests.forEach(test => {
          if (test.issues) {
            test.issues.forEach(issue => {
              if (issue.severity === 'CRITICAL' || issue.severity === 'HIGH') {
                criticalIssues.push({
                  column: test.column,
                  message: issue.message,
                  severity: issue.severity
                });
              }
            });
          }
        });
      }
    });

    return (
      <Box sx={{ mt: 2 }}>
        {/* Validation Status Card */}
        <Card sx={{ mb: 2, bgcolor: overallScore >= 90 ? 'success.light' : overallScore >= 70 ? 'warning.light' : 'error.light' }}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6" sx={{ color: overallScore >= 90 ? 'success.dark' : overallScore >= 70 ? 'warning.dark' : 'error.dark' }}>
                {overallScore}% Quality Score
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => onRunValidation(realData, syntheticData, { enableAdvancedTests: true })}
                  disabled={validating}
                >
                  Re-run
                </Button>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={() => {
                    const dataStr = JSON.stringify(validationResults, null, 2);
                    const dataBlob = new Blob([dataStr], {type: 'application/json'});
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'validation-report.json';
                    link.click();
                  }}
                >
                  Export
                </Button>
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={3}>
                <Typography variant="h6" color="success.main" sx={{ textAlign: 'center' }}>
                  {summary.passed}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block' }}>
                  Passed
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="h6" color="warning.main" sx={{ textAlign: 'center' }}>
                  {summary.warnings}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block' }}>
                  Warnings
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="h6" color="error.main" sx={{ textAlign: 'center' }}>
                  {summary.failures}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block' }}>
                  Failures
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="h6" color="text.primary" sx={{ textAlign: 'center' }}>
                  {summary.totalTests}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block' }}>
                  Total
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Critical Issues Alert */}
        {criticalIssues.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {criticalIssues.length} Critical Issue(s) Found
            </Typography>
            <Typography variant="body2">
              {criticalIssues.slice(0, 2).map((issue, idx) => (
                <span key={idx}>
                  <strong>{issue.column}:</strong> {issue.message}
                  {idx < Math.min(criticalIssues.length, 2) - 1 && <br />}
                </span>
              ))}
              {criticalIssues.length > 2 && ` ... and ${criticalIssues.length - 2} more`}
            </Typography>
          </Alert>
        )}

        {/* Top Recommendations */}
        {validationResults.recommendations && validationResults.recommendations.length > 0 && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lightbulb color="primary" />
                <Typography variant="subtitle2">
                  Top Recommendations ({validationResults.recommendations.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {validationResults.recommendations.slice(0, 3).map((rec, index) => (
                  <ListItem key={index} sx={{ pl: 0 }}>
                    <ListItemIcon>
                      <Chip 
                        label={rec.priority} 
                        size="small"
                        color={rec.priority === 'CRITICAL' ? 'error' : 'warning'}
                        variant="outlined"
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={rec.column ? `${rec.column}` : 'General'}
                      secondary={rec.recommendation}
                    />
                  </ListItem>
                ))}
                {validationResults.recommendations.length > 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                    ... and {validationResults.recommendations.length - 3} more recommendations available in full report
                  </Typography>
                )}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Processing Info */}
        <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
                            <strong>Analysis completed:</strong> {validationResults.timestamp || 'N/A'}<br />
            <strong>Processing time:</strong> {validationResults.processingTime}ms<br />
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
                      Running comprehensive validation analysis...
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
    </Box>
  );
};

export default SummaryTab; 