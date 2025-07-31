import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, Chip, IconButton, Tooltip, Divider, CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Clear, SelectAll, BarChart, CropFree, UnfoldLess, Warning, Download } from '@mui/icons-material';
import Plot from 'react-plotly.js';
import { generateDistributionPlot } from '../services/api';
import { classifyColumnType, getAvailablePlotTypes, isDiscreteVariable } from '../utils/dataUtils';
import anomalyDetectionService from '../services/anomalyDetectionService';

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
  const [histogramColumn, setHistogramColumn] = useState(0);
  const [histogramPlotType, setHistogramPlotType] = useState('histogram');

  const [plotData, setPlotData] = useState(null);
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState(null);
  
  // Anomaly detection state
  const [anomalyResults, setAnomalyResults] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyError, setAnomalyError] = useState(null);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [contamination, setContamination] = useState('auto');
  
  // Interactive filtering state
  const [showSyntheticNormal, setShowSyntheticNormal] = useState(true);
  const [showSyntheticAnomalies, setShowSyntheticAnomalies] = useState(true);
  const [showRealNormal, setShowRealNormal] = useState(true);
  const [showRealAnomalies, setShowRealAnomalies] = useState(true);
  
  // Helper functions for filter controls - Fixed null reference issues
  const showAllData = useCallback(() => {
    setShowRealNormal(true);
    setShowRealAnomalies(true);
    setShowSyntheticNormal(true);
    setShowSyntheticAnomalies(true);
  }, []);
  
  const hideAllData = useCallback(() => {
    setShowRealNormal(false);
    setShowRealAnomalies(false);
    setShowSyntheticNormal(false);
    setShowSyntheticAnomalies(false);
  }, []);
  
  const showOnlyAnomalies = useCallback(() => {
    setShowRealNormal(false);
    setShowRealAnomalies(true);
    setShowSyntheticNormal(false);
    setShowSyntheticAnomalies(true);
  }, []);
  
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
  
  // Get only visible points based on current filter state
  const getVisiblePoints = useCallback(() => {
    if (!data || !metadata) return [];
    
    const visibleIndices = [];
    
    data.forEach((point, embeddingIndex) => {
      const label = metadata.labels[embeddingIndex];
      
      // Check if this point should be visible based on current filters
      let shouldBeVisible = false;
      
      if (label === 'Real') {
        // For real data, check if we have anomaly results
        if (anomalyResults && anomalyResults.real_data) {
          const originalData = getOriginalData();
          if (originalData) {
            let realIndexInOriginal = 0;
            for (let j = 0; j < embeddingIndex; j++) {
              if (originalData.labels[j] === 'Real') {
                realIndexInOriginal++;
              }
            }
            
            if (realIndexInOriginal < anomalyResults.real_data.length) {
              const realPoint = anomalyResults.real_data[realIndexInOriginal];
              if (realPoint && realPoint.is_anomaly) {
                shouldBeVisible = showRealAnomalies;
              } else {
                shouldBeVisible = showRealNormal;
              }
            } else {
              shouldBeVisible = showRealNormal; // Fallback
            }
          } else {
            shouldBeVisible = showRealNormal; // Fallback
          }
        } else {
          shouldBeVisible = showRealNormal; // No anomaly data, treat as normal
        }
      } else if (label === 'Synthetic') {
        // For synthetic data, check if we have anomaly results
        if (anomalyResults && anomalyResults.synthetic_data) {
          const originalData = getOriginalData();
          if (originalData) {
            let syntheticIndexInOriginal = 0;
            for (let j = 0; j < embeddingIndex; j++) {
              if (originalData.labels[j] === 'Synthetic') {
                syntheticIndexInOriginal++;
              }
            }
            
            if (syntheticIndexInOriginal < anomalyResults.synthetic_data.length) {
              const syntheticPoint = anomalyResults.synthetic_data[syntheticIndexInOriginal];
              if (syntheticPoint && syntheticPoint.is_anomaly) {
                shouldBeVisible = showSyntheticAnomalies;
              } else {
                shouldBeVisible = showSyntheticNormal;
              }
            } else {
              shouldBeVisible = showSyntheticNormal; // Fallback
            }
          } else {
            shouldBeVisible = showSyntheticNormal; // Fallback
          }
        } else {
          shouldBeVisible = showSyntheticNormal; // No anomaly data, treat as normal
        }
      }
      
      if (shouldBeVisible) {
        visibleIndices.push(embeddingIndex);
      }
    });
    
    return visibleIndices;
  }, [data, metadata, anomalyResults, showRealNormal, showRealAnomalies, showSyntheticNormal, showSyntheticAnomalies, getOriginalData]);
  
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

  // Calculate optimal plot dimensions based on screen characteristics
  const calculatePlotDimensions = useCallback((containerWidth, containerHeight, sidebarVisible) => {
    const availableWidth = sidebarVisible && !sidebarCollapsed ? 
      containerWidth * ((100 - sidebarWidth) / 100) : containerWidth;
    
    // Get screen characteristics
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const screenRatio = viewportWidth / viewportHeight;
    const containerRatio = availableWidth / containerHeight;
    
    // More aggressive space utilization - use most of the available container
    let plotWidth, plotHeight;
    
    // Use container ratio to determine optimal dimensions - maximize space utilization
    if (containerRatio > 2.5) {
      // Extremely wide container - prioritize height to match sidebar
      plotHeight = containerHeight * 0.98; // Use 98% of available height
      plotWidth = Math.min(availableWidth * 0.98, plotHeight * 2.0); // Increased width constraint to 2.0:1 ratio
    } else if (containerRatio > 1.5) {
      // Wide container - prioritize height to match sidebar
      plotHeight = containerHeight * 0.98; // Use 98% of available height
      plotWidth = Math.min(availableWidth * 0.98, plotHeight * 1.8); // Increased width constraint to 1.8:1 ratio
    } else if (containerRatio < 0.8) {
      // Tall container - maximize both dimensions
      plotWidth = availableWidth * 0.98; // Use 98% of available width
      plotHeight = containerHeight * 0.98; // Use 98% of available height
    } else {
      // Balanced container - maximize both dimensions
      plotWidth = availableWidth * 0.98; // Use 98% of available width
      plotHeight = containerHeight * 0.98; // Use 98% of available height
    }
    
    // Ensure the plot fits within the container with minimal safety margin
    if (plotWidth > availableWidth * 0.995) {
      plotWidth = availableWidth * 0.995;
    }
    if (plotHeight > containerHeight * 0.995) {
      plotHeight = containerHeight * 0.995;
    }
    
    // Apply minimum constraints only (remove overly restrictive maximum constraints)
    const minWidth = Math.max(400, viewportWidth * 0.15);
    const minHeight = Math.max(400, viewportHeight * 0.20); // Increased minimum height
    
    plotWidth = Math.max(plotWidth, minWidth);
    plotHeight = Math.max(plotHeight, minHeight);
    
    // Final ratio adjustment to prevent extreme ratios - allow wider plots when sidebar is present
    const finalRatio = plotWidth / plotHeight;
    const maxRatio = shouldShowSidebar && !sidebarCollapsed ? 2.8 : 2.5; // Allow wider plots when sidebar is present
    if (finalRatio > maxRatio) {
      // For extremely wide plots, constrain to maxRatio:1 ratio
      plotHeight = plotWidth / maxRatio;
    } else if (finalRatio < 0.4) {
      plotWidth = plotHeight * 0.4;
    }
    
    console.log('Calculated plot dimensions:', { plotWidth, plotHeight, ratio: plotWidth / plotHeight });
    return { plotWidth, plotHeight };
  }, [sidebarWidth, sidebarCollapsed]);

  // Generate histogram data for selected points
  const generateHistogramData = useCallback(() => {
    if (selectedPoints.length === 0) return null;
    
    const originalData = getOriginalData();
    if (!originalData || histogramColumn >= originalData.headers.length) return null;

    // Get visible points based on current filter state
    const visiblePoints = getVisiblePoints();
    
    // Filter selectedPoints to only include visible points
    const visibleSelectedPoints = selectedPoints.filter(pointIndex => 
      visiblePoints.includes(pointIndex)
    );
    
    if (visibleSelectedPoints.length === 0) {
      return {
        realValues: [],
        syntheticValues: [],
        columnName: originalData.headers[histogramColumn] || `Column ${histogramColumn + 1}`,
        totalSelected: 0,
        realSelected: 0,
        syntheticSelected: 0,
        dataType: 'categorical',
        availablePlotTypes: ['bar'],
        dataTypeFilter: 'mixed' // 'real-only', 'synthetic-only', or 'mixed'
      };
    }

    const selectedData = visibleSelectedPoints
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
      .filter(item => item !== null);
    
    const realValues = selectedData.filter(d => d.label === 'Real').map(d => d.value);
    const syntheticValues = selectedData.filter(d => d.label === 'Synthetic').map(d => d.value);
    
    // Determine if we have only one type of data selected
    let dataTypeFilter = 'mixed';
    if (realValues.length > 0 && syntheticValues.length === 0) {
      dataTypeFilter = 'real-only';
    } else if (syntheticValues.length > 0 && realValues.length === 0) {
      dataTypeFilter = 'synthetic-only';
    }
    
    // Classify data type for this column
    const dataType = classifyColumnType(histogramColumn, originalData);
    const availablePlotTypes = getAvailablePlotTypes(dataType);
    
    return {
      realValues,
      syntheticValues,
      columnName: originalData.headers[histogramColumn] || `Column ${histogramColumn + 1}`,
      totalSelected: visibleSelectedPoints.length,
      realSelected: realValues.length,
      syntheticSelected: syntheticValues.length,
      dataType,
      availablePlotTypes,
      dataTypeFilter
    };
  }, [selectedPoints, histogramColumn, getOriginalData, data, metadata, getVisiblePoints]);

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

    // Get visible points based on current filter state
    const visiblePoints = getVisiblePoints();
    
    // Filter selectedPoints to only include visible points
    const visibleSelectedPoints = selectedPoints.filter(pointIndex => 
      visiblePoints.includes(pointIndex)
    );

    // Prepare selected data in the same format as the full dataset
    const selectedRealData = [];
    const selectedSyntheticData = [];

    // FIXED: Map embedding indices to original data indices correctly
    visibleSelectedPoints.forEach(embeddingIndex => {
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
        visibleSelectedPointsCount: visibleSelectedPoints.length,
        originalDataLength: originalData.data.length,
        embeddingDataLength: data.length,
        labelsLength: metadata.labels.length
      });
      setPlotError('No valid data points found for the selected column');
      setPlotLoading(false);
      return;
    }

    console.log(`Selected data: ${selectedRealData.length} real, ${selectedSyntheticData.length} synthetic`);

    // Determine the data type filter based on what's selected
    const dataTypeFilter = histogramData?.dataTypeFilter || 'mixed';

    // Use the same API as DistributionPlot.js
    const requestData = {
      real_data: selectedRealData,
      synthetic_data: selectedSyntheticData,
      column: originalData.headers[histogramColumn],
      plot_type: histogramPlotType,
      real_headers: originalData.headers,
      synthetic_headers: originalData.headers,
      data_type_filter: dataTypeFilter // Add the data type filter to the request
    };

    // Check if this is the same request as last time (avoid duplicate API calls)
    const requestKey = JSON.stringify({
      selectedPoints: visibleSelectedPoints.sort(),
      column: histogramColumn,
      plotType: histogramPlotType,
      dataTypeFilter: dataTypeFilter
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
  }, [metadata, getOriginalData, histogramColumn, histogramPlotType]);

  // Render plot using Plotly (same logic as DistributionPlot.js)
  const renderPlot = () => {
    if (!plotData) return null;
    
    // Get the data type filter from the response
    const dataTypeFilter = plotData.data_type_filter || 'mixed';
    
    // Generate appropriate title based on data type filter
    const getPlotTitle = () => {
      const columnName = plotData.column_name || `Column ${histogramColumn + 1}`;
      switch (dataTypeFilter) {
        case 'real-only':
          return `Real Data Distribution - ${columnName}`;
        case 'synthetic-only':
          return `Synthetic Data Distribution - ${columnName}`;
        case 'mixed':
        default:
          return `Data Distribution Comparison - ${columnName}`;
      }
    };
    
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
          
          // Handle single data type cases
          if (dataTypeFilter === 'real-only') {
            return (
              <Box sx={{ height: '300px' }}>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                  {getPlotTitle()}
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
                    margin: { l: 40, r: 20, t: 40, b: 40 },
                    showlegend: false,
                    xaxis: { 
                      title: '',
                      type: 'category'
                    },
                    yaxis: { title: 'Percentage (%)' },
                    bargap: 0.1
                  }}
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
                    margin: { l: 40, r: 20, t: 40, b: 40 },
                    showlegend: false,
                    xaxis: { 
                      title: '',
                      type: 'category'
                    },
                    yaxis: { title: 'Percentage (%)' },
                    bargap: 0.1
                  }}
                  style={{ width: '100%', height: '260px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            );
          } else {
            // Mixed data - show side by side
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
                        type: 'category'
                      },
                      yaxis: { title: 'Percentage (%)' },
                      bargap: 0.1
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
                        type: 'category'
                      },
                      yaxis: { title: 'Percentage (%)' },
                      bargap: 0.1
                    }}
                    style={{ width: '100%', height: '260px' }}
                    config={{ displayModeBar: false }}
                  />
                </Box>
              </Box>
            );
          }
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
          
          // Handle single data type cases
          if (dataTypeFilter === 'real-only') {
            return (
              <Box>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                  {getPlotTitle()}
                </Typography>
                <Plot
                  data={[
                    {
                      x: plotData.real_values,
                      type: 'histogram',
                      name: 'Real',
                      marker: { color: '#2563eb' },
                      opacity: 0.7,
                      histnorm: 'count',
                      xbins: sharedXBins
                    }
                  ]}
                  layout={{
                    margin: { l: 60, r: 20, t: 40, b: 40 },
                    xaxis: { 
                      title: plotData.column_name || `Column ${histogramColumn + 1}`
                    },
                    yaxis: { title: 'Count' },
                    showlegend: false
                  }}
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
                  data={[
                    {
                      x: plotData.synthetic_values,
                      type: 'histogram',
                      name: 'Synthetic',
                      marker: { color: '#dc2626' },
                      opacity: 0.7,
                      histnorm: 'count',
                      xbins: sharedXBins
                    }
                  ]}
                  layout={{
                    margin: { l: 60, r: 20, t: 40, b: 40 },
                    xaxis: { 
                      title: plotData.column_name || `Column ${histogramColumn + 1}`
                    },
                    yaxis: { title: 'Count' },
                    showlegend: false
                  }}
                  style={{ width: '100%', height: '300px' }}
                  config={{ displayModeBar: false }}
                />
              </Box>
            );
          } else {
            // Mixed data
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
                    title: plotData.column_name || `Column ${histogramColumn + 1}`
                  },
                  yaxis: { title: 'Count' }
                }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            );
          }
        }
        
        // Normal case with range > 0
        const binCount = Math.min(30, Math.ceil(Math.sqrt(combinedValues.length)));
        const binSize = range / binCount;
        const sharedXBins = {
          start: minValue - binSize * 0.1,
          end: maxValue + binSize * 0.1,
          size: binSize
        };
        
        // Handle single data type cases
        if (dataTypeFilter === 'real-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[
                  {
                    x: plotData.real_values,
                    type: 'histogram',
                    name: 'Real',
                    marker: { color: '#2563eb' },
                    opacity: 0.7,
                    histnorm: 'count',
                    xbins: sharedXBins
                  }
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 40, b: 40 },
                  xaxis: { 
                    title: plotData.column_name || `Column ${histogramColumn + 1}`
                  },
                  yaxis: { title: 'Count' },
                  showlegend: false
                }}
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
                data={[
                  {
                    x: plotData.synthetic_values,
                    type: 'histogram',
                    name: 'Synthetic',
                    marker: { color: '#dc2626' },
                    opacity: 0.7,
                    histnorm: 'count',
                    xbins: sharedXBins
                  }
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 40, b: 40 },
                  xaxis: { 
                    title: plotData.column_name || `Column ${histogramColumn + 1}`
                  },
                  yaxis: { title: 'Count' },
                  showlegend: false
                }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        } else {
          // Mixed data
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
                  title: plotData.column_name || `Column ${histogramColumn + 1}`
                },
                yaxis: { title: 'Count' }
              }}
              style={{ width: '100%', height: '300px' }}
              config={{ displayModeBar: false }}
            />
          );
        }
      }



      case 'violin':
        // Handle single data type cases
        if (dataTypeFilter === 'real-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[
                  {
                    y: plotData.real_values,
                    type: 'violin',
                    name: 'Real',
                    marker: { color: '#2563eb' },
                    opacity: 0.7,
                    box: { visible: true },
                    meanline: { visible: true }
                  }
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 40, b: 40 },
                  xaxis: { 
                    title: plotData.column_name || `Column ${histogramColumn + 1}`,
                    showticklabels: false
                  },
                  yaxis: { title: 'Value' },
                  showlegend: false
                }}
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
                data={[
                  {
                    y: plotData.synthetic_values,
                    type: 'violin',
                    name: 'Synthetic',
                    marker: { color: '#dc2626' },
                    opacity: 0.7,
                    box: { visible: true },
                    meanline: { visible: true }
                  }
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 40, b: 40 },
                  xaxis: { 
                    title: plotData.column_name || `Column ${histogramColumn + 1}`,
                    showticklabels: false
                  },
                  yaxis: { title: 'Value' },
                  showlegend: false
                }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        } else {
          // Mixed data
          return (
            <Plot
              data={[
                {
                  y: plotData.real_values,
                  type: 'violin',
                  name: 'Real',
                  marker: { color: '#2563eb' },
                  opacity: 0.5,
                  box: { visible: true },
                  meanline: { visible: true }
                },
                {
                  y: plotData.synthetic_values,
                  type: 'violin',
                  name: 'Synthetic',
                  marker: { color: '#dc2626' },
                  opacity: 0.5,
                  box: { visible: true },
                  meanline: { visible: true }
                }
              ]}
              layout={{
                margin: { l: 60, r: 20, t: 20, b: 40 },
                xaxis: { 
                  title: plotData.column_name || `Column ${histogramColumn + 1}`,
                  showticklabels: false
                },
                yaxis: { title: 'Value' }
              }}
              style={{ width: '100%', height: '300px' }}
              config={{ displayModeBar: false }}
            />
          );
        }

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
        
        // Handle single data type cases
        if (dataTypeFilter === 'real-only') {
          return (
            <Box>
              <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, color: '#2563eb' }}>
                {getPlotTitle()}
              </Typography>
              <Plot
                data={[
                  {
                    x: plotData.categories,
                    y: realPercentages,
                    type: 'bar',
                    name: 'Real',
                    marker: { color: '#2563eb' },
                    opacity: 0.7
                  }
                ]}
                layout={{
                  margin: { l: 60, r: 20, t: 40, b: 40 },
                  xaxis: { 
                    title: plotData.column_name || `Column ${histogramColumn + 1}`
                  },
                  yaxis: { title: 'Percentage (%)' },
                  showlegend: false
                }}
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
                data={[
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
                  margin: { l: 60, r: 20, t: 40, b: 40 },
                  xaxis: { 
                    title: plotData.column_name || `Column ${histogramColumn + 1}`
                  },
                  yaxis: { title: 'Percentage (%)' },
                  showlegend: false
                }}
                style={{ width: '100%', height: '300px' }}
                config={{ displayModeBar: false }}
              />
            </Box>
          );
        } else {
          // Mixed data
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
        }

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

    // Add a small delay to ensure DOM updates are complete when sidebar state changes
    const renderTimeout = setTimeout(() => {
      renderD3Plot();
    }, 50);

    return () => clearTimeout(renderTimeout);
  }, [data, metadata, pointSize, pointOpacity, selectedPoints, sidebarWidth, sidebarCollapsed, showAnomalies, anomalyResults, showRealNormal, showRealAnomalies, showSyntheticNormal, showSyntheticAnomalies, getOriginalData, calculatePlotDimensions]);

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

    // Clear previous plot
    if (!svgRef.current) {
      console.warn('SVG ref is null, skipping D3 visualization');
      return;
    }
    d3.select(svgRef.current).selectAll("*").remove();

    const effectivePlotWidth = plotWidth * devicePixelRatio;
    const effectivePlotHeight = plotHeight * devicePixelRatio;

    // Advanced point sizing based on dataset size and density (no need to multiply by devicePixelRatio since we're scaling the group)
    const basePointSize = plotWidth < 600 ? 0.8 : 1.2;
    const densityFactor = Math.max(0.3, Math.min(1.5, 1000 / Math.sqrt(numPoints)));
    const adjustedPointSize = basePointSize * densityFactor;

    // Adaptive opacity based on point density
    const baseOpacity = 0.5;
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
    
    // Optimized margins to maximize plot area while preventing overshooting
    const baseMargin = {
      top: Math.max(30, Math.min(50, plotHeight * 0.06)), // Increased top margin for y-axis
      // Right margin for legend - optimized for sidebar state
      right: shouldShowSidebar && !sidebarCollapsed ? 
        Math.max(100, Math.min(140, plotWidth * 0.15)) : 
        Math.max(140, Math.min(180, plotWidth * 0.20)), // Increased margin when sidebar is collapsed
      // Aggressive bottom margin to prevent x-axis overshooting
      bottom: Math.max(80, Math.min(100, plotHeight * 0.15)), // Slightly reduced bottom margin
      // Left margin for y-axis labels - increased for visibility when sidebar is present
      left: shouldShowSidebar && !sidebarCollapsed ? 
        Math.max(50, Math.min(80, plotWidth * 0.12)) : 
        Math.max(60, Math.min(80, plotWidth * 0.12)) // Standard margin when sidebar is collapsed
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

    // Ensure we have positive dimensions
    if (innerWidth <= 0 || innerHeight <= 0) {
      return;
    }

    // Apply scale transform on the main group to account for devicePixelRatio
    const g = svg.append("g")
      .attr("transform", `scale(${devicePixelRatio}) translate(${margin.left / devicePixelRatio},${margin.top / devicePixelRatio})`);

    // Extract coordinates and create scales
    const x = sampledData.map(d => d[0]);
    const y = sampledData.map(d => d[1]);

    // Add aggressive padding to scales to ensure points stay well within bounds
    const xExtent = d3.extent(x);
    const yExtent = d3.extent(y);
    
    // Calculate the actual data range
    const xRange = xExtent[1] - xExtent[0];
    const yRange = yExtent[1] - yExtent[0];
    
    // Add substantial padding to ensure points stay within bounds
    const xPadding = xRange * 0.20; // Increased to 20% padding
    const yPadding = yRange * 0.20; // Increased to 20% padding
    
    // Ensure we have a minimum padding even for small ranges
    const minPadding = 1.0; // Increased minimum padding in data units
    const finalXPadding = Math.max(xPadding, minPadding);
    const finalYPadding = Math.max(yPadding, minPadding);
    
    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - finalXPadding, xExtent[1] + finalXPadding])
      .range([0, innerWidth])
      .nice();

    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - finalYPadding, yExtent[1] + finalYPadding])
      .range([innerHeight, 0])
      .nice();
    
    // Validate that all data points fall within the scale domains
    const xDomain = xScale.domain();
    const yDomain = yScale.domain();
    
    // Check if any points are outside the domain and adjust if necessary
    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    const minY = Math.min(...y);
    const maxY = Math.max(...y);
    
    if (minX < xDomain[0] || maxX > xDomain[1]) {
      console.warn('X-axis data points outside domain, adjusting scale');
      xScale.domain([minX - finalXPadding, maxX + finalXPadding]);
    }
    
    if (minY < yDomain[0] || maxY > yDomain[1]) {
      console.warn('Y-axis data points outside domain, adjusting scale');
      yScale.domain([minY - finalYPadding, maxY + finalYPadding]);
    }

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
      .attr("y", axisSpacing + 5) // Increased spacing from axis
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
      .attr("transform", `rotate(-90)`)
      .attr("y", shouldShowSidebar && !sidebarCollapsed ? -axisSpacing - 5 : -axisSpacing - 10) // Reduced spacing when sidebar is present to keep label visible
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
      .style("stroke-width", "1px")
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

    // Add data points with anomaly detection - clamp coordinates to prevent overshooting
    const points = g.selectAll("circle")
      .data(sampledData)
      .enter()
      .append("circle")
      .attr("cx", (d) => {
        const x = xScale(d[0]);
        // Clamp x coordinate to prevent overshooting
        return Math.max(0, Math.min(innerWidth, x));
      })
      .attr("cy", (d) => {
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
        const originalIndex = indexMap[i];
        const label = sampledLabels[i];
        
        // Color coding based on anomaly detection results
        if (showAnomalies && anomalyResults && (anomalyResults.real_data || anomalyResults.synthetic_data)) {
          const originalData = getOriginalData();
          if (originalData) {
            if (label === 'Real') {
              // Find the real data index in the original dataset
              let realIndexInOriginal = 0;
              for (let j = 0; j < originalIndex; j++) {
                if (originalData.labels[j] === 'Real') {
                  realIndexInOriginal++;
                }
              }
              
              // Check if this point corresponds to a real point in anomaly results
              if (anomalyResults.real_data && realIndexInOriginal < anomalyResults.real_data.length) {
                const realPoint = anomalyResults.real_data[realIndexInOriginal];
                if (realPoint && realPoint.is_anomaly) {
                  return "#ef4444"; // Red for real anomalies
                } else {
                  return "#3b82f6"; // Blue for normal real data
                }
              }
            } else if (label === 'Synthetic') {
              // Find the synthetic data index in the original dataset
              let syntheticIndexInOriginal = 0;
              for (let j = 0; j < originalIndex; j++) {
                if (originalData.labels[j] === 'Synthetic') {
                  syntheticIndexInOriginal++;
                }
              }
              
              // Check if this point corresponds to a synthetic point in anomaly results
              if (anomalyResults.synthetic_data && syntheticIndexInOriginal < anomalyResults.synthetic_data.length) {
                const syntheticPoint = anomalyResults.synthetic_data[syntheticIndexInOriginal];
                if (syntheticPoint && syntheticPoint.is_anomaly) {
                  return "#ef4444"; // Red for synthetic anomalies (same as real anomalies)
                } else {
                  return "#dc2626"; // Red for normal synthetic data
                }
              }
            }
          }
        }
        
        // Default colors (when no anomaly detection or no anomaly data)
        if (label === 'Real') {
          return "#3b82f6"; // Blue for real data
        } else {
                      return "#dc2626"; // Red for synthetic data
        }
      })
      .attr("stroke", (_, i) => {
        const originalIndex = indexMap[i];
        const label = sampledLabels[i];
        
        // Thicker stroke for anomalies (both real and synthetic)
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
                  return "#991b1b"; // Darker red for real anomalies
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
                  return "#991b1b"; // Darker red for synthetic anomalies
                }
              }
            }
          }
        }
        
        return selectedPoints.includes(originalIndex) ? "#000" : d3.color(colorScale(sampledLabels[i])).darker(0.3);
      })
      .attr("stroke-width", (_, i) => {
        const originalIndex = indexMap[i];
        const label = sampledLabels[i];
        
        // Thicker stroke for anomalies (both real and synthetic)
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
                  return 1.5; // Thicker stroke for real anomalies
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
                  return 1.5; // Thicker stroke for synthetic anomalies
                }
              }
            }
          }
        }
        
        return selectedPoints.includes(originalIndex) ? 2 : 0.5;
      })
      .attr("opacity", (_, i) => {
        const originalIndex = indexMap[i];
        const label = sampledLabels[i];
        
        // Early return if anomalyResults is null to prevent errors
        if (label === 'Synthetic' && (!anomalyResults || !anomalyResults.synthetic_data)) {
          // If no anomaly data available, treat all synthetic as normal
          if (!showSyntheticNormal) return 0;
          return selectedPoints.includes(originalIndex) ? 1 : adjustedOpacity;
        }
        
        // Interactive filtering logic
        if (label === 'Real') {
          const originalData = getOriginalData();
          if (originalData) {
            let realIndexInOriginal = 0;
            for (let j = 0; j < originalIndex; j++) {
              if (originalData.labels[j] === 'Real') {
                realIndexInOriginal++;
              }
            }
            
            if (anomalyResults && anomalyResults.real_data && realIndexInOriginal < anomalyResults.real_data.length) {
              const realPoint = anomalyResults.real_data[realIndexInOriginal];
              if (realPoint && realPoint.is_anomaly) {
                // This is an anomalous real point
                if (!showRealAnomalies) return 0; // Hide real anomalies if filter is off
              } else {
                // This is a normal real point
                if (!showRealNormal) return 0; // Hide normal real if filter is off
              }
            } else {
              // Fallback for real points without anomaly data
              if (!showRealNormal) return 0;
            }
          } else {
            // Fallback for real points without original data
            if (!showRealNormal) return 0;
          }
        } else if (label === 'Synthetic') {
          const originalData = getOriginalData();
          if (originalData) {
            let syntheticIndexInOriginal = 0;
            for (let j = 0; j < originalIndex; j++) {
              if (originalData.labels[j] === 'Synthetic') {
                syntheticIndexInOriginal++;
              }
            }
            
            if (anomalyResults && anomalyResults.synthetic_data && syntheticIndexInOriginal < anomalyResults.synthetic_data.length) {
              const syntheticPoint = anomalyResults.synthetic_data[syntheticIndexInOriginal];
              if (syntheticPoint && syntheticPoint.is_anomaly) {
                // This is an anomalous synthetic point
                if (!showSyntheticAnomalies) return 0; // Hide anomalies if filter is off
              } else {
                // This is a normal synthetic point
                if (!showSyntheticNormal) return 0; // Hide normal synthetic if filter is off
              }
            } else {
              // Fallback for synthetic points without anomaly data
              if (!showSyntheticNormal) return 0;
            }
          } else {
            // Fallback for synthetic points without original data
            if (!showSyntheticNormal) return 0;
          }
        }
        
        // Higher opacity for anomalies when shown
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
                return 0.9; // Higher opacity for anomalies
              }
            }
          }
        }
        
        return selectedPoints.includes(originalIndex) ? 1 : adjustedOpacity;
      })
      // Add interactive hover effects
      .style("cursor", "pointer")
      .on("mouseover", function(event, d, i) {
        const originalIndex = indexMap[i];
        const label = sampledLabels[i];
        
        // Create tooltip content
        let tooltipContent = `<strong>${label} Data Point</strong><br/>`;
        tooltipContent += `Index: ${originalIndex}<br/>`;
        tooltipContent += `Coordinates: (${d[0].toFixed(3)}, ${d[1].toFixed(3)})<br/>`;
        
        // Add anomaly information if available
        if (showAnomalies && anomalyResults) {
          const originalData = getOriginalData();
          if (originalData) {
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
                  tooltipContent += `Anomaly Score: ${realPoint.score?.toFixed(3) || 'N/A'}<br/>`;
                  tooltipContent += `Status: ${realPoint.is_anomaly ? 'Anomalous' : 'Normal'}<br/>`;
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
                  tooltipContent += `Anomaly Score: ${syntheticPoint.score?.toFixed(3) || 'N/A'}<br/>`;
                  tooltipContent += `Status: ${syntheticPoint.is_anomaly ? 'Anomalous' : 'Normal'}<br/>`;
                }
              }
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
        tooltip.select("#select-point-btn").on("click", function() {
          if (selectedPoints.includes(originalIndex)) {
            setSelectedPoints(prev => prev.filter(idx => idx !== originalIndex));
          } else {
            setSelectedPoints(prev => [...prev, originalIndex]);
          }
          tooltip.remove();
        });
        
        tooltip.select("#select-similar-btn").on("click", function() {
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
      .on("mouseout", function() {
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
          .attr("stroke-width", isSelected ? 2 : 0.5);

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

    // Responsive legend positioning - ensure it fits properly
    const showAnomalyLegend = showAnomalies && anomalyResults && anomalyResults.synthetic_data;
    // Use more space for legend when sidebar is collapsed
    const legendWidth = showAnomalyLegend ? 
      (shouldShowSidebar && !sidebarCollapsed ? 220 : 250) : 
      (shouldShowSidebar && !sidebarCollapsed ? 190 : 220);
    const legendHeight = wasDownsampled ? 85 :
                        showAnomalyLegend ? 120 : 75;
    
    // Calculate optimal legend position - ensure it doesn't get cut off
    const legendX = Math.min(
      plotWidth - (margin.right / devicePixelRatio) + 30,
      plotWidth - legendWidth - 25
    );
    const legendY = (margin.top / devicePixelRatio) + 10;
    

    
    const legend = svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
      .attr("x", -10)
      .attr("y", -10)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", "white")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 1)
      .attr("rx", 6)
      .attr("opacity", 0.95);

    legend.append("text")
      .attr("x", 0)
      .attr("y", 8)
      .text(showAnomalyLegend ? "Data Points" : "Dataset Type")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .style("fill", "#374151");

    const realCount = sampledLabels.filter(label => label === "Real").length;
    const syntheticCount = sampledLabels.filter(label => label === "Synthetic").length;

    // Calculate anomaly counts if available
    let syntheticAnomalies = 0;
    let syntheticNormal = 0;
    if (showAnomalyLegend && anomalyResults && anomalyResults.synthetic_data) {
      syntheticAnomalies = anomalyResults.synthetic_data.filter(point => point.is_anomaly).length;
      syntheticNormal = anomalyResults.synthetic_data.filter(point => !point.is_anomaly).length;
    }

    // Show different legend based on anomaly display
    if (showAnomalyLegend) {
      // Real data
      const realLegendRow = legend.append("g")
        .attr("transform", `translate(0, 25)`);

      realLegendRow.append("circle")
        .attr("cx", 8)
        .attr("cy", 0)
        .attr("r", Math.max(3, adjustedPointSize * 1.5))
        .attr("fill", "#2563eb") // Blue for real
        .attr("stroke", "#1d4ed8")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.85);

      realLegendRow.append("text")
        .attr("x", 20)
        .attr("y", 4)
        .text(`Real (${realCount.toLocaleString()})`)
        .style("font-size", "10px") // Smaller font to fit better
        .style("font-weight", "500")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#374151");

      // Normal synthetic data
      const normalLegendRow = legend.append("g")
        .attr("transform", `translate(0, 47)`);

      normalLegendRow.append("circle")
        .attr("cx", 8)
        .attr("cy", 0)
        .attr("r", Math.max(3, adjustedPointSize * 1.5))
        .attr("fill", "#9ca3af") // Light gray for normal synthetic
        .attr("stroke", "#6b7280")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.85);

      normalLegendRow.append("text")
        .attr("x", 20)
        .attr("y", 4)
        .text(`Synthetic Normal (${syntheticNormal.toLocaleString()})`)
        .style("font-size", "10px") // Smaller font to fit better
        .style("font-weight", "500")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#374151");

      // Anomalous synthetic data
      const anomalyLegendRow = legend.append("g")
        .attr("transform", `translate(0, 69)`);

      anomalyLegendRow.append("circle")
        .attr("cx", 8)
        .attr("cy", 0)
        .attr("r", Math.max(3, adjustedPointSize * 1.5) * 1.2) // Slightly larger
        .attr("fill", "#ef4444") // Bright red for anomalies
        .attr("stroke", "#991b1b")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.9);

      anomalyLegendRow.append("text")
        .attr("x", 20)
        .attr("y", 4)
        .text(`Synthetic Anomalies (${syntheticAnomalies.toLocaleString()})`)
        .style("font-size", "10px") // Smaller font to fit better
        .style("font-weight", "600") // Bold for anomalies
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#dc2626"); // Red text for anomalies
    } else {
      // Standard legend
      ["Real", "Synthetic"].forEach((label, i) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(0, ${i * 22 + 25})`);

        legendRow.append("circle")
          .attr("cx", 8)
          .attr("cy", 0)
          .attr("r", Math.max(3, adjustedPointSize * 1.5))
          .attr("fill", colorScale(label))
          .attr("stroke", d3.color(colorScale(label)).darker(0.3))
          .attr("stroke-width", 0.5)
          .attr("opacity", 0.85);

        const count = label === "Real" ? realCount : syntheticCount;
        legendRow.append("text")
          .attr("x", 20)
          .attr("y", 4)
          .text(`${label} (${count.toLocaleString()})`)
          .style("font-size", "10px") // Smaller font to fit better
          .style("font-weight", "500")
          .style("font-family", "system-ui, -apple-system, sans-serif")
          .style("fill", "#374151");
      });
    }

    if (wasDownsampled) {
      legend.append("text")
        .attr("x", 0)
        .attr("y", 85)
        .text("* Intelligently sampled")
        .style("font-size", "10px")
        .style("font-weight", "400")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .style("fill", "#6b7280")
        .style("font-style", "italic");
    }

    // Legend for anomaly detection
    if (showAnomalyLegend && anomalyResults && (anomalyResults.real_data || anomalyResults.synthetic_data)) {
      const realAnomalies = anomalyResults.real_data ? anomalyResults.real_data.filter(point => point.is_anomaly).length : 0;
      const realNormal = anomalyResults.real_data ? anomalyResults.real_data.filter(point => !point.is_anomaly).length : 0;
      const syntheticAnomalies = anomalyResults.synthetic_data ? anomalyResults.synthetic_data.filter(point => point.is_anomaly).length : 0;
      const syntheticNormal = anomalyResults.synthetic_data ? anomalyResults.synthetic_data.filter(point => !point.is_anomaly).length : 0;
      
      const legendGroup = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${scaledPlotWidth - margin.left - margin.right - 200}, ${scaledPlotHeight - margin.top - margin.bottom - 140})`);
      
      // Title
      legendGroup.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "#374151")
        .text("Data Points");
      
      // Real normal data
      legendGroup.append("circle")
        .attr("cx", 0)
        .attr("cy", 20)
        .attr("r", 4)
        .attr("fill", "#3b82f6")
        .attr("stroke", "#1e40af")
        .attr("stroke-width", 1);
      
      legendGroup.append("text")
        .attr("x", 15)
        .attr("y", 25)
        .attr("font-size", "11px")
        .attr("fill", "#374151")
        .text(`Real Normal (${realNormal})`);
      
      // Real anomalous data
      legendGroup.append("circle")
        .attr("cx", 0)
        .attr("cy", 40)
        .attr("r", 4)
        .attr("fill", "#ef4444")
        .attr("stroke", "#991b1b")
        .attr("stroke-width", 1);
      
      legendGroup.append("text")
        .attr("x", 15)
        .attr("y", 45)
        .attr("font-size", "11px")
        .attr("fill", "#374151")
        .text(`Real Anomalous (${realAnomalies})`);
      
      // Synthetic normal data
      legendGroup.append("circle")
        .attr("cx", 0)
        .attr("cy", 60)
        .attr("r", 4)
        .attr("fill", "#dc2626")
        .attr("stroke", "#15803d")
        .attr("stroke-width", 1);
      
      legendGroup.append("text")
        .attr("x", 15)
        .attr("y", 65)
        .attr("font-size", "11px")
        .attr("fill", "#374151")
        .text(`Synthetic Normal (${syntheticNormal})`);
      
      // Synthetic anomalous data
      legendGroup.append("circle")
        .attr("cx", 0)
        .attr("cy", 80)
        .attr("r", 4)
        .attr("fill", "#ef4444")
        .attr("stroke", "#991b1b")
        .attr("stroke-width", 1);
      
      legendGroup.append("text")
        .attr("x", 15)
        .attr("y", 85)
        .attr("font-size", "11px")
        .attr("fill", "#374151")
        .text(`Synthetic Anomalous (${syntheticAnomalies})`);
    }
  }, [data, metadata, pointSize, pointOpacity, selectedPoints, sidebarWidth, sidebarCollapsed, showAnomalies, anomalyResults, showRealNormal, showRealAnomalies, showSyntheticNormal, showSyntheticAnomalies, getOriginalData, calculatePlotDimensions, sampleData]);

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
  }, [selectedPoints, histogramColumn, histogramPlotType, generatePlotData, getOriginalData, data, metadata, getVisiblePoints, plotData]);

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

  // Anomaly detection functions
  const runAnomalyDetection = useCallback(async () => {
    console.log('🔍 Anomaly detection started');
    console.log('Data:', data);
    console.log('Metadata:', metadata);
    
    if (!data || !metadata || !metadata.labels) {
      console.error('❌ Missing data or metadata');
      setAnomalyError('No embedding data available for anomaly detection');
      return;
    }

    // Check if we have a job_id in metadata (for history embeddings)
    const jobId = metadata?.job_id;
    if (jobId) {
      console.log('🎯 Using preprocessed data from job:', jobId);
      
      setAnomalyLoading(true);
      setAnomalyError(null);
      
      try {
        const results = await anomalyDetectionService.detectAnomaliesFromJob(
          jobId, 
          contamination
        );
        console.log('🎉 Anomaly detection from job completed:', results);
        
        // Check if results have the expected structure
        if (results && results.status === 'success' && results.statistics) {
          setAnomalyResults(results);
          console.log('📈 Statistics:', results.statistics);
          console.log('📊 Real data results:', results.real_data?.length || 0);
          console.log('📊 Synthetic data results:', results.synthetic_data?.length || 0);
        } else {
          console.error('❌ Unexpected response structure:', results);
          setAnomalyError('Unexpected response structure from anomaly detection');
        }
      } catch (error) {
        console.error('❌ Anomaly detection from job failed:', error);
        const errorMessage = error.message || error.toString() || 'Unknown error occurred';
        setAnomalyError(errorMessage);
      } finally {
        setAnomalyLoading(false);
      }
      return;
    }

    // Fallback to original method for fresh embeddings (using frontend data)
    console.log('📊 Using frontend data for anomaly detection (fallback method)');
    
    // Get preprocessed original data for anomaly detection
    const originalData = getOriginalData();
    if (!originalData) {
      console.error('❌ No preprocessed original data available for anomaly detection');
      setAnomalyError('Preprocessed original data not available for anomaly detection');
      return;
    }

    console.log('📊 Preprocessed original data:', {
      dataLength: originalData.data.length,
      labelsLength: originalData.labels.length,
      headers: originalData.headers,
      sampleData: originalData.data.slice(0, 3)
    });

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

    console.log('📊 Separated preprocessed data:', { 
      realDataLength: realData.length, 
      syntheticDataLength: syntheticData.length,
      realDataSample: realData.slice(0, 2),
      syntheticDataSample: syntheticData.slice(0, 2)
    });
    
    // Debug: Check data types
    if (realData.length > 0) {
      console.log('🔍 Real data type check:', {
        firstRow: realData[0],
        firstValue: realData[0][0],
        firstValueType: typeof realData[0][0],
        allNumbers: realData[0].every(val => typeof val === 'number')
      });
    }
    
    // Check if we have enough valid data
    if (realData.length === 0) {
      console.error('❌ No valid numeric real data found');
      setAnomalyError('No valid numeric real data available for anomaly detection');
      return;
    }
    
    if (syntheticData.length === 0) {
      console.error('❌ No valid numeric synthetic data found');
      setAnomalyError('No valid numeric synthetic data available for anomaly detection');
      return;
    }
    
    // Check data dimensions
    const realDim = realData[0].length;
    const syntheticDim = syntheticData[0].length;
    
    if (realDim !== syntheticDim) {
      console.error('❌ Dimension mismatch:', { realDim, syntheticDim });
      setAnomalyError(`Data dimension mismatch: Real data has ${realDim} features, Synthetic data has ${syntheticDim} features`);
      return;
    }
    
    // Validate data types
    const validateNumericData = (data, name) => {
      for (let i = 0; i < Math.min(data.length, 3); i++) {
        for (let j = 0; j < Math.min(data[i].length, 3); j++) {
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
    console.log('🚀 Starting anomaly detection with contamination:', contamination);

    try {
      const results = await anomalyDetectionService.detectAnomalies(
        realData, 
        syntheticData, 
        contamination
      );
      console.log('🎉 Anomaly detection completed:', results);
      
      // Check if results have the expected structure
      if (results && results.status === 'success' && results.statistics) {
        setAnomalyResults(results);
        console.log('📈 Statistics:', results.statistics);
        console.log('📊 Real data results:', results.real_data?.length || 0);
        console.log('📊 Synthetic data results:', results.synthetic_data?.length || 0);
      } else {
        console.error('❌ Unexpected response structure:', results);
        setAnomalyError('Unexpected response structure from anomaly detection');
      }
    } catch (error) {
      console.error('❌ Anomaly detection failed:', error);
      // Ensure we have a proper error message string
      const errorMessage = error.message || error.toString() || 'Unknown error occurred';
      setAnomalyError(errorMessage);
    } finally {
      setAnomalyLoading(false);
    }
  }, [data, metadata, contamination, getOriginalData]);

  const downloadAnomalyCSV = useCallback(async () => {
    if (!data || !metadata || !metadata.labels) {
      return;
    }

    // Check if we have a job_id in metadata (for history embeddings)
    const jobId = metadata?.job_id;
    if (jobId) {
      console.log('🎯 Downloading CSV using preprocessed data from job:', jobId);
      
      try {
        const csvResult = await anomalyDetectionService.generateAnomalyCSVFromJob(jobId, contamination);
        if (csvResult.status === 'success') {
          anomalyDetectionService.downloadCSV(csvResult.csv_content, csvResult.filename);
        }
      } catch (error) {
        console.error('Failed to download CSV from job:', error);
      }
      return;
    }

    // Fallback to original method for fresh embeddings (using frontend data)
    console.log('📊 Downloading CSV using frontend data (fallback method)');
    
    // Get preprocessed original data for anomaly detection
    const originalData = getOriginalData();
    if (!originalData) {
      console.error('❌ No preprocessed original data available for CSV download');
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
    
    // Check if we have enough valid data
    if (realData.length === 0 || syntheticData.length === 0) {
      console.error('❌ No valid numeric data available for CSV download');
      return;
    }
    
    try {
      const csvResult = await anomalyDetectionService.generateAnomalyCSV(realData, syntheticData, contamination);
      if (csvResult.status === 'success') {
        anomalyDetectionService.downloadCSV(csvResult.csv_content, csvResult.filename);
      }
    } catch (error) {
      console.error('Failed to download CSV:', error);
    }
  }, [data, metadata, contamination, getOriginalData]);

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
    <Box sx={{ display: 'flex', height: '100vh', position: 'relative', overflow: 'visible', width: '100%' }}>
      {/* Main Plot Area */}
      <Box 
        ref={containerRef} 
        className="embedding-plot" 
        sx={{ 
          flex: shouldShowSidebar && !sidebarCollapsed ? 1 : 1, // Use full available space when sidebar is present
          width: '100%', // Use full width of parent container
          marginLeft: shouldShowSidebar && !sidebarCollapsed ? '-80px' : '0px', // Expand 20px to the left when sidebar is present
          marginRight: shouldShowSidebar && !sidebarCollapsed ? '-80px' : '0px', // Expand 20px to the right when sidebar is present
          height: '100vh', // Use full viewport height
          minHeight: '600px', // Increased minimum height
          backgroundColor: 'rgba(248, 250, 252, 0.5)',
          borderRadius: '8px',
          padding: '12px', // Increased padding for more margin from parent container
          position: 'relative',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center', // Center the plot within its container
          transition: isResizing ? 'none' : shouldShowSidebar ? 'flex 0.3s ease' : 'none',
          overflow: 'visible' // Allow overflow to use more space
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
          
          {/* Anomaly Detection Controls */}
          <Tooltip title="Run Anomaly Detection">
            <IconButton 
              size="small" 
              aria-label="Run anomaly detection"
              onClick={() => {
                console.log('🔘 Anomaly detection button clicked!');
                console.log('Current data length:', data?.length);
                console.log('Current metadata:', metadata);
                runAnomalyDetection();
              }}
              disabled={anomalyLoading}
              sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
            >
              {anomalyLoading ? (
                <CircularProgress size={16} color="primary" />
              ) : (
                <Warning fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          
          {anomalyError && (
            <Chip
              label={`Error: ${anomalyError}`}
              size="small"
              color="error"
              variant="filled"
              sx={{ 
                bgcolor: 'rgba(220, 38, 38, 0.9)',
                fontSize: '11px',
                maxWidth: '200px'
              }}
            />
          )}
          
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
            <Tooltip title={showAnomalies ? "Hide Anomalies" : "Show Anomalies"}>
              <IconButton 
                size="small" 
                aria-label="Toggle anomaly visualization"
                onClick={() => setShowAnomalies(!showAnomalies)}
                sx={{ 
                  bgcolor: showAnomalies ? 'rgba(220, 38, 38, 0.1)' : 'white', 
                  '&:hover': { bgcolor: showAnomalies ? 'rgba(220, 38, 38, 0.2)' : 'grey.100' } 
                }}
              >
                <Warning fontSize="small" color={showAnomalies ? "error" : "inherit"} />
              </IconButton>
            </Tooltip>
          )}
          
          {/* Interactive Filter Controls */}
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Toggle Normal Real Data">
              <IconButton 
                size="small" 
                aria-label="Toggle normal real data visibility"
                onClick={() => setShowRealNormal(!showRealNormal)}
                sx={{ 
                  bgcolor: showRealNormal ? 'rgba(37, 99, 235, 0.1)' : 'white', 
                  '&:hover': { bgcolor: showRealNormal ? 'rgba(37, 99, 235, 0.2)' : 'grey.100' } 
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6' }} />
              </IconButton>
            </Tooltip>
            
            {anomalyResults && (
              <Tooltip title="Toggle Anomalous Real Data">
                <IconButton 
                  size="small" 
                  aria-label="Toggle anomalous real data visibility"
                  onClick={() => setShowRealAnomalies(!showRealAnomalies)}
                  sx={{ 
                    bgcolor: showRealAnomalies ? 'rgba(239, 68, 68, 0.1)' : 'white', 
                    '&:hover': { bgcolor: showRealAnomalies ? 'rgba(239, 68, 68, 0.2)' : 'grey.100' } 
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Toggle Normal Synthetic Data">
              <IconButton 
                size="small" 
                aria-label="Toggle normal synthetic data visibility"
                onClick={() => setShowSyntheticNormal(!showSyntheticNormal)}
                sx={{ 
                  bgcolor: showSyntheticNormal ? 'rgba(220, 38, 38, 0.1)' : 'white', 
                  '&:hover': { bgcolor: showSyntheticNormal ? 'rgba(220, 38, 38, 0.2)' : 'grey.100' } 
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#dc2626' }} />
              </IconButton>
            </Tooltip>
            
            {anomalyResults && (
              <Tooltip title="Toggle Anomalous Synthetic Data">
                <IconButton 
                  size="small" 
                  aria-label="Toggle anomalous synthetic data visibility"
                  onClick={() => setShowSyntheticAnomalies(!showSyntheticAnomalies)}
                  sx={{ 
                    bgcolor: showSyntheticAnomalies ? 'rgba(239, 68, 68, 0.1)' : 'white', 
                    '&:hover': { bgcolor: showSyntheticAnomalies ? 'rgba(239, 68, 68, 0.2)' : 'grey.100' } 
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          
          {/* Quick Filter Buttons */}
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Show All Data">
              <IconButton 
                size="small" 
                aria-label="Show all data"
                onClick={showAllData}
                sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
              >
                <SelectAll fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Hide All Data">
              <IconButton 
                size="small" 
                aria-label="Hide all data"
                onClick={hideAllData}
                sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
              >
                <Clear fontSize="small" />
              </IconButton>
            </Tooltip>
            
            {anomalyResults && (
              <Tooltip title="Show Only Anomalies">
                <IconButton 
                  size="small" 
                  aria-label="Show only anomalies"
                  onClick={showOnlyAnomalies}
                  sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
                >
                  <Warning fontSize="small" color="error" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
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
          
          {/* Anomaly Detection Status */}
          {anomalyResults && anomalyResults.statistics && (
            <Chip
              icon={<Warning />}
              label={`${anomalyResults.statistics.real_anomalies || 0} real + ${anomalyResults.statistics.synthetic_anomalies || 0} synthetic anomalies${showAnomalies ? ' (shown)' : ''}`}
              size="small"
              color={showAnomalies ? "error" : "default"}
              variant={showAnomalies ? "filled" : "outlined"}
              sx={{ 
                bgcolor: showAnomalies ? 'rgba(220, 38, 38, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                fontSize: '11px',
                borderColor: showAnomalies ? 'transparent' : 'rgba(220, 38, 38, 0.5)'
              }}
            />
          )}
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
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            objectFit: 'fill',
            overflow: 'visible' // Allow Y-axis label to be visible
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
          height: '100vh', // Use full viewport height
          maxHeight: '100vh',
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
                Total Selected: <strong>{histogramData?.totalSelected || 0}</strong>
                {selectedPoints.length !== (histogramData?.totalSelected || 0) && (
                  <span style={{ color: '#dc2626', fontSize: '0.8em' }}>
                    {' '}({selectedPoints.length} total, {selectedPoints.length - (histogramData?.totalSelected || 0)} hidden by filters)
                  </span>
                )}
              </Typography>
              <Typography variant="body2">
                Real: <strong>{histogramData?.realSelected || 0}</strong>
              </Typography>
              <Typography variant="body2">
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
