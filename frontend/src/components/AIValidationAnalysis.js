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
            {/* Executive Summary */}
            <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Assessment />
                  Executive Summary
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" color={analysis.summary?.overall_status === 'EXCELLENT' ? 'success.main' : 'warning.main'}>
                        {analysis.summary?.overall_status || 'UNKNOWN'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Overall Quality Status
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Box sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="h4" color={getQualityColor(analysis.summary?.quality_score || 0)}>
                        {analysis.summary?.quality_score || 0}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Quality Score
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="error.main">
                        {analysis.summary?.critical_issues || 0}
                      </Typography>
                      <Typography variant="caption">Critical Issues</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="warning.main">
                        {analysis.summary?.warning_issues || 0}
                      </Typography>
                      <Typography variant="caption">Warnings</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="success.main">
                        {analysis.summary?.passed_tests || 0}
                      </Typography>
                      <Typography variant="caption">Passed Tests</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="info.main">
                        {analysis.summary?.pass_rate || '0%'}
                      </Typography>
                      <Typography variant="caption">Pass Rate</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Risk Assessment */}
            {analysis.risk_assessment && (
              <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Security />
                    Risk Assessment
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Chip 
                      label={analysis.risk_assessment.level}
                      color={getRiskColor(analysis.risk_assessment.level)}
                      variant="outlined"
                      size="large"
                    />
                    <Typography variant="body2" color="text.secondary">
                      Risk Score: {analysis.risk_assessment.score}/100
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary">
                    {analysis.risk_assessment.description}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* AI Insights */}
            {analysis.insights && analysis.insights.length > 0 && (
              <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Lightbulb />
                    Claude AI Insights
                  </Typography>
                  
                  <List>
                    {analysis.insights.map((insight, index) => (
                      <ListItem key={index} sx={{ alignItems: 'flex-start' }}>
                        <ListItemIcon sx={{ mt: 0.5 }}>
                          {getInsightIcon(insight.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="subtitle2">
                                {insight.type?.charAt(0).toUpperCase() + insight.type?.slice(1) || 'General'} Analysis
                              </Typography>
                              <Chip 
                                size="small"
                                label={insight.severity}
                                color={insight.severity === 'high' ? 'error' : 'warning'}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {insight.message}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                <strong>Impact:</strong> {insight.impact}
                              </Typography>
                              {insight.columns && insight.columns.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    <strong>Affected Columns:</strong> {insight.columns.join(', ')}
                                  </Typography>
                                </Box>
                              )}
                            </Paper>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Speed />
                    Claude AI Recommendations
                  </Typography>
                  
                  {analysis.recommendations.map((rec, index) => (
                    <Accordion key={index} sx={{ mb: 1 }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                          <Chip 
                            label={rec.priority}
                            color={rec.priority === 'HIGH' ? 'error' : 'warning'}
                            size="small"
                          />
                          <Typography variant="subtitle2">
                            {rec.category}: {rec.action}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          {rec.description}
                        </Typography>
                        {rec.steps && rec.steps.length > 0 && (
                          <>
                            <Typography variant="subtitle2" gutterBottom>
                              Recommended Steps:
                            </Typography>
                            <List dense>
                              {rec.steps.map((step, stepIndex) => (
                                <ListItem key={stepIndex} sx={{ py: 0.5 }}>
                                  <ListItemIcon sx={{ minWidth: 30 }}>
                                    <Typography variant="caption" color="primary">
                                      {stepIndex + 1}.
                                    </Typography>
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary={step}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Action Items */}
            {analysis.action_items && analysis.action_items.length > 0 && (
              <Card sx={{ bgcolor: 'background.paper' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle />
                    Immediate Action Items
                  </Typography>
                  
                  <List>
                    {analysis.action_items.map((item, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Chip 
                            label={item.priority}
                            color={item.priority === 'IMMEDIATE' ? 'error' : 'warning'}
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.action}
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {item.description}
                              </Typography>
                              {item.columns && item.columns.length > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  <strong>Columns:</strong> {item.columns.join(', ')}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            {analysis.metadata && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Analysis by {analysis.metadata.model || 'Claude AI'} • {analysis.metadata.timestamp}
                </Typography>
              </Box>
            )}
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