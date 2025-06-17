import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Container, 
  Grid, 
  Paper, 
  CssBaseline, 
  ThemeProvider, 
  createTheme, 
  Tabs, 
  Tab, 
  Typography,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  LinearProgress,
  IconButton,
  Collapse
} from '@mui/material';
import { 
  CloudUpload, 
  ScatterPlot, 
  BarChart, 
  Assessment,
  CheckCircle,
  Error as ErrorIcon,
  AutorenewRounded,
  Menu
} from '@mui/icons-material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EmbeddingPlot from './components/EmbeddingPlot';
import DistributionPlot from './components/DistributionPlot';
import ResultsPane from './components/ResultsPane';
import { useDataUpload } from './hooks/useDataUpload';
import { useEmbedding } from './hooks/useEmbedding';
import { healthCheck } from './services/api';

// Create theme with better color scheme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // Modern blue
    },
    secondary: {
      main: '#7c3aed', // Purple accent
    },
    success: {
      main: '#059669', // Green
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
  },
  typography: {
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.95rem',
        },
      },
    },
  },
});

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
      style={{ height: '100%' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Main App Content (after authentication)
function AppContent() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [activeTab, setActiveTab] = useState(0);
  const [currentAlgorithm, setCurrentAlgorithm] = useState(null);
  
  const {
    realData,
    syntheticData,
    error: uploadError,
    setError: setUploadError,
    handleRealDataUpload,
    handleSyntheticDataUpload
  } = useDataUpload();

  const {
    embeddingData,
    embeddingMetadata,
    loading,
    error: embeddingError,
    setError: setEmbeddingError,
    handleVisualize
  } = useEmbedding();

  const error = uploadError || embeddingError;
  
  const setError = useCallback((error) => {
    setUploadError(error);
    setEmbeddingError(error);
  }, [setUploadError, setEmbeddingError]);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await healthCheck();
        setBackendStatus('connected');
      } catch (err) {
        setBackendStatus('disconnected');
        setError('Backend server is not responding. Please ensure it is running.');
      }
    };
    checkBackend();
  }, [setError]);

  const onVisualize = (params) => {
    setCurrentAlgorithm(params.method);
    handleVisualize(realData, syntheticData, params, backendStatus === 'connected');
    // Auto-switch to embeddings tab after visualization starts
    if (backendStatus === 'connected') {
      setActiveTab(1);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Determine which tabs should be enabled
  const dataUploaded = realData && syntheticData;
  const embeddingGenerated = embeddingData && embeddingMetadata;
  

  
  // Smart tab enabling logic
  const tabsEnabled = {
    upload: true, // Always enabled
    embeddings: dataUploaded, // Enabled when data is uploaded
    distributions: dataUploaded, // Enabled when data is uploaded
    summary: dataUploaded, // Enabled when data is uploaded
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          {/* Header with Authentication */}
          <Header />
          
          {/* Status Indicators */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {loading && (
              <Chip
                icon={<AutorenewRounded sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
                label="Generating Embeddings"
                color="primary"
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Loading Progress Bar */}
          {loading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress 
                sx={{ 
                  height: 6, 
                  borderRadius: 3,
                  backgroundColor: 'primary.50',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundColor: 'primary.main'
                  }
                }} 
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Processing data and computing embeddings... This may take a few moments.
              </Typography>
            </Box>
          )}

          {/* Main Content */}
          <Paper sx={{ 
            minHeight: '85vh', 
            display: 'flex', 
            flexDirection: 'column'
          }}>
            {/* Navigation Tabs */}
            <Box sx={{ 
              borderBottom: '1px solid', 
              borderColor: 'divider', 
              px: 2,
              py: 0,
              minHeight: 48,
              maxHeight: 48
            }}>
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange}
                aria-label="analysis tabs"
                sx={{ minHeight: 48 }}
              >
                <Tab 
                  icon={<CloudUpload />} 
                  label="Data Upload" 
                  iconPosition="start"
                  disabled={!tabsEnabled.upload}
                />
                <Tab 
                  icon={<ScatterPlot />} 
                  label="Embeddings" 
                  iconPosition="start"
                  disabled={!tabsEnabled.embeddings}
                />
                <Tab 
                  icon={<BarChart />} 
                  label="Distributions" 
                  iconPosition="start"
                  disabled={!tabsEnabled.distributions}
                />
                <Tab 
                  icon={<Assessment />} 
                  label="Summary" 
                  iconPosition="start"
                  disabled={!tabsEnabled.summary}
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{ 
              flex: 1, 
              minHeight: 0,
              height: 'calc(85vh - 48px)'
            }}>
              {/* Data Upload Tab */}
              <TabPanel value={activeTab} index={0}>
                <Box sx={{ p: 3 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 3, bgcolor: 'grey.50', minHeight: '70vh' }}>
                        <Typography variant="h6" gutterBottom>
                          Upload & Configure
                        </Typography>
                        <Box sx={{ height: '100%', overflow: 'auto' }}>
                          <Sidebar
                            onRealDataUpload={handleRealDataUpload}
                            onSyntheticDataUpload={handleSyntheticDataUpload}
                            onVisualize={onVisualize}
                            loading={loading}
                            realDataLoaded={!!realData}
                            syntheticDataLoaded={!!syntheticData}
                            realDataName={realData?.metadata?.fileName}
                            syntheticDataName={syntheticData?.metadata?.fileName}
                            backendConnected={backendStatus === 'connected'}
                            isCollapsed={false}
                            onToggleCollapse={() => {}}
                          />
                        </Box>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 3, minHeight: '70vh' }}>
                        <Typography variant="h6" gutterBottom>
                          Getting Started
                        </Typography>
                        <Box sx={{ color: 'text.secondary', lineHeight: 1.7, height: '100%', overflow: 'auto' }}>
                          <Typography paragraph>
                            <strong>Step 1:</strong> Upload your real dataset (CSV format)
                          </Typography>
                          <Typography paragraph>
                            <strong>Step 2:</strong> Upload your synthetic dataset (CSV format)
                          </Typography>
                          <Typography paragraph>
                            <strong>Step 3:</strong> Configure embedding parameters (UMAP/t-SNE)
                          </Typography>
                          <Typography paragraph>
                            <strong>Step 4:</strong> Click "Generate Visualization" to start analysis
                          </Typography>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="body2">
                            Once data is uploaded, you can explore embeddings, compare distributions, 
                            and view detailed statistics using the tabs above.
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              </TabPanel>

              {/* Embeddings Tab */}
              <TabPanel value={activeTab} index={1}>
                <Box sx={{ 
                  p: 1, 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column'
                }}>
                  {loading ? (
                    <Paper sx={{ 
                      p: 4, 
                      textAlign: 'center', 
                      flex: 1,
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      bgcolor: 'primary.50'
                    }}>
                      <Box>
                        <CircularProgress 
                          size={60} 
                          thickness={4}
                          sx={{ 
                            color: 'primary.main',
                            mb: 3
                          }}
                        />
                        <Typography variant="h6" color="primary.main" gutterBottom>
                          Generating Embeddings
                        </Typography>
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                          Computing dimensional reduction using {currentAlgorithm ? 
                            (currentAlgorithm.toUpperCase() === 'UMAP' ? 'UMAP (Uniform Manifold Approximation and Projection)' :
                             currentAlgorithm.toUpperCase() === 'TSNE' ? 't-SNE (t-Distributed Stochastic Neighbor Embedding)' :
                             `${currentAlgorithm.toUpperCase()} algorithm`) : 
                            'machine learning algorithms'}...
                        </Typography>
                        <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto' }}>
                          <LinearProgress 
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              backgroundColor: 'primary.100',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                backgroundColor: 'primary.main'
                              }
                            }} 
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                          {currentAlgorithm ? 
                            (currentAlgorithm.toUpperCase() === 'UMAP' ? 
                              'UMAP typically takes 30 seconds to 2 minutes depending on dataset size and parameters' :
                             currentAlgorithm.toUpperCase() === 'TSNE' ? 
                              't-SNE typically takes 1-5 minutes depending on dataset size and perplexity settings' :
                              'This process may take 30 seconds to several minutes depending on dataset size') :
                            'This process may take 30 seconds to several minutes depending on dataset size'}
                        </Typography>
                      </Box>
                    </Paper>
                  ) : embeddingGenerated ? (
                    <Box sx={{ 
                      flex: 1, 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}>
                      <EmbeddingPlot
                        data={embeddingData}
                        metadata={embeddingMetadata}
                      />
                    </Box>
                  ) : (
                    <Paper sx={{ 
                      p: 4, 
                      textAlign: 'center', 
                      flex: 1,
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <Box>
                        <ScatterPlot sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No Embeddings Generated
                        </Typography>
                        <Typography color="text.secondary">
                          Go to the Data Upload tab and click "Generate Visualization" to create embeddings.
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                </Box>
              </TabPanel>

              {/* Distributions Tab */}
              <TabPanel value={activeTab} index={2}>
                <Box sx={{ p: 2 }}>
                  {dataUploaded ? (
                    <Box sx={{ minHeight: '80vh' }}>
                      <DistributionPlot
                        realData={realData?.data}
                        syntheticData={syntheticData?.data}
                        realHeaders={realData?.headers}
                        syntheticHeaders={syntheticData?.headers}
                      />
                    </Box>
                  ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box>
                        <BarChart sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No Data Available
                        </Typography>
                        <Typography color="text.secondary">
                          Upload both real and synthetic datasets to compare distributions.
                        </Typography>
                      </Box>
                    </Paper>
                  )}
                </Box>
              </TabPanel>

              {/* Summary Tab */}
              <TabPanel value={activeTab} index={3}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Analysis Summary
                  </Typography>
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
                            Quick Insights
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
              </TabPanel>
            </Box>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

// Main App component with authentication wrapper
function App() {
  const { isAuthenticated, login, loading, error } = useAuth();

  if (!isAuthenticated) {
    return <Login onLogin={login} loading={loading} error={error} />;
  }

  return <AppContent />;
}

// Root component with AuthProvider
function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithAuth; 