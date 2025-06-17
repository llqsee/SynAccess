import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  Fade,
  Zoom,
  Backdrop,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  CloudUpload,
  ScatterPlot,
  TuneRounded,
  PlayArrow,
  CheckCircle,
  DatasetRounded,
  AutoAwesome,
  CompareArrows,
  Timeline,
  Insights,
  Upload,
  Settings,
  Visibility,
  ArrowForward,
  Info
} from '@mui/icons-material';

const LandingPage = ({ 
  onRealDataUpload, 
  onSyntheticDataUpload, 
  onVisualize, 
  loading, 
  realDataLoaded, 
  syntheticDataLoaded, 
  backendConnected,
  error 
}) => {
  const [method, setMethod] = useState('umap');
  const [nNeighbors, setNNeighbors] = useState(15);
  const [minDist, setMinDist] = useState(0.1);
  const [perplexity, setPerplexity] = useState(30.0);
  const [earlyExaggeration, setEarlyExaggeration] = useState(12.0);
  const [nRealSamples, setNRealSamples] = useState(1000);
  const [nSynthSamples, setNSynthSamples] = useState(1000);
  const [showParameters, setShowParameters] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleFileSelection = async (event, isReal) => {
    const file = event.target.files[0];
    if (file) {
      if (isReal) {
        onRealDataUpload(file, null);
        if (!syntheticDataLoaded) setCurrentStep(1);
      } else {
        onSyntheticDataUpload(file, null);
        setCurrentStep(2);
        setShowParameters(true);
      }
    }
  };

  const handleGenerate = () => {
    const params = {
      method,
      params: method === 'umap' 
        ? { 
            n_neighbors: nNeighbors, 
            min_dist: minDist,
            n_real_samples: nRealSamples,
            n_synth_samples: nSynthSamples
          }
        : { 
            perplexity: perplexity, 
            early_exaggeration: earlyExaggeration,
            n_real_samples: nRealSamples,
            n_synth_samples: nSynthSamples
          }
    };
    onVisualize(params);
  };

  const isReadyToGenerate = realDataLoaded && syntheticDataLoaded && backendConnected && !loading;

  return (
    <Box sx={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      py: 4
    }}>
      <Container maxWidth="lg">
        {/* Hero Section */}
        <Fade in timeout={1000}>
          <Box sx={{ textAlign: 'center', mb: 6, color: 'white' }}>
            <Typography variant="h2" component="h1" sx={{ 
              fontWeight: 800, 
              mb: 2,
              background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}>
              MAVIS
            </Typography>
            <Typography variant="h5" sx={{ 
              mb: 3, 
              opacity: 0.9,
              fontWeight: 300,
              letterSpacing: '0.5px'
            }}>
              Scalable Visualization & Explainability of Synthetic Datasets
            </Typography>
            <Typography variant="body1" sx={{ 
              maxWidth: '600px', 
              mx: 'auto', 
              opacity: 0.8,
              fontSize: '1.1rem',
              lineHeight: 1.6
            }}>
              Transform your data analysis with advanced embedding techniques. 
              Compare real and synthetic datasets through interactive visualizations.
            </Typography>
          </Box>
        </Fade>

        {/* Error Alert */}
        {error && (
          <Fade in>
            <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
              {error}
            </Alert>
          </Fade>
        )}

        {/* Main Configuration Panel */}
        <Zoom in timeout={1200}>
          <Paper sx={{ 
            borderRadius: 4, 
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            {/* Progress Steps */}
            <Box sx={{ 
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              p: 3,
              color: 'white'
            }}>
              <Stepper activeStep={currentStep} alternativeLabel sx={{
                '& .MuiStepLabel-root .Mui-completed': { color: '#4ade80' },
                '& .MuiStepLabel-root .Mui-active': { color: '#fbbf24' },
                '& .MuiStepLabel-label': { color: 'white !important' },
                '& .MuiStepConnector-line': { borderColor: 'rgba(255,255,255,0.3)' }
              }}>
                <Step>
                  <StepLabel>Upload Real Data</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Upload Synthetic Data</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Configure & Generate</StepLabel>
                </Step>
              </Stepper>
            </Box>

            <Box sx={{ p: 4 }}>
              <Grid container spacing={4}>
                {/* Data Upload Section */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Real Data Upload */}
                    <Card sx={{ 
                      border: realDataLoaded ? '2px solid #059669' : '2px dashed #e5e7eb',
                      borderRadius: 3,
                      background: realDataLoaded ? 
                        'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' : 
                        'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: realDataLoaded ? 'none' : 'translateY(-2px)',
                        boxShadow: realDataLoaded ? 'none' : '0 8px 25px rgba(0,0,0,0.1)'
                      }
                    }}>
                      <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Avatar sx={{ 
                          width: 60, 
                          height: 60, 
                          mx: 'auto', 
                          mb: 2,
                          bgcolor: realDataLoaded ? '#059669' : '#3b82f6'
                        }}>
                          {realDataLoaded ? <CheckCircle /> : <DatasetRounded />}
                        </Avatar>
                        <Typography variant="h6" gutterBottom>
                          Real Dataset
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          {realDataLoaded ? 
                            'Original dataset uploaded successfully' : 
                            'Upload your ground truth dataset'}
                        </Typography>
                        <Button
                          variant={realDataLoaded ? "outlined" : "contained"}
                          component="label"
                          fullWidth
                          size="large"
                          color={realDataLoaded ? "success" : "primary"}
                          startIcon={realDataLoaded ? <CheckCircle /> : <Upload />}
                          sx={{ borderRadius: 2, py: 1.5 }}
                        >
                          {realDataLoaded ? 'Real Data Loaded' : 'Choose Real Dataset'}
                          <input
                            type="file"
                            hidden
                            accept=".csv,.xlsx,.json"
                            onChange={(e) => handleFileSelection(e, true)}
                          />
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Synthetic Data Upload */}
                    <Card sx={{ 
                      border: syntheticDataLoaded ? '2px solid #059669' : '2px dashed #e5e7eb',
                      borderRadius: 3,
                      background: syntheticDataLoaded ? 
                        'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' : 
                        'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      transition: 'all 0.3s ease',
                      opacity: realDataLoaded ? 1 : 0.6,
                      '&:hover': {
                        transform: (syntheticDataLoaded || !realDataLoaded) ? 'none' : 'translateY(-2px)',
                        boxShadow: (syntheticDataLoaded || !realDataLoaded) ? 'none' : '0 8px 25px rgba(0,0,0,0.1)'
                      }
                    }}>
                      <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Avatar sx={{ 
                          width: 60, 
                          height: 60, 
                          mx: 'auto', 
                          mb: 2,
                          bgcolor: syntheticDataLoaded ? '#059669' : '#7c3aed'
                        }}>
                          {syntheticDataLoaded ? <CheckCircle /> : <AutoAwesome />}
                        </Avatar>
                        <Typography variant="h6" gutterBottom>
                          Synthetic Dataset
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          {syntheticDataLoaded ? 
                            'Synthetic dataset uploaded successfully' : 
                            'Upload your generated/synthetic dataset'}
                        </Typography>
                        <Button
                          variant={syntheticDataLoaded ? "outlined" : "contained"}
                          component="label"
                          fullWidth
                          size="large"
                          color={syntheticDataLoaded ? "success" : "secondary"}
                          startIcon={syntheticDataLoaded ? <CheckCircle /> : <Upload />}
                          disabled={!realDataLoaded}
                          sx={{ borderRadius: 2, py: 1.5 }}
                        >
                          {syntheticDataLoaded ? 'Synthetic Data Loaded' : 
                           realDataLoaded ? 'Choose Synthetic Dataset' : 'Upload Real Data First'}
                          <input
                            type="file"
                            hidden
                            accept=".csv,.xlsx,.json"
                            onChange={(e) => handleFileSelection(e, false)}
                            disabled={!realDataLoaded}
                          />
                        </Button>
                      </CardContent>
                    </Card>
                  </Box>
                </Grid>

                {/* Parameters Section */}
                <Grid item xs={12} md={6}>
                  <Fade in={showParameters} timeout={800}>
                    <Card sx={{ 
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%)',
                      border: '1px solid #e9d5ff',
                      height: '100%'
                    }}>
                      <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                          <Avatar sx={{ bgcolor: '#7c3aed', mr: 2 }}>
                            <TuneRounded />
                          </Avatar>
                          <Box>
                            <Typography variant="h6">
                              Embedding Parameters
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Fine-tune your visualization settings
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {/* Method Selection */}
                          <FormControl fullWidth>
                            <InputLabel>Embedding Method</InputLabel>
                            <Select
                              value={method}
                              label="Embedding Method"
                              onChange={(e) => setMethod(e.target.value)}
                              disabled={!showParameters}
                            >
                              <MenuItem value="umap">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <ScatterPlot />
                                  <Box>
                                    <Typography>UMAP</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Uniform Manifold Approximation
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                              <MenuItem value="tsne">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Timeline />
                                  <Box>
                                    <Typography>t-SNE</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      t-Distributed Stochastic Neighbor Embedding
                                    </Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                            </Select>
                          </FormControl>

                          {/* Method-specific parameters */}
                          {method === 'umap' ? (
                            <>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="body2">
                                    Neighbors: {nNeighbors}
                                  </Typography>
                                  <Tooltip title="Controls local vs global structure balance">
                                    <Info sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  </Tooltip>
                                </Box>
                                <Slider
                                  value={nNeighbors}
                                  onChange={(e, value) => setNNeighbors(value)}
                                  min={2}
                                  max={100}
                                  disabled={!showParameters}
                                  sx={{ color: '#7c3aed' }}
                                />
                              </Box>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="body2">
                                    Min Distance: {minDist}
                                  </Typography>
                                  <Tooltip title="Controls how tightly points are packed">
                                    <Info sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  </Tooltip>
                                </Box>
                                <Slider
                                  value={minDist}
                                  onChange={(e, value) => setMinDist(value)}
                                  min={0.0}
                                  max={1.0}
                                  step={0.01}
                                  disabled={!showParameters}
                                  sx={{ color: '#7c3aed' }}
                                />
                              </Box>
                            </>
                          ) : (
                            <>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="body2">
                                    Perplexity: {perplexity}
                                  </Typography>
                                  <Tooltip title="Balance between local and global aspects">
                                    <Info sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  </Tooltip>
                                </Box>
                                <Slider
                                  value={perplexity}
                                  onChange={(e, value) => setPerplexity(value)}
                                  min={5}
                                  max={50}
                                  disabled={!showParameters}
                                  sx={{ color: '#7c3aed' }}
                                />
                              </Box>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="body2">
                                    Early Exaggeration: {earlyExaggeration}
                                  </Typography>
                                  <Tooltip title="Controls separation between clusters">
                                    <Info sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  </Tooltip>
                                </Box>
                                <Slider
                                  value={earlyExaggeration}
                                  onChange={(e, value) => setEarlyExaggeration(value)}
                                  min={1}
                                  max={50}
                                  disabled={!showParameters}
                                  sx={{ color: '#7c3aed' }}
                                />
                              </Box>
                            </>
                          )}

                          {/* Sample Size Controls */}
                          <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              Real Samples: {nRealSamples}
                            </Typography>
                            <Slider
                              value={nRealSamples}
                              onChange={(e, value) => setNRealSamples(value)}
                              min={100}
                              max={5000}
                              step={100}
                              disabled={!showParameters}
                              sx={{ color: '#3b82f6' }}
                            />
                          </Box>

                          <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              Synthetic Samples: {nSynthSamples}
                            </Typography>
                            <Slider
                              value={nSynthSamples}
                              onChange={(e, value) => setNSynthSamples(value)}
                              min={100}
                              max={5000}
                              step={100}
                              disabled={!showParameters}
                              sx={{ color: '#7c3aed' }}
                            />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Fade>
                </Grid>
              </Grid>

              {/* Generate Button */}
              <Fade in={isReadyToGenerate} timeout={1000}>
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleGenerate}
                    disabled={!isReadyToGenerate}
                    startIcon={loading ? <CircularProgress size={20} /> : <Visibility />}
                    endIcon={!loading && <ArrowForward />}
                    sx={{
                      px: 6,
                      py: 2,
                      fontSize: '1.1rem',
                      borderRadius: 3,
                      background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 30px rgba(102, 126, 234, 0.4)',
                      },
                      '&:disabled': {
                        background: '#e5e7eb',
                        color: '#9ca3af'
                      }
                    }}
                  >
                    {loading ? 'Generating Visualization...' : 'Generate Visualization'}
                  </Button>
                  {isReadyToGenerate && !loading && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      🚀 Everything is ready! Click to start your data analysis journey
                    </Typography>
                  )}
                </Box>
              </Fade>

              {/* Status Chips */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                <Chip
                  icon={<DatasetRounded />}
                  label={realDataLoaded ? "Real Data ✓" : "Real Data"}
                  color={realDataLoaded ? "success" : "default"}
                  variant={realDataLoaded ? "filled" : "outlined"}
                />
                <Chip
                  icon={<AutoAwesome />}
                  label={syntheticDataLoaded ? "Synthetic Data ✓" : "Synthetic Data"}
                  color={syntheticDataLoaded ? "success" : "default"}
                  variant={syntheticDataLoaded ? "filled" : "outlined"}
                />
                <Chip
                  icon={<Settings />}
                  label={showParameters ? "Parameters ✓" : "Parameters"}
                  color={showParameters ? "success" : "default"}
                  variant={showParameters ? "filled" : "outlined"}
                />
                <Chip
                  icon={<CompareArrows />}
                  label={backendConnected ? "Backend Connected" : "Backend Disconnected"}
                  color={backendConnected ? "success" : "error"}
                  variant="filled"
                />
              </Box>
            </Box>
          </Paper>
        </Zoom>

        {/* Loading Backdrop */}
        <Backdrop
          sx={{ 
            color: '#fff', 
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backdropFilter: 'blur(5px)'
          }}
          open={loading}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress 
              size={60} 
              thickness={4}
              sx={{ mb: 3 }}
            />
            <Typography variant="h6" gutterBottom>
              Generating Embeddings
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, opacity: 0.8 }}>
              Computing {method.toUpperCase()} embeddings for your datasets...
            </Typography>
            <LinearProgress 
              sx={{ 
                width: 300,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.2)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  backgroundColor: '#4ade80'
                }
              }} 
            />
          </Box>
        </Backdrop>

        {/* Feature Cards */}
        {!loading && !realDataLoaded && (
          <Fade in timeout={1500}>
            <Box sx={{ mt: 8 }}>
              <Typography variant="h4" sx={{ 
                textAlign: 'center', 
                mb: 4, 
                color: 'white',
                fontWeight: 600
              }}>
                Why Choose MAVIS?
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card sx={{ 
                    height: '100%', 
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: '#3b82f6' }}>
                        <ScatterPlot />
                      </Avatar>
                      <Typography variant="h6" gutterBottom>
                        Advanced Embeddings
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        State-of-the-art UMAP and t-SNE algorithms for 
                        high-quality dimensional reduction and visualization.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card sx={{ 
                    height: '100%', 
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: '#059669' }}>
                        <CompareArrows />
                      </Avatar>
                      <Typography variant="h6" gutterBottom>
                        Smart Comparison
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Intelligent side-by-side analysis of real vs synthetic 
                        datasets with comprehensive statistical insights.
                      </Typography>
                    </CardContent>
                  </Card>  
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card sx={{ 
                    height: '100%', 
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: '#7c3aed' }}>
                        <Insights />
                      </Avatar>
                      <Typography variant="h6" gutterBottom>
                        Interactive Analysis
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Explore your data through interactive plots, distribution 
                        comparisons, and detailed statistical summaries.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Fade>
        )}
      </Container>
    </Box>
  );
};

export default LandingPage; 