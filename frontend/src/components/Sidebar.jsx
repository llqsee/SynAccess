import React, { useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Typography,
  TextField,
} from '@mui/material';

const drawerWidth = 240;

const Sidebar = ({ onDataUpload, onCompute, loading }) => {
  const [method, setMethod] = useState('umap');
  const [params, setParams] = useState({
    umap: {
      n_neighbors: 15,
      min_dist: 0.1,
    },
    tsne: {
      perplexity: 30,
      early_exaggeration: 12,
    },
  });

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          onDataUpload(data);
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleParamChange = (paramName, value) => {
    setParams(prev => ({
      ...prev,
      [method]: {
        ...prev[method],
        [paramName]: value,
      },
    }));
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          p: 2,
        },
      }}
    >
      <Box sx={{ overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          MAVIS Controls
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            component="label"
            fullWidth
            sx={{ mb: 2 }}
          >
            Upload Data
            <input
              type="file"
              hidden
              accept=".json"
              onChange={handleFileUpload}
            />
          </Button>
        </Box>

        <FormControl fullWidth sx={{ mb: 3 }}>
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

        {method === 'umap' && (
          <Box sx={{ mb: 3 }}>
            <Typography gutterBottom>n_neighbors</Typography>
            <Slider
              value={params.umap.n_neighbors}
              onChange={(_, value) => handleParamChange('n_neighbors', value)}
              min={2}
              max={100}
              valueLabelDisplay="auto"
            />
            <Typography gutterBottom>min_dist</Typography>
            <Slider
              value={params.umap.min_dist}
              onChange={(_, value) => handleParamChange('min_dist', value)}
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Box>
        )}

        {method === 'tsne' && (
          <Box sx={{ mb: 3 }}>
            <Typography gutterBottom>perplexity</Typography>
            <Slider
              value={params.tsne.perplexity}
              onChange={(_, value) => handleParamChange('perplexity', value)}
              min={5}
              max={100}
              valueLabelDisplay="auto"
            />
            <Typography gutterBottom>early_exaggeration</Typography>
            <Slider
              value={params.tsne.early_exaggeration}
              onChange={(_, value) => handleParamChange('early_exaggeration', value)}
              min={1}
              max={20}
              valueLabelDisplay="auto"
            />
          </Box>
        )}

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={() => onCompute(method, params[method])}
          disabled={loading}
        >
          {loading ? 'Computing...' : 'Compute Embedding'}
        </Button>
      </Box>
    </Drawer>
  );
};

export default Sidebar; 