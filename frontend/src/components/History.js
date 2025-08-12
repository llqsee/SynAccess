import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Snackbar,
  TextField,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  PlayArrow,
  Favorite,
  FavoriteBorder,
  Delete,
  Visibility,
  FilterList,
  History as HistoryIcon,
  Schedule,
  Memory,
  TrendingUp,
  Download
} from '@mui/icons-material';
import { 
  getJobHistory, 
  getJobDetail, 
  loadJobEmbeddings, 
  toggleJobFavorite, 
  deleteJob, 
  downloadModel,
  downloadModelBinary,
  getJobStats
} from '../services/api';
// Removed date utilities - using simple display

const History = ({ onLoadEmbedding }) => {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  const limit = 20;

  const showNotification = useCallback((message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJobHistory({
        page, limit,
        status: statusFilter === 'all' ? null : statusFilter,
        method: methodFilter === 'all' ? null : methodFilter,
        favorites_only: favoritesOnly
      });
      setJobs(response.jobs);
      setTotal(response.total);
    } catch (err) {
      setError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, favoritesOnly, showNotification]);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await getJobStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, [fetchJobs, fetchStats]);

  const handleLoadJob = async (jobId) => {
    try {
      setLoading(true);
      const result = await loadJobEmbeddings(jobId);
      if (onLoadEmbedding) {
        onLoadEmbedding(result.embeddings, result.metadata, result.session_state);
      }
      showNotification('Embedding loaded successfully!', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (jobId) => {
    try {
      await toggleJobFavorite(jobId);
      await fetchJobs();
      showNotification('Favorite status updated!', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      await deleteJob(jobToDelete.job_id);
      await fetchJobs();
      await fetchStats();
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      showNotification('Job deleted successfully!', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDownloadModel = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/jobs/${jobId}/model/download`);
      if (!response.ok) {
        throw new Error('Failed to download model');
      }
      
      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `model_${jobId}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Create download link with the binary blob
      const modelBlob = await response.blob();
      const url = URL.createObjectURL(modelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification('Model downloaded successfully', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleViewDetails = async (job) => {
    try {
      const details = await getJobDetail(job.job_id);
      setSelectedJob(details);
      setDetailDialogOpen(true);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid
      
      // Simple, readable format: "14/07/2025, 16:08:48 UTC"
      const formatted = date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      return `${formatted} UTC`;
    } catch (error) {
      return dateString; // Return original if any error
    }
  };

  const formatRuntime = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${(seconds / 60).toFixed(1)}m`;
  };

  const getStatusColor = (status) => {
    const colors = { completed: 'success', failed: 'error', running: 'warning' };
    return colors[status] || 'default';
  };

  const totalPages = Math.ceil(total / limit);

  // Helper function to generate correct job name based on user-selected samples
  const getDisplayJobName = useCallback((job) => {
    // First priority: Extract sample counts from the parameters (what user selected)
    let realSamples = job.parameters?.n_real_samples;
    let synthSamples = job.parameters?.n_synth_samples;
    
    // Second priority: Use processed samples (for completed jobs)
    if ((realSamples === null || realSamples === undefined) && job.real_processed_samples !== null && job.real_processed_samples !== undefined) {
      realSamples = job.real_processed_samples;
    }
    if ((synthSamples === null || synthSamples === undefined) && job.synthetic_processed_samples !== null && job.synthetic_processed_samples !== undefined) {
      synthSamples = job.synthetic_processed_samples;
    }
    
    // Third priority: Fall back to original data shape 
    if ((realSamples === null || realSamples === undefined) && job.real_data_shape?.[0]) {
      realSamples = job.real_data_shape[0];
    }
    if ((synthSamples === null || synthSamples === undefined) && job.synthetic_data_shape?.[0]) {
      synthSamples = job.synthetic_data_shape[0];
    }
    
    // If we have sample counts from any source, use them to generate the correct name
    if (realSamples !== null && realSamples !== undefined &&
        synthSamples !== null && synthSamples !== undefined) {
      return `${job.method.toUpperCase()} Embedding - ${realSamples}R + ${synthSamples}S samples`;
    }
    
    // Fall back to stored name if no sample information available
    return job.name;
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <HistoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Embedding History
        </Typography>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <HistoryIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                <Typography variant="h5">{stats?.total_jobs || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Total Jobs</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUp sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                <Typography variant="h5">{stats?.completed_jobs || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Completed</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Schedule sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                <Typography variant="h5">{formatRuntime(stats?.avg_runtime_seconds)}</Typography>
                <Typography variant="body2" color="text.secondary">Avg Runtime</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Memory sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                <Typography variant="h5">
                  {stats ? ((stats.umap_jobs > 0 ? 1 : 0) + (stats.tsne_jobs > 0 ? 1 : 0)) : 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">Methods Used</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FilterList sx={{ color: 'text.secondary' }} />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="running">Running</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Method</InputLabel>
            <Select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              label="Method"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="umap">UMAP</MenuItem>
              <MenuItem value="tsne">t-SNE</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
              />
            }
            label="Favorites Only"
          />
        </Box>
      </Paper>

      {/* Jobs Table */}
      <Paper>
        {loading && !jobs.length ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading job history...</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : jobs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No embedding jobs found
            </Typography>
            <Typography color="text.secondary">
              Start by creating some embeddings to see them here.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Runtime</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.job_id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {getDisplayJobName(job)}
                          </Typography>
                          {job.is_favorite && (
                            <Favorite sx={{ fontSize: 16, color: 'error.main' }} />
                          )}
                        </Box>
                        {job.description && (
                          <Typography variant="caption" color="text.secondary">
                            {job.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={job.method.toUpperCase()} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={job.status}
                          size="small"
                          color={getStatusColor(job.status)}
                        />
                      </TableCell>
                      <TableCell>{formatRuntime(job.runtime_seconds)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(job.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {job.status === 'completed' && (
                            <Tooltip title="Load Embedding">
                              <IconButton
                                size="small"
                                onClick={() => handleLoadJob(job.job_id)}
                                color="primary"
                              >
                                <PlayArrow data-testid="load-job-icon" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {job.status === 'completed' && job.has_model && (
                            <Tooltip title="Download Model">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadModel(job.job_id)}
                                color="secondary"
                              >
                                <Download data-testid="download-model-icon" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(job)}
                            >
                              <Visibility data-testid="view-details-icon" />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title={job.is_favorite ? "Remove from Favorites" : "Add to Favorites"}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleFavorite(job.job_id)}
                              color={job.is_favorite ? "error" : "default"}
                            >
                              {job.is_favorite ? <Favorite data-testid="favorite-icon" /> : <FavoriteBorder data-testid="favorite-border-icon" />}
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Delete Job">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setJobToDelete(job);
                                setDeleteDialogOpen(true);
                              }}
                              color="error"
                            >
                              <Delete data-testid="delete-job-icon" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(e, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* Job Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Job Details</DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Name"
                    value={selectedJob.name}
                    fullWidth
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Method"
                    value={selectedJob.method.toUpperCase()}
                    fullWidth
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Status"
                    value={selectedJob.status}
                    fullWidth
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Runtime"
                    value={formatRuntime(selectedJob.runtime_seconds)}
                    fullWidth
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Created At"
                    value={formatDate(selectedJob.created_at)}
                    fullWidth
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Processed Real Samples"
                    value={selectedJob.actual_processed_samples?.real_samples || 'N/A'}
                    fullWidth
                    disabled
                    size="small"
                    helperText="Samples actually used for visualization"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Processed Synthetic Samples"
                    value={selectedJob.actual_processed_samples?.synthetic_samples || 'N/A'}
                    fullWidth
                    disabled
                    size="small"
                    helperText="Samples actually used for visualization"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Has Results"
                    value={selectedJob.has_results ? 'Yes' : 'No'}
                    fullWidth
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Has Model"
                    value={selectedJob.has_model ? 'Yes' : 'No'}
                    fullWidth
                    disabled
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Parameters
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {JSON.stringify(selectedJob.parameters, null, 2)}
                    </pre>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      These are the parameters used to create the embedding model.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          {selectedJob?.status === 'completed' && (
            <Button
              onClick={() => {
                handleLoadJob(selectedJob.job_id);
                setDetailDialogOpen(false);
              }}
              color="primary"
              variant="contained"
              startIcon={<PlayArrow />}
            >
              Load Embedding
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the job "{jobToDelete?.name || jobToDelete?.job_id}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteJob} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default History; 
