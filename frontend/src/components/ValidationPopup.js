import React from 'react';
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
  Paper
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
  Lightbulb
} from '@mui/icons-material';

// Map AI agent's issue_type to icons
const getIssueTypeIcon = (type) => {
  switch (type) {
    case 'range_mismatch':
    case 'bounds_violation':
    case 'statistical':
      return <TrendingDown />;
    case 'new_categories':
    case 'missing_categories':
    case 'semantic':
      return <Category />;
    case 'distribution_mismatch':
    case 'practical':
      return <Functions />;
    case 'domain':
      return <Insights />;
    default:
      return <BugReport />;
  }
};

// Map AI agent's severity to icon and color
const getSeverityIcon = (severity) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return <ErrorIcon color="error" />;
    case 'HIGH':
      return <ErrorIcon color="error" />;
    case 'MEDIUM':
      return <Warning color="warning" />;
    default:
      return <BugReport color="info" />;
  }
};

const getSeverityColor = (severity) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'warning';
    default:
      return 'info';
  }
};

// Map AI agent's significant_issues to popup issues
const mapAIAnalysisToIssues = (significantIssues = []) =>
  significantIssues.map((issue) => ({
    column: issue.variable || issue.column || 'Unknown',
    type: issue.issue_type || 'general',
    severity: issue.severity ? issue.severity.toUpperCase() : 'INFO',
    message: issue.statistical_evidence || issue.message || '',
    impact: issue.practical_impact || '',
    recommendation: issue.expert_recommendation || '',
    domainContext: issue.domain_context || '',
  }));

const ValidationPopup = ({ 
  open, 
  onClose, 
  aiAnalysis, // Pass the full AI agent analysis object
  onViewFullReport 
}) => {
  // Extract issues from AI agent's output - simplified for actual AI response format
  const significantIssues = []; // AI provides analysis in text format, not structured issues
  const expertRecommendations = []; // AI provides recommendations in text format
  const issues = []; // No structured issues from simple AI response

  const criticalCount = issues.filter(issue => issue.severity === 'CRITICAL' || issue.severity === 'HIGH').length;
  const highCount = issues.filter(issue => issue.severity === 'MEDIUM').length;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="validation-issues-dialog"
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        bgcolor: criticalCount > 0 ? 'error.light' : 'warning.light',
        color: criticalCount > 0 ? 'error.contrastText' : 'warning.contrastText'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {criticalCount > 0 ? <ErrorIcon /> : <Warning />}
          <Typography variant="h6">
            Data Validation Issues Detected
          </Typography>
        </Box>
        <IconButton 
          onClick={onClose} 
          sx={{ color: 'inherit' }}
          aria-label="close dialog"
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Alert 
          severity={criticalCount > 0 ? "error" : "warning"} 
          sx={{ mb: 3 }}
        >
          <Typography variant="subtitle1" gutterBottom>
            {criticalCount > 0 
              ? `${criticalCount} critical/high and ${highCount} medium-priority issues found!`
              : `${highCount} medium-priority issues found!`
            }
          </Typography>
          <Typography variant="body2">
            These issues may significantly impact the quality and utility of your synthetic data. 
            Review the details below and consider the expert recommendations.
          </Typography>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Issue Summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {criticalCount > 0 && (
              <Chip 
                icon={<ErrorIcon />}
                label={`${criticalCount} Critical/High`}
                color="error"
                variant="outlined"
              />
            )}
            {highCount > 0 && (
              <Chip 
                icon={<Warning />}
                label={`${highCount} Medium Priority`}
                color="warning"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          Issues Requiring Attention
        </Typography>
        
        <List>
          {issues.slice(0, 5).map((issue, index) => (
            <ListItem key={index} sx={{ alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ mt: 0.5 }}>
                {getSeverityIcon(issue.severity)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getIssueTypeIcon(issue.type)}
                    <Typography variant="subtitle2">
                      Column: {issue.column}
                    </Typography>
                    <Chip 
                      size="small"
                      label={issue.severity}
                      color={getSeverityColor(issue.severity)}
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Issue:</strong> {issue.message}
                    </Typography>
                    {issue.impact && (
                      <Typography variant="caption" color="text.secondary">
                        <strong>Impact:</strong> {issue.impact}
                      </Typography>
                    )}
                    {issue.recommendation && (
                      <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
                        <Lightbulb fontSize="small" sx={{ mr: 0.5 }} />
                        <strong>Expert Recommendation:</strong> {issue.recommendation}
                      </Typography>
                    )}
                    {issue.domainContext && (
                      <Typography variant="caption" color="secondary" sx={{ display: 'block', mt: 1 }}>
                        <strong>Domain Context:</strong> {issue.domainContext}
                      </Typography>
                    )}
                  </Paper>
                }
              />
            </ListItem>
          ))}
        </List>

        {issues.length > 5 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Showing 5 of {issues.length} issues. 
              View the full validation report for complete details.
            </Typography>
          </Alert>
        )}

        {expertRecommendations.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Expert Recommendations
            </Typography>
            <List>
              {expertRecommendations.slice(0, 3).map((rec, idx) => (
                <ListItem key={idx} alignItems="flex-start">
                  <ListItemIcon>
                    <Lightbulb color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2">
                        {rec.action}
                        {rec.priority && (
                          <Chip size="small" label={rec.priority} color={getSeverityColor(rec.priority)} sx={{ ml: 1 }} />
                        )}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {rec.reasoning}
                        </Typography>
                        {rec.variables && (
                          <Typography variant="caption" color="secondary">
                            <strong>Variables:</strong> {rec.variables.join(', ')}
                          </Typography>
                        )}
                        {rec.implementation_steps && (
                          <Typography variant="caption" color="secondary" sx={{ display: 'block' }}>
                            <strong>Steps:</strong> {rec.implementation_steps.join(' → ')}
                          </Typography>
                        )}
                        {rec.expected_impact && (
                          <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                            <strong>Expected Impact:</strong> {rec.expected_impact}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Button
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(aiAnalysis, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "validation_report.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
          }}
          variant="outlined"
        >
          Download Report (JSON)
        </Button>
        <Button 
          onClick={onClose} 
          variant="outlined"
        >
          Dismiss
        </Button>
        <Button 
          onClick={() => {
            onViewFullReport();
            onClose();
          }}
          variant="contained"
          startIcon={<Insights />}
        >
          View Full Report
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ValidationPopup; 