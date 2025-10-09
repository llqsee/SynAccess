import React, { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Chip
} from '@mui/material';

/**
 * CorrelationPlot component
 *
 * Props:
 * - realData: number[][] | (string|number)[][]
 * - syntheticData: number[][] | (string|number)[][]
 * - realHeaders: string[]
 * - syntheticHeaders: string[]
 * - defaultDataset: 'combined' | 'real' | 'synthetic' (optional, default 'combined')
 * - maxColumns: number (optional, default 20)
 * - sampleSize: number (optional, default 2000)
 */
const CorrelationPlot = ({
  realData,
  syntheticData,
  realHeaders,
  syntheticHeaders,
  defaultDataset = 'combined',
  maxColumns = 20,
  sampleSize = 2000
}) => {
  const [dataset, setDataset] = useState(defaultDataset);

  const hasData = (arr) => Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0]);

  // Compute common headers for combined view; otherwise use the dataset's headers
  const commonHeaders = useMemo(() => {
    if (!Array.isArray(realHeaders) || !Array.isArray(syntheticHeaders)) return [];
    const set = new Set(syntheticHeaders);
    return realHeaders.filter(h => set.has(h));
  }, [realHeaders, syntheticHeaders]);

  // Build rows according to dataset selection, capped by sampleSize
  const { rows, headers } = useMemo(() => {
    if (dataset === 'real') {
      return {
        rows: hasData(realData) ? realData.slice(0, sampleSize) : [],
        headers: Array.isArray(realHeaders) ? realHeaders : []
      };
    }
    if (dataset === 'synthetic') {
      return {
        rows: hasData(syntheticData) ? syntheticData.slice(0, sampleSize) : [],
        headers: Array.isArray(syntheticHeaders) ? syntheticHeaders : []
      };
    }

    // combined
    const combined = [];
    if (hasData(realData)) combined.push(...realData);
    if (hasData(syntheticData)) combined.push(...syntheticData);
    // Use headers intersection to avoid mismatches
    const headersToUse = commonHeaders.length > 0 ? commonHeaders : (realHeaders || syntheticHeaders || []);
    return {
      rows: combined.slice(0, sampleSize),
      headers: headersToUse
    };
  }, [dataset, realData, syntheticData, realHeaders, syntheticHeaders, commonHeaders, sampleSize]);

  // Utility: determine numeric columns and convert values to numbers; returns { cols: string[], matrix: number[][] }
  const numericMatrix = useMemo(() => {
    if (!rows || rows.length === 0 || !Array.isArray(headers) || headers.length === 0) {
      return { cols: [], matrix: [] };
    }

    // Determine numeric columns: at least 80% of sampled values are numeric
    const maxCheck = Math.min(rows.length, 200);
    const isColNumeric = headers.map((_, colIdx) => {
      let numericCount = 0, checked = 0;
      for (let r = 0; r < maxCheck; r++) {
        const v = rows[r]?.[colIdx];
        if (v === null || v === undefined || v === '') continue;
        const num = typeof v === 'number' ? v : parseFloat(v);
        if (!Number.isNaN(num) && Number.isFinite(num)) numericCount++;
        checked++;
      }
      if (checked === 0) return false;
      return (numericCount / checked) >= 0.8;
    });

    const numericIndices = headers
      .map((h, i) => ({ h, i }))
      .filter((_, idx) => isColNumeric[idx])
      .map(obj => obj.i);

    // Early exit if none
    if (numericIndices.length === 0) return { cols: [], matrix: [] };

    // Limit number of columns for performance
    const limitedIndices = numericIndices.slice(0, Math.max(1, maxColumns));
    const cols = limitedIndices.map(i => headers[i]);

    // Build matrix: rows x cols numeric values; drop rows with NaN across all selected columns
    const matrix = rows
      .map(row => limitedIndices.map(i => {
        const v = row?.[i];
        const num = typeof v === 'number' ? v : parseFloat(v);
        return Number.isFinite(num) ? num : NaN;
      }))
      .filter(r => r.some(val => !Number.isNaN(val)));

    // Optionally impute NaNs per column with column mean to keep row length consistent
    const colMeans = cols.map((_, c) => {
      let sum = 0, count = 0;
      for (let r = 0; r < matrix.length; r++) {
        const v = matrix[r][c];
        if (!Number.isNaN(v)) { sum += v; count++; }
      }
      return count > 0 ? (sum / count) : 0;
    });
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (Number.isNaN(matrix[r][c])) matrix[r][c] = colMeans[c];
      }
    }

    return { cols, matrix };
  }, [rows, headers, maxColumns]);

  // Compute correlation matrix (Pearson)
  const { z, labels } = useMemo(() => {
    const { cols, matrix } = numericMatrix;
    if (!cols || cols.length === 0 || !matrix || matrix.length === 0) {
      return { z: [], labels: [] };
    }
    const nCols = cols.length;
    const nRows = matrix.length;

    // Means and stds
    const means = new Array(nCols).fill(0);
    const stds = new Array(nCols).fill(0);
    for (let c = 0; c < nCols; c++) {
      let sum = 0;
      for (let r = 0; r < nRows; r++) sum += matrix[r][c];
      means[c] = sum / nRows;
    }
    for (let c = 0; c < nCols; c++) {
      let sq = 0;
      for (let r = 0; r < nRows; r++) {
        const d = matrix[r][c] - means[c];
        sq += d * d;
      }
      stds[c] = Math.sqrt(sq / Math.max(1, nRows - 1));
    }

    const corr = Array.from({ length: nCols }, () => new Array(nCols).fill(0));
    for (let i = 0; i < nCols; i++) {
      corr[i][i] = 1;
      for (let j = i + 1; j < nCols; j++) {
        let cov = 0;
        for (let r = 0; r < nRows; r++) {
          cov += (matrix[r][i] - means[i]) * (matrix[r][j] - means[j]);
        }
        const denom = Math.max(1e-12, (nRows - 1) * stds[i] * stds[j]);
        const val = denom > 0 ? (cov / denom) : 0;
        corr[i][j] = val;
        corr[j][i] = val;
      }
    }

    return { z: corr, labels: cols };
  }, [numericMatrix]);

  const datasetLabel = dataset === 'combined' ? 'Combined' : (dataset === 'real' ? 'Real' : 'Synthetic');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 500 }}>
          Correlation Matrix
        </Typography>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Dataset</InputLabel>
          <Select value={dataset} label="Dataset" onChange={(e) => setDataset(e.target.value)}>
            <MenuItem value="combined">Combined (Real + Synthetic)</MenuItem>
            <MenuItem value="real">Real Only</MenuItem>
            <MenuItem value="synthetic">Synthetic Only</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title={`Using up to ${maxColumns} numeric columns • sampling up to ${sampleSize} rows`}> 
          <Chip label={`${datasetLabel}`} size="small" variant="outlined" />
        </Tooltip>
      </Box>

      {!hasData(rows) || labels.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {(!hasData(rows)) ? 'No data available for correlation.' : 'No numeric columns detected to compute correlation.'}
          </Typography>
        </Box>
      ) : (
        <Plot
          data={[{
            type: 'heatmap',
            z: z,
            x: labels,
            y: labels,
            colorscale: 'RdBu',
            reversescale: true,
            zmin: -1,
            zmax: 1,
            hovertemplate: '<b>%{y}</b> vs <b>%{x}</b><br>r=%{z:.3f}<extra></extra>'
          }]}
          layout={{
            margin: { t: 24, b: 60, l: 80, r: 20 },
            autosize: true,
            xaxis: { tickangle: -45, automargin: true },
            yaxis: { automargin: true },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            dragmode: false,
            title: { text: `${datasetLabel} Correlations`, font: { size: 12 } }
          }}
          config={{ responsive: true, displayModeBar: false, displaylogo: false }}
          style={{ width: '100%', height: '420px' }}
          useResizeHandler
        />
      )}
    </Box>
  );
};

export default CorrelationPlot;
