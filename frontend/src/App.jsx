import React from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import Sidebar from './components/Sidebar';
import EmbeddingPlot from './components/EmbeddingPlot';
import ResultsPane from './components/ResultsPane';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

function App() {
  const [data, setData] = React.useState(null);
  const [embeddings, setEmbeddings] = React.useState(null);
  const [metadata, setMetadata] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleDataUpload = (newData) => {
    setData(newData);
    setEmbeddings(null);
    setMetadata(null);
    setError(null);
  };

  const handleEmbeddingCompute = async (method, params) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:8000/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: data,
          method: method,
          params: params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setEmbeddings(result.embeddings);
      setMetadata(result.metadata);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar
          onDataUpload={handleDataUpload}
          onCompute={handleEmbeddingCompute}
          loading={loading}
        />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <EmbeddingPlot
            data={embeddings}
            loading={loading}
            error={error}
          />
          <ResultsPane metadata={metadata} error={error} />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App; 