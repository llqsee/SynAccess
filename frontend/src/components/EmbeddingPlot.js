import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Chip, IconButton, Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Clear, BarChart, CropFree, Warning, Download, Help, Gesture } from '@mui/icons-material';
// import Plot from 'react-plotly.js';
// import { generateDistributionPlot } from '../services/api';
// import { classifyColumnType, getAvailablePlotTypes, isDiscreteVariable } from '../utils/dataUtils';
import anomalyDetectionService from '../services/anomalyDetectionService';
// import logger from '../utils/logger';

// Debug logging helper gated by env var
// const dbg = (...args) => {
//   if (process.env.REACT_APP_DEBUG === '1') {
//     // eslint-disable-next-line no-console
//     console.log(...args);
//   }
// };

const EmbeddingPlot = ({
  data,
  metadata,
  pointSize = 0.8,
  pointOpacity = 0.5,
  onSelectionChange
}) => {
  // All React hooks must be called first, before any early returns
  const svgRef = useRef();
  const containerRef = useRef();
  const [selectedPoints, setSelectedPoints] = useState([]);
  // Sidebar-removed: distribution state now handled in external RightSidebar

  // Anomaly detection state
  const [anomalyResults, setAnomalyResults] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyError, setAnomalyError] = useState(null);
  const [showAnomalies, setShowAnomalies] = useState(false);
  // const [showGrid, setShowGrid] = useState(true); // Show grid cells by default
  // const [contamination, setContamination] = useState('auto');
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // Notify parent (e.g., App) when the selection changes so RightSidebar can update
  useEffect(() => {
    if (typeof onSelectionChange === 'function') {
      onSelectionChange(selectedPoints);
    }
  }, [selectedPoints, onSelectionChange]);

  // Interactive filtering state
  // const [showSyntheticNormal, setShowSyntheticNormal] = useState(true);
  // const [showSyntheticAnomalies, setShowSyntheticAnomalies] = useState(true);
  // const [showRealNormal, setShowRealNormal] = useState(true);
  // const [showRealAnomalies, setShowRealAnomalies] = useState(true);

  // Helper functions for filter controls - Fixed null reference issues
  // const showAllData = useCallback(() => {
  //   // setShowRealNormal(true);
  //   // setShowRealAnomalies(true);
  //   // setShowSyntheticNormal(true);
  //   // setShowSyntheticAnomalies(true);
  // }, []);

  // const hideAllData = useCallback(() => {
  //   // setShowRealNormal(false);
  //   // setShowRealAnomalies(false);
  //   // setShowSyntheticNormal(false);
  //   // setShowSyntheticAnomalies(false);
  // }, []);

  // const showOnlyAnomalies = useCallback(() => {
  //   // setShowRealNormal(false);
  //   // setShowRealAnomalies(true);
  //   // setShowSyntheticNormal(false);
  //   // setShowSyntheticAnomalies(true);
  // }, []);

  // Helper function to interpret p-value for tooltips
  const getPValueInterpretation = useCallback((pValue) => {
    if (pValue === null || pValue === undefined) return "N/A";
    if (typeof pValue === 'string') {
      if (pValue === 'Infinity' || pValue === '-Infinity') return "Extreme significance";
      if (pValue === 'NaN') return "N/A";
      return "Unknown";
    }
    if (isNaN(pValue)) return "N/A";
    if (pValue < 0.001) return "Highly significant";
    if (pValue < 0.01) return "Very significant";
    if (pValue < 0.05) return "Significant";
    return "Not significant";
  }, []);

  // Helper function to get p-value color for tooltips
  // const getPValueColor = useCallback((pValue) => {
  //   if (pValue === null || pValue === undefined) return "#666666"; // Gray
  //   if (typeof pValue === 'string') {
  //     if (pValue === 'Infinity' || pValue === '-Infinity') return "#8B0000"; // Dark Red for extreme
  //     if (pValue === 'NaN') return "#666666"; // Gray
  //     return "#666666"; // Gray for unknown strings
  //   }
  //   if (isNaN(pValue)) return "#666666"; // Gray
  //   if (pValue < 0.001) return "#8B0000"; // Dark Red
  //   if (pValue < 0.01) return "#FF4500"; // Orange Red
  //   if (pValue < 0.05) return "#FFD700"; // Golden Yellow
  //   return "#666666"; // Gray
  // }, []);

  // Helper function to create detailed tooltip content
  const createAnomalyTooltip = useCallback((cellData, i, j) => {
    const pValue = cellData?.p_value_adjusted;
    const interpretation = getPValueInterpretation(pValue);
    // const pValueColor = getPValueColor(pValue);

    // Safe formatting function for numbers that might be strings like "Infinity"
    const formatNumber = (value, decimals = 3) => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'string') {
        if (value === 'Infinity') return '∞';
        if (value === '-Infinity') return '-∞';
        if (value === 'NaN') return 'N/A';
        return value;
      }
      if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        return value.toFixed(decimals);
      }
      return 'N/A';
    };

    const testTypeText = cellData?.test_type === 'real_overpopulation'
      ? '🔴 Real Overpopulation'
      : '🔵 Synthetic Overpopulation';

    const testDescription = cellData?.test_type === 'real_overpopulation'
      ? 'This region has significantly more real data than expected'
      : 'This region has significantly more synthetic data than expected';

    return `🔍 Anomalous Region (${i}, ${j})

📊 Data Distribution:
   • Real Points: ${cellData?.real_count || 0}
   • Synthetic Points: ${cellData?.synthetic_count || 0}
   • Total Points: ${cellData?.total_count || 0}
   • Cell Proportion: ${formatNumber(cellData?.cell_proportion)}
   • Global Proportion: ${formatNumber(cellData?.global_proportion)}

📈 Statistical Analysis:
   • Proportion Difference: ${formatNumber(cellData?.proportion_diff)}
   • P-Value: ${formatNumber(cellData?.p_value)}
   • Adjusted P-Value: ${formatNumber(pValue)}
   • Interpretation: ${interpretation}
   • Significant: ${cellData?.is_significant ? 'Yes' : 'No'}

🎯 Anomaly Type:
   • ${testTypeText}
   • ${testDescription}

💡 Click to view distribution plot of data in this region`;
  }, [getPValueInterpretation]);

  // Get original data for histogram generation
  const getOriginalData = useCallback(() => {
    // Try to get data from metadata first (for history embeddings)
    if (metadata?.realData?.data && metadata?.syntheticData?.data) {
      const realData = metadata.realData.data;
      const syntheticData = metadata.syntheticData.data;

      // Validate that data arrays contain valid arrays
      if (!Array.isArray(realData) || !Array.isArray(syntheticData)) return null;

      // Filter out invalid data rows
      const validRealData = realData.filter(row => row && Array.isArray(row) && row.length > 0);
      const validSyntheticData = syntheticData.filter(row => row && Array.isArray(row) && row.length > 0);

      if (validRealData.length === 0 && validSyntheticData.length === 0) return null;

      const realLabels = Array(validRealData.length).fill('Real');
      const syntheticLabels = Array(validSyntheticData.length).fill('Synthetic');

      return {
        data: [...validRealData, ...validSyntheticData],
        labels: [...realLabels, ...syntheticLabels],
        headers: metadata.realData.headers || []
      };
    }

    // If metadata doesn't have original data, try to access session state data
    // This is the same pattern used in App.js for DistributionPlot
    try {
      // Access session state data directly (same as DistributionPlot component)
      const sessionRealData = window.sessionStorage.getItem('realData');
      const sessionSyntheticData = window.sessionStorage.getItem('syntheticData');

      if (sessionRealData && sessionSyntheticData) {
        const realData = JSON.parse(sessionRealData);
        const syntheticData = JSON.parse(sessionSyntheticData);

        if (realData.data && syntheticData.data &&
          Array.isArray(realData.data) && Array.isArray(syntheticData.data) &&
          realData.data.length > 0 && syntheticData.data.length > 0) {

          const realLabels = Array(realData.data.length).fill('Real');
          const syntheticLabels = Array(syntheticData.data.length).fill('Synthetic');

          return {
            data: [...realData.data, ...syntheticData.data],
            labels: [...realLabels, ...syntheticLabels],
            headers: realData.headers || []
          };
        }
      }
    } catch (error) {
      console.warn('Failed to access session state data:', error);
    }

    return null;
  }, [metadata]);

  // Helper function to get anomaly information for tooltip
  const getAnomalyInfo = useCallback((originalIndex, label) => {
    if (!anomalyResults) return '';

    const originalData = getOriginalData();
    if (!originalData) return '';

    if (label === 'Real' && anomalyResults.real_data) {
      let realIndexInOriginal = 0;
      for (let j = 0; j < originalIndex; j++) {
        if (originalData.labels[j] === 'Real') {
          realIndexInOriginal++;
        }
      }

      if (realIndexInOriginal < anomalyResults.real_data.length) {
        const realPoint = anomalyResults.real_data[realIndexInOriginal];
        if (realPoint) {
          return `Score: ${realPoint.score?.toFixed(3) || 'N/A'}<br/>Status: ${realPoint.is_anomaly ? '🔴 Anomalous' : '🟢 Normal'}`;
        }
      }
    } else if (label === 'Synthetic' && anomalyResults.synthetic_data) {
      let syntheticIndexInOriginal = 0;
      for (let j = 0; j < originalIndex; j++) {
        if (originalData.labels[j] === 'Synthetic') {
          syntheticIndexInOriginal++;
        }
      }

      if (syntheticIndexInOriginal < anomalyResults.synthetic_data.length) {
        const syntheticPoint = anomalyResults.synthetic_data[syntheticIndexInOriginal];
        if (syntheticPoint) {
          return `Score: ${syntheticPoint.score?.toFixed(3) || 'N/A'}<br/>Status: ${syntheticPoint.is_anomaly ? '🔴 Anomalous' : '🟢 Normal'}`;
        }
      }
    }

    return '';
  }, [anomalyResults, getOriginalData]);

  const variableTypeRows = useMemo(() => {
    const inferColumnType = (rows, index) => {
      if (!Array.isArray(rows) || rows.length === 0 || index === -1) return '—';
      const sampleLimit = 400;
      const values = [];
      for (let i = 0; i < rows.length && values.length < sampleLimit; i++) {
        const row = rows[i];
        if (!Array.isArray(row) || index >= row.length) continue;
        const value = row[index];
        if (value === null || value === undefined || value === '') continue;
        values.push(value);
      }
      if (values.length === 0) return '—';

      let numericCount = 0;
      let integerCount = 0;
      values.forEach((val) => {
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (Number.isFinite(num)) {
          numericCount += 1;
          if (Number.isInteger(num)) {
            integerCount += 1;
          }
        }
      });

      if (numericCount === 0 || (numericCount / values.length) <= 0.5) {
        return 'categorical';
      }

      return integerCount === numericCount ? 'integer' : 'float';
    };

    const normalizeDataset = (dataset, fallback) => {
      const headers = Array.isArray(dataset?.headers) ? dataset.headers : fallback.headers;
      const rows = Array.isArray(dataset?.data) ? dataset.data : fallback.rows;
      return { headers: Array.isArray(headers) ? headers : [], rows: Array.isArray(rows) ? rows : [] };
    };

    const original = getOriginalData();
  const fallbackHeaders = original?.headers || [];
  const canUseOriginal = original && Array.isArray(original.data) && Array.isArray(original.labels);
  const fallbackRealRows = canUseOriginal ? original.data.filter((_, idx) => original.labels[idx] === 'Real') : [];
  const fallbackSyntheticRows = canUseOriginal ? original.data.filter((_, idx) => original.labels[idx] === 'Synthetic') : [];

    const realDataset = normalizeDataset(metadata?.realData, { headers: fallbackHeaders, rows: fallbackRealRows });
    const syntheticDataset = normalizeDataset(metadata?.syntheticData, { headers: fallbackHeaders, rows: fallbackSyntheticRows });

    const headerUnion = Array.from(new Set([...(realDataset.headers || []), ...(syntheticDataset.headers || [])]));
    if (headerUnion.length === 0) return [];

    const formatType = (type) => {
      if (!type || type === '—') return '—';
      return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const evaluateMatch = (realType, synthType) => {
      const numericTypes = new Set(['integer', 'float']);
      if ((realType === '—' || !realType) && (synthType === '—' || !synthType)) {
        return { icon: '⚠️', label: 'No data' };
      }
      if (realType === synthType && realType !== '—') {
        return { icon: '✅', label: 'Types match' };
      }
      if (realType === '—' || synthType === '—') {
        return { icon: '⚠️', label: 'Missing column' };
      }
      if (numericTypes.has(realType) && numericTypes.has(synthType)) {
        if (realType === 'integer' && synthType === 'float') {
          return { icon: '❌', label: 'Synthetic includes fractional values' };
        }
        if (realType === 'float' && synthType === 'integer') {
          return { icon: '⚠️', label: 'Synthetic truncated numeric' };
        }
        return { icon: '⚠️', label: 'Numeric mismatch' };
      }
      return { icon: '❌', label: 'Type mismatch' };
    };

    return headerUnion
      .map((header) => {
        const realIndex = realDataset.headers.indexOf(header);
        const synthIndex = syntheticDataset.headers.indexOf(header);
        const realType = inferColumnType(realDataset.rows, realIndex);
        const syntheticType = inferColumnType(syntheticDataset.rows, synthIndex);
        const match = evaluateMatch(realType, syntheticType);
        return {
          variable: header,
          realType: formatType(realType),
          syntheticType: formatType(syntheticType),
          match
        };
      })
      .sort((a, b) => a.variable.localeCompare(b.variable));
  }, [getOriginalData, metadata]);

  // Simplified visibility - show all points by default
  const getVisiblePoints = useCallback(() => {
    if (!data || !metadata) return [];

    // Simplified: show all data points
    return Array.from({ length: data.length }, (_, i) => i);
  }, [data, metadata]);

  // Enhanced layout state with intelligent defaults
  // Fixed-size embedding: remove sidebar width state and resizing
  const [sidebarWidth] = useState(30);
  const [isResizing] = useState(false);

  // Calculate optimal plot dimensions based on screen characteristics
  const calculatePlotDimensions = useCallback((containerWidth, containerHeight, _sidebarVisible) => {
    // Use the container's size directly; container is a fixed square
    const plotWidth = containerWidth;
    const plotHeight = containerHeight;
    return { plotWidth, plotHeight };
  }, []);

  // Sidebar-removed: histogram data generation moved to RightSidebar

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPoints([]);
  }, []);

  // Removed: select all points functionality

  // Sidebar-removed: distribution plot API moved to RightSidebar

  // Sidebar-removed: plot type auto-correction handled in RightSidebar

  // Render plot using Plotly (same logic as DistributionPlot.js)
  // Sidebar-removed: distribution rendering handled in RightSidebar



  // Intelligent sampling function for large datasets
  const sampleData = (data, labels, maxPoints = 8000) => {
    // Filter out invalid data points first
    const validIndices = [];
    data.forEach((point, index) => {
      if (point && Array.isArray(point) && point.length >= 2 &&
        typeof point[0] === 'number' && typeof point[1] === 'number' &&
        !isNaN(point[0]) && !isNaN(point[1]) &&
        labels[index]) {
        validIndices.push(index);
      }
    });

    if (validIndices.length <= maxPoints) {
      return {
        sampledData: validIndices.map(i => data[i]),
        sampledLabels: validIndices.map(i => labels[i]),
        indexMap: validIndices
      };
    }

    const realIndices = [];
    const syntheticIndices = [];

    validIndices.forEach((index) => {
      const label = labels[index];
      if (label === "Real") {
        realIndices.push(index);
      } else if (label === "Synthetic") {
        syntheticIndices.push(index);
      }
    });

    // Sample proportionally from both datasets
    const realSampleSize = Math.floor(maxPoints * 0.5);
    const syntheticSampleSize = maxPoints - realSampleSize;

    const sampledRealIndices = realIndices
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(realSampleSize, realIndices.length));

    const sampledSyntheticIndices = syntheticIndices
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(syntheticSampleSize, syntheticIndices.length));

    const allSampledIndices = [...sampledRealIndices, ...sampledSyntheticIndices]
      .sort((a, b) => a - b);

    const sampledData = allSampledIndices.map(i => data[i]);
    const sampledLabels = allSampledIndices.map(i => labels[i]);

    return { sampledData, sampledLabels, indexMap: allSampledIndices };
  };

  // Main plot rendering with D3
  useEffect(() => {
    if (!data || !metadata || !data.length || !metadata.labels) {
      return;
    }

    // Additional validation to ensure data integrity
    if (data.length !== metadata.labels.length) {
      console.warn('Data and labels length mismatch:', { dataLength: data.length, labelsLength: metadata.labels.length });
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Add a small delay to ensure DOM updates are complete when sidebar state changes
    const renderTimeout = setTimeout(() => {
      renderD3Plot();
    }, 50);

    return () => clearTimeout(renderTimeout);
  }, [data, metadata, pointSize, pointOpacity, selectedPoints, sidebarWidth, showAnomalies, anomalyResults, getOriginalData, calculatePlotDimensions]);

  // Separate function for the actual D3 plot rendering logic
  const renderD3Plot = useCallback(() => {
    if (!data || !metadata || !data.length || !metadata.labels) {
      return;
    }

    // Additional validation to ensure data integrity
    if (data.length !== metadata.labels.length) {
      console.warn('Data and labels length mismatch:', { dataLength: data.length, labelsLength: metadata.labels.length });
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Get container dimensions and use available space efficiently
    // Force a reflow to get updated dimensions after sidebar state changes
    container.style.display = 'none';
    void container.offsetHeight; // Force reflow
    container.style.display = 'flex';

    const rect = container.getBoundingClientRect();
    // Use the full container dimensions, accounting for padding
    const containerWidth = rect.width > 0 ? rect.width : 800;
    const containerHeight = rect.height > 0 ? rect.height : 600;

    // Debug logging
    const containerRatio = containerWidth / containerHeight;
    console.log('Window dimensions:', { width: window.innerWidth, height: window.innerHeight });
    console.log('Container dimensions:', { width: containerWidth, height: containerHeight });
    console.log('Container ratio:', containerRatio);
    console.log('Available space utilization:', {
      widthUtilization: (containerWidth / window.innerWidth * 100).toFixed(1) + '%',
      heightUtilization: (containerHeight / window.innerHeight * 100).toFixed(1) + '%'
    });

    // Calculate responsive plot area based on sidebar state
    const { plotWidth, plotHeight } = calculatePlotDimensions(containerWidth, containerHeight, true);

    // Allow rendering at smaller sizes too; inner dimension check below ensures valid rendering area

    // Get device pixel ratio for high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;

  // Apply intelligent sampling for large datasets (now includes validation)
  // If the total points are <= 10,000, show all points to avoid 50/50 downsampling artifacts
  const totalPoints = data.length;
  const samplingCap = totalPoints <= 10000 ? totalPoints : 10000;
  const { sampledData, sampledLabels, indexMap } = sampleData(data, metadata.labels, samplingCap);



    // If no valid data, return early
    if (sampledData.length === 0) {
      console.warn('No valid data points found for embedding plot');
      return;
    }

    const numPoints = sampledData.length;
    const wasDownsampled = sampledData.length < data.length;

    // Clear previous plot
    if (!svgRef.current) {
      console.warn('SVG ref is null, skipping D3 visualization');
      return;
    }
    d3.select(svgRef.current).selectAll("*").remove();

    const effectivePlotWidth = plotWidth * devicePixelRatio;
    const effectivePlotHeight = plotHeight * devicePixelRatio;

    // Advanced point sizing based on dataset size and density (no need to multiply by devicePixelRatio since we're scaling the group)
  const basePointSize = plotWidth < 400 ? 0.7 : plotWidth < 800 ? 0.9 : 1.2;
    const densityFactor = Math.max(0.3, Math.min(1.5, 1000 / Math.sqrt(numPoints)));
    const adjustedPointSize = basePointSize * densityFactor;

    // Adaptive opacity based on point density
  const baseOpacity = plotWidth < 400 ? 0.45 : 0.5;
    const opacityFactor = Math.max(0.4, Math.min(0.9, 800 / Math.sqrt(numPoints)));
    const adjustedOpacity = baseOpacity * opacityFactor;

    // Create SVG with DPI-aware scaling
    const svg = d3.select(svgRef.current)
      .attr("width", plotWidth * devicePixelRatio)
      .attr("height", plotHeight * devicePixelRatio)
      .attr("viewBox", `0 0 ${plotWidth * devicePixelRatio} ${plotHeight * devicePixelRatio}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", `${plotWidth}px`)
      .style("height", `${plotHeight}px`)
      .style("max-width", "100%")
      .style("max-height", "100%")
      .style("display", "block")
      .style("shape-rendering", "geometricPrecision")
      .style("text-rendering", "optimizeLegibility")
      .style("cursor", "default");

    // Scale everything by device pixel ratio
    const scaledPlotWidth = plotWidth * devicePixelRatio;
    const scaledPlotHeight = plotHeight * devicePixelRatio;

    // Minimal margins so the scatter uses nearly the full div
    const baseMargin = {
      top: 8,
      right: 8,
      bottom: 8,
      left: 8
    };

    const margin = {
      top: baseMargin.top * devicePixelRatio,
      right: baseMargin.right * devicePixelRatio,
      bottom: baseMargin.bottom * devicePixelRatio,
      left: baseMargin.left * devicePixelRatio
    };

    // Calculate inner dimensions in the scaled coordinate system
    const innerWidth = plotWidth - (margin.left / devicePixelRatio) - (margin.right / devicePixelRatio);
    const innerHeight = plotHeight - (margin.top / devicePixelRatio) - (margin.bottom / devicePixelRatio);

    // Ensure we have positive dimensions; retry once using client sizes as fallback
    if (innerWidth <= 0 || innerHeight <= 0) {
      const c = containerRef.current;
      if (c) {
        const w = c.clientWidth || plotWidth;
        const h = c.clientHeight || plotHeight;
        if (w > 0 && h > 0) {
          svg.attr("viewBox", `0 0 ${w * devicePixelRatio} ${h * devicePixelRatio}`)
             .style("width", `${w}px`)
             .style("height", `${h}px`);
        }
      }
      if (innerWidth <= 0 || innerHeight <= 0) return;
    }

    // Apply scale transform on the main group to account for devicePixelRatio
    const g = svg.append("g")
      .attr("transform", `scale(${devicePixelRatio}) translate(${margin.left / devicePixelRatio},${margin.top / devicePixelRatio})`);

    // Layer groups to control rendering order (grid under points for interactivity)
    const gridLayer = g.append("g").attr("class", "grid-layer");
    const pointsLayer = g.append("g").attr("class", "points-layer");

    // Extract coordinates and create scales
    const x = sampledData.map(d => d[0]);
    const y = sampledData.map(d => d[1]);

  // Compute exact data extents (no padding) for consistent scales pre/post anomaly detection
  const xExtent = d3.extent(x);
  const yExtent = d3.extent(y);

  // Default to exact extents
  let xDomainMin = xExtent[0];
  let xDomainMax = xExtent[1];
  let yDomainMin = yExtent[0];
  let yDomainMax = yExtent[1];

    if (anomalyResults?.grid_info?.bounds) {
      const gb = anomalyResults.grid_info.bounds;
      xDomainMin = gb.x_min;
      xDomainMax = gb.x_max;
      yDomainMin = gb.y_min;
      yDomainMax = gb.y_max;
      console.log('✅ Using backend grid bounds for scales:', { xDomainMin, xDomainMax, yDomainMin, yDomainMax });
    }

    const xScale = d3.scaleLinear()
      .domain([xDomainMin, xDomainMax])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([yDomainMin, yDomainMax])
      .range([innerHeight, 0]);

    // Do not apply nice() or auto-adjustments to keep consistent scales

    // Enhanced color scheme
    const colorScale = d3.scaleOrdinal()
      .domain(["Real", "Synthetic"])
      .range(["#2563eb", "#dc2626"]);

    // Remove axes and grid lines to maximize plotting area (no ticks/labels)

    // Add anomaly region circles (blue transparent circles over anomalous grid cells)
    // Draw grid overlay for anomaly detection
    console.log('🔵 Anomaly detection state:', {
      showAnomalies,
      hasAnomalyResults: !!anomalyResults,
      anomalyResultsKeys: anomalyResults ? Object.keys(anomalyResults) : [],
      cellAnomalies: anomalyResults?.cell_anomalies,
      cellAnomaliesLength: anomalyResults?.cell_anomalies?.length,
      anomalyResultsType: typeof anomalyResults,
      anomalyResultsString: JSON.stringify(anomalyResults, null, 2).substring(0, 500)
    });

    const shouldDrawGrid = showAnomalies && anomalyResults && anomalyResults.cell_anomalies;
    console.log('🔵 Grid drawing condition check:', {
      showAnomalies,
      hasAnomalyResults: !!anomalyResults,
      hasCellAnomalies: !!(anomalyResults && anomalyResults.cell_anomalies),
      shouldDrawGrid
    });

    if (shouldDrawGrid) {
      console.log('🔵 Drawing grid overlay:', anomalyResults.cell_anomalies.length, 'anomalous cells');
      console.log('🔵 Anomaly results structure:', Object.keys(anomalyResults));
      console.log('🔵 Grid info:', anomalyResults.grid_info);
      console.log('🔵 Cell anomalies sample:', anomalyResults.cell_anomalies.slice(0, 3));

      // Create grid cell lookup for quick access
      const anomalousCells = new Set();
      anomalyResults.cell_anomalies.forEach(anomaly => {
        anomalousCells.add(`${anomaly.cell_x},${anomaly.cell_y}`);
      });

      // Get grid info from results - now supports different X and Y grid sizes
      const xGridSize = anomalyResults.grid_info?.x_grid_size || 20;
      const yGridSize = anomalyResults.grid_info?.y_grid_size || 20;
      const gridSize = anomalyResults.grid_info?.grid_size || Math.min(xGridSize, yGridSize); // Backward compatibility
      const bounds = anomalyResults.grid_info?.bounds;

      console.log('🔵 Grid sizes - X:', xGridSize, 'Y:', yGridSize, 'Legacy:', gridSize);
      console.log('🔵 Bounds:', bounds);
      console.log('🔵 Grid info full:', anomalyResults.grid_info);
      console.log('🔵 Anomalous cells:', Array.from(anomalousCells));

      // Check if all data points are within grid bounds
      const dataExtent = {
        xMin: Math.min(...data.map(d => d[0])),
        xMax: Math.max(...data.map(d => d[0])),
        yMin: Math.min(...data.map(d => d[1])),
        yMax: Math.max(...data.map(d => d[1]))
      };

      console.log('🔍 Data extent vs Grid bounds:', {
        dataExtent,
        gridBounds: bounds,
        dataWithinGrid: {
          xMin: dataExtent.xMin >= bounds.x_min,
          xMax: dataExtent.xMax <= bounds.x_max,
          yMin: dataExtent.yMin >= bounds.y_min,
          yMax: dataExtent.yMax <= bounds.y_max
        }
      });

      // STRICTLY require exact bin edges from backend - NO FALLBACKS ALLOWED
      const hasExactBins = anomalyResults.grid_info &&
        anomalyResults.grid_info.x_bins &&
        anomalyResults.grid_info.y_bins &&
        Array.isArray(anomalyResults.grid_info.x_bins) &&
        Array.isArray(anomalyResults.grid_info.y_bins) &&
        anomalyResults.grid_info.x_bins.length === xGridSize + 1 &&
        anomalyResults.grid_info.y_bins.length === yGridSize + 1;

      if (!hasExactBins) {
        console.error('❌ CRITICAL: Backend bin edges missing or invalid - cannot render grid');
        console.error('Expected bin arrays of length X:', xGridSize + 1, 'Y:', yGridSize + 1, 'but got:', {
          x_bins_length: anomalyResults.grid_info?.x_bins?.length,
          y_bins_length: anomalyResults.grid_info?.y_bins?.length,
          grid_info: anomalyResults.grid_info
        });
        return; // STOP - no fallback rendering allowed
      }

      // Store backend bin edges (guaranteed valid)
      const xBins = anomalyResults.grid_info.x_bins;
      const yBins = anomalyResults.grid_info.y_bins;

      console.log('✅ Using STRICTLY backend bin edges:', {
        x_bins_length: xBins.length,
        y_bins_length: yBins.length,
        x_range: [xBins[0], xBins[xBins.length - 1]],
        y_range: [yBins[0], yBins[yBins.length - 1]]
      });

      // Verify alignment by testing sample points with backend logic
      const samplePoints = data.slice(0, 3);
      console.log('🔍 Frontend-Backend alignment verification:');
      samplePoints.forEach((point, idx) => {
        const [x, y] = point;

        // Use EXACT same logic as backend: np.digitize equivalent
        // np.digitize(x, bins) returns the index of the bin that x belongs to
        // Backend uses: x_idx = np.digitize(point[0], x_bins) - 1

        // Find the bin index (equivalent to np.digitize)
        let x_digitize_idx = 0;
        for (let i = 0; i < xBins.length; i++) {
          if (x < xBins[i]) {
            x_digitize_idx = i;
            break;
          }
          x_digitize_idx = i + 1;
        }
        let y_digitize_idx = 0;
        for (let j = 0; j < yBins.length; j++) {
          if (y < yBins[j]) {
            y_digitize_idx = j;
            break;
          }
          y_digitize_idx = j + 1;
        }

        // Apply backend logic: subtract 1 and clamp
        let cellX = x_digitize_idx - 1;
        let cellY = y_digitize_idx - 1;

        // Clamp to valid range (same as backend)
        cellX = Math.max(0, Math.min(cellX, xGridSize - 1));
        cellY = Math.max(0, Math.min(cellY, yGridSize - 1));

        console.log(`📍 Point ${idx} (${x.toFixed(3)}, ${y.toFixed(3)}) -> Cell[${cellX}][${cellY}]`);

        // Verify this matches backend logic
        const cellBounds = {
          xMin: xBins[cellX],
          xMax: xBins[cellX + 1],
          yMin: yBins[cellY],
          yMax: yBins[cellY + 1]
        };
        const withinBounds = (x >= cellBounds.xMin && x < cellBounds.xMax &&
          y >= cellBounds.yMin && y < cellBounds.yMax);
        console.log(`   Cell bounds: [${cellBounds.xMin.toFixed(3)}, ${cellBounds.xMax.toFixed(3)}] x [${cellBounds.yMin.toFixed(3)}, ${cellBounds.yMax.toFixed(3)}]`);
        console.log(`   Point within cell: ${withinBounds}`);
      });

      if (bounds && bounds.x_min !== undefined && bounds.x_max !== undefined && bounds.y_min !== undefined && bounds.y_max !== undefined) {


        // First, draw all grid cells (including non-anomalous ones for context)
        for (let i = 0; i < xGridSize; i++) {
          for (let j = 0; j < yGridSize; j++) {
            const cellId = `${i},${j}`;
            const isAnomalous = anomalousCells.has(cellId);

            // Use ONLY backend bin edges - NO FALLBACKS
            const cellX = xBins[i];
            const cellXEnd = xBins[i + 1];
            const cellY = yBins[j];
            const cellYEnd = yBins[j + 1];

            // Debug first few cells to verify backend alignment
            if (i < 2 && j < 2) {
              console.log(`🎯 Cell[${i}][${j}] backend bounds:`, {
                cellX, cellXEnd, cellY, cellYEnd,
                width: cellXEnd - cellX,
                height: cellYEnd - cellY,
                screenX: xScale(cellX),
                screenXEnd: xScale(cellXEnd),
                screenY: yScale(cellY),
                screenYEnd: yScale(cellYEnd)
              });
            }

            // Convert to screen coordinates (handle inverted Y-axis)
            const screenX1 = xScale(cellX);
            const screenX2 = xScale(cellXEnd);
            const screenY1 = yScale(cellY);
            const screenY2 = yScale(cellYEnd);
            const rectX = Math.min(screenX1, screenX2);
            const rectY = Math.min(screenY1, screenY2);
            const rectWidth = Math.abs(screenX2 - screenX1);
            const rectHeight = Math.abs(screenY2 - screenY1);

            // Draw grid cell background (subtle for all cells) if grid is enabled
            if (true) {
              const cellRect = gridLayer.append("rect")
                .attr("class", isAnomalous ? "anomaly-grid-cell" : "normal-grid-cell")
                .attr("x", rectX)
                .attr("y", rectY)
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("fill", isAnomalous ?
                  (anomalyResults.cell_anomalies.find(a => a.cell_x === i && a.cell_y === j)?.test_type === 'real_overpopulation' ?
                    "rgba(220, 38, 38, 0.2)" : "rgba(59, 130, 246, 0.2)") : // Red for real overpopulation, blue for synthetic overpopulation
                  "rgba(100, 100, 100, 0.01)") // Very subtle fill for normal cells
                .attr("stroke", isAnomalous ?
                  (anomalyResults.cell_anomalies.find(a => a.cell_x === i && a.cell_y === j)?.test_type === 'real_overpopulation' ?
                    "rgba(220, 38, 38, 0.9)" : "rgba(59, 130, 246, 0.9)") : // Red for real overpopulation, blue for synthetic overpopulation
                  "rgba(150, 150, 150, 0.3)") // More visible border for normal cells to see alignment
                .attr("stroke-width", isAnomalous ? 2.5 : 0.5)
                // Enable pointer events only for anomalous cells to show tooltips
                .style("pointer-events", isAnomalous ? "all" : "none")
                .style("cursor", isAnomalous ? "pointer" : "default");

              // Add tooltips and click handlers to anomalous cells
              if (isAnomalous) {
                const cellData = anomalyResults.cell_anomalies.find(
                  anomaly => anomaly.cell_x === i && anomaly.cell_y === j
                );

                if (cellData) {
                  cellRect
                    .on("mouseover", function (event) {
                      const tooltipContent = createAnomalyTooltip(cellData, i, j);

                      // Create tooltip
                      const tooltip = d3.select("body")
                        .append("div")
                        .attr("class", "anomaly-cell-tooltip")
                        .style("position", "absolute")
                        .style("background", "rgba(0, 0, 0, 0.9)")
                        .style("color", "white")
                        .style("padding", "10px")
                        .style("border-radius", "5px")
                        .style("font-size", "12px")
                        .style("font-family", "monospace")
                        .style("white-space", "pre-line")
                        .style("z-index", "1000")
                        .style("pointer-events", "none")
                        .style("max-width", "300px")
                        .style("box-shadow", "0 2px 10px rgba(0,0,0,0.3)")
                        .html(tooltipContent);

                      // Position tooltip
                      const tooltipWidth = tooltip.node().getBoundingClientRect().width;
                      const tooltipHeight = tooltip.node().getBoundingClientRect().height;
                      const mouseX = event.pageX;
                      const mouseY = event.pageY;

                      let tooltipX = mouseX + 10;
                      let tooltipY = mouseY + 10;

                      // Adjust if tooltip would go off screen
                      if (tooltipX + tooltipWidth > window.innerWidth) {
                        tooltipX = mouseX - tooltipWidth - 10;
                      }
                      if (tooltipY + tooltipHeight > window.innerHeight) {
                        tooltipY = mouseY - tooltipHeight - 10;
                      }

                      tooltip
                        .style("left", tooltipX + "px")
                        .style("top", tooltipY + "px");
                    })
                    .on("mouseout", function () {
                      d3.select("body").selectAll(".anomaly-cell-tooltip").remove();
                    })
                    .on("click", function () {
                      // Remove tooltip on click
                      d3.select("body").selectAll(".anomaly-cell-tooltip").remove();
                      // Handle the click to generate distribution plot
                      handleAnomalyCellClick(cellData, i, j);
                    });
                }
              }
            }

            if (isAnomalous) {
              // Find cell data
              const cellData = anomalyResults.cell_anomalies.find(
                anomaly => anomaly.cell_x === i && anomaly.cell_y === j
              );

              // Calculate center based on actual data points in this cell
              const actualCellWidth = cellXEnd - cellX;
              const actualCellHeight = cellYEnd - cellY;

              // Find data points that fall within this grid cell
              // Use the EXACT same data that was sent to backend (user-selected data from sidebar)
              // This ensures perfect consistency between visual count and backend count
              const cellPoints = data.filter(point => {
                const pointX = point[0];
                const pointY = point[1];
                return pointX >= cellX && pointX < cellXEnd &&
                  pointY >= cellY && pointY < cellYEnd;
              });

              // Verify point count accuracy
              const frontendCount = cellPoints.length;
              const backendRealCount = cellData?.real_count || 0;
              const backendSynthCount = cellData?.synthetic_count || 0;
              const backendTotalCount = backendRealCount + backendSynthCount;

              console.log(`🔍 Cell (${i},${j}) Point Count Verification (USING USER-SELECTED DATA):`, {
                frontendTotal: frontendCount,
                backendReal: backendRealCount,
                backendSynth: backendSynthCount,
                backendTotal: backendTotalCount,
                match: frontendCount === backendTotalCount,
                cellBounds: { cellX, cellY, cellXEnd, cellYEnd },
                samplePoints: cellPoints.slice(0, 3), // Show first 3 points for verification
                note: 'Using exact data user selected in sidebar - perfect consistency'
              });

              // Calculate precise circle based on actual data points
              let centerDataX = cellX + actualCellWidth / 2; // Default to cell center
              let centerDataY = cellY + actualCellHeight / 2; // Default to cell center
              let circleRadius;

              if (cellPoints.length > 0) {
                // Use centroid of actual points
                centerDataX = cellPoints.reduce((sum, point) => sum + point[0], 0) / cellPoints.length;
                centerDataY = cellPoints.reduce((sum, point) => sum + point[1], 0) / cellPoints.length;

                // Calculate radius to encompass all points with some padding
                const distances = cellPoints.map(point => {
                  const dx = point[0] - centerDataX;
                  const dy = point[1] - centerDataY;
                  return Math.sqrt(dx * dx + dy * dy);
                });

                const maxDistance = Math.max(...distances);
                const minVisibleRadius = Math.abs(actualCellWidth) / 8; // Minimum visible size
                const paddingFactor = 1.2; // 20% padding around the furthest point

                // Radius in data coordinates
                const radiusData = Math.max(maxDistance * paddingFactor, minVisibleRadius);

                // Calculate radius in screen coordinates
                const radiusPoint1 = xScale(centerDataX + radiusData);
                const radiusPoint2 = xScale(centerDataX);
                const calculatedRadius = Math.abs(radiusPoint1 - radiusPoint2);

                // Ensure minimum visible radius (especially for single points)
                const minScreenRadius = 8; // Minimum 8 pixels
                circleRadius = Math.max(calculatedRadius, minScreenRadius);

                console.log(`🎯 Dynamic Circle for Cell (${i},${j}):`, {
                  pointCount: cellPoints.length,
                  center: { x: centerDataX, y: centerDataY },
                  maxPointDistance: maxDistance.toFixed(3),
                  radiusData: radiusData.toFixed(3),
                  calculatedScreenRadius: calculatedRadius.toFixed(1),
                  finalScreenRadius: circleRadius.toFixed(1),
                  minVisibleRadius: minVisibleRadius.toFixed(3),
                  paddingFactor: paddingFactor
                });
              } else {
                // Fallback if no points found (shouldn't happen for anomalies)
                // centerDataX and centerDataY already set to cell center defaults
                circleRadius = 12;

                console.log(`⚠️ Fallback Circle for Cell (${i},${j}): No points found in anomalous cell!`);
              }

              // Convert center to screen coordinates
              const centerX = xScale(centerDataX);
              const centerY = yScale(centerDataY);

              console.log(`🔵 Drawing cell (${i}, ${j}):`, {
                cellX, cellY, cellXEnd, cellYEnd,
                centerDataX, centerDataY,
                centerX, centerY,
                dynamicRadius: circleRadius,
                severity: cellData?.severity
              });

              // Verify circle encompasses points
              console.log(`🔍 Circle Coverage Analysis for Cell (${i},${j}):`, {
                circleCenter: { x: centerDataX, y: centerDataY },
                circleRadiusScreen: circleRadius,
                cellBounds: {
                  left: cellX,
                  right: cellXEnd,
                  top: cellY,
                  bottom: cellYEnd
                },
                pointsInCell: frontendCount,
                expectedPoints: backendTotalCount,
                usingExactBins: hasExactBins,
                actualDimensions: { width: actualCellWidth, height: actualCellHeight },
                preciseSizing: true
              });

              // Circle drawing removed - using colored grid cells instead
            }
          }
        }
      } else {
        console.warn('🔵 No valid bounds found in grid info:', bounds);
        console.warn('🔵 Grid info structure:', anomalyResults.grid_info);
      }

      // Provide grid hover information without enabling pointer events on grid cells
      // We compute the hovered cell from mouse position and backend bin edges
      const ensureGridTooltip = () => {
        let tip = d3.select('body').select('.grid-cell-tooltip');
        if (tip.empty()) {
          tip = d3.select('body')
            .append('div')
            .attr('class', 'grid-cell-tooltip')
            .style('position', 'fixed')
            .style('background', 'rgba(0,0,0,0.9)')
            .style('color', 'white')
            .style('border', '1px solid #555')
            .style('border-radius', '4px')
            .style('padding', '6px 8px')
            .style('font-size', '11px')
            .style('font-family', 'Arial, sans-serif')
            .style('pointer-events', 'none')
            .style('z-index', '9999')
            .style('box-shadow', '0 2px 6px rgba(0,0,0,0.3)')
            .style('visibility', 'hidden');
        }
        return tip;
      };

      const svgRootForHover = d3.select(svgRef.current);
      svgRootForHover.on('mousemove.gridHover', null).on('mouseleave.gridHover', null);
      svgRootForHover
        .on('mousemove.gridHover', function (event) {
          // If hovering a point, prefer point tooltip
          const target = event.target;
          if (target && target.tagName && target.tagName.toLowerCase() === 'circle') {
            d3.select('body').select('.grid-cell-tooltip').style('visibility', 'hidden');
            return;
          }

          const tip = ensureGridTooltip();
          const [mx, my] = d3.pointer(event, g.node());
          const dataX = xScale.invert(mx);
          const dataY = yScale.invert(my);
          if (Number.isNaN(dataX) || Number.isNaN(dataY)) {
            tip.style('visibility', 'hidden');
            return;
          }

          // Determine cell indices using strict backend bin edges
          let cellXIdx = -1;
          let cellYIdx = -1;
          for (let i = 0; i < xBins.length - 1; i++) {
            if (dataX >= xBins[i] && dataX < xBins[i + 1]) { cellXIdx = i; break; }
          }
          for (let j = 0; j < yBins.length - 1; j++) {
            if (dataY >= yBins[j] && dataY < yBins[j + 1]) { cellYIdx = j; break; }
          }

          if (cellXIdx < 0 || cellYIdx < 0) {
            tip.style('visibility', 'hidden');
            return;
          }

          const cellData = anomalyResults.cell_anomalies?.find(a => a.cell_x === cellXIdx && a.cell_y === cellYIdx);
          if (!cellData) {
            tip.style('visibility', 'hidden');
            return;
          }

          // Skip showing grid tooltip for anomalous cells since they have their own detailed tooltip
          if (cellData.is_significant) {
            tip.style('visibility', 'hidden');
            return;
          }

          const fmt = (v) => {
            if (v === null || v === undefined) return 'N/A';
            if (typeof v === 'number' && isFinite(v)) return v.toFixed(2);
            if (v === 'Infinity') return '∞';
            if (v === '-Infinity') return '-∞';
            return String(v);
          };

          const html = `Cell (${cellXIdx},${cellYIdx})<br/>Real: ${cellData.real_count || 0} • Synthetic: ${cellData.synthetic_count || 0}<br/>P-Value: ${fmt(cellData.p_value_adjusted)} • ${cellData.test_type === 'real_overpopulation' ? 'Real overpopulation' : 'Synthetic overpopulation'}<br/>Significant: ${cellData.is_significant ? 'Yes' : 'No'}`;
          tip.html(html)
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY + 12) + 'px')
            .style('visibility', 'visible');
        })
        .on('mouseleave.gridHover', function () {
          d3.select('body').select('.grid-cell-tooltip').style('visibility', 'hidden');
        });
    } else {
      console.log('🔵 Not drawing grid overlay:', {
        showAnomalies,
        hasAnomalyResults: !!anomalyResults,
        hasCellAnomalies: !!(anomalyResults && anomalyResults.cell_anomalies)
      });
    }

    // Add data points with anomaly detection - clamp coordinates to prevent overshooting
    const points = pointsLayer.selectAll("circle")
      .data(sampledData)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => {
        const x = xScale(d[0]);
        // DEBUG: Log first few points to verify alignment with grid
        if (i < 3) {
          console.log(`🔴 Point ${i} data coords: (${d[0].toFixed(3)}, ${d[1].toFixed(3)})`);
          console.log(`🔴 Point ${i} screen coords: (${x.toFixed(1)}, ${yScale(d[1]).toFixed(1)})`);
        }
        // Clamp x coordinate to prevent overshooting
        return Math.max(0, Math.min(innerWidth, x));
      })
      .attr("cy", (d, i) => {
        const y = yScale(d[1]);
        // Clamp y coordinate to prevent overshooting
        return Math.max(0, Math.min(innerHeight, y));
      })
      .attr("r", (d, i) => {
        const originalIndex = indexMap[i];
        const label = sampledLabels[i];

        // Early return if anomalyResults is null to prevent errors
        if (label === 'Synthetic' && (!anomalyResults || !anomalyResults.synthetic_data)) {
          return adjustedPointSize; // Default size for synthetic without anomaly data
        }

        // Make anomalies larger and more visible
        if (showAnomalies && anomalyResults && anomalyResults.synthetic_data && label === 'Synthetic') {
          const originalData = getOriginalData();
          if (originalData) {
            let syntheticIndexInOriginal = 0;
            for (let j = 0; j < originalIndex; j++) {
              if (originalData.labels[j] === 'Synthetic') {
                syntheticIndexInOriginal++;
              }
            }

            if (anomalyResults && anomalyResults.synthetic_data && syntheticIndexInOriginal < anomalyResults.synthetic_data.length) {
              const anomalyPoint = anomalyResults.synthetic_data[syntheticIndexInOriginal];
              if (anomalyPoint && anomalyPoint.is_anomaly) {
                return Math.min(adjustedPointSize * 1.3, 4);
              }
            }
          }
        }

        return adjustedPointSize; // Default size
      })
      .attr("fill", (d, i) => {
        const label = sampledLabels[i];

        // Simple color coding: real vs synthetic data
        if (label === 'Real') {
          return "#3b82f6"; // Blue for real data
        } else {
          return "#dc2626"; // Red for synthetic data
        }
      })
      .attr("stroke", (_, i) => {
        const originalIndex = indexMap[i];
        return selectedPoints.includes(originalIndex) ? "#000" : "rgba(0,0,0,0.1)";
      })
      .attr("stroke-width", (_, i) => {
        const originalIndex = indexMap[i];
        return selectedPoints.includes(originalIndex) ? 1.5 : 0.3;
      })
      .attr("opacity", (_, i) => {
        const originalIndex = indexMap[i];
        return selectedPoints.includes(originalIndex) ? 1.0 : pointOpacity;
      })
      // Add interactive hover effects
      .style("cursor", "pointer")
      .on("mouseover", function (event, d, i) {
        const originalIndex = indexMap[i];
        const label = sampledLabels[i];

        // Create tooltip content
        let tooltipContent = `<strong>${label} Data Point</strong><br/>`;
        tooltipContent += `Index: ${originalIndex}<br/>`;
        tooltipContent += `Coordinates: (${d[0].toFixed(3)}, ${d[1].toFixed(3)})<br/>`;

        // Add grid-based anomaly information if available
        if (showAnomalies && anomalyResults && anomalyResults.cell_anomalies) {
          // Find which grid cell this point belongs to using histogram bins
          const xBins = anomalyResults.grid_info?.x_bins;
          const yBins = anomalyResults.grid_info?.y_bins;
          const xGridSize = anomalyResults.grid_info?.x_grid_size || 20;
          const yGridSize = anomalyResults.grid_info?.y_grid_size || 20;

          if (xBins && yBins) {
            // Use np.digitize equivalent logic (same as backend)
            let x_digitize_idx = 0;
            for (let i = 0; i < xBins.length; i++) {
              if (d[0] < xBins[i]) {
                x_digitize_idx = i;
                break;
              }
              x_digitize_idx = i + 1;
            }
            let y_digitize_idx = 0;
            for (let j = 0; j < yBins.length; j++) {
              if (d[1] < yBins[j]) {
                y_digitize_idx = j;
                break;
              }
              y_digitize_idx = j + 1;
            }

            // Apply backend logic: subtract 1 and clamp
            const cellX = Math.max(0, Math.min(x_digitize_idx - 1, xGridSize - 1));
            const cellY = Math.max(0, Math.min(y_digitize_idx - 1, yGridSize - 1));

            // Find if this cell is anomalous
            const cellData = anomalyResults.cell_anomalies.find(
              anomaly => anomaly.cell_x === cellX && anomaly.cell_y === cellY
            );

            if (cellData) {
              tooltipContent += `<br/><strong>Grid Cell (${cellX}, ${cellY})</strong><br/>`;
              tooltipContent += `Real Points: ${cellData.real_count}<br/>`;
              tooltipContent += `Synthetic Points: ${cellData.synthetic_count}<br/>`;
              tooltipContent += `Real Ratio: ${(cellData.real_ratio * 100).toFixed(1)}%<br/>`;
              tooltipContent += `Expected Ratio: ${(cellData.expected_ratio * 100).toFixed(1)}%<br/>`;
              tooltipContent += `Deviation: ${(cellData.deviation * 100).toFixed(1)}%<br/>`;
              tooltipContent += `Severity: ${cellData.severity}<br/>`;
            }
          }
        }

        // Show tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.9)")
          .style("color", "white")
          .style("padding", "8px 12px")
          .style("border-radius", "6px")
          .style("font-size", "12px")
          .style("font-family", "system-ui, -apple-system, sans-serif")
          .style("pointer-events", "auto") // Allow interaction with tooltip
          .style("z-index", "1000")
          .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)")
          .style("max-width", "250px")
          .style("white-space", "nowrap")
          .html(`
            <div style="font-weight: bold; margin-bottom: 6px; color: ${label === 'Real' ? '#3b82f6' : '#dc2626'};">
              ${label} Data Point
            </div>
            <div style="margin-bottom: 4px;">Index: ${originalIndex}</div>
            <div style="margin-bottom: 4px;">Coordinates: (${d[0].toFixed(3)}, ${d[1].toFixed(3)})</div>
            ${showAnomalies && anomalyResults ? `
              <div style="margin-bottom: 6px; padding: 4px; background: rgba(255,255,255,0.1); border-radius: 3px;">
                ${getAnomalyInfo(originalIndex, label)}
              </div>
            ` : ''}
            <div style="margin-top: 8px; display: flex; gap: 4px;">
              <button id="select-point-btn" style="
                background: ${selectedPoints.includes(originalIndex) ? '#ef4444' : '#dc2626'};
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
                font-family: inherit;
              ">${selectedPoints.includes(originalIndex) ? 'Deselect' : 'Select'}</button>
              <button id="select-similar-btn" style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
                font-family: inherit;
              ">Select Similar</button>
            </div>
          `);

        // Add event listeners to tooltip buttons
        tooltip.select("#select-point-btn").on("click", function () {
          if (selectedPoints.includes(originalIndex)) {
            setSelectedPoints(prev => prev.filter(idx => idx !== originalIndex));
          } else {
            setSelectedPoints(prev => [...prev, originalIndex]);
          }
          tooltip.remove();
        });

        tooltip.select("#select-similar-btn").on("click", function () {
          // Select all points of the same type (Real/Synthetic)
          const similarPoints = sampledData
            .map((_, i) => ({ index: indexMap[i], label: sampledLabels[i] }))
            .filter(point => point.label === label)
            .map(point => point.index);

          setSelectedPoints(prev => {
            const newSelection = [...prev];
            similarPoints.forEach(idx => {
              if (!newSelection.includes(idx)) {
                newSelection.push(idx);
              }
            });
            return newSelection;
          });
          tooltip.remove();
        });
      })
      .on("mouseout", function () {
        // Remove tooltip
        d3.selectAll(".tooltip").remove();

        // Restore original appearance
        d3.select(this)
          .transition()
          .duration(150)
          .attr("r", d => {
            const originalIndex = indexMap[sampledData.indexOf(d)];
            const label = sampledLabels[sampledData.indexOf(d)];

            // Restore original size logic
            if (label === 'Synthetic' && (!anomalyResults || !anomalyResults.synthetic_data)) {
              return adjustedPointSize;
            }

            if (showAnomalies && anomalyResults && anomalyResults.synthetic_data && label === 'Synthetic') {
              const originalData = getOriginalData();
              if (originalData) {
                let syntheticIndexInOriginal = 0;
                for (let j = 0; j < originalIndex; j++) {
                  if (originalData.labels[j] === 'Synthetic') {
                    syntheticIndexInOriginal++;
                  }
                }

                if (anomalyResults && anomalyResults.synthetic_data && syntheticIndexInOriginal < anomalyResults.synthetic_data.length) {
                  const anomalyPoint = anomalyResults.synthetic_data[syntheticIndexInOriginal];
                  if (anomalyPoint && anomalyPoint.is_anomaly) {
                    return Math.min(adjustedPointSize * 1.3, 4);
                  }
                }
              }
            }

            return adjustedPointSize;
          })
          .style("opacity", d => {
            const originalIndex = indexMap[sampledData.indexOf(d)];
            return selectedPoints.includes(originalIndex) ? 1 : adjustedOpacity;
          })
          .style("stroke-width", d => {
            const originalIndex = indexMap[sampledData.indexOf(d)];
            const label = sampledLabels[sampledData.indexOf(d)];

            // Restore original stroke width logic
            if (showAnomalies && anomalyResults && (anomalyResults.real_data || anomalyResults.synthetic_data)) {
              const originalData = getOriginalData();
              if (originalData) {
                if (label === 'Real') {
                  let realIndexInOriginal = 0;
                  for (let j = 0; j < originalIndex; j++) {
                    if (originalData.labels[j] === 'Real') {
                      realIndexInOriginal++;
                    }
                  }

                  if (anomalyResults.real_data && realIndexInOriginal < anomalyResults.real_data.length) {
                    const realPoint = anomalyResults.real_data[realIndexInOriginal];
                    if (realPoint && realPoint.is_anomaly) {
                      return 1.5 * devicePixelRatio;
                    }
                  }
                } else if (label === 'Synthetic') {
                  let syntheticIndexInOriginal = 0;
                  for (let j = 0; j < originalIndex; j++) {
                    if (originalData.labels[j] === 'Synthetic') {
                      syntheticIndexInOriginal++;
                    }
                  }

                  if (anomalyResults.synthetic_data && syntheticIndexInOriginal < anomalyResults.synthetic_data.length) {
                    const syntheticPoint = anomalyResults.synthetic_data[syntheticIndexInOriginal];
                    if (syntheticPoint && syntheticPoint.is_anomaly) {
                      return 1.5 * devicePixelRatio; // Thicker stroke for synthetic anomalies
                    }
                  }
                }
              }
            }

            return selectedPoints.includes(originalIndex) ? 2 * devicePixelRatio : 0.5 * devicePixelRatio;
          });
      });

    // Lasso selection logic only
    let isDrawing = false;
    let hasDragged = false;
    let lassoPath = null;
    let lassoPoints = [];
    const lassoMinDistance = 2; // pixels between successive lasso points

    // Point-in-polygon test (ray casting) for lasso selection
    const pointInPolygon = (x, y, polygon) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    // Add background rectangle for reliable event handling
    const background = g.append("rect")
      .attr("class", "selection-background")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", scaledPlotWidth - margin.left - margin.right)
      .attr("height", scaledPlotHeight - margin.top - margin.bottom)
      .style("fill", "transparent")
      .style("cursor", "crosshair")
      // Keep background passive so point hover/clicks are not blocked
      .style("pointer-events", "none");

    console.log('🔍 Background pointer-events:', "none", { showAnomalies, hasAnomalyResults: !!anomalyResults });

    // Attach selection handlers to the SVG root so they work alongside point/tooltips
    const svgRoot = d3.select(svgRef.current);
    svgRoot.on("mousedown.selection", null).on("mousemove.selection", null).on("mouseup.selection", null);
    svgRoot
      .on("mousedown.selection", function (event) {
        // Start selection only when not clicking a point
        if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'circle') return;
        event.preventDefault();
        isDrawing = true;
        hasDragged = false;
        // Lasso start
        lassoPoints = [];
        const p = d3.pointer(event, g.node());
        lassoPoints.push(p);
        lassoPath = g.append('path')
          .attr('class', 'lasso-path')
          .attr('d', `M ${p[0]},${p[1]}`)
          .style('fill', 'rgba(37, 99, 235, 0.1)')
          .style('stroke', '#2563eb')
          .style('stroke-width', '2px')
          .style('stroke-dasharray', '5,5')
          .style('pointer-events', 'none');
      })
      .on("mousemove.selection", function (event) {
        if (!isDrawing) return;
        const currentPoint = d3.pointer(event, g.node());
        // Lasso drawing
        const last = lassoPoints[lassoPoints.length - 1];
        const dx = currentPoint[0] - last[0];
        const dy = currentPoint[1] - last[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > lassoMinDistance) {
          hasDragged = true;
          lassoPoints.push(currentPoint);
          const d = ['M', lassoPoints[0][0], lassoPoints[0][1], ...lassoPoints.slice(1).flatMap(p => ['L', p[0], p[1]])].join(' ');
          lassoPath.attr('d', d);
        }
      })
      .on("mouseup.selection", function (event) {
        if (!isDrawing) return;
        event.preventDefault();
        // Lasso finalize
        if (hasDragged && lassoPath && lassoPoints.length > 2) {
          // Close polygon visually
          const closed = [...lassoPoints, lassoPoints[0]];
          const d = ['M', closed[0][0], closed[0][1], ...closed.slice(1).flatMap(p => ['L', p[0], p[1]]), 'Z'].join(' ');
          lassoPath.attr('d', d);

          const selected = [];
          points.each(function (dpt, i) {
            const cx = xScale(dpt[0]);
            const cy = yScale(dpt[1]);
            if (pointInPolygon(cx, cy, lassoPoints)) {
              selected.push(indexMap[i]);
            }
          });
          setSelectedPoints(selected);
          lassoPath.remove();
        } else if (lassoPath) {
          // Not enough movement; cancel lasso
          lassoPath.remove();
        }
        isDrawing = false;
        hasDragged = false;
        lassoPoints = [];
        lassoPath = null;
      });

    // Create tooltip
    let tooltip = d3.select("body").select(".embedding-tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body")
        .append("div")
        .attr("class", "embedding-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.2)");
    }

    // Enhanced hover effects
    points
      .on("mouseover", function (event, d, i) {
        const originalIndex = indexMap[i];
        const dataType = sampledLabels[i];

        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", Math.min(adjustedPointSize * 1.8, 4))
          .attr("opacity", 0.9)
          .attr("stroke-width", Math.min(2, 3));

        tooltip
          .style("visibility", "visible")
          .html(`
            <div style="font-weight: bold; margin-bottom: 4px; color: ${dataType === 'Real' ? '#4682b4' : '#e74c3c'};">
              ${dataType} Data Point
            </div>
            <div>Index: ${originalIndex}</div>
            <div>Coordinates: (${d[0].toFixed(3)}, ${d[1].toFixed(3)})</div>
            <div style="margin-top: 4px; font-size: 10px; opacity: 0.8;">
              Click to select • ${(metadata?.method || 'Embedding').toUpperCase()} embedding
            </div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function (event, d, i) {
        const originalIndex = indexMap[i];
        const isSelected = selectedPoints.includes(originalIndex);

        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", adjustedPointSize)
          .attr("opacity", isSelected ? 1 : adjustedOpacity)
          .attr("stroke-width", isSelected ? 2 : 0.5);

        tooltip.style("visibility", "hidden");
      })
      .on("click", function (event, d, i) {
        // Don't handle click if we just finished a drag selection
        if (hasDragged) return;

        event.stopPropagation();
        const originalIndex = indexMap[i];



        if (selectedPoints.includes(originalIndex)) {
          setSelectedPoints(prev => prev.filter(idx => idx !== originalIndex));
        } else {
          setSelectedPoints(prev => [...prev, originalIndex]);
        }
      });

    // Responsive legend positioning - float inside plot area (top-right) without consuming margins
    const showAnomalyLegend = showAnomalies && anomalyResults && anomalyResults.synthetic_data;

    // Create legend group inside the scaled plotting group so coordinates are in innerWidth/innerHeight
    const legend = g.append("g")
      .attr("class", "floating-legend")
      .style("pointer-events", "none"); // don't block plot interactions

    // Background for readability (added first; sized after content via bbox)
    const legendBg = legend.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", "none")
      .attr("stroke", "none");


    // Removed count-based legend details for a minimal legend

    // Show different legend based on anomaly display
    if (showAnomalyLegend) {
      // Real data
      const realLegendRow = legend.append("g")
        .attr("transform", `translate(0, 0)`);

      realLegendRow.append("circle")
        .attr("cx", 8)
        .attr("cy", 0)
        .attr("r", Math.max(2.5, adjustedPointSize * 1.2))
        .attr("fill", colorScale("Real")) // Use same color as data points
        .attr("stroke", d3.color(colorScale("Real")).darker(0.3))
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.85);

      realLegendRow.append("text")
        .attr("x", 20)
        .attr("y", 4)
        .text(`Real`)
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#374151");

      // Normal synthetic data
      const normalLegendRow = legend.append("g")
        .attr("transform", `translate(0, 16)`);

      normalLegendRow.append("circle")
        .attr("cx", 8)
        .attr("cy", 0)
        .attr("r", Math.max(2.5, adjustedPointSize * 1.2))
        .attr("fill", colorScale("Synthetic")) // Use same color as data points
        .attr("stroke", d3.color(colorScale("Synthetic")).darker(0.3))
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.85);

      normalLegendRow.append("text")
        .attr("x", 20)
        .attr("y", 4)
        .text(`Synthetic`)
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#374151");


    } else {
      // Standard legend
      ["Real", "Synthetic"].forEach((label, i) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(0, ${i * 16})`);

        legendRow.append("circle")
          .attr("cx", 8)
          .attr("cy", 0)
          .attr("r", Math.max(2.5, adjustedPointSize * 1.2))
          .attr("fill", colorScale(label))
          .attr("stroke", d3.color(colorScale(label)).darker(0.3))
          .attr("stroke-width", 0.5)
          .attr("opacity", 0.85);

        legendRow.append("text")
          .attr("x", 20)
          .attr("y", 4)
          .text(`${label}`)
          .style("font-size", "11px")
          .style("font-weight", "500")
          .style("font-family", "system-ui, -apple-system, sans-serif")
          .style("fill", "#374151");
      });
    }

  // Position legend automatically in the least-dense corner
  const padding = { x: 0, y: 0 };
    const legendNode = legend.node();
    if (legendNode) {
      const bbox = legendNode.getBBox();
      const legendWidth = bbox.width + padding.x * 2;
      const legendHeight = bbox.height + padding.y * 2;

      // Move content by padding
      legend.selectAll("g").attr("transform", function () {
        const t = d3.select(this).attr("transform") || "translate(0,0)";
        const match = /translate\(([^,]+),\s*([^\)]+)\)/.exec(t);
        const x = match ? parseFloat(match[1]) + padding.x : padding.x;
        const y = match ? parseFloat(match[2]) + padding.y : padding.y;
        return `translate(${x}, ${y})`;
      });
      legendBg.attr("width", legendWidth).attr("height", legendHeight);

      // Helper to count points in a given rectangle
      const countPointsInRect = (x0, y0, w, h) => {
        let count = 0;
        for (let i = 0; i < sampledData.length; i++) {
          const sx = Math.max(0, Math.min(innerWidth, xScale(sampledData[i][0])));
          const sy = Math.max(0, Math.min(innerHeight, yScale(sampledData[i][1])));
          if (sx >= x0 && sx <= x0 + w && sy >= y0 && sy <= y0 + h) count++;
        }
        return count;
      };

      const offset = 8;
      const candidates = [
        { name: 'tl', x: offset, y: offset },
        { name: 'tr', x: Math.max(0, innerWidth - legendWidth - offset), y: offset },
        { name: 'bl', x: offset, y: Math.max(0, innerHeight - legendHeight - offset) },
        { name: 'br', x: Math.max(0, innerWidth - legendWidth - offset), y: Math.max(0, innerHeight - legendHeight - offset) },
      ];

      // Compute counts and choose the corner with fewest points; break ties preferring top-right
      const counts = candidates.map(c => ({ ...c, count: countPointsInRect(c.x, c.y, legendWidth, legendHeight) }));
      counts.sort((a, b) => a.count - b.count || (a.name === 'tr' ? -1 : b.name === 'tr' ? 1 : 0));
      const best = counts[0];
      legend.attr("transform", `translate(${best.x}, ${best.y})`);
    }

    // Omit downsampling footnote in compact legend to keep it short


  }, [data, metadata, pointSize, pointOpacity, selectedPoints, sidebarWidth, showAnomalies, anomalyResults, getOriginalData, calculatePlotDimensions, sampleData]);

  // Add resize observer to handle container size changes when sidebar appears/disappears
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      // Trigger re-render when container size changes (e.g., when sidebar appears/disappears)
      if (data && metadata && data.length > 0) {
        // Force a small delay to ensure DOM updates are complete
        setTimeout(() => {
          // This will trigger the main useEffect to re-render
        }, 10);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [data, metadata]);

  // API trigger for distribution plot generation
  // Sidebar-removed: distribution plot generation handled externally in RightSidebar

  // Monitor anomaly detection state changes
  useEffect(() => {
    console.log('🔍 Anomaly state changed:', {
      showAnomalies,
      hasAnomalyResults: !!anomalyResults,
      anomalyResultsKeys: anomalyResults ? Object.keys(anomalyResults) : [],
      cellAnomaliesLength: anomalyResults?.cell_anomalies?.length,
      anomalyLoading,
      anomalyError
    });
  }, [showAnomalies, anomalyResults, anomalyLoading, anomalyError]);

  // Anomaly detection functions
  // CRITICAL FIX: Use exact user-selected data for both backend and frontend to ensure consistency
  // This ensures backend, frontend visualization, and cell counting all use the same data
  // that the user selected in the sidebar (e.g., 1000 real + 1000 synthetic = 2000 total)
  const runAnomalyDetection = useCallback(async () => {
    console.log('🔍 Anomaly detection started (using exact user-selected data)');
    console.log('Data:', data);
    console.log('Metadata:', metadata);
    console.log('Data length:', data?.length);
    console.log('Metadata labels:', metadata?.labels);
    console.log('Sample data points:', data?.slice(0, 3));

    if (!data || !metadata || !metadata.labels) {
      console.error('❌ Missing data or metadata');
      setAnomalyError('No embedding data available for anomaly detection');
      return;
    }

    // Use 2D embedding coordinates for grid-based anomaly detection
    console.log('📊 Using 2D embedding coordinates for grid-based anomaly detection');

    // Use the EXACT data that user selected in sidebar (no additional sampling)
    // This ensures backend, frontend visualization, and cell counting all use same data
    const realData = [];
    const syntheticData = [];

    data.forEach((point, index) => {
      if (metadata.labels[index] === 'Real') {
        realData.push([point[0], point[1]]); // 2D coordinates from user-selected data
      } else if (metadata.labels[index] === 'Synthetic') {
        syntheticData.push([point[0], point[1]]); // 2D coordinates from user-selected data
      }
    });

    console.log('📊 Using EXACT user-selected data for consistency:', {
      realDataLength: realData.length,
      syntheticDataLength: syntheticData.length,
      realDataSample: realData.slice(0, 3),
      syntheticDataSample: syntheticData.slice(0, 3),
      totalDataLength: data.length,
      note: 'No additional sampling - using exact data user selected in sidebar'
    });

    // Check if we have enough valid data
    if (realData.length === 0) {
      console.error('❌ No valid real data found');
      setAnomalyError('No valid real data available for anomaly detection');
      return;
    }

    if (syntheticData.length === 0) {
      console.error('❌ No valid synthetic data found');
      setAnomalyError('No valid synthetic data available for anomaly detection');
      return;
    }

    // Validate data types
    const validateNumericData = (data, name) => {
      for (let i = 0; i < Math.min(data.length, 3); i++) {
        for (let j = 0; j < 2; j++) { // Always 2D coordinates
          if (typeof data[i][j] !== 'number' || isNaN(data[i][j])) {
            throw new Error(`${name}[${i}][${j}] must be a number, got ${typeof data[i][j]}: ${data[i][j]}`);
          }
        }
      }
    };

    try {
      validateNumericData(realData, 'realData');
      validateNumericData(syntheticData, 'syntheticData');
    } catch (error) {
      console.error('❌ Data validation failed:', error.message);
      setAnomalyError(`Data validation failed: ${error.message}`);
      return;
    }

    // Validate data
    const validation = anomalyDetectionService.validateData(realData, syntheticData);
    console.log('✅ Validation result:', validation);

    if (!validation.isValid) {
      console.error('❌ Validation failed:', validation.errors);
      setAnomalyError(validation.errors.join(', '));
      return;
    }

    setAnomalyLoading(true);
    setAnomalyError(null);
    console.log('🚀 Starting grid-based anomaly detection with 2D coordinates');

    try {
      const results = await anomalyDetectionService.detectAnomalies(
        realData,
        syntheticData,
        20, // x_bins
        20, // y_bins
        0.05 // fdr_alpha
      );
      console.log('🎉 Grid-based anomaly detection completed:', results);

      // Check if results have the expected structure
      if (results && results.status === 'success' && results.statistics) {
        console.log('🎯 Setting anomaly results:', {
          status: results.status,
          cellAnomaliesLength: results.cell_anomalies?.length,
          cellAnomaliesSample: results.cell_anomalies?.slice(0, 2),
          gridInfo: results.grid_info,
          statistics: results.statistics
        });

        setAnomalyResults(results);
        setShowAnomalies(true); // Automatically show anomalies when detection completes

        // Force a re-render to ensure the grid overlay is drawn
        setTimeout(() => {
          console.log('🔄 Forcing re-render after anomaly detection');
          setAnomalyResults(prev => ({ ...prev, ...results }));
        }, 100);

        console.log('📈 Statistics:', results.statistics);
        console.log('📊 Real data results:', results.real_data?.length || 0);
        console.log('📊 Synthetic data results:', results.synthetic_data?.length || 0);
        console.log('📊 Cell anomalies:', results.cell_anomalies?.length || 0);
      } else {
        console.error('❌ Unexpected response structure:', results);
        setAnomalyError('Unexpected response structure from anomaly detection');
      }
    } catch (error) {
      console.error('❌ Anomaly detection failed:', error);
      const errorMessage = error.message || error.toString() || 'Unknown error occurred';
      setAnomalyError(errorMessage);
    } finally {
      setAnomalyLoading(false);
    }
  }, [data, metadata]);

  const downloadAnomalyCSV = useCallback(async () => {
    console.log('🔽 Download button clicked');
    console.log('Data available:', !!data);
    console.log('Metadata available:', !!metadata);
    console.log('Labels available:', !!(metadata && metadata.labels));

    if (!data || !metadata || !metadata.labels) {
      console.error('❌ Missing required data for CSV download');
      alert('No anomaly detection data available. Please run anomaly detection first.');
      return;
    }

    // Check if we have a job_id in metadata (for history embeddings)
    const jobId = metadata?.job_id;
    if (jobId) {
      console.log('🎯 Downloading CSV using preprocessed data from job:', jobId);

      try {
        const csvResult = await anomalyDetectionService.generateAnomalyCSVFromJob(jobId, 20, 20, 0.05);
        console.log('CSV result from job:', csvResult);
        if (csvResult.status === 'success') {
          anomalyDetectionService.downloadCSV(csvResult.csv_content, csvResult.filename);
          console.log('✅ CSV downloaded successfully from job');
        } else {
          console.error('❌ CSV generation failed:', csvResult);
          alert('Failed to generate CSV. Please try again.');
        }
      } catch (error) {
        console.error('Failed to download CSV from job:', error);
        alert('Failed to download CSV. Please check the console for details.');
      }
      return;
    }

    // Fallback to original method for fresh embeddings (using frontend data)
    console.log('📊 Downloading CSV using frontend data (fallback method)');

    // Get preprocessed original data for anomaly detection
    const originalData = getOriginalData();
    if (!originalData) {
      console.error('❌ No preprocessed original data available for CSV download');
      alert('No original data available for CSV download. Please try running anomaly detection again.');
      return;
    }

    // Separate real and synthetic data from preprocessed original data
    const realData = [];
    const syntheticData = [];

    originalData.data.forEach((row, index) => {
      if (originalData.labels[index] === 'Real') {
        // Convert all values to numbers and filter out invalid data
        const numericRow = row.map(val => {
          // Handle both string and number inputs
          const num = typeof val === 'string' ? parseFloat(val) : Number(val);
          return isNaN(num) ? null : num;
        }).filter(val => val !== null);

        if (numericRow.length > 0) {
          realData.push(numericRow);
        }
      } else if (originalData.labels[index] === 'Synthetic') {
        // Convert all values to numbers and filter out invalid data
        const numericRow = row.map(val => {
          // Handle both string and number inputs
          const num = typeof val === 'string' ? parseFloat(val) : Number(val);
          return isNaN(num) ? null : num;
        }).filter(val => val !== null);

        if (numericRow.length > 0) {
          syntheticData.push(numericRow);
        }
      }
    });

    console.log('Real data points:', realData.length);
    console.log('Synthetic data points:', syntheticData.length);

    // Check if we have enough valid data
    if (realData.length === 0 || syntheticData.length === 0) {
      console.error('❌ No valid numeric data available for CSV download');
      alert('No valid numeric data available for CSV download. Please check your data.');
      return;
    }

    try {
      const csvResult = await anomalyDetectionService.generateAnomalyCSV(realData, syntheticData, 20, 20, 0.05);
      console.log('CSV result from frontend data:', csvResult);
      if (csvResult.status === 'success') {
        anomalyDetectionService.downloadCSV(csvResult.csv_content, csvResult.filename);
        console.log('✅ CSV downloaded successfully from frontend data');
      } else {
        console.error('❌ CSV generation failed:', csvResult);
        alert('Failed to generate CSV. Please try again.');
      }
    } catch (error) {
      console.error('Failed to download CSV:', error);
      alert('Failed to download CSV. Please check the console for details.');
    }
  }, [data, metadata, getOriginalData]);

  // Sidebar-removed: no pending distribution requests to clean up here

  // 🎯 Sidebar always visible
  const shouldShowSidebar = true;

  // Memoized data for performance
  const originalData = useMemo(() => getOriginalData(), [getOriginalData]);
  // Sidebar-removed: histogram data memoization moved to RightSidebar

  // Resizing disabled: remove handlers and listeners

  // Auto-resize logic removed for fixed-size embedding

  // Sidebar collapse is disabled; no toggle function needed

  // New function to handle clicking on anomalous regions
  const handleAnomalyCellClick = useCallback(async (cellData, i, j) => {
    console.log(`🎯 Anomaly cell clicked: (${i}, ${j})`, cellData);

    // Get the grid information to determine cell boundaries
    if (!anomalyResults?.grid_info) {
      console.error('No grid info available for cell click');
      return;
    }

    const gridInfo = anomalyResults.grid_info;
    const cellX = gridInfo.x_bins[i];
    const cellXEnd = gridInfo.x_bins[i + 1];
    const cellY = gridInfo.y_bins[j];
    const cellYEnd = gridInfo.y_bins[j + 1];

    console.log(`🔍 Cell boundaries: X[${cellX}, ${cellXEnd}), Y[${cellY}, ${cellYEnd})`);

    // Find data points that fall within this grid cell
    const cellPoints = data.filter(point => {
      const pointX = point[0];
      const pointY = point[1];
      return pointX >= cellX && pointX < cellXEnd &&
        pointY >= cellY && pointY < cellYEnd;
    });

    console.log(`📊 Found ${cellPoints.length} points in cell (${i}, ${j})`);

    if (cellPoints.length === 0) {
      console.warn('No points found in clicked cell');
      return;
    }

    // Get the indices of these points in the original data
    const originalData = getOriginalData();
    if (!originalData) {
      console.error('No original data available for distribution plot');
      return;
    }

    // Map embedding points back to original data indices
    const selectedRealData = [];
    const selectedSyntheticData = [];

    cellPoints.forEach(embeddingPoint => {
      // Find the index of this point in the embedding data
      const embeddingIndex = data.findIndex(point =>
        point[0] === embeddingPoint[0] && point[1] === embeddingPoint[1]
      );

      if (embeddingIndex >= 0 && embeddingIndex < metadata.labels.length) {
        const pointLabel = metadata.labels[embeddingIndex];

        // Get corresponding original data point
        if (embeddingIndex < originalData.data.length &&
          originalData.labels[embeddingIndex] === pointLabel) {

          const originalDataPoint = originalData.data[embeddingIndex];
          if (originalDataPoint && Array.isArray(originalDataPoint)) {
            if (pointLabel === 'Real') {
              selectedRealData.push(originalDataPoint);
            } else if (pointLabel === 'Synthetic') {
              selectedSyntheticData.push(originalDataPoint);
            }
          }
        }
      }
    });

    console.log(`📈 Selected data for distribution plot: ${selectedRealData.length} real, ${selectedSyntheticData.length} synthetic`);

    if (selectedRealData.length === 0 && selectedSyntheticData.length === 0) {
      console.error('No valid data found for distribution plot');
      return;
    }

    // Set the selected points to trigger distribution plot generation
    // We need to find the indices of these points in the current data array
    const selectedIndices = [];
    cellPoints.forEach(embeddingPoint => {
      const index = data.findIndex(point =>
        point[0] === embeddingPoint[0] && point[1] === embeddingPoint[1]
      );
      if (index >= 0) {
        selectedIndices.push(index);
      }
    });

    console.log(`🎯 Setting selected points: ${selectedIndices.length} indices`);
    setSelectedPoints(selectedIndices);

  }, [anomalyResults, data, metadata, getOriginalData]);

  // Early validation after all hooks are declared
  if (!data || !metadata) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">No embedding data available</Typography>
      </Box>
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">No embedding data points available</Typography>
      </Box>
    );
  }

  if (!metadata.labels || !Array.isArray(metadata.labels)) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">Missing data labels</Typography>
      </Box>
    );
  }



  return (
    <Box sx={{
      display: 'block',
      position: 'relative',
      overflow: 'visible',
      width: '100%',
      height: 'auto',
      minWidth: '260px',
      alignSelf: 'flex-start',
      justifySelf: 'flex-start',
      // Add CSS animation for pulsing effect
      '& .anomaly-pulse': {
        animation: 'pulse 2s ease-in-out infinite'
      },
      '@keyframes pulse': {
        '0%': { opacity: 0.8, transform: 'scale(1)' },
        '50%': { opacity: 0.4, transform: 'scale(1.1)' },
        '100%': { opacity: 0.8, transform: 'scale(1)' }
      }
    }}>
      {/* Title */}
      <Box sx={{ p: 1, borderBottom: '0.1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2">Overall Analysis</Typography>
      </Box>
      {/* Main Plot Area */}
      <Box
        ref={containerRef}
        className="embedding-plot"
        sx={{
          width: '100%',
          aspectRatio: '1 / 1',
          position: 'relative',
          minHeight: 'unset',
          backgroundColor: 'rgba(248, 250, 252, 0.5)',
          borderRadius: '8px',
          padding: '4px',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          transition: 'none',
          overflow: 'visible'
        }}
      >

        {/* Selection Controls moved below plot */}

        {/* Bottom controls moved below */}

        {/* Anomaly legend moved below */}

        {/* Removed aspect ratio controls - now fully automatic */}

        <svg
          ref={svgRef}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
            touchAction: 'none', // Prevent touch zoom/pan
            userSelect: 'none',   // Prevent text selection
            transition: 'all 0.3s ease', // Smooth transitions for aspect ratio changes
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            objectFit: 'fill',
            overflow: 'visible' // Allow Y-axis label to be visible
          }}
        />
      </Box>

      {/* Controls and generated information below the plot */}
      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          icon={<BarChart />}
          label={`${selectedPoints.length} selected`}
          size="small"
          color={selectedPoints.length > 0 ? "primary" : "default"}
          variant={selectedPoints.length > 0 ? "filled" : "outlined"}
        />

        <Tooltip title={selectedPoints.length === 0 ? "No points selected" : "Clear Selection"}>
          <span>
            <IconButton
              size="small"
              aria-label="Clear selection"
              onClick={clearSelection}
              disabled={selectedPoints.length === 0}
              sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
            >
              <Clear fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Run Anomaly Detection - Highlights anomalous regions">
          <IconButton
            size="small"
            aria-label="Run anomaly detection"
            onClick={() => {
              console.log('🔘 Anomaly detection button clicked!');
              console.log('Current data length:', data?.length);
              console.log('Current metadata:', metadata);
              console.log('Button state - anomalyLoading:', anomalyLoading);
              console.log('Button state - anomalyResults:', !!anomalyResults);
              setShowAnomalies(true);
              runAnomalyDetection();
            }}
            disabled={anomalyLoading}
            sx={{
              bgcolor: anomalyResults && showAnomalies ? 'rgba(220, 38, 38, 0.3)' : 'rgba(59, 130, 246, 0.1)',
              '&:hover': {
                bgcolor: anomalyResults && showAnomalies ? 'rgba(220, 38, 38, 0.4)' : 'rgba(59, 130, 246, 0.2)'
              },
              border: '1px solid',
              borderColor: anomalyResults && showAnomalies ? 'rgba(220, 38, 38, 0.5)' : 'rgba(59, 130, 246, 0.3)',
              '&:disabled': {
                bgcolor: 'rgba(156, 163, 175, 0.1)',
                borderColor: 'rgba(156, 163, 175, 0.3)'
              }
            }}
          >
            {anomalyLoading ? (
              <CircularProgress size={16} color="primary" />
            ) : (
              <Warning fontSize="small" color={anomalyResults && showAnomalies ? "error" : "primary"} />
            )}
          </IconButton>
        </Tooltip>

        {anomalyResults && (
          <Tooltip title="Download Anomaly CSV">
            <IconButton
              size="small"
              aria-label="Download anomaly CSV"
              onClick={downloadAnomalyCSV}
              sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
            >
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {anomalyResults && (
          <Tooltip title={showAnomalies ? "Hide Anomaly Grid" : "Show Anomaly Grid"}>
            <IconButton
              size="small"
              aria-label="Toggle anomaly display"
              onClick={() => setShowAnomalies(!showAnomalies)}
              sx={{
                bgcolor: showAnomalies ? 'rgba(220, 38, 38, 0.2)' : 'white',
                '&:hover': { bgcolor: showAnomalies ? 'rgba(220, 38, 38, 0.3)' : 'grey.100' }
              }}
            >
              <Warning fontSize="small" color={showAnomalies ? "error" : "inherit"} />
            </IconButton>
          </Tooltip>
        )}

        {showAnomalies && anomalyResults && (
          <Tooltip title="Anomaly Detection Help">
            <IconButton
              size="small"
              aria-label="Anomaly detection help"
              onClick={() => setShowHelpDialog(true)}
              sx={{
                bgcolor: 'rgba(59, 130, 246, 0.1)',
                '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' }
              }}
            >
              <Help fontSize="small" color="primary" />
            </IconButton>
          </Tooltip>
        )}

        {anomalyResults && anomalyResults.statistics && (
          <Chip
            icon={<Warning />}
            label={`${anomalyResults.statistics.real_anomalies || 0} real + ${anomalyResults.statistics.synthetic_anomalies || 0} synthetic anomalies detected`}
            size="small"
            color="error"
            variant="filled"
            sx={{
              bgcolor: 'rgba(220, 38, 38, 0.9)',
              fontSize: '11px'
            }}
          />
        )}
      </Box>

      {showAnomalies && anomalyResults && anomalyResults.cell_anomalies && (
        <Box sx={{
          mt: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          bgcolor: 'rgba(255, 255, 255, 0.6)',
          p: 1.5,
          borderRadius: 1,
          border: '1px solid rgba(0, 0, 0, 0.12)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          maxWidth: '100%'
        }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 0.5 }}>
            Anomaly Legend
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'rgba(239, 68, 68, 0.2)', border: '2px solid rgba(239, 68, 68, 1.0)' }} />
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 'bold' }}>
              Real Overpopulation ({anomalyResults.cell_anomalies.filter(a => a.test_type === 'real_overpopulation' && a.is_significant).length})
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'rgba(59, 130, 246, 0.2)', border: '2px solid rgba(59, 130, 246, 1.0)' }} />
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Synthetic Overpopulation ({anomalyResults.cell_anomalies.filter(a => a.test_type === 'synthetic_overpopulation' && a.is_significant).length})
            </Typography>
          </Box>
          {anomalyResults.statistics && (
            <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                📊 Real Anomalies: {anomalyResults.statistics.real_anomalies || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                📊 Synthetic Anomalies: {anomalyResults.statistics.synthetic_anomalies || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                📈 Total Anomalous Regions: {anomalyResults.cell_anomalies.length}
              </Typography>
            </Box>
          )}
        </Box>
      )}


      {/* Resize handle removed for fixed-size embedding */}

      {/* External RightSidebar will be rendered by parent next to this plot */}

      {variableTypeRows.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Variable Type Comparison
          </Typography>
          <TableContainer
            sx={{
              maxHeight: 240,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflowY: 'auto'
            }}
          >
            <Table size="small" stickyHeader aria-label="Variable type comparison">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 11, fontWeight: 600, width: 140, maxWidth: 140 }}>Variable</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Real Type</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Synthetic Type</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Match</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {variableTypeRows.map((row) => (
                  <TableRow key={row.variable} hover>
                    <TableCell sx={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{row.variable}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{row.realType}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{row.syntheticType}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span role="img" aria-label={row.match.label}>{row.match.icon}</span>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {row.match.label}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Help Dialog */}
      <Dialog
        open={showHelpDialog}
        onClose={() => setShowHelpDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          🔍 Anomaly Detection Guide
        </DialogTitle>
        <DialogContent>
          <Box sx={{ p: 1 }}>
            <Typography variant="h6" gutterBottom>
              📊 What are the colored cells?
            </Typography>
            <Typography variant="body2" paragraph>
              • <strong>Red cells</strong> = Real overpopulation (significantly more real data than expected)<br />
              • <strong>Blue cells</strong> = Synthetic overpopulation (significantly more synthetic data than expected)<br />
              • <strong>Gray cells</strong> = Normal distribution (no significant difference)
            </Typography>

            <Typography variant="h6" gutterBottom>
              📈 How are anomalies detected?
            </Typography>
            <Typography variant="body2" paragraph>
              • Creates histogram-based grid cells for optimal data distribution<br />
              • Calculates global proportion of real vs synthetic data in the entire dataset<br />
              • Performs binomial proportion tests in each cell:<br />
              &nbsp;&nbsp;&nbsp;&nbsp;- Compares cell's real data proportion to the global proportion<br />
              &nbsp;&nbsp;&nbsp;&nbsp;- Uses binomial distribution to test if the difference is statistically significant<br />
              &nbsp;&nbsp;&nbsp;&nbsp;- Tests if cell has significantly more real data than expected (real overpopulation)<br />
              &nbsp;&nbsp;&nbsp;&nbsp;- Tests if cell has significantly more synthetic data than expected (synthetic overpopulation)<br />
              • Applies False Discovery Rate (FDR) correction to control for multiple testing<br />
              • Colors cells based on statistical significance (p &lt; 0.05 after FDR correction)
            </Typography>

            <Typography variant="h6" gutterBottom>
              📊 Binomial Distribution & Global Proportion
            </Typography>
            <Typography variant="body2" paragraph>
              • <strong>Global proportion</strong> = Total real data / Total data across entire dataset<br />
              • Each cell is tested against this global baseline<br />
              • Binomial test asks: "Is this cell's proportion significantly different from global?"<br />
              • If cell has 80% real data but global is 50%, binomial test determines if this is significant<br />
              • <strong>Significance</strong> = Unlikely to occur by random chance alone
            </Typography>

            <Typography variant="h6" gutterBottom>
              📊 Statistical Significance
            </Typography>
            <Typography variant="body2" paragraph>
              • Significant cells (p &lt; 0.05 after FDR correction) are colored<br />
              • Non-significant cells remain transparent/gray<br />
              • <strong>Red cells</strong> = Significantly more real data than expected<br />
              • <strong>Blue cells</strong> = Significantly more synthetic data than expected
            </Typography>

            <Typography variant="h6" gutterBottom>
              💡 Tips
            </Typography>
            <Typography variant="body2" paragraph>
              • Hover over colored cells for detailed statistics<br />
              • Red cells indicate areas where real data dominates<br />
              • Blue cells indicate areas where synthetic data dominates<br />
              • Download CSV for comprehensive analysis<br />
              • System automatically adapts to your dataset characteristics
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelpDialog(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Add CSS animation for pulse effect
const pulseAnimation = `
  @keyframes pulse {
    0% {
      opacity: 0.8;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(1.05);
    }
    100% {
      opacity: 0.8;
      transform: scale(1);
    }
  }
`;

// Inject the CSS animation
if (typeof document !== 'undefined') {
  const styleId = 'embedding-plot-pulse-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = pulseAnimation;
    document.head.appendChild(style);
  }
}

export default EmbeddingPlot; 
