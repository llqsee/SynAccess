import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, Chip, FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress, Button, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
  const theme = useTheme();
  // Local sidebar states
  const [histogramColumn, setHistogramColumn] = useState(0);
  const [histogramPlotType, setHistogramPlotType] = useState('histogram');
  const [plotData, setPlotData] = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState(null);
  // Overall (global) distribution state
  const [globalPlotData, setGlobalPlotData] = useState(null);
  const [globalPlotLoading, setGlobalPlotLoading] = useState(false);
  const [globalPlotError, setGlobalPlotError] = useState(null);
  // Reset keys used to force Plot re-mount (reset zoom)
  const [globalResetKey, setGlobalResetKey] = useState(0);
  const [selectedResetKey, setSelectedResetKey] = useState(0);
  const [yScale, setYScale] = useState('count'); // 'count' | 'density'

  const abortControllerRef = useRef(null);
  const plotGenerationTimeoutRef = useRef(null);
  const lastRequestParamsRef = useRef(null);
  const globalAbortControllerRef = useRef(null);

  // Build aligned datasets using intersection of headers to avoid column count mismatches
  const { commonHeaders, alignedRealData, alignedSyntheticData } = useMemo(() => {
    const hasRealHeaders = Array.isArray(realHeaders) && realHeaders.length > 0;
    const hasSynthHeaders = Array.isArray(syntheticHeaders) && syntheticHeaders.length > 0;

    const norm = (h) => (typeof h === 'string' ? h.trim() : h);

    let common = [];
    let realIdx = [];
    let synthIdx = [];

    if (hasRealHeaders && hasSynthHeaders) {
      const realMap = new Map();
      realHeaders.forEach((h, i) => {
        const k = norm(h);
        if (k) realMap.set(k, i);
      });
      const synthMap = new Map();
      syntheticHeaders.forEach((h, i) => {
        const k = norm(h);
        if (k) synthMap.set(k, i);
      });
      // Intersection preserving realHeaders order
      for (const h of realHeaders) {
        const k = norm(h);
        if (!k) continue;
        if (synthMap.has(k)) {
          common.push(k);
        }
      }
      realIdx = common.map((h) => realMap.get(h));
      synthIdx = common.map((h) => synthMap.get(h));
    } else if (hasRealHeaders) {
      common = realHeaders.map(norm).filter(Boolean);
      realIdx = common.map((_, i) => i);
      synthIdx = [];
    } else if (hasSynthHeaders) {
      common = syntheticHeaders.map(norm).filter(Boolean);
      realIdx = [];
      synthIdx = common.map((_, i) => i);
    }

    const alignRows = (rows, idxs) => {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      if (!Array.isArray(idxs) || idxs.length === 0) return [];
      return rows.map((row) => idxs.map((i) => row?.[i]));
    };

    const alignedReal = realIdx.length ? alignRows(realData, realIdx) : [];
    const alignedSynth = synthIdx.length ? alignRows(syntheticData, synthIdx) : [];

    return {
      commonHeaders: common,
      alignedRealData: alignedReal,
      alignedSyntheticData: alignedSynth,
    };
  }, [realHeaders, syntheticHeaders, realData, syntheticData]);

  // Compute how many columns were excluded due to header mismatches (intersection logic)
  const headerMismatchInfo = useMemo(() => {
    const norm = (h) => (typeof h === 'string' ? h.trim() : h);
    const r = Array.isArray(realHeaders) ? realHeaders.map(norm).filter(Boolean) : [];
    const s = Array.isArray(syntheticHeaders) ? syntheticHeaders.map(norm).filter(Boolean) : [];
    if (!r.length && !s.length) {
      return { excludedCount: 0, realOnly: [], synthOnly: [], totalReal: 0, totalSynth: 0, commonCount: 0 };
    }
    const rSet = new Set(r);
    const sSet = new Set(s);
    const realOnly = r.filter((h) => !sSet.has(h));
    const synthOnly = s.filter((h) => !rSet.has(h));
    const commonCount = Array.isArray(commonHeaders) ? commonHeaders.length : 0;
    const excludedCount = realOnly.length + synthOnly.length;
    return { excludedCount, realOnly, synthOnly, totalReal: r.length, totalSynth: s.length, commonCount };
  }, [realHeaders, syntheticHeaders, commonHeaders]);

  // (Removed duplicate classRanks/mapEmbeddingIndexToOriginal/originalData block)

  // Precompute class-wise ranks for each embedding index to map back to original rows
  const classRanks = useMemo(() => {
    const labels = metadata?.labels;
    const total = embeddingData?.length || 0;
    if (!labels || !Array.isArray(labels) || total === 0) return null;

    const realRank = new Array(total).fill(0);
    const synthRank = new Array(total).fill(0);
    let rc = 0;
    let sc = 0;
    for (let i = 0; i < total; i++) {
      if (labels[i] === 'Real') {
        rc += 1;
        realRank[i] = rc;
        synthRank[i] = sc;
      } else if (labels[i] === 'Synthetic') {
        sc += 1;
        synthRank[i] = sc;
        realRank[i] = rc;
      } else {
        // Unknown label, keep previous counts
        realRank[i] = rc;
        synthRank[i] = sc;
      }
    }
    return { realRank, synthRank };
  }, [metadata, embeddingData]);

  // Helper to map an embedding index to original row data and label
  const mapEmbeddingIndexToOriginal = useCallback((embeddingIndex) => {
    if (!metadata?.labels || !classRanks) return null;
    if (embeddingIndex < 0 || embeddingIndex >= (embeddingData?.length || 0)) return null;
    const label = metadata.labels[embeddingIndex];
    if (label === 'Real') {
      const rank = classRanks.realRank[embeddingIndex] - 1; // 0-based
      if (rank >= 0 && Array.isArray(alignedRealData) && rank < alignedRealData.length) {
        return { label, row: alignedRealData[rank], rank };
      }
    } else if (label === 'Synthetic') {
      const rank = classRanks.synthRank[embeddingIndex] - 1; // 0-based
      if (rank >= 0 && Array.isArray(alignedSyntheticData) && rank < alignedSyntheticData.length) {
        return { label, row: alignedSyntheticData[rank], rank };
      }
    }
    return null;
  }, [metadata, classRanks, embeddingData, alignedRealData, alignedSyntheticData]);

  // Combine aligned data for plotting
  const originalData = useMemo(() => {
    const headers = Array.isArray(commonHeaders) ? commonHeaders : [];
    const data = [];
    const labels = [];
    if (Array.isArray(alignedRealData) && alignedRealData.length) {
      for (const row of alignedRealData) {
        data.push(row);
        labels.push('Real');
      }
    }
    if (Array.isArray(alignedSyntheticData) && alignedSyntheticData.length) {
      for (const row of alignedSyntheticData) {
        data.push(row);
        labels.push('Synthetic');
      }
    }
    return { data, headers, labels };
  }, [alignedRealData, alignedSyntheticData, commonHeaders]);

  // Headers available for selection (exclude unnamed headers)
  const displayHeaders = useMemo(() => {
    const headers = originalData?.headers || [];
    return headers
      .map((h, idx) => ({ name: (h || '').trim(), index: idx }))
      .filter(h => !!h.name);
  }, [originalData]);

  // Initialize column and plot type to first available named header
  useEffect(() => {
    if (!originalData || !displayHeaders.length) return;
    const validIndices = new Set(displayHeaders.map(h => h.index));
    if (!validIndices.has(histogramColumn)) {
      const firstIdx = displayHeaders[0].index;
      setHistogramColumn(firstIdx);
      const firstType = classifyColumnType(firstIdx, originalData);
      setHistogramPlotType(firstType === 'numeric' ? 'histogram' : 'bar');
    }
  }, [originalData, displayHeaders, histogramColumn]);

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

  // Dataset totals for summary denominators
  const datasetTotals = useMemo(() => {
    const labels = metadata?.labels;
    if (!Array.isArray(labels) || labels.length === 0) {
      return { total: 0, real: 0, synthetic: 0 };
    }
    let real = 0, synthetic = 0;
    for (const l of labels) {
      if (l === 'Real') real++;
      else if (l === 'Synthetic') synthetic++;
    }
    return { total: labels.length, real, synthetic };
  }, [metadata]);

  // Build histogram input from selection
  const generateHistogramData = useCallback(() => {
    if (!originalData || !originalData.headers || originalData.headers.length === 0) return null;
    if (!Array.isArray(selectedPoints) || selectedPoints.length === 0) {
      return {
        realValues: [],
        syntheticValues: [],
        columnName: originalData.headers[histogramColumn] || '',
        totalSelected: 0,
        realSelected: 0,
        syntheticSelected: 0,
        dataType: 'categorical',
        availablePlotTypes: ['bar'],
        dataTypeFilter: 'mixed'
      };
    }

    // Use class-wise rank mapping to get correct rows per class
    const realValues = [];
    const syntheticValues = [];
    for (const embeddingIndex of selectedPoints) {
      const mapped = mapEmbeddingIndexToOriginal(embeddingIndex);
      if (!mapped || !Array.isArray(mapped.row)) continue;
      const val = mapped.row[histogramColumn];
      if (val === undefined) continue;
      if (mapped.label === 'Real') realValues.push(val);
      else if (mapped.label === 'Synthetic') syntheticValues.push(val);
    }

    let dataTypeFilter = 'mixed';
    if (realValues.length > 0 && syntheticValues.length === 0) dataTypeFilter = 'real-only';
    else if (syntheticValues.length > 0 && realValues.length === 0) dataTypeFilter = 'synthetic-only';

    const dataType = classifyColumnType(histogramColumn, originalData);
    const availablePlotTypes = getAvailablePlotTypes(dataType);

    return {
      realValues,
      syntheticValues,
      columnName: originalData.headers[histogramColumn] || '',
      totalSelected: selectedPoints.length,
      realSelected: realValues.length,
      syntheticSelected: syntheticValues.length,
      dataType,
      availablePlotTypes,
      dataTypeFilter
    };
  }, [selectedPoints, histogramColumn, originalData, mapEmbeddingIndexToOriginal]);

  // Debounced API call to generate plot
  const generatePlotData = useCallback(async () => {
    const histData = generateHistogramData();
    if (!histData) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build payload rows using the class-wise rank mapping
    const selectedRealData = [];
    const selectedSyntheticData = [];
    for (const embeddingIndex of selectedPoints) {
      const mapped = mapEmbeddingIndexToOriginal(embeddingIndex);
      if (!mapped || !Array.isArray(mapped.row)) continue;
      if (mapped.label === 'Real') selectedRealData.push(mapped.row);
      else if (mapped.label === 'Synthetic') selectedSyntheticData.push(mapped.row);
    }

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
  }, [selectedPoints, histogramColumn, histogramPlotType, originalData, generateHistogramData, mapEmbeddingIndexToOriginal]);

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

  // Generic renderer for any plot data
  const renderPlotFor = (dataObj, plotKey) => {
    if (!dataObj) return null;
    const dataTypeFilter = dataObj.data_type_filter || 'mixed';
    const xAxisTitle = originalData?.headers?.[histogramColumn] || '';
    // Determine y-axis label and normalization for histograms based on selected scale
    const getYAxisTitle = () => (yScale === 'density' ? 'Density' : 'Count');
    const getHistnorm = () => (yScale === 'density' ? 'probability density' : undefined);

    // No plot titles per user request

    switch (dataObj.plot_type) {
      case 'histogram': {
        const isDiscrete = originalData ? isDiscreteVariable(histogramColumn, originalData) : false;
        if (isDiscrete) {
          // Convert counts to percentages or counts for discrete values and render a single grouped chart
          const realCounts = {};
          const synthCounts = {};
          dataObj.real_values.forEach(v => realCounts[v] = (realCounts[v] || 0) + 1);
          dataObj.synthetic_values.forEach(v => synthCounts[v] = (synthCounts[v] || 0) + 1);
          const realTotal = dataObj.real_values.length || 1;
          const synthTotal = dataObj.synthetic_values.length || 1;
          const realX = Object.keys(realCounts);
          const synthX = Object.keys(synthCounts);
          // Union of categories preserving order (real first, then new from synthetic)
          const unionCats = [...new Set([...realX, ...synthX])];
          const getY = (countsObj, cats, total) => (
            yScale === 'density' ? cats.map(x => ((countsObj[x] || 0) / total)) : cats.map(x => (countsObj[x] || 0))
          );
          const realY = getY(realCounts, unionCats, realTotal);
          const synthY = getY(synthCounts, unionCats, synthTotal);
          const discreteYAxisTitle = getYAxisTitle();

          const traces = [];
          if (dataTypeFilter !== 'synthetic-only') {
            traces.push({ x: unionCats, y: realY, type: 'bar', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7 });
          }
          if (dataTypeFilter !== 'real-only') {
            traces.push({ x: unionCats, y: synthY, type: 'bar', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7 });
          }

          return (
            <Plot
              data={traces}
              layout={plotLayout({ margin: { l: 40, r: 20, t: 20, b: 40 }, barmode: 'group', showlegend: false, xaxis: { title: xAxisTitle, type: 'category' }, yaxis: { title: discreteYAxisTitle }, bargap: 0.1 })}
              style={{ width: '100%', height: '160px' }}
              config={{ displayModeBar: false, doubleClick: 'reset' }}
              key={plotKey}
            />
          );
        }

        // Continuous histogram (overlay)
        const combinedValues = [...dataObj.real_values, ...dataObj.synthetic_values];
        if (combinedValues.length === 0) {
          return <Typography>No data available for histogram</Typography>;
        }
        const minValue = Math.min(...combinedValues);
        const maxValue = Math.max(...combinedValues);
        const range = maxValue - minValue;
        const histnorm = getHistnorm();
        const yAxisTitle = getYAxisTitle();

        if (range === 0) {
          const singleValue = minValue;
          const sharedXBins = { start: singleValue - 0.5, end: singleValue + 0.5, size: 1 };
          if (dataTypeFilter === 'real-only') {
            return (
              <Plot
                data={[{ x: dataObj.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7, histnorm, xbins: sharedXBins }]}
                layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
                style={{ width: '100%', height: '160px' }}
                config={{ displayModeBar: false, doubleClick: 'reset' }}
                key={plotKey}
              />
            );
          } else if (dataTypeFilter === 'synthetic-only') {
            return (
              <Plot
                data={[{ x: dataObj.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7, histnorm, xbins: sharedXBins }]}
                layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
                style={{ width: '100%', height: '160px' }}
                config={{ displayModeBar: false, doubleClick: 'reset' }}
                key={plotKey}
              />
            );
          } else {
            return (
              <Plot
                data={[
                  { x: dataObj.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.5, histnorm, xbins: sharedXBins },
                  { x: dataObj.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.5, histnorm, xbins: sharedXBins },
                ]}
                layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, barmode: 'overlay', xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
                style={{ width: '100%', height: '160px' }}
                config={{ displayModeBar: false, doubleClick: 'reset' }}
                key={plotKey}
              />
            );
          }
        }

        const binCount = Math.min(30, Math.ceil(Math.sqrt(combinedValues.length)));
        const binSize = range / binCount;
        const sharedXBins = { start: minValue - binSize * 0.1, end: maxValue + binSize * 0.1, size: binSize };

        if (dataTypeFilter === 'real-only') {
          return (
            <Plot
              data={[{ x: dataObj.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7, histnorm, xbins: sharedXBins }]}
              layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
              style={{ width: '100%', height: '160px' }}
              config={{ displayModeBar: false, doubleClick: 'reset' }}
              key={plotKey}
            />
          );
        } else if (dataTypeFilter === 'synthetic-only') {
          return (
            <Plot
              data={[{ x: dataObj.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7, histnorm, xbins: sharedXBins }]}
              layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
              style={{ width: '100%', height: '160px' }}
              config={{ displayModeBar: false, doubleClick: 'reset' }}
              key={plotKey}
            />
          );
        }

        return (
          <Plot
            data={[
              { x: dataObj.real_values, type: 'histogram', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.5, histnorm, xbins: sharedXBins },
              { x: dataObj.synthetic_values, type: 'histogram', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.5, histnorm, xbins: sharedXBins },
            ]}
            layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, barmode: 'overlay', xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
            style={{ width: '100%', height: '160px' }}
            config={{ displayModeBar: false, doubleClick: 'reset' }}
            key={plotKey}
          />
        );
      }

      case 'violin': {
        if (dataTypeFilter === 'real-only') {
          return (
            <Plot
              data={[{ y: dataObj.real_values, type: 'violin', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7, box: { visible: true }, meanline: { visible: true } }]}
              layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle, showticklabels: false }, yaxis: { title: 'Value' }, showlegend: false })}
              style={{ width: '100%', height: '160px' }}
              config={{ displayModeBar: false, doubleClick: 'reset' }}
              key={plotKey}
            />
          );
        } else if (dataTypeFilter === 'synthetic-only') {
          return (
            <Plot
              data={[{ y: dataObj.synthetic_values, type: 'violin', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7, box: { visible: true }, meanline: { visible: true } }]}
              layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle, showticklabels: false }, yaxis: { title: 'Value' }, showlegend: false })}
              style={{ width: '100%', height: '160px' }}
              config={{ displayModeBar: false, doubleClick: 'reset' }}
              key={plotKey}
            />
          );
        }

        return (
          <Plot
            data={[
              { y: dataObj.real_values, type: 'violin', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.5, box: { visible: true }, meanline: { visible: true } },
              { y: dataObj.synthetic_values, type: 'violin', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.5, box: { visible: true }, meanline: { visible: true } },
            ]}
            layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle, showticklabels: false }, yaxis: { title: 'Value' }, showlegend: false })}
            style={{ width: '100%', height: '160px' }}
            config={{ displayModeBar: false, doubleClick: 'reset' }}
            key={plotKey}
          />
        );
      }

      case 'bar': {
        const realTotal = dataObj.real_counts.reduce((s, c) => s + c, 0) || 1;
        const synthTotal = dataObj.synthetic_counts.reduce((s, c) => s + c, 0) || 1;
        const useDensity = yScale === 'density';
        const realValues = useDensity ? dataObj.real_counts.map(c => (c / realTotal)) : dataObj.real_counts;
        const synthValues = useDensity ? dataObj.synthetic_counts.map(c => (c / synthTotal)) : dataObj.synthetic_counts;
        const yAxisTitle = useDensity ? 'Density' : 'Count';

        if (dataTypeFilter === 'real-only') {
          return (
            <Plot
              data={[{ x: dataObj.categories, y: realValues, type: 'bar', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7 }]}
              layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
              style={{ width: '100%', height: '160px' }}
              config={{ displayModeBar: false, doubleClick: 'reset' }}
              key={plotKey}
            />
          );
        } else if (dataTypeFilter === 'synthetic-only') {
          return (
            <Plot
              data={[{ x: dataObj.categories, y: synthValues, type: 'bar', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7 }]}
              layout={plotLayout({ margin: { l: 60, r: 20, t: 20, b: 40 }, xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
              style={{ width: '100%', height: '160px' }}
              config={{ displayModeBar: false, doubleClick: 'reset' }}
              key={plotKey}
            />
          );
        }

        return (
          <Plot
            data={[
              { x: dataObj.categories, y: realValues, type: 'bar', name: 'Real', marker: { color: '#2563eb' }, opacity: 0.7 },
              { x: dataObj.categories, y: synthValues, type: 'bar', name: 'Synthetic', marker: { color: '#dc2626' }, opacity: 0.7 },
            ]}
            layout={plotLayout({ margin: { l: 40, r: 20, t: 20, b: 40 }, barmode: 'group', xaxis: { title: xAxisTitle }, yaxis: { title: yAxisTitle }, showlegend: false })}
            style={{ width: '100%', height: '160px' }}
            config={{ displayModeBar: false, doubleClick: 'reset' }}
            key={plotKey}
          />
        );
      }

      default:
        return <Typography>Unsupported plot type: {dataObj.plot_type}</Typography>;
    }
  };

  // Backward-compatible renderer for selected plot
  const renderPlot = () => renderPlotFor(plotData);

  // Generate overall (global) distribution using embedded subset (based on labels)
  const generateGlobalPlotData = useCallback(async () => {
    if (!originalData || !originalData.headers || originalData.headers.length === 0) return;
    // Abort previous
    if (globalAbortControllerRef.current) globalAbortControllerRef.current.abort();
    const abortController = new AbortController();
    globalAbortControllerRef.current = abortController;

    // Determine embedded subset sizes (if labels available) and slice aligned arrays accordingly
    let embeddedRealCount = 0;
    let embeddedSynthCount = 0;
    if (Array.isArray(metadata?.labels)) {
      for (const l of metadata.labels) {
        if (l === 'Real') embeddedRealCount++;
        else if (l === 'Synthetic') embeddedSynthCount++;
      }
    }

    let allReal = Array.isArray(alignedRealData)
      ? (embeddedRealCount > 0 ? alignedRealData.slice(0, Math.min(embeddedRealCount, alignedRealData.length)) : alignedRealData)
      : [];
    let allSynthetic = Array.isArray(alignedSyntheticData)
      ? (embeddedSynthCount > 0 ? alignedSyntheticData.slice(0, Math.min(embeddedSynthCount, alignedSyntheticData.length)) : alignedSyntheticData)
      : [];

    if (allReal.length === 0 && allSynthetic.length === 0) {
      setGlobalPlotData(null);
      setGlobalPlotError('No data available to plot');
      setGlobalPlotLoading(false);
      return;
    }

    const dataTypeFilter = allReal.length > 0 && allSynthetic.length > 0 ? 'mixed' : (allReal.length > 0 ? 'real-only' : 'synthetic-only');
    const requestData = {
      real_data: allReal,
      synthetic_data: allSynthetic,
      column: originalData.headers[histogramColumn],
      plot_type: histogramPlotType,
      real_headers: originalData.headers,
      synthetic_headers: originalData.headers,
      data_type_filter: dataTypeFilter,
    };

    setGlobalPlotLoading(true);
    setGlobalPlotError(null);
    try {
      const resp = await generateDistributionPlot(requestData, abortController.signal);
      if (abortController.signal.aborted) return;
      setGlobalPlotData(resp);
    } catch (err) {
      if (err.name === 'AbortError' || abortController.signal.aborted) return;
      setGlobalPlotError(`Failed to generate overall plot: ${err.message}`);
    } finally {
      if (!abortController.signal.aborted) setGlobalPlotLoading(false);
    }
  }, [originalData, histogramColumn, histogramPlotType, alignedRealData, alignedSyntheticData, metadata]);

  // Trigger overall distribution when inputs change
  useEffect(() => {
    if (!originalData || !originalData.headers || originalData.headers.length === 0) return;
    generateGlobalPlotData();
    return () => {
      if (globalAbortControllerRef.current) globalAbortControllerRef.current.abort();
    };
  }, [originalData, histogramColumn, histogramPlotType, generateGlobalPlotData]);

  // Removed legacy auto-init effect; initialization handled by displayHeaders effect

  const histogramData = useMemo(() => generateHistogramData(), [generateHistogramData]);

  // Derive Plot Type options from overall dataset (not selection)
  const plotTypeOptions = useMemo(() => {
    if (!originalData || !originalData.headers || histogramColumn >= (originalData.headers?.length || 0)) return [];
    const columnDataType = classifyColumnType(histogramColumn, originalData);
    return getAvailablePlotTypes(columnDataType) || [];
  }, [originalData, histogramColumn]);

  // Available Y-axis scales depending on plot type and data type
  const availableYScales = useMemo(() => {
    if (!originalData || !originalData.headers || histogramColumn >= (originalData.headers?.length || 0)) return [];
    if (histogramPlotType === 'histogram') {
      // Support Count and Density for both discrete and continuous histograms
      return ['count', 'density'];
    }
    if (histogramPlotType === 'bar') {
      return ['count', 'density'];
    }
    return [];
  }, [histogramPlotType, histogramColumn, originalData]);

  // Coerce yScale when options change
  useEffect(() => {
    if (availableYScales.length && !availableYScales.includes(yScale)) {
      setYScale(availableYScales[0]);
    }
  }, [availableYScales, yScale]);

  // Consistent Plotly font styling aligned with MUI theme
  const plotBaseFont = useMemo(() => ({
    family: theme.typography?.fontFamily || 'Inter, Roboto, Helvetica, Arial, sans-serif',
    size: 12,
    color: theme.palette?.text?.primary || '#111',
  }), [theme]);

  const axisFonts = useMemo(() => ({
    titlefont: {
      family: plotBaseFont.family,
      size: 12,
      color: plotBaseFont.color,
    },
    tickfont: {
      family: plotBaseFont.family,
      size: 11,
      color: theme.palette?.text?.secondary || '#555',
    },
  }), [plotBaseFont, theme]);

  const plotLayout = useCallback((overrides = {}) => {
    const xaxis = { ...(overrides.xaxis || {}) };
    const yaxis = { ...(overrides.yaxis || {}) };
    return {
      font: plotBaseFont,
      ...overrides,
      xaxis: { ...xaxis, ...axisFonts },
      yaxis: { ...yaxis, ...axisFonts },
    };
  }, [plotBaseFont, axisFonts]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, borderBottom: '0.1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2">Univariate Distribution Analysis</Typography>
      </Box>


      {/* Selection Summary */}
      <Box sx={{ ml: 1, mb: 1, mt: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Selected: <strong>{selectionSummary.total}</strong>/<strong>{datasetTotals.total}</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Real: <strong>{selectionSummary.real}</strong>/<strong>{datasetTotals.real}</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Synthetic: <strong>{selectionSummary.synthetic}</strong>/<strong>{datasetTotals.synthetic}</strong>
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
        {/* Controls (apply to both Overall and Selected plots) */}
        {originalData && originalData.headers && originalData.headers.length > 0 && (
          <Box>
            {headerMismatchInfo.excludedCount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Tooltip
                  arrow
                  placement="left"
                  title={
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Using intersection of headers for analysis
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Common: {headerMismatchInfo.commonCount}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Real-only: {headerMismatchInfo.realOnly.length}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Synthetic-only: {headerMismatchInfo.synthOnly.length}
                      </Typography>
                    </Box>
                  }
                >
                  <Chip
                    size="small"
                    variant="outlined"
                    color="warning"
                    label={`Excluded ${headerMismatchInfo.excludedCount} cols`}
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                </Tooltip>
              </Box>
            )}
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel sx={{ fontSize: 12, '&.MuiInputLabel-shrink': { fontSize: 12 } }}>Column for Analysis</InputLabel>
              <Select value={histogramColumn} label="Column for Analysis" onChange={(e) => setHistogramColumn(e.target.value)} sx={{ '& .MuiSelect-select': { fontSize: 12, py: 0.5 } }}>
                {displayHeaders.map(({ name, index }) => {
                  const columnDataType = classifyColumnType(index, originalData);
                  return (
                    <MenuItem key={index} value={index} sx={{ fontSize: 12, minHeight: 32, py: 0.25 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography variant="body2" sx={{ flex: 1, fontSize: 12 }}>{name}</Typography>
                        <Chip label={columnDataType} size="small" color={columnDataType === 'numeric' ? 'primary' : 'secondary'} variant="outlined" sx={{ fontSize: '0.7rem', height: '20px' }} />
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>

            {plotTypeOptions && plotTypeOptions.length > 0 && (
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel sx={{ fontSize: 12, '&.MuiInputLabel-shrink': { fontSize: 12 } }}>Plot Type</InputLabel>
                <Select value={histogramPlotType} label="Plot Type" onChange={(e) => setHistogramPlotType(e.target.value)} sx={{ '& .MuiSelect-select': { fontSize: 12, py: 0.5 } }}>
                  {plotTypeOptions.map((plotType) => (
                    <MenuItem key={plotType.value} value={plotType.value} sx={{ fontSize: 12, minHeight: 32, py: 0.25 }}>
                      <Typography variant="body2" sx={{ fontSize: 12 }}>{plotType.label}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Y-axis Scale control */}
            {availableYScales.length > 0 && (
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel sx={{ fontSize: 12, '&.MuiInputLabel-shrink': { fontSize: 12 } }}>Y-axis Scale</InputLabel>
                <Select value={yScale} label="Y-axis Scale" onChange={(e) => setYScale(e.target.value)} sx={{ '& .MuiSelect-select': { fontSize: 12, py: 0.5 } }}>
                  {availableYScales.map((s) => (
                    <MenuItem key={s} value={s} sx={{ fontSize: 12, minHeight: 32, py: 0.25 }}>
                      <Typography variant="body2" sx={{ fontSize: 12 }}>{s === 'count' ? 'Count' : 'Density'}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        )}

        {/* Overall Distribution (full dataset) */}
        {originalData && originalData.headers && originalData.headers.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontSize: 12 }}>
              Overall Distribution: {originalData.headers[histogramColumn] || `Column ${histogramColumn + 1}`}
            </Typography>
            {globalPlotLoading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '160px', gap: 1 }}>
                <CircularProgress size={40} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Generating overall plot...</Typography>
              </Box>
            )}
            {globalPlotError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2" component="div" sx={{ fontSize: 12 }}><strong>Overall Plot Error:</strong></Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontSize: 12 }}>{globalPlotError}</Typography>
              </Alert>
            )}
            {!globalPlotLoading && !globalPlotError && globalPlotData && (
              <Box sx={{ width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {(globalPlotData?.data_type_filter === 'mixed' || globalPlotData?.data_type_filter === 'real-only') && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, bgcolor: '#2563eb', opacity: 0.7, borderRadius: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: 11 }}>Real</Typography>
                      </Box>
                    )}
                    {(globalPlotData?.data_type_filter === 'mixed' || globalPlotData?.data_type_filter === 'synthetic-only') && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, bgcolor: '#dc2626', opacity: 0.7, borderRadius: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: 11 }}>Synthetic</Typography>
                      </Box>
                    )}
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => setGlobalResetKey((k) => k + 1)} sx={{ fontSize: 11, px: 0.75, py: 0.25, minHeight: 22, textTransform: 'none' }}>Reset zoom</Button>
                </Box>
                {renderPlotFor(globalPlotData, `global-${globalResetKey}`)}
              </Box>
            )}
          </Box>
        )}

        {/* Divider intentionally removed to keep layout compact */}

        {/* Selected Distribution */}
        {originalData && originalData.headers && originalData.headers.length > 0 && Array.isArray(selectedPoints) && selectedPoints.length > 0 ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontSize: 12 }}>
              Selected Distribution: {histogramData?.columnName || (originalData?.headers?.[histogramColumn] || `Column ${histogramColumn + 1}`)}
            </Typography>

            {plotLoading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '160px', gap: 1 }}>
                <CircularProgress size={40} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Generating plot...</Typography>
              </Box>
            )}

            {plotError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2" component="div" sx={{ fontSize: 12 }}><strong>Plot Generation Error:</strong></Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontSize: 12 }}>{plotError}</Typography>
              </Alert>
            )}

            {!plotLoading && !plotError && plotData && (
              <Box sx={{ width: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {(plotData?.data_type_filter === 'mixed' || plotData?.data_type_filter === 'real-only') && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, bgcolor: '#2563eb', opacity: 0.7, borderRadius: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: 11 }}>Real</Typography>
                      </Box>
                    )}
                    {(plotData?.data_type_filter === 'mixed' || plotData?.data_type_filter === 'synthetic-only') && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, bgcolor: '#dc2626', opacity: 0.7, borderRadius: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: 11 }}>Synthetic</Typography>
                      </Box>
                    )}
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => setSelectedResetKey((k) => k + 1)} sx={{ fontSize: 11, px: 0.75, py: 0.25, minHeight: 22, textTransform: 'none' }}>Reset zoom</Button>
                </Box>
                {renderPlotFor(plotData, `selected-${selectedResetKey}`)}
              </Box>
            )}

            {!plotLoading && !plotError && !plotData && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '160px', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>Select points to view distribution</Typography>
              </Box>
            )}
          </Box>
        ) : (
          selectedPoints && selectedPoints.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100px', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>Distribution analysis not available for this embedding</Typography>
            </Box>
          )
        )}

        {/* Bottom legend removed: legend now lives inline with Reset zoom per plot */}
      </Box>
    </Paper>
  );
}
