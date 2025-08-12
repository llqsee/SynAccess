import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  IconButton,
  Paper,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItemButton
} from '@mui/material';
import {
  Warning,
  Error as ErrorIcon,
  Close,
  BugReport,
  TrendingDown,
  Category,
  Functions,
  Insights,
  Psychology,
  Assessment,
  Lightbulb,
  CheckCircle,
  ExpandMore,
  Security,
  Speed,
  Analytics,
  Refresh
} from '@mui/icons-material';
import aiAnalysisService from '../services/aiAnalysisService';

const AIValidationAnalysis = ({ 
  open, 
  onClose, 
  validationResults, 
  datasetInfo = null 
}) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);

  useEffect(() => {
    if (open && validationResults) {
      performAnalysis();
    }
  }, [open, validationResults]);

  const performAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check service status first
      const status = await aiAnalysisService.checkServiceStatus();
      setServiceStatus(status);
      
      // Perform analysis
      const aiAnalysis = await aiAnalysisService.analyzeValidationResults(validationResults, datasetInfo);
      setAnalysis(aiAnalysis);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setError('Failed to perform AI analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return 'error';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      case 'LOW': return 'success';
      default: return 'default';
    }
  };

  const getQualityColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    if (score >= 40) return 'info';
    return 'error';
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'distribution': return <Functions />;
      case 'range': return <TrendingDown />;
      case 'correlation': return <Analytics />;
      case 'statistical': return <Assessment />;
      default: return <Insights />;
    }
  };

  if (!validationResults) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      aria-labelledby="ai-validation-analysis-dialog"
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        bgcolor: 'primary.main',
        color: 'primary.contrastText'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology />
          <Typography variant="h6">
            Claude AI Analysis
          </Typography>
          {serviceStatus && (
            <Chip 
              label={serviceStatus.service_available ? 'Available' : 'Unavailable'}
              color={serviceStatus.service_available ? 'success' : 'error'}
              size="small"
            />
          )}
        </Box>
        <IconButton 
          onClick={onClose} 
          sx={{ color: 'inherit' }}
          aria-label="close dialog"
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loading && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              🤖 Claude is analyzing your validation results...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!serviceStatus?.service_available && !loading && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Claude AI service is not available. Please ensure:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 1 }}>
              <li>ANTHROPIC_API_KEY environment variable is set</li>
              <li>Anthropic library is installed</li>
              <li>Backend server is running</li>
            </Typography>
          </Alert>
        )}

        {analysis && (
          <>
            {/* AI Analysis Content */}
            <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Assessment />
                  Claude AI Analysis Report
                </Typography>
                
                {/* Extract the actual analysis data from the response structure */}
                {(() => {
                  const analysisData = analysis.analysis || analysis;
                  
                  if (analysisData.result_summary) {
                    return (
                      <Typography 
                        variant="body1" 
                        paragraph 
                        sx={{ 
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                          textAlign: 'justify',
                          bgcolor: 'grey.50',
                          p: 2,
                          borderRadius: 1
                        }}
                      >
                        {analysisData.result_summary}
                      </Typography>
                    );
                  } else {
                    return (
                      <Typography variant="body1" color="text.secondary">
                        No analysis content available.
                      </Typography>
                    );
                  }
                })()}
              </CardContent>
            </Card>

            {/* Analysis Status */}
            {(() => {
              const analysisData = analysis.analysis || analysis;
              
              if (analysisData.status) {
                return (
                  <Card sx={{ mb: 3, bgcolor: analysisData.status === 'success' ? 'success.50' : 'error.50' }}>
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
                );
              }
              return null;
            })()}

            {/* Timestamp */}
            {(() => {
              const analysisData = analysis.analysis || analysis;
              
              if (analysisData.timestamp) {
                return (
                  <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Analysis Generated
                      </Typography>
                      <Typography variant="body2">
                        {new Date(analysisData.timestamp).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
        >
          Close
        </Button>
        <Button 
          onClick={performAnalysis}
          variant="contained"
          startIcon={<Refresh />}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Refresh Analysis'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIValidationAnalysis; 