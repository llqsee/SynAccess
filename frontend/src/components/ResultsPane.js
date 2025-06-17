import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Chip
} from '@mui/material';

const ResultsPane = ({ realData, syntheticData, embeddingMetadata, compact = false }) => {
  const calculateStats = (data) => {
    if (!data?.length) return null;
    return {
      rows: data.length,
      columns: data[0]?.length || 0
    };
  };

  const formatNumber = (num) => {
    if (typeof num !== 'number') return '-';
    return Math.abs(num) < 0.01 ? num.toExponential(2) : num.toFixed(4);
  };

  const realStats = calculateStats(realData);
  const syntheticStats = calculateStats(syntheticData);

  if (!realStats && !syntheticStats) {
    return (
      <Box>
        <Typography variant={compact ? "caption" : "subtitle1"} gutterBottom>
          No data available for analysis
        </Typography>
      </Box>
    );
  }

  if (compact) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Dataset Info */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1976d2', display: 'block', mb: 0.5 }}>
            Dataset Info
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption">
              Real: {realStats ? `${realStats.rows}×${realStats.columns}` : '-'}
            </Typography>
            <Typography variant="caption">
              Synth: {syntheticStats ? `${syntheticStats.rows}×${syntheticStats.columns}` : '-'}
            </Typography>
          </Box>
        </Box>

        {embeddingMetadata && (
          <>
            <Divider sx={{ my: 0.5 }} />
            {/* Embedding Info */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1976d2', display: 'block', mb: 0.5 }}>
                Embedding
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Chip 
                  label={embeddingMetadata.method.toUpperCase()} 
                  size="small" 
                  color="primary" 
                  sx={{ fontSize: '0.7rem', height: '20px' }}
                />
                <Typography variant="caption">
                  Runtime: {formatNumber(embeddingMetadata.runtime)}s
                </Typography>
                <Typography variant="caption">
                  Samples: {embeddingMetadata.real_samples}R / {embeddingMetadata.synthetic_samples}S
                </Typography>
              </Box>
            </Box>

            {/* Parameters */}
            {Object.keys(embeddingMetadata.params || {}).length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#1976d2', display: 'block', mb: 0.5 }}>
                  Parameters
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {Object.entries(embeddingMetadata.params || {}).map(([key, value]) => (
                    <Typography key={key} variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {key}: {typeof value === 'number' ? formatNumber(value) : value}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>
    );
  }

  // Original full-size layout
  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
        Dataset Statistics
      </Typography>
      
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Metric</strong></TableCell>
              <TableCell><strong>Real Data</strong></TableCell>
              <TableCell><strong>Synthetic Data</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Dimensions</TableCell>
              <TableCell>{realStats ? `${realStats.rows} × ${realStats.columns}` : '-'}</TableCell>
              <TableCell>{syntheticStats ? `${syntheticStats.rows} × ${syntheticStats.columns}` : '-'}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {embeddingMetadata && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
            Embedding Information
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ width: '30%' }}><strong>Method</strong></TableCell>
                  <TableCell>{embeddingMetadata.method.toUpperCase()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Runtime</strong></TableCell>
                  <TableCell>{formatNumber(embeddingMetadata.runtime)} seconds</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Real Data Samples</strong></TableCell>
                  <TableCell>{embeddingMetadata.real_samples || '-'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Synthetic Data Samples</strong></TableCell>
                  <TableCell>{embeddingMetadata.synthetic_samples || '-'}</TableCell>
                </TableRow>
                {embeddingMetadata.preprocessing?.real?.encoding?.encoding_applied && (
                  <TableRow>
                    <TableCell><strong>Categorical Encoding</strong></TableCell>
                    <TableCell>One-hot encoding applied</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell><strong>Parameters</strong></TableCell>
                  <TableCell>
                    {Object.entries(embeddingMetadata.params || {}).map(([key, value]) => (
                      <Box key={key} sx={{ mb: 0.5 }}>
                        <strong>{key}:</strong> {typeof value === 'number' ? formatNumber(value) : value}
                      </Box>
                    ))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default ResultsPane; 