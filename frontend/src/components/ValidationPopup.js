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
  Insights
} from '@mui/icons-material';

const ValidationPopup = ({ 
  open, 
  onClose, 
  criticalIssues, 
  onViewFullReport 
}) => {
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return <ErrorIcon color="error" />;
      case 'HIGH':
        return <Warning color="warning" />;
      default:
        return <BugReport color="info" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getIssueTypeIcon = (type) => {
    switch (type) {
      case 'range_mismatch':
      case 'bounds_violation':
        return <TrendingDown />;
      case 'new_categories':
      case 'missing_categories':
        return <Category />;
      case 'distribution_mismatch':
        return <Functions />;
      default:
        return <Insights />;
    }
  };

  const criticalCount = criticalIssues.filter(issue => issue.severity === 'CRITICAL').length;
  const highCount = criticalIssues.filter(issue => issue.severity === 'HIGH').length;

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
              ? `${criticalCount} critical and ${highCount} high-priority issues found!`
              : `${highCount} high-priority issues found!`
            }
          </Typography>
          <Typography variant="body2">
            These issues may significantly impact the quality and utility of your synthetic data. 
            Review the details below and consider adjusting your data generation process.
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
                label={`${criticalCount} Critical`}
                color="error"
                variant="outlined"
              />
            )}
            {highCount > 0 && (
              <Chip 
                icon={<Warning />}
                label={`${highCount} High Priority`}
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
          {criticalIssues.slice(0, 5).map((issue, index) => (
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
                    <Typography variant="caption" color="text.secondary">
                      <strong>Impact:</strong> {issue.impact}
                    </Typography>
                  </Paper>
                }
              />
            </ListItem>
          ))}
        </List>

        {criticalIssues.length > 5 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Showing 5 of {criticalIssues.length} issues. 
              View the full validation report for complete details.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
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