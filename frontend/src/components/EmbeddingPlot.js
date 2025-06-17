import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, Chip, IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem, Divider, CircularProgress, Alert } from '@mui/material';
import { Clear, SelectAll, BarChart, CropFree, UnfoldMore, UnfoldLess } from '@mui/icons-material';
import Plot from 'react-plotly.js';
import { generateDistributionPlot } from '../services/api';
import { classifyColumnType, getAvailablePlotTypes } from '../utils/dataUtils';

const EmbeddingPlot = ({ 
  data, 
  metadata, 
  width = 800, 
  height = 600,
  pointSize = 0.8,  
  pointOpacity = 0.6  
}) => {
  // All React hooks must be called first, before any early returns
  const svgRef = useRef();
  const containerRef = useRef();
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [selectionMode, setSelectionMode] = useState('circle'); // Only circle selection
  const [histogramColumn, setHistogramColumn] = useState(0);
  const [histogramPlotType, setHistogramPlotType] = useState('histogram');

  const [plotData, setPlotData] = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState(null);
  
  // Layout state for adjustable panels
  const [sidebarWidth, setSidebarWidth] = useState(35); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Refs for smooth resizing and API management
  const resizeTimeoutRef = useRef(null);
  const lastResizeTimeRef = useRef(0);
  const abortControllerRef = useRef(null);
  const plotGenerationTimeoutRef = useRef(null);
  const lastRequestParamsRef = useRef(null);

  // Get original data for histogram generation
  const getOriginalData = useCallback(() => {
    if (!metadata?.realData?.data || !metadata?.syntheticData?.data) return null;
    
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
  }, [metadata]);

  // Generate histogram data for selected points
  const generateHistogramData = useCallback(() => {
    if (selectedPoints.length === 0) return null;
    
    const originalData = getOriginalData();
    if (!originalData || histogramColumn >= originalData.headers.length) return null;

    const selectedData = selectedPoints
      .filter(index => {
        // More permissive validation with debugging
        const isValidIndex = index >= 0 && index < originalData.data.length;
        const hasData = originalData.data[index];
        const isDataArray = hasData && Array.isArray(originalData.data[index]);
        const hasEnoughColumns = isDataArray && originalData.data[index].length > histogramColumn;
        const hasLabel = originalData.labels[index];
        
        const isValid = isValidIndex && hasData && isDataArray && hasEnoughColumns && hasLabel;
        return isValid;
      })
      .map(index => ({
        value: originalData.data[index][histogramColumn],
        label: originalData.labels[index],
        index: index
      }));
    
    const realValues = selectedData.filter(d => d.label === 'Real').map(d => d.value);
    const syntheticValues = selectedData.filter(d => d.label === 'Synthetic').map(d => d.value);
    
    // Classify data type for this column
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
      availablePlotTypes
    };
  }, [selectedPoints, histogramColumn, getOriginalData]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPoints([]);
  }, []);

  // Select all points
  const selectAllPoints = useCallback(() => {
    if (!data) return;
    setSelectedPoints(Array.from({ length: data.length }, (_, i) => i));
  }, [data]);

  // API call logic for generating distribution plots
  const generatePlotData = useCallback(async () => {
    const histogramData = generateHistogramData();
    if (!histogramData) return;

    const originalData = getOriginalData();
    if (!originalData) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      console.log('🚫 Cancelling previous API request to prevent race condition');
      abortControllerRef.current.abort();
    }

    // Prepare selected data in the same format as the full dataset
    const selectedRealData = [];
    const selectedSyntheticData = [];

    selectedPoints.forEach(index => {
      const isValidIndex = index >= 0 && index < originalData.data.length;
      const hasData = originalData.data[index];
      const isDataArray = hasData && Array.isArray(originalData.data[index]);
      const hasLabel = originalData.labels[index];
      
      if (isValidIndex && hasData && isDataArray && hasLabel) {
        if (originalData.labels[index] === 'Real') {
          selectedRealData.push(originalData.data[index]);
        } else {
          selectedSyntheticData.push(originalData.data[index]);
        }
      }
    });

    // Check if we have any data to send
    if (selectedRealData.length === 0 && selectedSyntheticData.length === 0) {
      console.error('No valid data to send to API');
      setPlotError('No valid data points found for the selected column');
      setPlotLoading(false);
      return;
    }

    // Use the same API as DistributionPlot.js
    const requestData = {
      real_data: selectedRealData,
      synthetic_data: selectedSyntheticData,
      column: originalData.headers[histogramColumn],
      plot_type: histogramPlotType,
      real_headers: originalData.headers,
      synthetic_headers: originalData.headers
    };

    // Check if this is the same request as last time (avoid duplicate API calls)
    const requestKey = JSON.stringify({
      selectedPoints: selectedPoints.sort(),
      column: histogramColumn,
      plotType: histogramPlotType
    });

    if (lastRequestParamsRef.current === requestKey) {
      console.log('🔄 Skipping duplicate API request for same parameters');
      return; // Skip duplicate request
    }

    lastRequestParamsRef.current = requestKey;

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setPlotLoading(true);
    setPlotError(null);

    try {
      const data = await generateDistributionPlot(requestData, abortController.signal);
      
      // Check if request was cancelled
      if (abortController.signal.aborted) {
        return;
      }
      
      setPlotData(data);
    } catch (err) {
      // Don't show error if request was cancelled
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('Error generating plot:', err);
      setPlotError(`Failed to generate plot: ${err.message}`);
    } finally {
      // Only update loading state if this request wasn't cancelled
      if (!abortController.signal.aborted) {
        setPlotLoading(false);
      }
    }
  }, [selectedPoints, histogramColumn, histogramPlotType, generateHistogramData, getOriginalData]);

  // Auto-set plot type when column changes (using same logic as DistributionPlot.js)
  useEffect(() => {
    const originalData = getOriginalData();
    if (originalData && originalData.headers.length > 0 && histogramColumn < originalData.headers.length) {
      const columnDataType = classifyColumnType(histogramColumn, originalData);
      
      // Check if current plot type is compatible with new data type (same logic as DistributionPlot.js)
      const numericPlotTypes = ['histogram', 'violin', 'histogram_comparison'];
      const categoricalPlotTypes = ['bar'];
      
      const isCurrentPlotCompatible = 
        (columnDataType === 'numeric' && numericPlotTypes.includes(histogramPlotType)) ||
        (columnDataType === 'categorical' && categoricalPlotTypes.includes(histogramPlotType));
      
      // Only change plot type if current one is not compatible
      if (!isCurrentPlotCompatible) {
        const defaultPlotType = columnDataType === 'numeric' ? 'histogram' : 'bar';
        setHistogramPlotType(defaultPlotType);
      }
    }
  }, [histogramColumn, getOriginalData, histogramPlotType]);

  // Render plot using Plotly (same logic as DistributionPlot.js)
  const renderPlot = () => {
    if (!plotData) return null;
    
    switch (plotData.plot_type) {
      case 'histogram':
        return (
          <Box sx={{ display: 'flex', gap: 1, height: '300px' }}>
            <Box sx={{ flex: 1, minHeight: '300px', backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#2563eb', mb: 1 }}>
                Real Data
              </Typography>
              <Plot
                data={[{
                  x: plotData.real_values,
                  type: 'histogram',
                  name: 'Real',
                  marker: { color: '#2563eb' },
                  opacity: 0.7
                }]}
                layout={{
                  margin: { l: 40, r: 20, t: 20, b: 40 },
                  showlegend: false,
                  xaxis: { title: '' },
                  yaxis: { title: 'Count' }
                }}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
              />
            </Box>
            <Box sx={{ flex: 1, minHeight: '300px', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#dc2626', mb: 1 }}>
                Synthetic Data
              </Typography>
              <Plot
                data={[{
                  x: plotData.synthetic_values,
                  type: 'histogram',
                  name: 'Synthetic',
                  marker: { color: '#dc2626' },
                  opacity: 0.7
                }]}
                layout={{
                  margin: { l: 40, r: 20, t: 20, b: 40 },
                  showlegend: false,
                  xaxis: { title: '' },
                  yaxis: { title: 'Count' }
                }}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          </Box>
        );

      case 'histogram_comparison':
        return (
          <Plot
            data={[
              {
                x: plotData.real_values,
                type: 'histogram',
                name: 'Real',
                marker: { color: '#2563eb' },
                opacity: 0.5,
                histnorm: 'probability density'
              },
              {
                x: plotData.synthetic_values,
                type: 'histogram',
                name: 'Synthetic',
                marker: { color: '#dc2626' },
                opacity: 0.5,
                histnorm: 'probability density' 
              }
            ]}
            layout={{
              margin: { l: 60, r: 20, t: 20, b: 40 },
              barmode: 'overlay',
              xaxis: { title: '' },
              yaxis: { title: 'Probability Density' },
              legend: { x: 0.7, y: 0.9 }
            }}
            style={{ width: '100%', height: '300px' }}
            config={{ displayModeBar: false }}
          />
        );

      case 'violin':
        return (
          <Plot
            data={[
              {
                y: plotData.real_values,
                type: 'violin',
                name: 'Real',
                fillcolor: 'rgba(37, 99, 235, 0.5)',
                line: { color: '#2563eb' },
                box: { visible: true },
                meanline: { visible: true }
              },
              {
                y: plotData.synthetic_values,
                type: 'violin',
                name: 'Synthetic',
                fillcolor: 'rgba(220, 38, 38, 0.5)',
                line: { color: '#dc2626' },
                box: { visible: true },
                meanline: { visible: true }
              }
            ]}
            layout={{
              margin: { l: 40, r: 20, t: 20, b: 40 },
              yaxis: { title: '' },
              showlegend: true,
              legend: { x: 0.7, y: 0.9 }
            }}
            style={{ width: '100%', height: '300px' }}
            config={{ displayModeBar: false }}
          />
        );

      case 'bar':
        return (
          <Plot
            data={[
              {
                x: plotData.categories,
                y: plotData.real_counts,
                type: 'bar',
                name: 'Real',
                marker: { color: '#2563eb' },
                opacity: 0.7
              },
              {
                x: plotData.categories,
                y: plotData.synthetic_counts,
                type: 'bar',
                name: 'Synthetic',
                marker: { color: '#dc2626' },
                opacity: 0.7
              }
            ]}
            layout={{
              margin: { l: 40, r: 20, t: 20, b: 40 },
              barmode: 'group',
              xaxis: { title: '' },
              yaxis: { title: 'Count' },
              legend: { x: 0.7, y: 0.9 }
            }}
            style={{ width: '100%', height: '300px' }}
            config={{ displayModeBar: false }}
          />
        );

      default:
        return <Typography>Unsupported plot type: {plotData.plot_type}</Typography>;
    }
  };



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

    // Get container dimensions and use available space efficiently
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width > 0 ? rect.width : width;
    const containerHeight = rect.height > 0 ? rect.height : height;
    
    // Calculate responsive plot area based on sidebar state
    const shouldShowSidebar = selectedPoints.length > 0;
    const plotAreaWidth = shouldShowSidebar && !sidebarCollapsed ? 
      containerWidth * ((100 - sidebarWidth) / 100) : containerWidth;
    

    
    // Use full available space with intelligent aspect ratio
    const plotWidth = plotAreaWidth;
    const plotHeight = containerHeight;
    
    // Ensure minimum reasonable dimensions
    const minWidth = 300;
    const minHeight = 250;
    
    if (plotWidth < minWidth || plotHeight < minHeight) {
      console.warn('Container too small for embedding plot');
      return;
    }

    // Get device pixel ratio for high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Apply intelligent sampling for large datasets (now includes validation)
    const { sampledData, sampledLabels, indexMap } = sampleData(data, metadata.labels, 8000);
    

    
    // If no valid data, return early
    if (sampledData.length === 0) {
      console.warn('No valid data points found for embedding plot');
      return;
    }
    
    const numPoints = sampledData.length;
    const wasDownsampled = sampledData.length < data.length;

    // Advanced point sizing based on dataset size and density
    const basePointSize = plotWidth < 600 ? 0.8 : 1.2;
    const densityFactor = Math.max(0.3, Math.min(1.5, 1000 / Math.sqrt(numPoints)));
    const adjustedPointSize = (basePointSize * densityFactor) * devicePixelRatio;

    // Adaptive opacity based on point density
    const baseOpacity = 0.7;
    const opacityFactor = Math.max(0.4, Math.min(0.9, 800 / Math.sqrt(numPoints)));
    const adjustedOpacity = baseOpacity * opacityFactor;

    // Clear previous plot
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG with enhanced sharpness configuration
    const svg = d3.select(svgRef.current)
      .attr("width", plotWidth * devicePixelRatio)
      .attr("height", plotHeight * devicePixelRatio)
      .attr("viewBox", `0 0 ${plotWidth * devicePixelRatio} ${plotHeight * devicePixelRatio}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", `${plotWidth}px`)
      .style("height", `${plotHeight}px`)
      .style("shape-rendering", "geometricPrecision")
      .style("text-rendering", "geometricPrecision")
      .style("cursor", "default");

    // Scale everything by device pixel ratio
    const scaledPlotWidth = plotWidth * devicePixelRatio;
    const scaledPlotHeight = plotHeight * devicePixelRatio;
    
    // Responsive margins accounting for sidebar state and legend space
    const baseMargin = {
      top: Math.max(30, Math.min(50, plotHeight * 0.08)),
      // Increase right margin when sidebar is visible to ensure legend fits
      right: shouldShowSidebar && !sidebarCollapsed ? 
        Math.max(140, Math.min(180, plotWidth * 0.18)) : 
        Math.max(120, Math.min(160, plotWidth * 0.16)),
      bottom: Math.max(40, Math.min(60, plotHeight * 0.1)),
      left: Math.max(40, Math.min(60, plotWidth * 0.08))
    };
    
    const margin = { 
      top: baseMargin.top * devicePixelRatio, 
      right: baseMargin.right * devicePixelRatio, 
      bottom: baseMargin.bottom * devicePixelRatio, 
      left: baseMargin.left * devicePixelRatio 
    };
    
    const innerWidth = scaledPlotWidth - margin.left - margin.right;
    const innerHeight = scaledPlotHeight - margin.top - margin.bottom;

    // Ensure we have positive dimensions
    if (innerWidth <= 0 || innerHeight <= 0) {
      return;
    }

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Extract coordinates and create scales
    const x = sampledData.map(d => d[0]);
    const y = sampledData.map(d => d[1]);

    const xScale = d3.scaleLinear()
      .domain(d3.extent(x))
      .range([0, innerWidth])
      .nice();

    const yScale = d3.scaleLinear()
      .domain(d3.extent(y))
      .range([innerHeight, 0])
      .nice();

    // Enhanced color scheme
    const colorScale = d3.scaleOrdinal()
      .domain(["Real", "Synthetic"])
      .range(["#2563eb", "#dc2626"]);

    // Add axes
    const xAxis = g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .attr("class", "axis")
      .style("shape-rendering", "crispEdges")
      .call(d3.axisBottom(xScale).ticks(8));

    xAxis.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 45 * devicePixelRatio)
      .attr("fill", "black")
      .attr("font-weight", "600")
      .style("font-size", `${14 * devicePixelRatio}px`)
      .style("text-rendering", "geometricPrecision")
      .text(`${metadata.method.toUpperCase()}_1`);

    const yAxis = g.append("g")
      .attr("class", "axis")
      .style("shape-rendering", "crispEdges")
      .call(d3.axisLeft(yScale).ticks(8));

    yAxis.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -45 * devicePixelRatio)
      .attr("x", -innerHeight / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .attr("font-weight", "600")
      .style("font-size", `${14 * devicePixelRatio}px`)
      .style("text-rendering", "geometricPrecision")
      .text(`${metadata.method.toUpperCase()}_2`);

    // Style axes
    svg.selectAll(".axis line, .axis path")
      .style("stroke", "#e5e7eb")
      .style("stroke-width", `${1 * devicePixelRatio}px`)
      .style("shape-rendering", "crispEdges");

    svg.selectAll(".axis text")
      .style("font-size", `${12 * devicePixelRatio}px`)
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .style("fill", "#374151")
      .style("text-rendering", "geometricPrecision");

    // Add data points
    const points = g.selectAll("circle")
      .data(sampledData)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d[0]))
      .attr("cy", (d) => yScale(d[1]))
      .attr("r", adjustedPointSize)
      .attr("fill", (_, i) => colorScale(sampledLabels[i]))
      .attr("stroke", (_, i) => {
        const originalIndex = indexMap[i];
        return selectedPoints.includes(originalIndex) ? "#000" : d3.color(colorScale(sampledLabels[i])).darker(0.3);
      })
      .attr("stroke-width", (_, i) => {
        const originalIndex = indexMap[i];
        return selectedPoints.includes(originalIndex) ? 2 * devicePixelRatio : 0.5 * devicePixelRatio;
      })
      .attr("opacity", (_, i) => {
        const originalIndex = indexMap[i];
        return selectedPoints.includes(originalIndex) ? 1 : adjustedOpacity;
      })
      .style("shape-rendering", "geometricPrecision")
      .style("cursor", "pointer");

    // Circular selection logic
    let isDrawing = false;
    let startPoint = null;
    let selectionCircle = null;
    let dragThreshold = 3; // pixels
    let hasDragged = false;

    // Add background rectangle for reliable event handling
    const background = g.append("rect")
      .attr("class", "selection-background")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", scaledPlotWidth - margin.left - margin.right)
      .attr("height", scaledPlotHeight - margin.top - margin.bottom)
      .style("fill", "transparent")
      .style("cursor", "crosshair")
      .style("pointer-events", "all");

    background
      .on("mousedown", function(event) {
        event.preventDefault();
        isDrawing = true;
        hasDragged = false;
        startPoint = d3.pointer(event, g.node());
        selectionCircle = null;
      })
      .on("mousemove", function(event) {
        if (!isDrawing || !startPoint) return;

        const currentPoint = d3.pointer(event, g.node());
        const distance = Math.sqrt((currentPoint[0] - startPoint[0])**2 + (currentPoint[1] - startPoint[1])**2);

        if (distance > dragThreshold && !hasDragged) {
          hasDragged = true;
          selectionCircle = g.append("circle")
            .attr("class", "selection-circle")
            .attr("cx", startPoint[0])
            .attr("cy", startPoint[1])
            .attr("r", 0)
            .style("fill", "rgba(37, 99, 235, 0.1)")
            .style("stroke", "#2563eb")
            .style("stroke-width", "2px")
            .style("stroke-dasharray", "5,5")
            .style("pointer-events", "none");
        }

        if (hasDragged && selectionCircle) {
          const adjustedRadius = Math.max(0, distance - dragThreshold);
          
          // Make circle expand toward the mouse direction
          const centerX = startPoint[0] + (currentPoint[0] - startPoint[0]) * 0.5;
          const centerY = startPoint[1] + (currentPoint[1] - startPoint[1]) * 0.5;
          
          selectionCircle
            .attr("cx", centerX)
            .attr("cy", centerY)
            .attr("r", adjustedRadius / 2); // Smaller radius since center moves
        }
      })
      .on("mouseup", function(event) {
        event.preventDefault();

        if (!isDrawing || !startPoint) return;

        if (hasDragged && selectionCircle) {
          const currentPoint = d3.pointer(event, g.node());
          const distance = Math.sqrt((currentPoint[0] - startPoint[0])**2 + (currentPoint[1] - startPoint[1])**2);
          const adjustedRadius = Math.max(0, distance - dragThreshold);
          
          // Use the same center positioning as during drag
          const centerX = startPoint[0] + (currentPoint[0] - startPoint[0]) * 0.5;
          const centerY = startPoint[1] + (currentPoint[1] - startPoint[1]) * 0.5;
          const finalRadius = adjustedRadius / 2;

          const selected = [];
          points.each(function(d, i) {
            const cx = xScale(d[0]);
            const cy = yScale(d[1]);
            const pointDistance = Math.sqrt((cx - centerX)**2 + (cy - centerY)**2);
            if (pointDistance <= finalRadius) {
              selected.push(indexMap[i]);
            }
          });



          setSelectedPoints(selected);
          selectionCircle.remove();
        }

        isDrawing = false;
        hasDragged = false;
        startPoint = null;
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
      .on("mouseover", function(event, d, i) {
        const originalIndex = indexMap[i];
        const dataType = sampledLabels[i];
        
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", (adjustedPointSize * 2.5) / devicePixelRatio)
          .attr("opacity", 0.9)
          .attr("stroke-width", 2 * devicePixelRatio);

        tooltip
          .style("visibility", "visible")
          .html(`
            <div style="font-weight: bold; margin-bottom: 4px; color: ${dataType === 'Real' ? '#4682b4' : '#e74c3c'};">
              ${dataType} Data Point
            </div>
            <div>Index: ${originalIndex}</div>
            <div>Coordinates: (${d[0].toFixed(3)}, ${d[1].toFixed(3)})</div>
            <div style="margin-top: 4px; font-size: 10px; opacity: 0.8;">
              Click to select • ${metadata.method.toUpperCase()} embedding
            </div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function(event, d, i) {
        const originalIndex = indexMap[i];
        const isSelected = selectedPoints.includes(originalIndex);
        
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", adjustedPointSize)
          .attr("opacity", isSelected ? 1 : adjustedOpacity)
          .attr("stroke-width", isSelected ? 2 * devicePixelRatio : 0.5 * devicePixelRatio);

        tooltip.style("visibility", "hidden");
      })
      .on("click", function(event, d, i) {
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

    // Responsive legend positioning
    const legendWidth = 130 * devicePixelRatio;
    const legendHeight = wasDownsampled ? 85 * devicePixelRatio : 75 * devicePixelRatio;
    
          // Calculate optimal legend position
    const legendX = Math.min(
      scaledPlotWidth - margin.right + (10 * devicePixelRatio),
      scaledPlotWidth - legendWidth - (5 * devicePixelRatio)
    );
    const legendY = margin.top + (10 * devicePixelRatio);
    

    
    const legend = svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`);

    const legendBg = legend.append("rect")
      .attr("x", -10 * devicePixelRatio)
      .attr("y", -10 * devicePixelRatio)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", "white")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 1 * devicePixelRatio)
      .attr("rx", 6 * devicePixelRatio)
      .attr("opacity", 0.95);

    legend.append("text")
      .attr("x", 0)
      .attr("y", 8 * devicePixelRatio)
      .text("Dataset Type")
      .style("font-size", `${11 * devicePixelRatio}px`)
      .style("font-weight", "600")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .style("fill", "#374151");

    const realCount = sampledLabels.filter(label => label === "Real").length;
    const syntheticCount = sampledLabels.filter(label => label === "Synthetic").length;

    ["Real", "Synthetic"].forEach((label, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${(i * 22 + 25) * devicePixelRatio})`);

      legendRow.append("circle")
        .attr("cx", 8 * devicePixelRatio)
        .attr("cy", 0)
        .attr("r", Math.max(3 * devicePixelRatio, adjustedPointSize * 1.5))
        .attr("fill", colorScale(label))
        .attr("stroke", d3.color(colorScale(label)).darker(0.3))
        .attr("stroke-width", 0.5 * devicePixelRatio)
        .attr("opacity", 0.85);

      const count = label === "Real" ? realCount : syntheticCount;
      legendRow.append("text")
        .attr("x", 20 * devicePixelRatio)
        .attr("y", 4 * devicePixelRatio)
        .text(`${label} (${count.toLocaleString()})`)
        .style("font-size", `${12 * devicePixelRatio}px`)
        .style("font-weight", "500")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#374151");
    });

    if (wasDownsampled) {
      legend.append("text")
        .attr("x", 0)
        .attr("y", 85 * devicePixelRatio)
        .text("* Intelligently sampled")
        .style("font-size", `${10 * devicePixelRatio}px`)
        .style("font-weight", "400")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#6b7280")
        .style("font-style", "italic");
    }

  }, [data, metadata, pointSize, pointOpacity, selectedPoints, sidebarWidth, sidebarCollapsed]);

  // API trigger for distribution plot generation
  useEffect(() => {
    // Clear any existing timeout
    if (plotGenerationTimeoutRef.current) {
      clearTimeout(plotGenerationTimeoutRef.current);
    }

    if (selectedPoints.length > 0) {
      const originalData = getOriginalData();
      if (originalData && histogramColumn < originalData.headers.length) {
        // Auto-set appropriate plot type if current type doesn't match data
        const currentDataType = classifyColumnType(histogramColumn, originalData);
        const isValidCombination = 
          (currentDataType === 'numeric' && ['histogram', 'violin', 'histogram_comparison'].includes(histogramPlotType)) ||
          (currentDataType === 'categorical' && histogramPlotType === 'bar');
        
        if (!isValidCombination) {
          // Auto-set appropriate plot type - choose the most informative
          const defaultPlotType = currentDataType === 'numeric' ? 'histogram_comparison' : 'bar';
          setHistogramPlotType(defaultPlotType);
          // The plot will be generated when histogramPlotType updates
          return;
        }
        
        // Generate plot with smart debouncing
        if (plotData === null) {
          // First-time plot generation - immediate loading for best UX
          generatePlotData();
        } else {
          // Subsequent updates - minimal debounce to prevent API spam
          plotGenerationTimeoutRef.current = setTimeout(() => {
            generatePlotData();
          }, 100); // Slightly longer debounce for stability
        }
      }
    } else {
      // Cancel any pending request when no points selected
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setPlotData(null);
      setPlotError(null);
      setPlotLoading(false);
    }

    // Cleanup function
    return () => {
      if (plotGenerationTimeoutRef.current) {
        clearTimeout(plotGenerationTimeoutRef.current);
      }
    };
  }, [selectedPoints, histogramColumn, histogramPlotType, generatePlotData, getOriginalData]);

  // Initialize plot type based on first column's data type (same logic as DistributionPlot.js)
  useEffect(() => {
    const originalData = getOriginalData();
    if (originalData && originalData.headers.length > 0 && histogramColumn === 0) {
      const firstColumnDataType = classifyColumnType(0, originalData);
      
      // Check if current plot type is compatible with first column
      const numericPlotTypes = ['histogram', 'violin', 'histogram_comparison'];
      const categoricalPlotTypes = ['bar'];
      
      const isCurrentPlotCompatible = 
        (firstColumnDataType === 'numeric' && numericPlotTypes.includes(histogramPlotType)) ||
        (firstColumnDataType === 'categorical' && categoricalPlotTypes.includes(histogramPlotType));
      
      // Only update if current plot type is not compatible
      if (!isCurrentPlotCompatible) {
        const defaultPlotType = firstColumnDataType === 'numeric' ? 'histogram_comparison' : 'bar';
        setHistogramPlotType(defaultPlotType);
      }
    }
  }, [metadata, getOriginalData, histogramColumn, histogramPlotType]);

  // Cleanup effect to cancel pending requests on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending API request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear any pending timeout
      if (plotGenerationTimeoutRef.current) {
        clearTimeout(plotGenerationTimeoutRef.current);
      }
    };
  }, []);

  // 🎯 CLEAN SIDEBAR VISIBILITY - Simple and predictable
  const shouldShowSidebar = useMemo(() => {
    return selectedPoints.length > 0;
  }, [selectedPoints.length]);

  // Memoized data for performance
  const originalData = useMemo(() => getOriginalData(), [getOriginalData]);
  const histogramData = useMemo(() => generateHistogramData(), [generateHistogramData]);

  // Handle mouse events for resizing
  const handleMouseDown = useCallback((e) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;
    
    const container = containerRef.current?.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    // Calculate width from left edge so sidebar expands leftward
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 20% and 80% (allowing larger expansion to the left)
    const constrainedWidth = Math.max(20, Math.min(80, newWidth));
    const newSidebarWidth = 100 - constrainedWidth;
    
    // Throttle updates for smooth performance (update every 16ms = ~60fps)
    const now = Date.now();
    if (now - lastResizeTimeRef.current > 16) {
      setSidebarWidth(newSidebarWidth);
      lastResizeTimeRef.current = now;
    } else {
      // Ensure final update after throttling
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        setSidebarWidth(newSidebarWidth);
      }, 16);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    
    // Clean up resize timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
  }, []);

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 🎯 CLEAN AUTO-RESIZE LOGIC - Simple and predictable
  useEffect(() => {
    // Don't auto-resize if user has manually collapsed the sidebar
    if (sidebarCollapsed) return;
    
    // Simple auto-resize logic without complex dependencies
    if (selectedPoints.length > 0 && plotData && sidebarWidth === 35) {
      // Auto-expand sidebar when plots are generated for better visibility
      setSidebarWidth(45);
    } else if (selectedPoints.length === 0 && sidebarWidth > 35) {
      // Return to compact size when no selection
      setSidebarWidth(35);
    }
  }, [selectedPoints.length, plotData, sidebarWidth, sidebarCollapsed]);

  // Toggle sidebar collapse/expand
  const toggleSidebarExpansion = useCallback(() => {
    const newCollapsedState = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsedState);
    
    if (newCollapsedState) {
      setSidebarWidth(0);
    } else {
      setSidebarWidth(45);
    }
  }, [sidebarCollapsed, sidebarWidth]);

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
    <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Main Plot Area */}
      <Box 
        ref={containerRef} 
        className="embedding-plot" 
        sx={{ 
          flex: shouldShowSidebar && !sidebarCollapsed ? `0 0 ${100 - sidebarWidth}%` : 1,
          height: '100%',
          minHeight: '400px',
          backgroundColor: 'rgba(248, 250, 252, 0.5)',
          borderRadius: '8px',
          padding: '8px',
          position: 'relative',
          transition: isResizing ? 'none' : shouldShowSidebar ? 'flex 0.3s ease' : 'none'
        }}
      >

        {/* Selection Controls */}
        <Box sx={{ 
          position: 'absolute', 
          top: 16, 
          left: 16, 
          zIndex: 10,
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap'
        }}>
          <Chip
            icon={<BarChart />}
            label={`${selectedPoints.length} selected`}
            size="small"
            color={selectedPoints.length > 0 ? "primary" : "default"}
            variant={selectedPoints.length > 0 ? "filled" : "outlined"}
          />
          
          {/* Selection Tool Info */}
          <Chip
            icon={<CropFree />}
            label="Drag to select cluster"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ bgcolor: 'white' }}
          />
          
          <Tooltip title={selectedPoints.length === 0 ? "No points selected" : "Clear Selection"}>
            <span>
              <IconButton 
                size="small" 
                onClick={clearSelection}
                disabled={selectedPoints.length === 0}
                sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
              >
                <Clear fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Select All">
            <IconButton 
              size="small" 
              onClick={selectAllPoints}
              sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
            >
              <SelectAll fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <svg 
          ref={svgRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            display: 'block',
            touchAction: 'none', // Prevent touch zoom/pan
            userSelect: 'none'   // Prevent text selection
          }}
        />
      </Box>

      {/* Resize Handle */}
      {shouldShowSidebar && !sidebarCollapsed && (
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            width: 8,
            cursor: 'col-resize',
            backgroundColor: isResizing ? 'primary.main' : 'divider',
            transition: 'background-color 0.2s ease',
            position: 'relative',
            '&:hover': {
              backgroundColor: 'primary.main'
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 3,
              height: 20,
              backgroundColor: 'white',
              borderRadius: 1
            }
          }}
        />
      )}

      {/* Floating Restore Button - Only show when sidebar is collapsed */}
      {shouldShowSidebar && sidebarCollapsed && (
        <Box sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000
        }}>
          <Tooltip title="Show distribution sidebar">
            <IconButton 
              onClick={toggleSidebarExpansion}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 1)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                },
                width: '48px',
                height: '48px'
              }}
              color="primary"
            >
              <BarChart />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Histogram Sidebar */}
      {shouldShowSidebar && !sidebarCollapsed && (
        <Paper sx={{ 
          flex: `0 0 ${sidebarWidth}%`,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100%',
          overflow: 'hidden',
          transition: isResizing ? 'none' : 'flex 0.3s ease'
        }}>
          {/* Header with controls */}
          <Box sx={{ 
            p: 2, 
            borderBottom: '1px solid', 
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChart color="primary" />
              Distributions
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Hide sidebar (maximize plot)">
                <IconButton 
                  size="small" 
                  onClick={toggleSidebarExpansion}
                  color="primary"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 1)',
                    },
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <UnfoldLess />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Scrollable content */}
          <Box sx={{ 
            flex: 1,
            overflow: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
          
          <Divider />
          
          {/* Selection Stats */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Selection Summary
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2">
                Total Points: <strong>{histogramData?.totalSelected || 0}</strong>
              </Typography>
              <Typography variant="body2" sx={{ color: '#2563eb' }}>
                Real: <strong>{histogramData?.realSelected || 0}</strong>
              </Typography>
              <Typography variant="body2" sx={{ color: '#dc2626' }}>
                Synthetic: <strong>{histogramData?.syntheticSelected || 0}</strong>
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Column Selection */}
          <FormControl fullWidth size="small">
            <InputLabel>Column for Analysis</InputLabel>
            <Select
              value={histogramColumn}
              label="Column for Analysis"
              onChange={(e) => {
                setHistogramColumn(e.target.value);
              }}
            >
              {originalData?.headers?.map((header, index) => {
                const columnDataType = classifyColumnType(index, originalData);
                return (
                  <MenuItem key={index} value={index}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {header || `Column ${index + 1}`}
                      </Typography>
                      <Chip 
                        label={columnDataType} 
                        size="small" 
                        color={columnDataType === 'numeric' ? 'primary' : 'secondary'}
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: '20px' }}
                      />
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          {/* Plot Type Selection */}
          {histogramData && histogramData.availablePlotTypes && (
            <FormControl fullWidth size="small">
              <InputLabel>Plot Type</InputLabel>
              <Select
                value={histogramPlotType}
                label="Plot Type"
                onChange={(e) => {
                  setHistogramPlotType(e.target.value);
                }}
              >
                {histogramData.availablePlotTypes.map((plotType) => (
                  <MenuItem key={plotType.value} value={plotType.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {plotType.label}
                      </Typography>
                      {((histogramData.dataType === 'numeric' && plotType.value === 'histogram') ||
                        (histogramData.dataType === 'categorical' && plotType.value === 'bar')) && (
                        <Chip 
                          label="default" 
                          size="small" 
                          color="primary"
                          variant="outlined"
                          sx={{ fontSize: '0.6rem', height: '16px' }}
                        />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Data Type Indicator */}
          {histogramData && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Data Type:
              </Typography>
              <Chip 
                label={histogramData.dataType} 
                size="small" 
                color={histogramData.dataType === 'numeric' ? 'primary' : 'secondary'}
                variant="outlined"
              />
            </Box>
          )}

          {/* Plot Display */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Distribution: {histogramData?.columnName}
            </Typography>
            
            {plotLoading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', gap: 1 }}>
                <CircularProgress size={40} />
                <Typography variant="caption" color="text.secondary">
                  Generating plot...
                </Typography>
              </Box>
            )}
            
            {plotError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2" component="div">
                  <strong>Plot Generation Error:</strong>
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {plotError}
                </Typography>
                {plotError.includes('categorical') && plotError.includes('numeric') && (
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                    💡 Tip: The system should auto-correct plot types, but you can manually select a compatible plot type above.
                  </Typography>
                )}
              </Alert>
            )}
            
            {!plotLoading && !plotError && plotData && (
              <Box sx={{ 
                width: '100%',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                p: 1
              }}>
                {renderPlot()}
              </Box>
            )}
            
            {!plotLoading && !plotError && !plotData && selectedPoints.length > 0 && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '200px',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'grey.50'
              }}>
                <Typography variant="body2" color="text.secondary">
                  Select points to view distribution
                </Typography>
              </Box>
            )}
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
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
      )}
    </Box>
  );
};

export default EmbeddingPlot; 