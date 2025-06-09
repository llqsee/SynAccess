import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Typography,
  CircularProgress
} from '@mui/material';

const Sidebar = ({
  onRealDataUpload,
  onSyntheticDataUpload,
  onVisualize,
  loading,
  realDataLoaded,
  syntheticDataLoaded,
  backendConnected
}) => {
  const [method, setMethod] = useState('umap');
  const [nNeighbors, setNNeighbors] = useState(15);
  const [minDist, setMinDist] = useState(0.1);
  const [perplexity, setPerplexity] = useState(30.0);
  const [earlyExaggeration, setEarlyExaggeration] = useState(12.0);
  const [nRealSamples, setNRealSamples] = useState(1000);
  const [nSynthSamples, setNSynthSamples] = useState(1000);

  const handleFileSelection = async (event, isReal) => {
    const file = event.target.files[0];
    if (file) {
      if (isReal) {
        onRealDataUpload(file, null);
      } else {
        onSyntheticDataUpload(file, null);
      }
    }
  };

  const handleVisualize = () => {
    const params = {
      method,
      params: method === 'umap' 
        ? { 
            n_neighbors: nNeighbors, 
            min_dist: minDist,
            n_real_samples: nRealSamples,
            n_synth_samples: nSynthSamples
          }
        : { 
            perplexity: perplexity, 
            early_exaggeration: earlyExaggeration,
            n_real_samples: nRealSamples,
            n_synth_samples: nSynthSamples
          }
    };
    onVisualize(params);
  };

  const isVisualizationDisabled = loading || !realDataLoaded || !syntheticDataLoaded || !backendConnected;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6">Data Upload</Typography>
      
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Real Data {realDataLoaded && '✓'}
        </Typography>
        <Button
          variant="contained"
          component="label"
          fullWidth
          color={realDataLoaded ? "success" : "primary"}
        >
          Upload Real Data
          <input
            type="file"
            hidden
            accept=".csv,.xlsx,.json"
            onChange={(e) => handleFileSelection(e, true)}
          />
        </Button>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Synthetic Data {syntheticDataLoaded && '✓'}
        </Typography>
        <Button
          variant="contained"
          component="label"
          fullWidth
          color={syntheticDataLoaded ? "success" : "primary"}
        >
          Upload Synthetic Data
          <input
            type="file"
            hidden
            accept=".csv,.xlsx,.json"
            onChange={(e) => handleFileSelection(e, false)}
          />
        </Button>
      </Box>

      <Typography variant="h6" sx={{ mt: 2 }}>Parameters</Typography>

      <FormControl fullWidth>
        <InputLabel>Method</InputLabel>
        <Select
          value={method}
          label="Method"
          onChange={(e) => setMethod(e.target.value)}
        >
          <MenuItem value="umap">UMAP</MenuItem>
          <MenuItem value="tsne">t-SNE</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <Typography gutterBottom>Real Data Samples</Typography>
        <Slider
          value={nRealSamples}
          onChange={(e, v) => setNRealSamples(v)}
          min={100}
          max={10000}
          step={100}
          valueLabelDisplay="auto"
          marks={[
            { value: 100, label: '100' },
            { value: 10000, label: '10k' }
          ]}
        />
      </Box>

      <Box>
        <Typography gutterBottom>Synthetic Data Samples</Typography>
        <Slider
          value={nSynthSamples}
          onChange={(e, v) => setNSynthSamples(v)}
          min={100}
          max={10000}
          step={100}
          valueLabelDisplay="auto"
          marks={[
            { value: 100, label: '100' },
            { value: 10000, label: '10k' }
          ]}
        />
      </Box>

      {method === 'umap' ? (
        <>
          <Box>
            <Typography gutterBottom>n_neighbors</Typography>
            <Slider
              value={nNeighbors}
              onChange={(e, v) => setNNeighbors(v)}
              min={2}
              max={100}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Typography gutterBottom>min_dist</Typography>
            <Slider
              value={minDist}
              onChange={(e, v) => setMinDist(v)}
              min={0.0}
              max={0.99}
              step={0.01}
              valueLabelDisplay="auto"
            />
          </Box>
        </>
      ) : (
        <>
          <Box>
            <Typography gutterBottom>Perplexity</Typography>
            <Slider
              value={perplexity}
              onChange={(e, v) => setPerplexity(v)}
              min={5}
              max={50}
              valueLabelDisplay="auto"
            />
          </Box>

          <Box>
            <Typography gutterBottom>Early Exaggeration</Typography>
            <Slider
              value={earlyExaggeration}
              onChange={(e, v) => setEarlyExaggeration(v)}
              min={1}
              max={20}
              valueLabelDisplay="auto"
            />
          </Box>
        </>
      )}

      <Button
        variant="contained"
        onClick={handleVisualize}
        disabled={isVisualizationDisabled}
        sx={{ mt: 2 }}
      >
        {loading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Visualise'
        )}
      </Button>
    </Box>
  );
};

export default Sidebar; 