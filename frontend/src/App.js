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
  LinearProgress
} from '@mui/material';
import { 
  CloudUpload, 
  ScatterPlot, 
  BarChart, 
  Assessment,
  CheckCircle,
  AutorenewRounded,
  History as HistoryIcon
} from '@mui/icons-material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import EmbeddingPlot from './components/EmbeddingPlot';
import RightSidebar from './components/rightsidebar';
// import DistributionPlot from './components/DistributionPlot';

// import ResultsPane from './components/ResultsPane';
import History from './components/History';
import SummaryTab from './components/SummaryTab';
import ValidationPopup from './components/ValidationPopup';
import { useDataUpload } from './hooks/useDataUpload';
import { useEmbedding } from './hooks/useEmbedding';
import { useValidation } from './hooks/useValidation';
import { healthCheck } from './services/api';

// Set up the app theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // Nice blue color
    },
    secondary: {
      main: '#7c3aed', // Purple for accents
    },
    success: {
      main: '#059669', // Green for success states
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
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{ height: '100%' }}
    >
      {value === index && children}
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
    originalRealData,
    originalSyntheticData,
    processingStatus,
    progress,
    canCancel,
    setError: setEmbeddingError,
    handleVisualize,
    handleVisualizeWithPretrainedModel,
    handleCancel,
    loadFromHistory,
    // resetState: resetEmbeddingState
  } = useEmbedding();

  const {
    validationResults,
    validating,
    validationError,
    criticalIssues,
    showValidationPopup,
    runValidation,
    dismissValidationPopup,
    // clearValidation,
    // getValidationSummary
  } = useValidation();

  // Manual validation trigger - removed automatic validation
  // Users must now click "Run Validation" button in Summary tab

  const error = uploadError || embeddingError || validationError;
  
  // Selection state lifted to App to coordinate EmbeddingPlot and RightSidebar
  const [selectedEmbeddingPoints, setSelectedEmbeddingPoints] = useState([]);

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
    
    // Handle pretrained models from history
    if (params.method === 'pretrained' && params.pretrainedModelJobId) {
      // Use the new pretrained model from history approach
      handleVisualizeWithPretrainedModel(realData, syntheticData, params, backendStatus === 'connected');
    } else {
      // Use the regular embedding approach
      handleVisualize(realData, syntheticData, params, backendStatus === 'connected');
    }
    
    // Auto-switch to visualization tab after visualization starts
    if (backendStatus === 'connected') {
      setActiveTab(2);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleLoadFromHistory = useCallback((embeddings, metadata, sessionState) => {
    loadFromHistory(embeddings, metadata, sessionState);
    setActiveTab(2); // Switch to visualization tab
  }, [loadFromHistory]);

  // Determine which tabs should be enabled
  const dataUploaded = realData && syntheticData;
  const hasOriginalData = dataUploaded || 
                         (embeddingMetadata?.hasCompressedData) || 
                         (embeddingMetadata?.realData?.data && embeddingMetadata?.syntheticData?.data) ||
                         (originalRealData?.data && originalSyntheticData?.data);
  const dataAvailable = dataUploaded || hasOriginalData;
  const embeddingGenerated = embeddingData && embeddingMetadata;
  
  // Smart tab enabling logic
  const tabsEnabled = {
    upload: true, // Always enabled
    embeddings: dataUploaded, // Enabled when data is uploaded
    summary: dataAvailable, // Enabled when data is uploaded OR loaded from history with compressed data
    history: true, // Always enabled - users can view history anytime
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container
          maxWidth={false}
          disableGutters
          sx={{
            m: 0,
            p: 1,
            width: '100%',
            maxWidth: '100%',
          }}
        >
          {/* Header with Authentication */}
          <Header />
          
          {/* Status Indicators removed to eliminate gap above tabs */}

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Validation Popup */}
          <ValidationPopup
            open={showValidationPopup}
            onClose={dismissValidationPopup}
            criticalIssues={criticalIssues}
            onViewFullReport={() => setActiveTab(1)} // Switch to Summary tab
          />

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

            </Box>
          )}

          {/* Main Content */}
          <Paper sx={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minHeight: 'calc(100vh - 0px)',
            borderRadius: 0,
            boxShadow: 'none'
          }}>
            {/* Navigation Tabs */}
            <Box sx={{ 
              borderBottom: '1px solid', 
              borderColor: 'divider', 
              px: 2,
              py: 0,
              minHeight: 28,
              maxHeight: 40,
              mt: 0 // ensure no extra margin collapses
            }}>
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange}
                aria-label="analysis tabs"
                variant="scrollable"
                allowScrollButtonsMobile
                TabIndicatorProps={{ style: { height: 2 } }}
                sx={{ 
                  minHeight: 28,
                  '& .MuiTab-root': {
                    minHeight: 26,
                    padding: '2px 8px',
                    fontSize: '0.78rem', /* slightly increased font size */
                    minWidth: 60,
                    lineHeight: 1.15,
                    letterSpacing: 0.1,
                  },
                  '& .MuiTab-iconWrapper': {
                    fontSize: '0.9rem',
                    mb: '-2px'
                  }
                }}
              >
                <Tab 
                  icon={<CloudUpload />} 
                  label="Data Upload" 
                  iconPosition="start"
                  disabled={!tabsEnabled.upload}
                />
                <Tab 
                  icon={<Assessment />} 
                  label="Summary" 
                  iconPosition="start"
                  disabled={!tabsEnabled.summary}
                />
                <Tab 
                  icon={<ScatterPlot />} 
                  label="Visualization" 
                  iconPosition="start"
                  disabled={!tabsEnabled.embeddings}
                />
                {/* Distributions tab removed */}

                <Tab 
                  icon={<HistoryIcon />} 
                  label="History" 
                  iconPosition="start"
                  disabled={!tabsEnabled.history}
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{
              flex: 1,
              minHeight: 0,
              height: 'calc(100vh - 48px)',
              width: '100%'
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
                            realData={realData}
                            syntheticData={syntheticData}
                            onCancel={handleCancel}
                            processingStatus={processingStatus}
                            progress={progress}
                            canCancel={canCancel}
                            error={error}
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

              {/* Summary Tab */}
              <TabPanel value={activeTab} index={1}>
                <Box sx={{ p: 2 }}>
                  <SummaryTab
                    realData={realData || (embeddingMetadata?.hasCompressedData ? embeddingMetadata.realData : null) || originalRealData}
                    syntheticData={syntheticData || (embeddingMetadata?.hasCompressedData ? embeddingMetadata.syntheticData : null) || originalSyntheticData}
                    embeddingData={embeddingData}
                    embeddingMetadata={embeddingMetadata}
                    validationResults={validationResults}
                    validating={validating}
                    onRunValidation={runValidation}
                  />
                </Box>
              </TabPanel>

              {/* Embeddings Tab */}
              <TabPanel value={activeTab} index={2}>
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
                    <Grid container spacing={1} sx={{ height: '100%' }}>
                      <Grid item xs={12} md={8} lg={9} sx={{ height: '100%' }}>
                        <Box sx={{ 
                          height: '100%', 
                          border: '1px solid', 
                          borderColor: 'divider', 
                          borderRadius: 1,
                          overflow: 'hidden'
                        }}>
                          <EmbeddingPlot
                            data={embeddingData}
                            metadata={embeddingMetadata}
                            onSelectionChange={setSelectedEmbeddingPoints}
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4} lg={3} sx={{ height: '100%' }}>
                        <Box sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                          <RightSidebar
                            realData={realData?.data || embeddingMetadata?.realData?.data || originalRealData?.data}
                            syntheticData={syntheticData?.data || embeddingMetadata?.syntheticData?.data || originalSyntheticData?.data}
                            realHeaders={realData?.headers || embeddingMetadata?.realData?.headers || originalRealData?.headers}
                            syntheticHeaders={syntheticData?.headers || embeddingMetadata?.syntheticData?.headers || originalSyntheticData?.headers}
                            embeddingData={embeddingData}
                            metadata={embeddingMetadata}
                            selectedPoints={selectedEmbeddingPoints}
                          />
                        </Box>
                      </Grid>
                    </Grid>
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

              {/* Distributions tab content removed */}



              {/* History Tab (index adjusted after removing Distributions) */}
              <TabPanel value={activeTab} index={3}>
                <Box sx={{ p: 2, height: '100%' }}>
                  <History onLoadEmbedding={handleLoadFromHistory} />
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