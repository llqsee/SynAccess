import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, Chip, IconButton, Tooltip, Divider, CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Clear, SelectAll, BarChart, CropFree, UnfoldMore, UnfoldLess } from '@mui/icons-material';
import Plot from 'react-plotly.js';
import { generateDistributionPlot } from '../services/api';
import { classifyColumnType, getAvailablePlotTypes, isDiscreteVariable } from '../utils/dataUtils';

const EmbeddingPlot = ({ 
  data, 
  metadata,
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
  
  // Enhanced layout state with intelligent defaults
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // Smart initial sidebar width based on viewport
    if (typeof window !== 'undefined') {
      const viewportWidth = window.innerWidth;
      if (viewportWidth < 768) return 40; // Mobile: reasonable sidebar
      if (viewportWidth < 1024) return 35; // Tablet: balanced
      if (viewportWidth < 1440) return 30; // Desktop: more plot space
      return 25; // Large screens: maximize plot area
    }
    return 30;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Removed aspect ratio mode - now fully automatic
  
  // Refs for smooth resizing and API management
  const resizeTimeoutRef = useRef(null);
  const lastResizeTimeRef = useRef(0);
  const abortControllerRef = useRef(null);
  const plotGenerationTimeoutRef = useRef(null);
  const lastRequestParamsRef = useRef(null);

  // Check if this embedding is loaded from history (no original data available)
  const isFromHistory = useMemo(() => {
    // The key question is: do we have the original data to generate distribution plots?
    // This is now mainly for internal tracking since both fresh and history embeddings work
    if (!metadata) return true;
    
    // Check if we have original data structure for distribution plots in metadata
    const hasOriginalDataInMetadata = metadata.realData?.data && 
                                    metadata.syntheticData?.data &&
                                    Array.isArray(metadata.realData.data) &&
                                    Array.isArray(metadata.syntheticData.data) &&
                                    metadata.realData.data.length > 0 &&
                                    metadata.syntheticData.data.length > 0;
    
    // Check if we have original data structure in session state
    let hasOriginalDataInSession = false;
    try {
      const sessionRealData = window.sessionStorage.getItem('realData');
      const sessionSyntheticData = window.sessionStorage.getItem('syntheticData');
      
      if (sessionRealData && sessionSyntheticData) {
        const realData = JSON.parse(sessionRealData);
        const syntheticData = JSON.parse(sessionSyntheticData);
        
        hasOriginalDataInSession = realData.data && syntheticData.data && 
                                 Array.isArray(realData.data) && Array.isArray(syntheticData.data) &&
                                 realData.data.length > 0 && syntheticData.data.length > 0;
      }
    } catch (error) {
      console.warn('Failed to check session state data:', error);
    }
    
    // If we have original data in either place, we can generate plots
    return !(hasOriginalDataInMetadata || hasOriginalDataInSession);
  }, [metadata]);

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

  // Calculate optimal plot dimensions based on screen characteristics
  const calculatePlotDimensions = useCallback((containerWidth, containerHeight, sidebarVisible) => {
    const availableWidth = sidebarVisible && !sidebarCollapsed ? 
      containerWidth * ((100 - sidebarWidth) / 100) : containerWidth;
    
    // Get screen characteristics
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const screenRatio = viewportWidth / viewportHeight;
    const containerRatio = availableWidth / containerHeight;
    
    // Calculate optimal plot dimensions based on screen type and ratio
    let plotWidth, plotHeight;
    
    // Screen-aware aspect ratio selection
    if (viewportWidth < 768) {
      // Mobile: Portrait-friendly ratios
      if (screenRatio < 0.75) {
        // Very tall phones (iPhone X, etc.)
        plotWidth = availableWidth;
        plotHeight = availableWidth * 0.85; // Slightly wider than square
      } else {
        // Standard mobile
        plotWidth = availableWidth;
        plotHeight = availableWidth * 0.75; // 4:3 ratio
      }
    } else if (viewportWidth < 1024) {
      // Tablet: Balanced ratios that work in both orientations
      if (screenRatio > 1.3) {
        // Landscape tablet
        plotWidth = Math.min(availableWidth, containerHeight * 1.4);
        plotHeight = plotWidth / 1.4; // 7:5 ratio
      } else {
        // Portrait tablet or square-ish
        plotWidth = availableWidth;
        plotHeight = availableWidth / 1.2; // 6:5 ratio
      }
    } else if (viewportWidth < 1440) {
      // Desktop: Optimize for common screen ratios
      if (screenRatio > 1.7) {
        // Wide screens (16:9, 16:10)
        plotWidth = Math.min(availableWidth, containerHeight * 1.6);
        plotHeight = plotWidth / 1.6; // 8:5 ratio (golden-like)
      } else if (screenRatio > 1.4) {
        // Standard desktop (4:3, 5:4)
        plotWidth = Math.min(availableWidth, containerHeight * 1.3);
        plotHeight = plotWidth / 1.3; // 13:10 ratio
      } else {
        // Tall or square screens
        plotWidth = availableWidth;
        plotHeight = availableWidth / 1.1; // Nearly square
      }
    } else {
      // Large screens: Premium aspect ratios
      if (screenRatio > 2.0) {
        // Ultra-wide screens (21:9, 32:9)
        plotWidth = Math.min(availableWidth, containerHeight * 1.8);
        plotHeight = plotWidth / 1.8; // 9:5 ratio
      } else if (screenRatio > 1.6) {
        // Wide screens (16:9, 16:10)
        plotWidth = Math.min(availableWidth, containerHeight * 1.618);
        plotHeight = plotWidth / 1.618; // Golden ratio
      } else {
        // Standard or tall screens
        plotWidth = Math.min(availableWidth, containerHeight * 1.4);
        plotHeight = plotWidth / 1.4; // 7:5 ratio
      }
    }
    
    // Ensure the plot fits within the container
    if (plotWidth > availableWidth) {
      plotWidth = availableWidth;
      plotHeight = plotWidth / (plotWidth / plotHeight); // Maintain ratio
    }
    if (plotHeight > containerHeight) {
      plotHeight = containerHeight;
      plotWidth = plotHeight * (plotWidth / plotHeight); // Maintain ratio
    }
    
    // Apply reasonable minimum and maximum constraints
    const minDimension = Math.min(viewportWidth * 0.2, viewportHeight * 0.2);
    const maxDimension = Math.min(viewportWidth * 0.8, viewportHeight * 0.8);
    
    plotWidth = Math.max(plotWidth, Math.max(350, minDimension));
    plotHeight = Math.max(plotHeight, Math.max(280, minDimension));
    
    plotWidth = Math.min(plotWidth, maxDimension);
    plotHeight = Math.min(plotHeight, maxDimension);
    
    // Final ratio adjustment to prevent extreme ratios
    const finalRatio = plotWidth / plotHeight;
    if (finalRatio > 2.5) {
      plotHeight = plotWidth / 2.5;
    } else if (finalRatio < 0.6) {
      plotWidth = plotHeight * 0.6;
    }
    
    return { plotWidth, plotHeight };
  }, [sidebarWidth, sidebarCollapsed]);

  // Generate histogram data for selected points
  const generateHistogramData = useCallback(() => {
    if (selectedPoints.length === 0) return null;
    
    const originalData = getOriginalData();
    if (!originalData || histogramColumn >= originalData.headers.length) return null;

    const selectedData = selectedPoints
      .filter(embeddingIndex => {
        // Validate embedding index
        const isValidEmbeddingIndex = embeddingIndex >= 0 && embeddingIndex < data.length;
        const hasEmbeddingLabel = metadata.labels[embeddingIndex];
        return isValidEmbeddingIndex && hasEmbeddingLabel;
      })
      .map(embeddingIndex => {
        const pointLabel = metadata.labels[embeddingIndex];
        
        // Try direct mapping first
        if (embeddingIndex >= 0 && embeddingIndex < originalData.data.length && 
            originalData.labels[embeddingIndex] === pointLabel) {
          
          const originalDataPoint = originalData.data[embeddingIndex];
          if (originalDataPoint && Array.isArray(originalDataPoint) && originalDataPoint.length > histogramColumn) {
            return {
              value: originalDataPoint[histogramColumn],
              label: pointLabel,
              index: embeddingIndex
            };
          }
        }
        
        // Fallback: find matching data in original dataset
        for (let i = 0; i < originalData.data.length; i++) {
          if (originalData.labels[i] === pointLabel && 
              originalData.data[i] && 
              Array.isArray(originalData.data[i]) && 
              originalData.data[i].length > histogramColumn) {
            return {
              value: originalData.data[i][histogramColumn],
              label: pointLabel,
              index: i
            };
          }
        }
        
        return null; // Invalid data point
      })
      .filter(item => item !== null); // Remove invalid entries
    
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
  }, [selectedPoints, histogramColumn, getOriginalData, data, metadata]);

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

    // FIXED: Map embedding indices to original data indices correctly
    selectedPoints.forEach(embeddingIndex => {
      // Check if this is a valid embedding index
      if (embeddingIndex < 0 || embeddingIndex >= data.length || !metadata.labels[embeddingIndex]) {
        return;
      }

      // Get the label for this embedding point
      const pointLabel = metadata.labels[embeddingIndex];
      
      // Get the coordinates for this embedding point
      const embeddingCoords = data[embeddingIndex];
      if (!embeddingCoords || !Array.isArray(embeddingCoords)) {
        return;
      }

      // Now we need to find this point in the original data
      // Since embedding coordinates correspond to original data points,
      // we need to map back to the original data structure
      
      // The embedding data should maintain the same order as the combined original data
      // But let's be more robust and find the corresponding original data point
      
      // For now, use the embedding index directly but validate it exists in original data
      if (embeddingIndex >= 0 && embeddingIndex < originalData.data.length && 
          originalData.labels[embeddingIndex] === pointLabel) {
        
        const originalDataPoint = originalData.data[embeddingIndex];
        if (originalDataPoint && Array.isArray(originalDataPoint)) {
          if (pointLabel === 'Real') {
            selectedRealData.push(originalDataPoint);
          } else if (pointLabel === 'Synthetic') {
            selectedSyntheticData.push(originalDataPoint);
          }
        }
      } else {
        // If direct mapping fails, we need to find the correct original data point
        // This happens when there's a mismatch between embedding and original data ordering
        console.warn(`Index mismatch detected for embedding point ${embeddingIndex} with label ${pointLabel}`);
        
        // As a fallback, try to find matching data in the original dataset
        // This is less efficient but more robust
        let foundInOriginal = false;
        for (let i = 0; i < originalData.data.length && !foundInOriginal; i++) {
          if (originalData.labels[i] === pointLabel && originalData.data[i] && Array.isArray(originalData.data[i])) {
            // Additional validation could go here if needed
            if (pointLabel === 'Real') {
              selectedRealData.push(originalData.data[i]);
            } else if (pointLabel === 'Synthetic') {
              selectedSyntheticData.push(originalData.data[i]);
            }
            foundInOriginal = true;
          }
        }
      }
    });

    // Check if we have any data to send
    if (selectedRealData.length === 0 && selectedSyntheticData.length === 0) {
      console.error('No valid data to send to API');
      console.log('Debug info:', {
        selectedPointsCount: selectedPoints.length,
        originalDataLength: originalData.data.length,
        embeddingDataLength: data.length,
        labelsLength: metadata.labels.length
      });
      setPlotError('No valid data points found for the selected column');
      setPlotLoading(false);
      return;
    }

    console.log(`Selected data: ${selectedRealData.length} real, ${selectedSyntheticData.length} synthetic`);

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
  }, [selectedPoints, histogramColumn, histogramPlotType, generateHistogramData, getOriginalData, data, metadata]);

  // Auto-set plot type when column changes (using same logic as DistributionPlot.js)
  useEffect(() => {
    const originalData = getOriginalData();
    if (originalData && originalData.headers.length > 0 && histogramColumn < originalData.headers.length) {
      const columnDataType = classifyColumnType(histogramColumn, originalData);
      
      // Check if current plot type is compatible with new data type (same logic as DistributionPlot.js)
      const numericPlotTypes = ['histogram', 'violin'];
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
      case 'histogram': {
        // Check if this is a discrete variable
        const originalData = getOriginalData();
        const isDiscrete = originalData ? isDiscreteVariable(histogramColumn, originalData) : false;
        
        if (isDiscrete) {
          // Render discrete histogram with gaps - separate side by side plots
          // Convert to percentages for discrete variables
          const realValueCounts = {};
          plotData.real_values.forEach(val => {
            realValueCounts[val] = (realValueCounts[val] || 0) + 1;
          });
          
          const syntheticValueCounts = {};
          plotData.synthetic_values.forEach(val => {
            syntheticValueCounts[val] = (syntheticValueCounts[val] || 0) + 1;
          });
          
          const realTotal = plotData.real_values.length;
          const syntheticTotal = plotData.synthetic_values.length;
          
          // Convert counts to percentages
          const realValuesWithPercentages = [];
          const realPercentages = [];
          Object.entries(realValueCounts).forEach(([value, count]) => {
            realValuesWithPercentages.push(value);
            realPercentages.push((count / realTotal) * 100);
          });
          
          const syntheticValuesWithPercentages = [];
          const syntheticPercentages = [];
          Object.entries(syntheticValueCounts).forEach(([value, count]) => {
            syntheticValuesWithPercentages.push(value);
            syntheticPercentages.push((count / syntheticTotal) * 100);
          });
          
          return (
            <Box sx={{ display: 'flex', gap: 1, height: '300px' }}>
              <Box sx={{ flex: 1, minHeight: '300px', backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#2563eb', mb: 1 }}>
                  Real Data
                </Typography>
                <Plot
                  data={[
                    {
                      x: realValuesWithPercentages,
                      y: realPercentages,
                      type: 'bar',
                      name: 'Real',
                      marker: { color: '#2563eb' },
                      opacity: 0.7
                    }
                  ]}
                  layout={{
                    margin: { l: 40, r: 20, t: 20, b: 40 },
                    showlegend: false,
                    xaxis: { 
                      title: '',
                      type: 'category'  // Treat as categories to add gaps
                    },
                    yaxis: { title: 'Percentage (%)' },
                    bargap: 0.1  // Add gaps between bars
                  }}
                  style={{ width: '100%', height: '260px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
              
              <Box sx={{ flex: 1, minHeight: '300px', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#dc2626', mb: 1 }}>
                  Synthetic Data
                </Typography>
                <Plot
                  data={[
                    {
                      x: syntheticValuesWithPercentages,
                      y: syntheticPercentages,
                      type: 'bar',
                      name: 'Synthetic',
                      marker: { color: '#dc2626' },
                      opacity: 0.7
                    }
                  ]}
                  layout={{
                    margin: { l: 40, r: 20, t: 20, b: 40 },
                    showlegend: false,
                    xaxis: { 
                      title: '',
                      type: 'category'  // Treat as categories to add gaps
                    },
                    yaxis: { title: 'Percentage (%)' },
                    bargap: 0.1  // Add gaps between bars
                  }}
                  style={{ width: '100%', height: '260px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            </Box>
          );
        }
        
        // Regular continuous histogram with overlay
        // Calculate shared bins and range for proper overlay comparison
        const combinedValues = [...plotData.real_values, ...plotData.synthetic_values];
        
        // Handle edge cases
        if (combinedValues.length === 0) {
          return <Typography>No data available for histogram</Typography>;
        }
        
        const minValue = Math.min(...combinedValues);
        const maxValue = Math.max(...combinedValues);
        const range = maxValue - minValue;
        
        // Handle case where all values are identical
        if (range === 0) {
          const singleValue = minValue;
          const sharedXBins = {
            start: singleValue - 0.5,
            end: singleValue + 0.5,
            size: 1
          };
          
          return (
            <Plot
              data={[
                {
                  x: plotData.real_values,
                  type: 'histogram',
                  name: 'Real',
                  marker: { color: '#2563eb' },
                  opacity: 0.5,
                  histnorm: 'count',
                  xbins: sharedXBins
                },
                {
                  x: plotData.synthetic_values,
                  type: 'histogram',
                  name: 'Synthetic',
                  marker: { color: '#dc2626' },
                  opacity: 0.5,
                  histnorm: 'count',
                  xbins: sharedXBins
                }
              ]}
              layout={{
                margin: { l: 60, r: 20, t: 20, b: 40 },
                barmode: 'overlay',
                xaxis: { 
                  title: '',
                  range: [singleValue - 1, singleValue + 1]
                },
                yaxis: { title: 'Count' },
                legend: { x: 0.7, y: 0.9 }
              }}
              style={{ width: '100%', height: '300px' }}
              config={{ displayModeBar: false }}
            />
          );
        }
        
        const binSize = range / 30; // 30 bins total
        
        const sharedXBins = {
          start: minValue,
          end: maxValue,
          size: binSize
        };
        
        return (
          <Plot
            data={[
              {
                x: plotData.real_values,
                type: 'histogram',
                name: 'Real',
                marker: { color: '#2563eb' },
                opacity: 0.5,
                histnorm: 'probability density',
                xbins: sharedXBins
              },
              {
                x: plotData.synthetic_values,
                type: 'histogram',
                name: 'Synthetic',
                marker: { color: '#dc2626' },
                opacity: 0.5,
                histnorm: 'probability density',
                xbins: sharedXBins
              }
            ]}
            layout={{
              margin: { l: 60, r: 20, t: 20, b: 40 },
              barmode: 'overlay',
              xaxis: { 
                title: '',
                range: [minValue - range * 0.05, maxValue + range * 0.05] // Add 5% padding
              },
              yaxis: { title: 'Probability Density' },
              legend: { x: 0.7, y: 0.9 }
            }}
            style={{ width: '100%', height: '300px' }}
            config={{ displayModeBar: false }}
          />
        );
      }



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
        // Convert counts to percentages
        const realTotal = plotData.real_counts.reduce((sum, count) => sum + count, 0);
        const syntheticTotal = plotData.synthetic_counts.reduce((sum, count) => sum + count, 0);
        
        const realPercentages = realTotal > 0 
          ? plotData.real_counts.map(count => (count / realTotal) * 100)
          : plotData.real_counts.map(() => 0);
          
        const syntheticPercentages = syntheticTotal > 0
          ? plotData.synthetic_counts.map(count => (count / syntheticTotal) * 100)
          : plotData.synthetic_counts.map(() => 0);
          
        return (
          <Plot
            data={[
              {
                x: plotData.categories,
                y: realPercentages,
                type: 'bar',
                name: 'Real',
                marker: { color: '#2563eb' },
                opacity: 0.7
              },
              {
                x: plotData.categories,
                y: syntheticPercentages,
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
              yaxis: { title: 'Percentage (%)' },
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
    const containerWidth = rect.width > 0 ? rect.width : 800;
    const containerHeight = rect.height > 0 ? rect.height : 600;
    
    // Calculate responsive plot area based on sidebar state
    const shouldShowSidebar = selectedPoints.length > 0;
    const { plotWidth, plotHeight } = calculatePlotDimensions(containerWidth, containerHeight, shouldShowSidebar);
    
    // Early return if dimensions are too small
    if (plotWidth < 350 || plotHeight < 280) {
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
    if (!svgRef.current) {
      console.warn('SVG ref is null, skipping D3 visualization');
      return;
    }
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
    
    // Enhanced responsive margins for proper axis label display
    const baseMargin = {
      top: Math.max(25, Math.min(40, plotHeight * 0.06)),
      // Increase right margin when sidebar is visible to ensure legend fits
      right: shouldShowSidebar && !sidebarCollapsed ? 
        Math.max(140, Math.min(180, plotWidth * 0.18)) : 
        Math.max(120, Math.min(160, plotWidth * 0.16)),
      // Increased bottom margin for x-axis label
      bottom: Math.max(60, Math.min(80, plotHeight * 0.12)),
      // Increased left margin for y-axis label
      left: Math.max(60, Math.min(80, plotWidth * 0.1))
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

    // Calculate responsive font sizes and spacing
    const baseFontSize = Math.max(10, Math.min(14, plotWidth / 60));
    const labelFontSize = Math.max(12, Math.min(16, plotWidth / 50));
    const axisSpacing = Math.max(30, Math.min(50, plotHeight / 15));
    
    // Add axes with proper tick formatting
    const xAxis = g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .attr("class", "axis x-axis")
      .style("shape-rendering", "crispEdges")
      .call(d3.axisBottom(xScale)
        .ticks(Math.max(4, Math.min(8, Math.floor(plotWidth / 100))))
        .tickFormat(d3.format(".2f")));

    // X-axis label with better positioning
    xAxis.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", axisSpacing * devicePixelRatio)
      .attr("text-anchor", "middle")
      .attr("fill", "#1f2937")
      .attr("font-weight", "600")
      .style("font-size", `${labelFontSize}px`)
      .style("font-family", "system-ui, -apple-system, BlinkMacSystemFont, sans-serif")
      .style("text-rendering", "optimizeLegibility")
      .text(`${(metadata?.method || 'Embedding').toUpperCase()} Component 1`);

    const yAxis = g.append("g")
      .attr("class", "axis y-axis")
      .style("shape-rendering", "crispEdges")
      .call(d3.axisLeft(yScale)
        .ticks(Math.max(4, Math.min(8, Math.floor(plotHeight / 80))))
        .tickFormat(d3.format(".2f")));

    // Y-axis label with better positioning
    yAxis.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -axisSpacing * devicePixelRatio)
      .attr("x", -innerHeight / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#1f2937")
      .attr("font-weight", "600")
      .style("font-size", `${labelFontSize}px`)
      .style("font-family", "system-ui, -apple-system, BlinkMacSystemFont, sans-serif")
      .style("text-rendering", "optimizeLegibility")
      .text(`${(metadata?.method || 'Embedding').toUpperCase()} Component 2`);

    // Style axes with better visibility
    svg.selectAll(".axis line, .axis path")
      .style("stroke", "#d1d5db")
      .style("stroke-width", `${Math.max(1, devicePixelRatio)}px`)
      .style("shape-rendering", "crispEdges");

    // Style axis tick labels
    svg.selectAll(".axis text")
      .style("font-size", `${baseFontSize}px`)
      .style("font-family", "system-ui, -apple-system, BlinkMacSystemFont, sans-serif")
      .style("fill", "#6b7280")
      .style("text-rendering", "optimizeLegibility");

    // Add subtle grid lines for better readability
    g.selectAll(".grid-line-x")
      .data(xScale.ticks(Math.max(4, Math.min(8, Math.floor(plotWidth / 100)))))
      .enter()
      .append("line")
      .attr("class", "grid-line-x")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .style("stroke", "#f3f4f6")
      .style("stroke-width", "1px")
      .style("opacity", 0.5);

    g.selectAll(".grid-line-y")
      .data(yScale.ticks(Math.max(4, Math.min(8, Math.floor(plotHeight / 80)))))
      .enter()
      .append("line")
      .attr("class", "grid-line-y")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .style("stroke", "#f3f4f6")
      .style("stroke-width", "1px")
      .style("opacity", 0.5);

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
              Click to select • ${(metadata?.method || 'Embedding').toUpperCase()} embedding
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
          (currentDataType === 'numeric' && ['histogram', 'violin'].includes(histogramPlotType)) ||
          (currentDataType === 'categorical' && histogramPlotType === 'bar');
        
        if (!isValidCombination) {
          // Auto-set appropriate plot type - choose the most informative
          const defaultPlotType = currentDataType === 'numeric' ? 'histogram' : 'bar';
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
      const numericPlotTypes = ['histogram', 'violin'];
      const categoricalPlotTypes = ['bar'];
      
      const isCurrentPlotCompatible = 
        (firstColumnDataType === 'numeric' && numericPlotTypes.includes(histogramPlotType)) ||
        (firstColumnDataType === 'categorical' && categoricalPlotTypes.includes(histogramPlotType));
      
      // Only update if current plot type is not compatible
      if (!isCurrentPlotCompatible) {
        const defaultPlotType = firstColumnDataType === 'numeric' ? 'histogram' : 'bar';
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

  // 🎯 SIMPLIFIED AUTO-RESIZE LOGIC - Fully automatic
  useEffect(() => {
    // Don't auto-resize if user has manually collapsed the sidebar
    if (sidebarCollapsed) return;
    
    // Get current viewport dimensions
    const viewportWidth = window.innerWidth;
    
    // Calculate ideal sidebar width based on viewport size only
    const calculateIdealSidebarWidth = () => {
      let idealWidth;
      if (viewportWidth < 768) {
        idealWidth = 40; // Mobile: reasonable sidebar for touch
      } else if (viewportWidth < 1024) {
        idealWidth = 35; // Tablet: balanced
      } else if (viewportWidth < 1440) {
        idealWidth = 30; // Desktop: more plot space
      } else {
        idealWidth = 25; // Large screens: maximize plot area
      }
      
      // Adjust based on selection state - expand when data is available
      if (selectedPoints.length > 0 && plotData) {
        idealWidth = Math.min(idealWidth + 5, 45); // Expand for better plot visibility
      }
      
      return idealWidth;
    };
    
    const idealWidth = calculateIdealSidebarWidth();
    
    // Only adjust if there's a meaningful difference (avoid constant small adjustments)
    if (Math.abs(sidebarWidth - idealWidth) > 3) {
      setSidebarWidth(idealWidth);
    }
  }, [selectedPoints.length, plotData, sidebarWidth, sidebarCollapsed]);

  // Responsive sidebar adjustments on window resize
  useEffect(() => {
    const handleResize = () => {
      if (sidebarCollapsed) return;
      
      const viewportWidth = window.innerWidth;
      let newWidth;
      
      if (viewportWidth < 768) {
        newWidth = 40;
      } else if (viewportWidth < 1024) {
        newWidth = 35;
      } else if (viewportWidth < 1440) {
        newWidth = 30;
      } else {
        newWidth = 25;
      }
      
      // Expand if there's active data
      if (selectedPoints.length > 0 && plotData) {
        newWidth = Math.min(newWidth + 5, 45);
      }
      
      setSidebarWidth(newWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarCollapsed, selectedPoints.length, plotData]);

  // Toggle sidebar collapse/expand with intelligent width restoration
  const toggleSidebarExpansion = useCallback(() => {
    const newCollapsedState = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsedState);
    
    if (newCollapsedState) {
      setSidebarWidth(0);
    } else {
      // Restore to intelligent width based on current viewport
      const viewportWidth = window.innerWidth;
      let restoredWidth;
      
      if (viewportWidth < 768) {
        restoredWidth = 40;
      } else if (viewportWidth < 1024) {
        restoredWidth = 35;
      } else if (viewportWidth < 1440) {
        restoredWidth = 30;
      } else {
        restoredWidth = 25;
      }
      
      // Expand if there's active data
      if (selectedPoints.length > 0 && plotData) {
        restoredWidth = Math.min(restoredWidth + 5, 45);
      }
      
      setSidebarWidth(restoredWidth);
    }
  }, [sidebarCollapsed, selectedPoints.length, plotData]);

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
                aria-label="Clear selection"
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
              aria-label="Select all"
              onClick={selectAllPoints}
              sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
            >
              <SelectAll fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

                {/* Plot Info Status */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: 16, 
          zIndex: 10,
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap'
        }}>
          <Chip
            label={`${data?.length || 0} points`}
            size="small"
            variant="outlined"
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              fontSize: '11px'
            }}
          />
          {/* Removed aspect ratio display chip - keeping logic for background calculations */}
        </Box>

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
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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

          {/* Distribution Controls - Show when we have original data available */}
          {originalData && originalData.headers && originalData.headers.length > 0 ? (
            <>
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
            </>
          ) : (
            /* Simple message when no data available for distribution plots */
            selectedPoints.length > 0 && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100px',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'grey.50'
              }}>
                <Typography variant="body2" color="text.secondary">
                  Distribution analysis not available for this embedding
                </Typography>
              </Box>
            )
          )}

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