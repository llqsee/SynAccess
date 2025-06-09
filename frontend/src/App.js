import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Grid, Paper, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import Sidebar from './components/Sidebar';
import EmbeddingPlot from './components/EmbeddingPlot';
import ResultsPane from './components/ResultsPane';
import { useDataUpload } from './hooks/useDataUpload';
import { useEmbedding } from './hooks/useEmbedding';
import { healthCheck } from './services/api';

// Create theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [backendStatus, setBackendStatus] = useState('checking');
  
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
    handleVisualize(realData, syntheticData, params, backendStatus === 'connected');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl">
        <Box sx={{ flexGrow: 1, mt: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2 }}>
                <Sidebar
                  onRealDataUpload={handleRealDataUpload}
                  onSyntheticDataUpload={handleSyntheticDataUpload}
                  onVisualize={onVisualize}
                  loading={loading}
                  realDataLoaded={!!realData}
                  syntheticDataLoaded={!!syntheticData}
                  backendConnected={backendStatus === 'connected'}
                />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ 
                p: 2, 
                minHeight: '600px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {error ? (
                  <Box sx={{ color: 'error.main', p: 2, whiteSpace: 'pre-line' }}>{error}</Box>
                ) : embeddingData && embeddingMetadata ? (
                  <Box sx={{ 
                    flex: 1, 
                    minHeight: 0,
                    position: 'relative'
                  }}>
                    <EmbeddingPlot
                      data={embeddingData}
                      metadata={embeddingMetadata}
                      pointSize={1.5}
                      pointOpacity={0.3}
                    />
                  </Box>
                ) : (
                  <Box sx={{ p: 2 }}>
                    {backendStatus === 'checking' ? 'Checking backend connection...' :
                     backendStatus === 'disconnected' ? 'Backend server is not connected' :
                     'Upload data files and configure parameters to visualise embeddings'}
                  </Box>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2 }}>
                <ResultsPane
                  realData={realData?.data}
                  syntheticData={syntheticData?.data}
                  embeddingMetadata={embeddingMetadata}
                />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App; 