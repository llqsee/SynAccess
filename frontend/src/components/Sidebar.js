import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Typography,
  CircularProgress,
  Divider,
  Paper,
  Collapse,
  Fade,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Stack,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction
} from '@mui/material';
import { 
  CheckCircle, 
  CloudUpload, 
  ArrowForward, 
  Settings, 
  ExpandLess, 
  ExpandMore, 
  PlayArrow, 
  Cancel, 
  Upload,
  History,
  Favorite,
  FavoriteBorder,
  Schedule,
  Memory,
  Refresh
} from '@mui/icons-material';
import { getAvailableModels } from '../services/api';

const Sidebar = ({
  onRealDataUpload,
  onSyntheticDataUpload,
  onVisualize,
  loading,
  realDataLoaded,
  syntheticDataLoaded,
  realDataName,
  syntheticDataName,
  backendConnected,
  isCollapsed,
  onToggleCollapse,
  realData,
  syntheticData,
  onCancel,
  processingStatus,
  progress = 0,
  canCancel = false,
  error
}) => {
  const [method, setMethod] = useState('umap');
  const [nNeighbors, setNNeighbors] = useState(15);
  const [minDist, setMinDist] = useState(0.1);
  const [perplexity, setPerplexity] = useState(30.0);
  const [earlyExaggeration, setEarlyExaggeration] = useState(12.0);
  const [nRealSamples, setNRealSamples] = useState(1000);
  const [nSynthSamples, setNSynthSamples] = useState(1000);
  const [parametersConfigured, setParametersConfigured] = useState(false);
  const [parametersExpanded, setParametersExpanded] = useState(true);
  const [usePretrainedModel, setUsePretrainedModel] = useState(false);
  const [selectedModelJobId, setSelectedModelJobId] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [useGpu, setUseGpu] = useState(false);

  // Load pretrained models when user switches to that option
  useEffect(() => {
    if (method === 'pretrained') {
      loadAvailableModels(true); // Refresh the list
    }
  }, [method]);

  const loadAvailableModels = async (forceRefresh = false) => {
    setLoadingModels(true);
    try {
      // Clear existing models if forcing refresh
      if (forceRefresh) {
        setAvailableModels([]);
        setSelectedModelJobId('');
      }
      
      const response = await getAvailableModels();
      setAvailableModels(response.models || []);
      console.log(`Loaded ${response.models?.length || 0} available models`);
    } catch (error) {
      console.error('Failed to load available models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleFileSelection = async (event, isReal) => {
    const file = event.target.files[0];
    if (file) {
      try {
        if (isReal) {
          await onRealDataUpload(file, null);
        } else {
          await onSyntheticDataUpload(file, null);
        }
      } catch (error) {
        console.error(`Error uploading ${isReal ? 'real' : 'synthetic'} file:`, error);
      }
    }
  };

  const handleVisualize = () => {
    if (method === 'pretrained') {
      if (!selectedModelJobId) {
        alert('Please select a pre-trained model from the dropdown.');
        return;
      }
      
      // Find the selected model details
      const selectedModel = availableModels.find(model => model.job_id === selectedModelJobId);
      if (!selectedModel) {
        alert('Selected model not found. Please refresh and try again.');
        return;
      }

      // Use pre-trained model from history
      const params = {
        method: selectedModel.method,
        pretrainedModelJobId: selectedModelJobId,
        params: {
          pretrained_model: true,
          model_job_id: selectedModelJobId,
          n_real_samples: nRealSamples,
          n_synth_samples: nSynthSamples
        }
      };
      onVisualize(params);
    } else {
      // Use regular training
      const params = {
        method,
        params: method === 'umap' 
          ? { 
              n_neighbors: nNeighbors, 
              min_dist: minDist,
              n_real_samples: nRealSamples,
              n_synth_samples: nSynthSamples,
              use_gpu: useGpu
            }
          : { 
              perplexity: perplexity, 
              early_exaggeration: earlyExaggeration,
              n_real_samples: nRealSamples,
              n_synth_samples: nSynthSamples
            }
      };
      onVisualize(params);
    }
  };

  // Handlers for parameter changes (without auto-confirming)
  const handleSelectChange = (setter) => (e) => {
    setter(e.target.value);
  };

  const handleSliderChange = (setter) => (e, value) => {
    setter(value);
  };

  const isVisualizationDisabled = !realDataLoaded || !syntheticDataLoaded || !backendConnected;

  // Determine current step
  const getCurrentStep = () => {
    if (!realDataLoaded) return 0;
    if (!syntheticDataLoaded) return 1;
    if (syntheticDataLoaded && !parametersConfigured) return 2;
    if (syntheticDataLoaded && parametersConfigured) return 3;
    return 2;
  };

  const currentStep = getCurrentStep();

  // Get selected model details
  const selectedModel = availableModels.find(model => model.job_id === selectedModelJobId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
      {/* Progress Stepper */}
      <Box>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload />
          Data Upload Workflow
        </Typography>
        
        <Stepper activeStep={currentStep} orientation="vertical" sx={{ mt: 2 }}>
          {/* Step 1: Real Data Upload */}
          <Step>
            <StepLabel>
              <Box>
                <Typography variant="subtitle2">Upload Real Dataset</Typography>
                {realDataLoaded && currentStep > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      📁 {realDataName || 'Unknown filename'}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      color="primary"
                      component="label"
                      sx={{ minWidth: 'auto', px: 1, py: 0, fontSize: '0.7rem' }}
                    >
                      Change
                      <input
                        type="file"
                        hidden
                        accept=".csv,.xlsx,.json"
                        onChange={(e) => handleFileSelection(e, true)}
                        key={`real-change-${Date.now()}`}
                      />
                    </Button>
                  </Box>
                )}
              </Box>
            </StepLabel>
            <StepContent>
              <Paper sx={{ 
                p: 2, 
                bgcolor: realDataLoaded ? 'success.50' : 'primary.50',
                border: currentStep === 0 ? '2px solid' : '1px solid',
                borderColor: currentStep === 0 ? 'primary.main' : 'divider'
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Start by uploading your real dataset to establish the baseline for comparison.
                </Typography>
                <Button
                  variant="contained"
                  component="label"
                  fullWidth
                  size="medium"
                  color={realDataLoaded ? "success" : "primary"}
                  startIcon={realDataLoaded ? <CheckCircle /> : <CloudUpload />}
                  sx={{ mb: realDataName ? 0.5 : 1 }}
                >
                  {realDataLoaded ? 'Real Data Uploaded ✓' : 'Choose Real Dataset'}
                  <input
                    type="file"
                    hidden
                    accept=".csv,.xlsx,.json"
                    onChange={(e) => handleFileSelection(e, true)}
                    key={realDataLoaded ? 'real-uploaded' : 'real-empty'}
                  />
                </Button>
                {realDataLoaded && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
                    📁 {realDataName || 'Unknown filename'}
                  </Typography>
                )}
                {realDataLoaded && (
                  <Fade in={realDataLoaded}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                      <Typography variant="caption" color="success.main">
                        Ready to proceed to synthetic data
                      </Typography>
                      <ArrowForward sx={{ fontSize: 16, color: 'success.main' }} />
                    </Box>
                  </Fade>
                )}
              </Paper>
            </StepContent>
          </Step>

          {/* Step 2: Synthetic Data Upload */}
          <Step>
            <StepLabel>
              <Box>
                <Typography variant="subtitle2">Upload Synthetic Dataset</Typography>
                {syntheticDataLoaded && currentStep > 1 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      📁 {syntheticDataName || 'Unknown filename'}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      color="primary"
                      component="label"
                      sx={{ minWidth: 'auto', px: 1, py: 0, fontSize: '0.7rem' }}
                    >
                      Change
                      <input
                        type="file"
                        hidden
                        accept=".csv,.xlsx,.json"
                        onChange={(e) => handleFileSelection(e, false)}
                        key={`synthetic-change-${Date.now()}`}
                      />
                    </Button>
                  </Box>
                )}
              </Box>
            </StepLabel>
            <StepContent>
              <Collapse in={realDataLoaded}>
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: syntheticDataLoaded ? 'success.50' : realDataLoaded ? 'primary.50' : 'grey.100',
                  border: currentStep === 1 ? '2px solid' : '1px solid',
                  borderColor: currentStep === 1 ? 'primary.main' : 'divider',
                  opacity: realDataLoaded ? 1 : 0.6
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Now upload your synthetic dataset to compare against the real data.
                  </Typography>
                  <Button
                    variant="contained"
                    component="label"
                    fullWidth
                    size="medium"
                    color={syntheticDataLoaded ? "success" : "primary"}
                    startIcon={syntheticDataLoaded ? <CheckCircle /> : <CloudUpload />}
                    disabled={!realDataLoaded}
                    sx={{ mb: syntheticDataName ? 0.5 : 1 }}
                  >
                    {syntheticDataLoaded ? 'Synthetic Data Uploaded ✓' : 
                     realDataLoaded ? 'Choose Synthetic Dataset' : 'Upload Real Data First'}
                    <input
                      type="file"
                      hidden
                      accept=".csv,.xlsx,.json"
                      onChange={(e) => handleFileSelection(e, false)}
                      disabled={!realDataLoaded}
                      key={syntheticDataLoaded ? 'synthetic-uploaded' : 'synthetic-empty'}
                    />
                  </Button>
                  {syntheticDataLoaded && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
                      📁 {syntheticDataName || 'Unknown filename'}
                    </Typography>
                  )}
                  {syntheticDataLoaded && (
                    <Fade in={syntheticDataLoaded}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        <Typography variant="caption" color="success.main">
                          Ready to configure parameters
                        </Typography>
                        <ArrowForward sx={{ fontSize: 16, color: 'success.main' }} />
                      </Box>
                    </Fade>
                  )}
                </Paper>
              </Collapse>
            </StepContent>
          </Step>

          {/* Step 3: Configure Parameters */}
          <Step>
            <StepLabel>
              <Typography variant="subtitle2">Configure Parameters</Typography>
            </StepLabel>
            <StepContent>
              <Collapse in={syntheticDataLoaded}>
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: currentStep >= 2 ? 'primary.50' : 'grey.100',
                  border: currentStep === 2 ? '2px solid' : '1px solid',
                  borderColor: currentStep === 2 ? 'primary.main' : 'divider'
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Configure your embedding parameters before generating the visualization.
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => setParametersExpanded(!parametersExpanded)}
                      endIcon={parametersExpanded ? <ExpandLess /> : <ExpandMore />}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      {parametersExpanded ? 'Hide' : 'Show'} Parameters
                    </Button>
                  </Box>
                  
                  {/* Collapsible Embedding Parameters */}
                  <Collapse in={parametersExpanded}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Method</InputLabel>
                      <Select
                        value={method}
                        label="Method"
                        onChange={handleSelectChange(setMethod)}
                        disabled={!syntheticDataLoaded}
                      >
                        <MenuItem value="umap">UMAP</MenuItem>
                        <MenuItem value="tsne">t-SNE</MenuItem>
                        <MenuItem value="pretrained">Use Pre-trained Model</MenuItem>
                      </Select>
                    </FormControl>

                    {method === 'umap' && (
                      <>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            Neighbors: {nNeighbors}
                          </Typography>
                          <Slider
                            value={nNeighbors}
                            onChange={handleSliderChange(setNNeighbors)}
                            min={2}
                            max={100}
                            size="small"
                            disabled={!syntheticDataLoaded}
                          />
                        </Box>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            Min Distance: {minDist}
                          </Typography>
                          <Slider
                            value={minDist}
                            onChange={handleSliderChange(setMinDist)}
                            min={0.0}
                            max={1.0}
                            step={0.01}
                            size="small"
                            disabled={!syntheticDataLoaded}
                          />
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={useGpu}
                              onChange={(e) => setUseGpu(e.target.checked)}
                              color="primary"
                              size="small"
                              disabled={!syntheticDataLoaded}
                            />
                          }
                          label="Use GPU (if available)"
                          sx={{ 
                            mt: 1,
                            '& .MuiFormControlLabel-label': {
                              fontSize: '0.875rem'
                            }
                          }}
                        />
                      </>
                    )}
                    
                    {method === 'tsne' && (
                      <>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            Perplexity: {perplexity}
                          </Typography>
                          <Slider
                            value={perplexity}
                            onChange={handleSliderChange(setPerplexity)}
                            min={5}
                            max={50}
                            size="small"
                            disabled={!syntheticDataLoaded}
                          />
                        </Box>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            Early Exaggeration: {earlyExaggeration}
                          </Typography>
                          <Slider
                            value={earlyExaggeration}
                            onChange={handleSliderChange(setEarlyExaggeration)}
                            min={1}
                            max={50}
                            size="small"
                            disabled={!syntheticDataLoaded}
                          />
                        </Box>
                      </>
                    )}
                    
                    {method === 'pretrained' && (
                      <Box sx={{ 
                        border: '2px dashed #e5e7eb', 
                        borderRadius: 2, 
                        p: 2,
                        background: selectedModelJobId ? 
                          'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' : 
                          'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderColor: selectedModelJobId ? '#059669' : '#e5e7eb'
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            {selectedModelJobId ? 'Model Selected' : 'Select Pre-trained Model'}
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => loadAvailableModels(true)}
                            disabled={loadingModels}
                            startIcon={loadingModels ? <CircularProgress size={16} /> : <Refresh />}
                          >
                            {loadingModels ? 'Loading...' : 'Refresh'}
                          </Button>
                        </Box>
                        
                        {loadingModels ? (
                          <Box sx={{ textAlign: 'center', py: 2 }}>
                            <CircularProgress size={24} />
                            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                              Loading available models...
                            </Typography>
                          </Box>
                        ) : availableModels.length === 0 ? (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              No pre-trained models available. Create some embeddings first to see them here.
                            </Typography>
                          </Alert>
                        ) : (
                          <>
                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                              <InputLabel>Select Model</InputLabel>
                              <Select
                                value={selectedModelJobId}
                                label="Select Model"
                                onChange={(e) => setSelectedModelJobId(e.target.value)}
                                disabled={!syntheticDataLoaded}
                              >
                                {availableModels.map((model) => (
                                  <MenuItem key={model.job_id} value={model.job_id}>
                                    <Tooltip 
                                      title={
                                        <Box>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                            {(() => {
                                              // Try to get the actual job name first (which should contain dataset name)
                                              const jobName = model.name;
                                              const displayName = model.display_name;
                                              
                                              // First try to extract from the full job name (like "UMAP: insurance+insurance 100K 1,000R+1,000S 7cols 3cat 4num")
                                              if (jobName) {
                                                // Look for pattern: "METHOD: datasetname+..." 
                                                const match = jobName.match(/^(UMAP|t-SNE|TSNE):\s*([^+\s]+)/i);
                                                if (match) {
                                                  // Return the first dataset name, capitalized
                                                  const datasetName = match[2];
                                                  return datasetName.charAt(0).toUpperCase() + datasetName.slice(1).toLowerCase();
                                                }
                                              }
                                              
                                              // If no job name or pattern doesn't match, try display name
                                              if (displayName) {
                                                const match = displayName.match(/^(UMAP|t-SNE|TSNE):\s*([^+\s]+)/i);
                                                if (match) {
                                                  const datasetName = match[2];
                                                  return datasetName.charAt(0).toUpperCase() + datasetName.slice(1).toLowerCase();
                                                }
                                              }
                                              
                                              // Fallback: show display name or job name
                                              return displayName || jobName || 'Unknown Dataset';
                                            })()}
                                          </Typography>
                                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                            Method: {model.method?.toUpperCase()}
                                          </Typography>
                                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                            Created: {model.created_at ? new Date(model.created_at).toLocaleString() : 'N/A'}
                                          </Typography>
                                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                            Runtime: {model.runtime_seconds ? `${model.runtime_seconds.toFixed(1)}s` : 'N/A'}
                                          </Typography>
                                          {model.real_processed_samples && (
                                            <Typography variant="caption" sx={{ display: 'block' }}>
                                              Samples: {model.real_processed_samples}R + {model.synthetic_processed_samples}S
                                            </Typography>
                                          )}
                                        </Box>
                                      }
                                      arrow
                                      placement="right"
                                      enterDelay={500}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                      <Typography variant="body2">
                                        {model.display_name}
                                      </Typography>
                                      {model.is_favorite && (
                                        <Favorite sx={{ fontSize: 16, color: 'error.main' }} />
                                      )}
                                    </Box>
                                    </Tooltip>
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            
                            {selectedModel && (
                              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Model Details
                                </Typography>
                                <List dense>
                                  <ListItem>
                                    <ListItemIcon>
                                      <Memory sx={{ fontSize: 16 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                      primary="Method" 
                                      secondary={selectedModel.method.toUpperCase()} 
                                    />
                                  </ListItem>
                                  <ListItem>
                                    <ListItemIcon>
                                      <Schedule sx={{ fontSize: 16 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                      primary="Created" 
                                      secondary={new Date(selectedModel.created_at).toLocaleString()} 
                                    />
                                  </ListItem>
                                  <ListItem>
                                    <ListItemIcon>
                                      <History sx={{ fontSize: 16 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                      primary="Runtime" 
                                      secondary={`${selectedModel.runtime_seconds?.toFixed(1)}s`} 
                                    />
                                  </ListItem>
                                  {selectedModel.real_processed_samples && (
                                    <ListItem>
                                      <ListItemIcon>
                                        <CheckCircle sx={{ fontSize: 16 }} />
                                      </ListItemIcon>
                                      <ListItemText 
                                        primary="Samples" 
                                        secondary={`${selectedModel.real_processed_samples}R + ${selectedModel.synthetic_processed_samples}S`} 
                                      />
                                    </ListItem>
                                  )}
                                </List>
                              </Paper>
                            )}
                            
                            {selectedModelJobId && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                  The selected model will be used directly to transform your current data without additional training.
                                </Typography>
                              </Box>
                            )}
                          </>
                        )}
                      </Box>
                    )}

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Real Samples: {nRealSamples}
                      </Typography>
                      <Slider
                        value={nRealSamples}
                        onChange={handleSliderChange(setNRealSamples)}
                        min={100}
                        max={5000}
                        step={100}
                        size="small"
                        disabled={!syntheticDataLoaded}
                      />
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Synthetic Samples: {nSynthSamples}
                      </Typography>
                      <Slider
                        value={nSynthSamples}
                        onChange={handleSliderChange(setNSynthSamples)}
                        min={100}
                        max={5000}
                        step={100}
                        size="small"
                        disabled={!syntheticDataLoaded}
                      />
                    </Box>
                                       </Box>
                   </Collapse>

                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {!parametersExpanded && (
                      <Typography variant="caption" color="text.secondary">
                        {method === 'pretrained' ? 'PRETRAINED MODEL' : method.toUpperCase()} | {method === 'umap' ? `${nNeighbors} neighbors` : method === 'tsne' ? `${perplexity} perplexity` : selectedModel ? selectedModel.method.toUpperCase() : 'no model'} | {nRealSamples}/{nSynthSamples} samples
                      </Typography>
                    )}
                    
                    {parametersExpanded && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setParametersConfigured(true);
                          setParametersExpanded(false);
                        }}
                        startIcon={<CheckCircle />}
                        sx={{ ml: 'auto' }}
                      >
                        Confirm Parameters
                      </Button>
                    )}
                  </Box>

                  {parametersConfigured && !parametersExpanded && (
                    <Fade in={parametersConfigured && !parametersExpanded}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, p: 1, bgcolor: 'success.50', borderRadius: 1 }}>
                        <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        <Typography variant="caption" color="success.main" sx={{ flex: 1 }}>
                          Parameters confirmed - Ready to generate visualization
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setParametersExpanded(true);
                            setParametersConfigured(false);
                          }}
                          sx={{ 
                            minWidth: 'auto', 
                            px: 1, 
                            py: 0.5,
                            fontSize: '0.75rem',
                            borderColor: 'success.main',
                            color: 'success.main',
                            '&:hover': {
                              borderColor: 'success.dark',
                              bgcolor: 'success.100'
                            }
                          }}
                        >
                          Edit
                        </Button>
                        <ArrowForward sx={{ fontSize: 16, color: 'success.main' }} />
                      </Box>
                    </Fade>
                  )}
                </Paper>
              </Collapse>
            </StepContent>
          </Step>

          {/* Step 4: Generate Visualization */}
          <Step>
            <StepLabel>
              <Typography variant="subtitle2">Generate Visualization</Typography>
            </StepLabel>
            <StepContent>
              <Collapse in={parametersConfigured && syntheticDataLoaded}>
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: parametersConfigured ? 'success.50' : 'grey.100',
                  border: currentStep === 3 ? '2px solid' : '1px solid',
                  borderColor: currentStep === 3 ? 'primary.main' : 'divider'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    All set! Click below to start the embedding computation and visualization generation.
                  </Typography>
                  
                  {/* Current Parameters Summary */}
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      <strong>Current Parameters:</strong>
                    </Typography>
                    <Typography variant="caption" color="text.primary">
                      {method === 'pretrained' && selectedModel ? 
                        `${selectedModel.method.toUpperCase()} (Pre-trained) • ${selectedModel.real_processed_samples}R + ${selectedModel.synthetic_processed_samples}S samples` :
                        method === 'umap' ? `${nNeighbors} neighbors, ${minDist} min distance${useGpu ? ', GPU enabled' : ''}` : 
                        `${perplexity} perplexity, ${earlyExaggeration} early exaggeration`} • {nRealSamples}/{nSynthSamples} samples
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        setParametersExpanded(true);
                        setParametersConfigured(false);
                      }}
                      sx={{ 
                        mt: 0.5,
                        minWidth: 'auto', 
                        p: 0.5,
                        fontSize: '0.7rem',
                        textTransform: 'none'
                      }}
                    >
                      Edit Parameters
                    </Button>
                  </Box>
                  
                  <Button
                    variant="contained"
                    onClick={handleVisualize}
                    disabled={isVisualizationDisabled}
                    fullWidth
                    size="large"
                    startIcon={loading ? <CircularProgress size={16} /> : <Settings />}
                    sx={{ py: 1.5 }}
                  >
                    {loading ? 'Generating Visualization...' : 'Generate Visualization'}
                  </Button>
                </Paper>
              </Collapse>
            </StepContent>
          </Step>
        </Stepper>
      </Box>

      {/* Help Text */}
      {!syntheticDataLoaded && (
        <Box sx={{ mt: 'auto', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            💡 <strong>Tip:</strong> Follow the steps above in order. Each step unlocks the next one, 
            guiding you through the complete workflow.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Sidebar; 