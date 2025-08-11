# Quick Start Guide

This guide will walk you through using MAVIS to analyze and visualize synthetic data. You'll learn how to upload data, generate embeddings, explore visualizations, and validate data quality.

## Prerequisites

Before starting, ensure you have:

- ✅ MAVIS installed and running (see [Installation Guide](installation.md))
- ✅ Backend server running on http://localhost:8000
- ✅ Frontend server running on http://localhost:3000
- ✅ Sample datasets ready (CSV, Excel, or JSON format)

## Step 1: Access MAVIS

1. **Open your browser** and navigate to http://localhost:3000
2. **You should see the MAVIS interface** with tabs for Data Upload, Embeddings, and Summary

## Step 2: Upload Your Data

### Prepare Your Data

MAVIS works with two types of datasets:
- **Real Data**: Your original dataset
- **Synthetic Data**: The generated synthetic dataset

Both datasets should have the same columns and data types.

### Upload Process

1. **Navigate to the Data Upload tab**
2. **Upload Real Data**:
   - Click "Choose File" for Real Data
   - Select your original dataset file (CSV, Excel, or JSON)
   - The file will be validated automatically

3. **Upload Synthetic Data**:
   - Click "Choose File" for Synthetic Data
   - Select your synthetic dataset file
   - Ensure it has the same structure as the real data

4. **Verify Upload**:
   - Check that both files are uploaded successfully
   - Review the data preview to ensure correct loading
   - Confirm column names match between datasets

## Step 3: Configure Embedding Parameters

### Choose Embedding Method

1. **Select Method**:
   - **UMAP**: Better for preserving global structure (recommended)
   - **t-SNE**: Better for preserving local clusters

2. **Adjust Parameters**:

   **For UMAP:**
   - **n_neighbors**: 15 (default) - Controls local vs global structure
   - **min_dist**: 0.1 (default) - Minimum distance between points
   - **n_components**: 2 (fixed) - Output dimensions

   **For t-SNE:**
   - **perplexity**: 30 (default) - Balance between local and global structure
   - **learning_rate**: 200 (default) - Optimization step size
   - **n_iter**: 1000 (default) - Number of iterations

### Advanced Settings

- **Random State**: Set for reproducible results
- **Metric**: Distance metric for nearest neighbors
- **Preprocessing**: Choose normalization method

## Step 4: Generate Embeddings

1. **Click "Generate Embeddings"**
2. **Wait for Processing**:
   - Progress bar shows computation status
   - Large datasets may take several minutes
   - You can monitor progress in real-time

3. **Review Results**:
   - Check for any warnings or errors
   - Verify the embedding quality visually

## Step 5: Explore Visualizations

### Interactive Scatter Plot

1. **Main Visualization**:
   - Real data points shown in one color
   - Synthetic data points shown in another color
   - Zoom and pan to explore different regions

2. **Point Selection**:
   - Click and drag to select points
   - Selected points are highlighted
   - Use selection to focus on specific regions

3. **Distribution Sidebar**:
   - Toggle sidebar to show/hide distributions
   - Compare real vs synthetic distributions
   - Use filters to focus on specific features

### Statistical Charts

1. **Histograms**: Compare value distributions
2. **Violin Plots**: Show distribution shapes
3. **Correlation Heatmaps**: Compare feature relationships

## Step 6: Validate Data Quality

### Run Validation Analysis

1. **Navigate to the Summary tab**
2. **Click "Run Validation"**
3. **Review Results**:

   **Validation Outputs:**
   - **Range Validation**: Check if synthetic data stays within expected bounds
   - **Distribution Validation**: Compare statistical distributions
   - **Correlation Validation**: Preserve feature relationships
   - **Raw Results**: No composite score; review p-values, effect sizes, and summaries

   **Issues Detected:**
   - **Critical**: Must be addressed immediately
   - **Warning**: Should be investigated
   - **Info**: Minor observations

### Interpret Results

1. **No Overall Score**
   - Results are provided as raw statistics per test
   - Interpretation is left to expert review or AI analysis

2. **Distribution Analysis**:
   - Kolmogorov-Smirnov test results
   - Effect sizes for practical significance
   - Visual comparisons

3. **Recommendations**:
   - Specific suggestions for improvement
   - Parameter tuning advice
   - Data generation tips

## Step 7: Export and Save Results

### Save Your Work

1. **Job History**: All analyses are automatically saved
2. **Export Results**: Download visualizations and reports
3. **Share Findings**: Generate reports for stakeholders

### Export Options

- **PNG/SVG**: High-quality images for publications
- **CSV**: Embedding coordinates for further analysis
- **JSON**: Complete analysis results
- **PDF**: Comprehensive reports

## Example Workflow

Here's a complete example using a sample dataset:

### 1. Upload Data
```
Real Data: diabetes_real.csv (768 samples, 8 features)
Synthetic Data: diabetes_synthetic.csv (768 samples, 8 features)
```

### 2. Configure UMAP
```
n_neighbors: 15
min_dist: 0.1
random_state: 42
```

### 3. Generate Embeddings
- Processing time: ~30 seconds
- Result: 2D visualization showing data distribution

### 4. Explore Results
- Zoom into clusters to examine local structure
- Compare distributions using sidebar
- Identify regions where synthetic data differs

### 5. Validate Quality
- Overall score: 87/100
- Range validation: Passed
- Distribution validation: Minor issues with 'Insulin' feature
- Correlation validation: Good preservation

### 6. Export Results
- Save visualization as PNG
- Export embedding coordinates
- Generate quality report

## Tips for Best Results

### Data Preparation

1. **Clean Your Data**:
   - Remove outliers that might skew results
   - Handle missing values appropriately
   - Ensure consistent data types

2. **Match Datasets**:
   - Same number of features
   - Same data types
   - Same value ranges (when possible)

### Parameter Tuning

1. **Start with Defaults**: UMAP defaults work well for most cases
2. **Adjust for Dataset Size**:
   - Small datasets (<1000 samples): Reduce n_neighbors to 10
   - Large datasets (>10000 samples): Increase n_neighbors to 30

3. **Consider Data Characteristics**:
   - High-dimensional data: Use UMAP
   - Clustered data: Try t-SNE
   - Mixed data types: Experiment with different metrics

### Interpretation

1. **Look for Patterns**:
   - Clusters should be similar between real and synthetic
   - Outliers should be preserved
   - Global structure should be maintained

2. **Check Quality Metrics**:
   - Focus on critical issues first
   - Consider practical significance, not just statistical
   - Use domain knowledge to interpret results

## Troubleshooting

### Common Issues

**Upload Fails**:
- Check file format (CSV, Excel, JSON)
- Verify file size
- Ensure consistent column names

**Processing Slow**:
- Reduce dataset size for testing
- Use fewer features initially
- Check system resources

**Poor Visualization**:
- Try different embedding parameters
- Check for data preprocessing issues
- Verify data quality

**Validation Errors**:
- Review data types and ranges
- Check for missing values
- Ensure datasets are comparable

## Next Steps

After completing this quick start:

1. **Explore Advanced Features**: Try different embedding methods and parameters
2. **Read the User Guide**: Detailed instructions for all features
3. **Check API Documentation**: Integrate MAVIS into your workflows
4. **Join the Community**: Share experiences and get help

## Support

Need help with the quick start?

- **Documentation**: Check the [User Guide](../user-guide/upload-data.md)
- **API Reference**: Review the [Technical Documentation](../technical/api-reference.md)
- **GitHub Issues**: Report bugs and request features
- **Examples**: Try the sample datasets included with MAVIS

MAVIS is designed to make synthetic data analysis accessible and powerful. This quick start should get you up and running quickly! 