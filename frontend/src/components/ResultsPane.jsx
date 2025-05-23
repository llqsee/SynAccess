import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@mui/material';

const ResultsPane = ({ metadata, error }) => {
  if (error) {
    return null;
  }

  if (!metadata) {
    return (
      <Paper
        sx={{
          height: '200px',
          m: 2,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary">
          No results to display. Upload data and compute embeddings to see statistics.
        </Typography>
      </Paper>
    );
  }

  const formatValue = (value) => {
    if (typeof value === 'number') {
      return value.toFixed(4);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  };

  return (
    <Paper sx={{ height: '200px', m: 2, overflow: 'auto' }}>
      <TableContainer>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell component="th">Method</TableCell>
              <TableCell>{metadata.method}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th">Runtime (s)</TableCell>
              <TableCell>{formatValue(metadata.runtime)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell component="th">Input Shape</TableCell>
              <TableCell>{`${metadata.input_shape[0]} samples × ${metadata.input_shape[1]} features`}</TableCell>
            </TableRow>
            {Object.entries(metadata.parameters).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell component="th">{key}</TableCell>
                <TableCell>{formatValue(value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ResultsPane; 