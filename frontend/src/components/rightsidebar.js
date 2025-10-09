import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, Divider, Chip, FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress } from '@mui/material';
import Plot from 'react-plotly.js';
import { generateDistributionPlot } from '../services/api';
import { classifyColumnType, getAvailablePlotTypes, isDiscreteVariable } from '../utils/dataUtils';

// RightSidebar renders selection summary, column/plot controls, and the distribution plot
// Props:
// - realData: array[] | undefined
// - syntheticData: array[] | undefined
// - realHeaders: string[] | undefined
// - syntheticHeaders: string[] | undefined
// - embeddingData: number[][] (2D coords)
// - metadata: { labels: string[] } (embedding labels)
// - selectedPoints: number[]
export default function RightSidebar({
  realData,
  syntheticData,
  realHeaders,
  syntheticHeaders,
  embeddingData,
  metadata,
  selectedPoints,
}) {
  // Local sidebar states
  const [histogramColumn, setHistogramColumn] = useState(0);
  const [histogramPlotType, setHistogramPlotType] = useState('histogram');
  const [plotData, setPlotData] = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState(null);

  const abortControllerRef = useRef(null);
  const plotGenerationTimeoutRef = useRef(null);
  const lastRequestParamsRef = useRef(null);

  // Combine original data
  const originalData = useMemo(() => {
    const headers = realHeaders && realHeaders.length ? realHeaders : (syntheticHeaders || []);
    const data = [];
    const labels = [];
    if (Array.isArray(realData)) {
      for (const row of realData) {
        data.push(row);
        labels.push('Real');
      }
    }
    if (Array.isArray(syntheticData)) {
      for (const row of syntheticData) {
        data.push(row);
        labels.push('Synthetic');
      }
    }
    return { data, headers, labels };
  }, [realData, syntheticData, realHeaders, syntheticHeaders]);

  // Compute selection summary
  const selectionSummary = useMemo(() => {
    if (!Array.isArray(selectedPoints) || !metadata?.labels) {
      return { total: 0, real: 0, synthetic: 0 };
    }
    let real = 0, synthetic = 0;
    for (const idx of selectedPoints) {
      if (metadata.labels[idx] === 'Real') real++;
      else if (metadata.labels[idx] === 'Synthetic') synthetic++;
    }
    return { total: selectedPoints.length, real, synthetic };
  }, [selectedPoints, metadata]);

  // Build histogram input from selection
  const generateHistogramData = useCallback(() => {
    if (!originalData || !originalData.headers || originalData.headers.length === 0) return null;
    if (!Array.isArray(selectedPoints) || selectedPoints.length === 0) {
      return {
        realValues: [],
        syntheticValues: [],
        columnName: originalData.headers[histogramColumn] || `Column ${histogramColumn + 1}`,
        totalSelected: 0,
        realSelected: 0,
        syntheticSelected: 0,
        dataType: 'categorical',
        availablePlotTypes: ['bar'],
        dataTypeFilter: 'mixed'
      };
    }

    // Map selected embedding points back to original rows
    const selectedData = selectedPoints
      .filter(embeddingIndex => embeddingIndex >= 0 && embeddingIndex < (embeddingData?.length || 0))
      .map(embeddingIndex => {
        const pointLabel = metadata?.labels?.[embeddingIndex];
        if (!pointLabel) return null;

        // Direct index mapping first
        if (embeddingIndex >= 0 && embeddingIndex < originalData.data.length && originalData.labels[embeddingIndex] === pointLabel) {
          const originalDataPoint = originalData.data[embeddingIndex];
          if (originalDataPoint && Array.isArray(originalDataPoint) && originalDataPoint.length > histogramColumn) {
            return { value: originalDataPoint[histogramColumn], label: pointLabel, index: embeddingIndex };
          }
        }
        // Fallback: scan by label
        for (let i = 0; i < originalData.data.length; i++) {
          if (originalData.labels[i] === pointLabel && Array.isArray(originalData.data[i]) && originalData.data[i].length > histogramColumn) {
            return { value: originalData.data[i][histogramColumn], label: pointLabel, index: i };
          }
        }
        return null;
      })
      .filter(Boolean);

    const realValues = selectedData.filter(d => d.label === 'Real').map(d => d.value);
    const syntheticValues = selectedData.filter(d => d.label === 'Synthetic').map(d => d.value);

    let dataTypeFilter = 'mixed';
    if (realValues.length > 0 && syntheticValues.length === 0) dataTypeFilter = 'real-only';
    else if (syntheticValues.length > 0 && realValues.length === 0) dataTypeFilter = 'synthetic-only';

    const dataType = classifyColumnType(histogramColumn, originalData);
    const availablePlotTypes = getAvailablePlotTypes(dataType);

    return {
      realValues,
      syntheticValues,
      columnName: originalData.headers[histogramColumn] || `Column ${histogramColumn + 1}`,
      totalSelected: selectedPoints.length,
      realSelected: realValues.length,
      syntheticSelected: syntheticValues.length,
      dataType,
      availablePlotTypes,
      dataTypeFilter
    };
  }, [selectedPoints, histogramColumn, originalData, metadata, embeddingData]);

  // Debounced API call to generate plot
  const generatePlotData = useCallback(async () => {
    const histData = generateHistogramData();
    if (!histData) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build payload rows
    const selectedRealData = [];
    const selectedSyntheticData = [];

    selectedPoints.forEach(embeddingIndex => {
      if (embeddingIndex < 0 || embeddingIndex >= (embeddingData?.length || 0) || !metadata?.labels?.[embeddingIndex]) return;
      const pointLabel = metadata.labels[embeddingIndex];

      if (embeddingIndex >= 0 && embeddingIndex < originalData.data.length && originalData.labels[embeddingIndex] === pointLabel) {
        const originalDataPoint = originalData.data[embeddingIndex];
        if (Array.isArray(originalDataPoint)) {
          if (pointLabel === 'Real') selectedRealData.push(originalDataPoint);
          else if (pointLabel === 'Synthetic') selectedSyntheticData.push(originalDataPoint);
        }
      } else {
        // Fallback scan
        for (let i = 0; i < originalData.data.length; i++) {
          if (originalData.labels[i] === pointLabel && Array.isArray(originalData.data[i])) {
            if (pointLabel === 'Real') selectedRealData.push(originalData.data[i]);
            else if (pointLabel === 'Synthetic') selectedSyntheticData.push(originalData.data[i]);
            break;
          }
        }
      }
    });

    if (selectedRealData.length === 0 && selectedSyntheticData.length === 0) {
      setPlotError('No valid data points found for the selected column');
      setPlotLoading(false);
      return;
    }

    const dataTypeFilter = histData.dataTypeFilter || 'mixed';
    const requestData = {
      real_data: selectedRealData,
      synthetic_data: selectedSyntheticData,
      column: originalData.headers[histogramColumn],
      plot_type: histogramPlotType,
      real_headers: originalData.headers,
      synthetic_headers: originalData.headers,
      data_type_filter: dataTypeFilter,
    };

    const requestKey = JSON.stringify({
      selectedPoints: [...selectedPoints].sort(),
      column: histogramColumn,
      plotType: histogramPlotType,
      dataTypeFilter,
    });

    if (lastRequestParamsRef.current === requestKey) {
      return;
    }
    lastRequestParamsRef.current = requestKey;

    setPlotLoading(true);
    setPlotError(null);

    try {
      const data = await generateDistributionPlot(requestData, abortController.signal);
      if (abortController.signal.aborted) return;
      setPlotData(data);
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) return;
      setPlotError(`Failed to generate plot: ${err.message}`);
    } finally {
      if (!abortController.signal.aborted) {
        setPlotLoading(false);
      }
    }
  }, [selectedPoints, histogramColumn, histogramPlotType, originalData, embeddingData, metadata, generateHistogramData]);

  // Auto-correct plot type when column changes
  useEffect(() => {
    if (!originalData || !originalData.headers || histogramColumn >= originalData.headers.length) return;
    const columnDataType = classifyColumnType(histogramColumn, originalData);
    const numericPlotTypes = ['histogram', 'violin'];
    const categoricalPlotTypes = ['bar'];
    const compatible = (columnDataType === 'numeric' && numericPlotTypes.includes(histogramPlotType)) ||
      (columnDataType === 'categorical' && categoricalPlotTypes.includes(histogramPlotType));
    if (!compatible) {
      setHistogramPlotType(columnDataType === 'numeric' ? 'histogram' : 'bar');
    }
  }, [originalData, histogramColumn, histogramPlotType]);

  // Trigger plot generation when selection/settings change
  useEffect(() => {
    if (!selectedPoints || selectedPoints.length === 0) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setPlotData(null);
      setPlotError(null);
      setPlotLoading(false);
      return;
    }

    if (plotData === null) {
      generatePlotData();
    } else {
      if (plotGenerationTimeoutRef.current) clearTimeout(plotGenerationTimeoutRef.current);
      plotGenerationTimeoutRef.current = setTimeout(() => {
        generatePlotData();
      }, 120);
    }

    return () => {
      if (plotGenerationTimeoutRef.current) clearTimeout(plotGenerationTimeoutRef.current);
    };
  }, [selectedPoints, histogramColumn, histogramPlotType, generatePlotData, plotData]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (plotGenerationTimeoutRef.current) clearTimeout(plotGenerationTimeoutRef.current);
    };
  }, []);

  const renderPlot = () => {
    if (!plotData) return null;
    const dataTypeFilter = plotData.data_type_filter || 'mixed';

    const getPlotTitle = () => {
      const columnName = plotData.column_name || `Column ${histogramColumn + 1}`;
      switch (dataTypeFilter) {
        case 'real-only': return `Real Data Distribution - ${columnName}`;
        case 'synthetic-only': return `Synthetic Data Distribution - ${columnName}`;
        default: return `Data Distribution Comparison - ${columnName}`;
      }
    };

    switch (plotData.plot_type) {
      case 'histogram': {
        const isDiscrete = originalData ? isDiscreteVariable(histogramColumn, originalData) : false;
        if (isDiscrete) {
          // Convert counts to percentages for discrete values
          const realCounts = {};
          const synthCounts = {};
          plotData.real_values.forEach(v => realCounts[v] = (realCounts[v] || 0) + 1);
          plotData.synthetic_values.forEach(v => synthCounts[v] = (synthCounts[v] || 0) + 1);
          const realTotal = plotData.real_values.length || 1;
          const synthTotal = plotData.synthetic_values.length || 1;
          const realX = Object.keys(realCounts);
          const realY = realX.map(x => (realCounts[x] / realTotal) * 100);
          const synthX = Object.keys(synthCounts);
          const synthY = synthX.map(x => (synthCounts[x] / synthTotal) * 100);

          if (dataTypeFilter === 'real-only') {
            return (
              <Box sx={{ height: '300px' }}>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                  {getPlotTitle()}
                </Typography>
                <Plot
                  data={[{ x: realX, y: realY, type: 'bar', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7 }]}
                  layout={{ margin: { l: 40, r: 20, t: 40, b: 40 }, showlegend: false, xaxis: { title: '', type: 'category' }, yaxis: { title: 'Percentage (%)' }, bargap: 0.1 }}
                  style={{ width: '100%', height: '260px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            );
          } else if (dataTypeFilter === 'synthetic-only') {
            return (
              <Box sx={{ height: '300px' }}>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#dc2626' }}>
                  {getPlotTitle()}
                </Typography>
                <Plot
                  data={[{ x: synthX, y: synthY, type: 'bar', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7 }]}
                  layout={{ margin: { l: 40, r: 20, t: 40, b: 40 }, showlegend: false, xaxis: { title: '', type: 'category' }, yaxis: { title: 'Percentage (%)' }, bargap: 0.1 }}
                  style={{ width: '100%', height: '260px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            );
          }

          return (
            <Box sx={{ display: 'flex', gap: 1, height: '300px' }}>
              <Box sx={{ flex: 1, minHeight: '300px', backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#2563eb', mb: 1 }}>
                  Real Data
                </Typography>
                <Plot
                  data={[{ x: realX, y: realY, type: 'bar', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7 }]}
                  layout={{ margin: { l: 40, r: 20, t: 20, b: 40 }, showlegend: false, xaxis: { title: '', type: 'category' }, yaxis: { title: 'Percentage (%)' }, bargap: 0.1 }}
                  style={{ width: '100%', height: '260px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
              <Box sx={{ flex: 1, minHeight: '300px', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#dc2626', mb: 1 }}>
                  Synthetic Data
                </Typography>
                <Plot
                  data={[{ x: synthX, y: synthY, type: 'bar', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7 }]}
                  layout={{ margin: { l: 40, r: 20, t: 20, b: 40 }, showlegend: false, xaxis: { title: '', type: 'category' }, yaxis: { title: 'Percentage (%)' }, bargap: 0.1 }}
                  style={{ width: '100%', height: '260px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            </Box>
          );
        }

        // Continuous histogram (overlay)
        const combinedValues = [...plotData.real_values, ...plotData.synthetic_values];
        if (combinedValues.length === 0) {
          return <Typography>No data available for histogram</Typography>;
        }
        const minValue = Math.min(...combinedValues);
        const maxValue = Math.max(...combinedValues);
        const range = maxValue - minValue;

        if (range === 0) {
          const singleValue = minValue;
          const sharedXBins = { start: singleValue - 0.5, end: singleValue + 0.5, size: 1 };
          if (dataTypeFilter === 'real-only') {
            return (
              <Box>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                  {getPlotTitle()}
                </Typography>
                <Plot
                  data={[{ x: plotData.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7, histnorm: 'count', xbins: sharedXBins }]}
                  layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Count' }, showlegend: false }}
                  style={{ width: '100%', height: '300px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            );
          } else if (dataTypeFilter === 'synthetic-only') {
            return (
              <Box>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#dc2626' }}>
                  {getPlotTitle()}
                </Typography>
                <Plot
                  data={[{ x: plotData.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7, histnorm: 'count', xbins: sharedXBins }]}
                  layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Count' }, showlegend: false }}
                  style={{ width: '100%', height: '300px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            );
          } else {
            return (
              <Plot
                data={[
                  { x: plotData.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.5, histnorm: 'count', xbins: sharedXBins },
                  { x: plotData.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.5, histnorm: 'count', xbins: sharedXBins },
                ]}
                layout={{ margin: { l: 60, r: 20, t: 20, b: 40 }, barmode: 'overlay', xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Count' } }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            );
          }
        }

        const binCount = Math.min(30, Math.ceil(Math.sqrt(combinedValues.length)));
        const binSize = range / binCount;
        const sharedXBins = { start: minValue - binSize * 0.1, end: maxValue + binSize * 0.1, size: binSize };

        if (dataTypeFilter === 'real-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[{ x: plotData.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7, histnorm: 'count', xbins: sharedXBins }]}
                layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Count' }, showlegend: false }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        } else if (dataTypeFilter === 'synthetic-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#dc2626' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[{ x: plotData.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7, histnorm: 'count', xbins: sharedXBins }]}
                layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Count' }, showlegend: false }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        }

        return (
          <Plot
            data={[
              { x: plotData.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.5, histnorm: 'count', xbins: sharedXBins },
              { x: plotData.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.5, histnorm: 'count', xbins: sharedXBins },
            ]}
            layout={{ margin: { l: 60, r: 20, t: 20, b: 40 }, barmode: 'overlay', xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Count' } }}
            style={{ width: '100%', height: '300px' }}
            config={{ displayModeBar: false }}
          />
        );
      }

      case 'violin': {
        if (dataTypeFilter === 'real-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[{ y: plotData.real_values, type: 'violin', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7, box: { visible: true }, meanline: { visible: true } }]}
                layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}`, showticklabels: false }, yaxis: { title: 'Value' }, showlegend: false }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        } else if (dataTypeFilter === 'synthetic-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#dc2626' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[{ y: plotData.synthetic_values, type: 'violin', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7, box: { visible: true }, meanline: { visible: true } }]}
                layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}`, showticklabels: false }, yaxis: { title: 'Value' }, showlegend: false }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        }

        return (
          <Plot
            data={[
              { y: plotData.real_values, type: 'violin', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.5, box: { visible: true }, meanline: { visible: true } },
              { y: plotData.synthetic_values, type: 'violin', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.5, box: { visible: true }, meanline: { visible: true } },
            ]}
            layout={{ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}`, showticklabels: false }, yaxis: { title: 'Value' } }}
            style={{ width: '100%', height: '300px' }}
            config={{ displayModeBar: false }}
          />
        );
      }

      case 'bar': {
        const realTotal = plotData.real_counts.reduce((s, c) => s + c, 0) || 1;
        const synthTotal = plotData.synthetic_counts.reduce((s, c) => s + c, 0) || 1;
        const realPercentages = plotData.real_counts.map(c => (c / realTotal) * 100);
        const synthPercentages = plotData.synthetic_counts.map(c => (c / synthTotal) * 100);

        if (dataTypeFilter === 'real-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[{ x: plotData.categories, y: realPercentages, type: 'bar', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7 }]}
                layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Percentage (%)' }, showlegend: false }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        } else if (dataTypeFilter === 'synthetic-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#dc2626' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[{ x: plotData.categories, y: synthPercentages, type: 'bar', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7 }]}
                layout={{ margin: { l: 60, r: 20, t: 40, b: 40 }, xaxis: { title: plotData.column_name || `Column ${histogramColumn + 1}` }, yaxis: { title: 'Percentage (%)' }, showlegend: false }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        }

        return (
          <Plot
            data={[
              { x: plotData.categories, y: realPercentages, type: 'bar', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7 },
              { x: plotData.categories, y: synthPercentages, type: 'bar', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7 },
            ]}
            layout={{ margin: { l: 40, r: 20, t: 20, b: 40 }, barmode: 'group', xaxis: { title: '' }, yaxis: { title: 'Percentage (%)' }, legend: { x: 0.7, y: 0.9 } }}
            style={{ width: '100%', height: '300px' }}
            config={{ displayModeBar: false }}
          />
        );
      }

      default:
        return <Typography>Unsupported plot type: {plotData.plot_type}</Typography>;
    }
  };

  // Auto-initialize default plot type based on first column
  useEffect(() => {
    if (!originalData || !originalData.headers || originalData.headers.length === 0 || histogramColumn !== 0) return;
    const firstType = classifyColumnType(0, originalData);
    const numericPlotTypes = ['histogram', 'violin'];
    const categoricalPlotTypes = ['bar'];
    const compatible = (firstType === 'numeric' && numericPlotTypes.includes(histogramPlotType)) || (firstType === 'categorical' && categoricalPlotTypes.includes(histogramPlotType));
    if (!compatible) setHistogramPlotType(firstType === 'numeric' ? 'histogram' : 'bar');
  }, [originalData, histogramColumn, histogramPlotType]);

  const histogramData = useMemo(() => generateHistogramData(), [generateHistogramData]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Distributions</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Divider />

        {/* Selection Summary */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Selection Summary
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2">
              Total Selected: <strong>{selectionSummary.total}</strong>
            </Typography>
            <Typography variant="body2">Real: <strong>{selectionSummary.real}</strong></Typography>
            <Typography variant="body2">Synthetic: <strong>{selectionSummary.synthetic}</strong></Typography>
          </Box>
        </Box>

        <Divider />

        {/* Controls */}
        {originalData && originalData.headers && originalData.headers.length > 0 ? (
          <>
            <FormControl fullWidth size="small">
              <InputLabel>Column for Analysis</InputLabel>
              <Select value={histogramColumn} label="Column for Analysis" onChange={(e) => setHistogramColumn(e.target.value)}>
                {originalData.headers.map((header, index) => {
                  const columnDataType = classifyColumnType(index, originalData);
                  return (
                    <MenuItem key={index} value={index}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{header || `Column ${index + 1}`}</Typography>
                        <Chip label={columnDataType} size="small" color={columnDataType === 'numeric' ? 'primary' : 'secondary'} variant="outlined" sx={{ fontSize: '0.7rem', height: '20px' }} />
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            {histogramData && histogramData.availablePlotTypes && (
              <FormControl fullWidth size="small">
                <InputLabel>Plot Type</InputLabel>
                <Select value={histogramPlotType} label="Plot Type" onChange={(e) => setHistogramPlotType(e.target.value)}>
                  {histogramData.availablePlotTypes.map((plotType) => (
                    <MenuItem key={plotType.value} value={plotType.value}>
                      <Typography variant="body2">{plotType.label}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {histogramData && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">Data Type:</Typography>
                <Chip label={histogramData.dataType} size="small" color={histogramData.dataType === 'numeric' ? 'primary' : 'secondary'} variant="outlined" />
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Distribution: {histogramData?.columnName || (originalData?.headers?.[histogramColumn] || `Column ${histogramColumn + 1}`)}
              </Typography>

              {plotLoading && (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', gap: 1 }}>
                  <CircularProgress size={40} />
                  <Typography variant="caption" color="text.secondary">Generating plot...</Typography>
                </Box>
              )}

              {plotError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2" component="div"><strong>Plot Generation Error:</strong></Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{plotError}</Typography>
                </Alert>
              )}

              {!plotLoading && !plotError && plotData && (
                <Box sx={{ width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1 }}>
                  {renderPlot()}
                </Box>
              )}

              {!plotLoading && !plotError && !plotData && selectedPoints.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" color="text.secondary">Select points to view distribution</Typography>
                </Box>
              )}
            </Box>
          </>
        ) : (
          selectedPoints.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100px', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="text.secondary">Distribution analysis not available for this embedding</Typography>
            </Box>
          )
        )}

        {/* Legend */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: '#2563eb', opacity: 0.7 }} />
            <Typography variant="caption">Real</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: '#dc2626', opacity: 0.7 }} />
            <Typography variant="caption">Synthetic</Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
