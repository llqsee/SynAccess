import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import Plot from 'react-plotly.js';
import { generateDistributionPlot } from '../services/api';
import { classifyColumnType, getAvailablePlotTypes, isDiscreteVariable } from '../utils/dataUtils';

const plotTypeTooltips = {
  histogram: 'Compare frequency distributions using overlaid histograms',
  violin: 'Compare distributions showing density and quartiles',
  bar: 'Compare categorical data using bar charts'
};



const DistributionPlot = ({ realData, syntheticData, realHeaders, syntheticHeaders }) => {
  const [selectedColumn, setSelectedColumn] = useState('');
  const [plotType, setPlotType] = useState('bar');
  const [plotData, setPlotData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [columnDataType, setColumnDataType] = useState('categorical');

  // Wrapper function to adapt shared utility to DistributionPlot's data structure
  const determineColumnType = useCallback((columnName) => {
    if (!realData || !syntheticData || !realHeaders || !syntheticHeaders) {
      return 'categorical';
    }

    // Create data structure compatible with shared utility
    const originalData = {
      data: [...realData, ...syntheticData],
      labels: [
        ...Array(realData.length).fill('Real'),
        ...Array(syntheticData.length).fill('Synthetic')
      ],
      headers: realHeaders
    };

    return classifyColumnType(null, originalData, columnName);
  }, [realData, syntheticData, realHeaders, syntheticHeaders]);

  useEffect(() => {
    if (realHeaders && syntheticHeaders && realData && syntheticData) {
      const commonColumns = realHeaders.filter(header => syntheticHeaders.includes(header));
      setAvailableColumns(commonColumns);
      if (commonColumns.length > 0 && !selectedColumn) {
        const firstColumn = commonColumns[0];
        const dataType = determineColumnType(firstColumn);
        setColumnDataType(dataType);
        // Set default plot type immediately based on data type
        const defaultPlotType = dataType === 'numeric' ? 'histogram' : 'bar';
        setPlotType(defaultPlotType);
        setSelectedColumn(firstColumn);
      }
    }
  }, [realHeaders, syntheticHeaders, realData, syntheticData, selectedColumn, determineColumnType]);

  // Update data type and plot type when column changes
  useEffect(() => {
    if (selectedColumn) {
      const dataType = determineColumnType(selectedColumn);
      setColumnDataType(dataType);
      
      // Check if current plot type is compatible with new data type
      const numericPlotTypes = ['histogram', 'violin'];
      const categoricalPlotTypes = ['bar'];
      
      const isCurrentPlotCompatible = 
        (dataType === 'numeric' && numericPlotTypes.includes(plotType)) ||
        (dataType === 'categorical' && categoricalPlotTypes.includes(plotType));
      
      // Only change plot type if current one is not compatible
      if (!isCurrentPlotCompatible) {
        const defaultPlotType = dataType === 'numeric' ? 'histogram' : 'bar';
        setPlotType(defaultPlotType);
      }
    }
  }, [selectedColumn, determineColumnType, plotType]);

  useEffect(() => {
    if (selectedColumn && realData && syntheticData && plotType) {
      // Validate that plot type is appropriate for the column data type
      const currentDataType = determineColumnType(selectedColumn);
      const isValidCombination = 
        (currentDataType === 'numeric' && ['histogram', 'violin'].includes(plotType)) ||
        (currentDataType === 'categorical' && plotType === 'bar');
      
      if (!isValidCombination) {
        // Don't make API call if plot type doesn't match data type
        // The other useEffect will update the plot type appropriately
        return;
      }
      
      setLoading(true);
      setError(null);
      
      const requestData = {
        real_data: realData,
        synthetic_data: syntheticData,
        column: selectedColumn,
        plot_type: plotType,
        real_headers: realHeaders,
        synthetic_headers: syntheticHeaders,
        kde: true  
      };
      
      generateDistributionPlot(requestData)
        .then(data => {
          setPlotData(data);
        })
        .catch(err => {
          console.error('Full error object:', err);
          console.error('Error response:', err.response);
          setError(`Failed to generate distribution plot: ${err.message}`);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedColumn, realData, syntheticData, plotType, realHeaders, syntheticHeaders, determineColumnType]);

  const handleColumnChange = (event) => setSelectedColumn(event.target.value);
  const handlePlotTypeChange = (event) => setPlotType(event.target.value);

  // Map backend response to Plotly traces
  const renderPlot = () => {
    if (!plotData) return null;
    
    switch (plotData.plot_type) {
      case 'histogram': {
        // Check if this is a discrete variable
        const originalData = {
          data: [...realData, ...syntheticData],
          labels: [
            ...Array(realData.length).fill('Real'),
            ...Array(syntheticData.length).fill('Synthetic')
          ],
          headers: realHeaders
        };
        
        const isDiscrete = isDiscreteVariable(null, originalData, selectedColumn);
        
        if (isDiscrete) {
          // Render discrete histogram with gaps (like bar plot style) - side by side
          return (
            <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
              <Box sx={{ flex: 1, minHeight: '400px', backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', color: '#2563eb' }}>
                  Real Data
                </Typography>
                <Plot
                  data={[
                    {
                      x: plotData.real_values,
                      type: 'histogram',
                      name: 'Real',
                      marker: { color: '#2563eb' },
                      opacity: 0.7
                    }
                  ]}
                  layout={{ 
                    xaxis: { 
                      title: 'Value',
                      type: 'category'  // Treat as categories to add gaps
                    }, 
                    yaxis: { title: 'Count' },
                    showlegend: false,
                    margin: { t: 20, b: 40, l: 40, r: 20 },
                    autosize: true,
                    bargap: 0.1  // Add gaps between bars
                  }}
                  config={{ responsive: true, displayModeBar: false, displaylogo: false }}
                  style={{ width: '100%', height: '350px' }}
                  useResizeHandler={true}
                />
              </Box>
              <Box sx={{ flex: 1, minHeight: '400px', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', color: '#dc2626' }}>
                  Synthetic Data
                </Typography>
                <Plot
                  data={[
                    {
                      x: plotData.synthetic_values,
                      type: 'histogram',
                      name: 'Synthetic',
                      marker: { color: '#dc2626' },
                      opacity: 0.7
                    }
                  ]}
                  layout={{ 
                    xaxis: { 
                      title: 'Value',
                      type: 'category'  // Treat as categories to add gaps
                    }, 
                    yaxis: { title: 'Count' },
                    showlegend: false,
                    margin: { t: 20, b: 40, l: 40, r: 20 },
                    autosize: true,
                    bargap: 0.1  // Add gaps between bars
                  }}
                  config={{ responsive: true, displayModeBar: false, displaylogo: false }}
                  style={{ width: '100%', height: '350px' }}
                  useResizeHandler={true}
                />
              </Box>
            </Box>
          );
        }
        
        // Regular continuous histogram with overlay
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
                nbinsx: 30
              },
              {
                x: plotData.synthetic_values,
                type: 'histogram',
                name: 'Synthetic',
                marker: { color: '#dc2626' },
                opacity: 0.5, 
                histnorm: 'probability density',
                nbinsx: 30
              }
            ]}
            layout={{ 
              xaxis: { title: 'Value' }, 
              yaxis: { title: 'Probability Density' },
              barmode: 'overlay',        
              showlegend: true,
              margin: { t: 20, b: 40, l: 60, r: 20 },
              autosize: true
            }}
            config={{ responsive: true, displayModeBar: true, displaylogo: false }}
            style={{ width: '100%', height: '100%' }}
          />
        );
      }
        
      case 'violin':

        
        return (
          <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
            <Box sx={{ flex: 1, minHeight: '400px', backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', color: '#2563eb' }}>
                Real Data
              </Typography>
              <Plot
                data={[
                  {
                    type: 'violin',
                    y: plotData.real_values,
                    name: 'Real',
                    line: { color: '#2563eb' },
                    fillcolor: '#2563eb',
                    opacity: 0.6,
                    box: { 
                      visible: true,
                      line: { color: '#1e40af', width: 2 }
                    },
                    meanline: { 
                      visible: true,
                      color: '#fbbf24',
                      width: 3
                    },
                    points: false,
                    bandwidth: 0
                  }
                ]}
                layout={{ 
                  yaxis: { title: 'Value' },
                  xaxis: { showticklabels: false },
                  showlegend: false,
                  margin: { t: 20, b: 40, l: 40, r: 20 },
                  autosize: true
                }}
                config={{ responsive: true, displayModeBar: false, displaylogo: false }}
                style={{ width: '100%', height: '350px' }}
                useResizeHandler={true}
              />
            </Box>
            <Box sx={{ flex: 1, minHeight: '400px', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', color: '#dc2626' }}>
                Synthetic Data
              </Typography>
              <Plot
                data={[
                  {
                    type: 'violin',
                    y: plotData.synthetic_values,
                    name: 'Synthetic',
                    line: { color: '#dc2626' },
                    fillcolor: '#dc2626',
                    opacity: 0.6,
                    box: { 
                      visible: true,
                      line: { color: '#b91c1c', width: 2 }
                    },
                    meanline: { 
                      visible: true,
                      color: '#fbbf24',
                      width: 3
                    },
                    points: false,
                    bandwidth: 0
                  }
                ]}
                layout={{ 
                  yaxis: { title: 'Value' },
                  xaxis: { showticklabels: false },
                  showlegend: false,
                  margin: { t: 20, b: 40, l: 40, r: 20 },
                  autosize: true
                }}
                config={{ responsive: true, displayModeBar: false, displaylogo: false }}
                style={{ width: '100%', height: '350px' }}
                useResizeHandler={true}
              />
            </Box>
          </Box>
        );

      case 'bar':
        // Check if data is valid
        if (!plotData.categories || !plotData.real_counts || !plotData.synthetic_counts) {
          console.error('Missing bar plot data:', plotData);
          return <div>Error: Missing bar plot data</div>;
        }
        
        return (
          <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
            <Box sx={{ flex: 1, minHeight: '400px', backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', color: '#2563eb' }}>
                Real Data
              </Typography>
              <Plot
                data={[
                  {
                    x: plotData.categories,
                    y: plotData.real_counts,
                    type: 'bar',
                    name: 'Real',
                    marker: { color: '#2563eb' }
                  }
                ]}
                layout={{ 
                  xaxis: { title: 'Category' }, 
                  yaxis: { title: 'Count' },
                  showlegend: false,
                  margin: { t: 20, b: 40, l: 40, r: 20 },
                  autosize: true
                }}
                config={{ responsive: true, displayModeBar: false, displaylogo: false }}
                style={{ width: '100%', height: '350px' }}
                useResizeHandler={true}

                onError={(err) => console.error('Real bar plot error:', err)}
              />
            </Box>
            <Box sx={{ flex: 1, minHeight: '400px', backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', color: '#dc2626' }}>
                Synthetic Data
              </Typography>
              <Plot
                data={[
                  {
                    x: plotData.categories,
                    y: plotData.synthetic_counts,
                    type: 'bar',
                    name: 'Synthetic',
                    marker: { color: '#dc2626' }
                  }
                ]}
                layout={{ 
                  xaxis: { title: 'Category' }, 
                  yaxis: { title: 'Count' },
                  showlegend: false,
                  margin: { t: 20, b: 40, l: 40, r: 20 },
                  autosize: true
                }}
                config={{ responsive: true, displayModeBar: false, displaylogo: false }}
                style={{ width: '100%', height: '350px' }}
                useResizeHandler={true}

                onError={(err) => console.error('Synthetic bar plot error:', err)}
              />
            </Box>
          </Box>
        );
        

        
        
      default:
        return <div>Unsupported plot type</div>;
    }
  };

  if (!realData || !syntheticData) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Upload both real and synthetic data to compare distributions
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'normal' }}>
          Distribution Comparison
        </Typography>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Column</InputLabel>
          <Select
            value={selectedColumn}
            label="Column"
            onChange={handleColumnChange}
          >
            {availableColumns.map((column) => (
              <MenuItem key={column} value={column}>
                {column}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Plot Type</InputLabel>
          <Select
            value={plotType}
            label="Plot Type"
            onChange={handlePlotTypeChange}
          >
            {getAvailablePlotTypes(columnDataType).map(({ value, label }) => (
              <MenuItem value={value} key={value}>
                <Tooltip title={plotTypeTooltips[value]} arrow placement="right">
                  <span>{label}</span>
                </Tooltip>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <CircularProgress />
          </Box>
        ) : (
          renderPlot()
        )}
      </Box>
    </Box>
  );
};

export default DistributionPlot; 