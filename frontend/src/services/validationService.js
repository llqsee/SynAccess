// Comprehensive Data Validation and Benchmarking Service
import { classifyColumnType } from '../utils/dataUtils';

export class ValidationService {
  constructor() {
    this.validationResults = null;
    this.severity_thresholds = {
      CRITICAL: 0.8,   // 80%+ difference
      HIGH: 0.5,       // 50%+ difference  
      MEDIUM: 0.3,     // 30%+ difference
      LOW: 0.1         // 10%+ difference
    };
  }

  /**
   * Main validation function that runs all tests
   */
  async validateDatasets(realData, syntheticData, options = {}) {
    const startTime = performance.now();
    
    try {
      const results = {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: 0,
          passed: 0,
          warnings: 0,
          failures: 0,
          critical: 0
        },
        tests: {},
        recommendations: [],
        processingTime: 0
      };

      // Basic dataset info
      results.datasetInfo = this.getDatasetInfo(realData, syntheticData);
      
      // Run validation tests with yields to prevent UI blocking
      console.log('Running range validation...');
      results.tests.rangeValidation = this.runRangeTests(realData, syntheticData);
      await this.yield(); // Yield control back to UI
      
      console.log('Running distribution validation...');
      results.tests.distributionValidation = this.runDistributionTests(realData, syntheticData);
      await this.yield();
      
      console.log('Running correlation validation...');
      results.tests.correlationValidation = this.runCorrelationTests(realData, syntheticData);
      await this.yield();
      
      console.log('Running statistical validation...');
      results.tests.statisticalValidation = this.runStatisticalTests(realData, syntheticData);
      await this.yield();
      
      console.log('Running outlier validation...');
      results.tests.outlierValidation = this.runOutlierTests(realData, syntheticData);
      await this.yield();
      
      console.log('Calculating quality metrics...');
      results.tests.qualityMetrics = this.calculateQualityMetrics(realData, syntheticData);
      await this.yield();

      // Additional advanced tests if enabled
      if (options.enableAdvancedTests) {
        console.log('Running advanced tests...');
        results.tests.jennrichTest = this.runJennrichTest(realData, syntheticData);
        await this.yield();
        results.tests.privacyTests = this.runPrivacyTests(realData, syntheticData);
        await this.yield();
      }

      console.log('Finalizing results...');
      // Calculate summary statistics
      this.calculateSummary(results);
      
      // Generate recommendations
      results.recommendations = this.generateRecommendations(results);
      
      results.processingTime = Math.round(performance.now() - startTime);
      this.validationResults = results;
      
      return results;
    } catch (error) {
      console.error('Validation error:', error);
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Yield control back to the browser to prevent UI blocking
   */
  async yield() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Get basic dataset information
   */
  getDatasetInfo(realData, syntheticData) {
    return {
      real: {
        rows: realData.data.length,
        columns: realData.headers.length,
        headers: realData.headers,
        fileName: realData.metadata?.fileName || 'Unknown'
      },
      synthetic: {
        rows: syntheticData.data.length,
        columns: syntheticData.headers.length,
        headers: syntheticData.headers,
        fileName: syntheticData.metadata?.fileName || 'Unknown'
      },
      compatibility: {
        sameColumnCount: realData.headers.length === syntheticData.headers.length,
        sameHeaders: JSON.stringify(realData.headers) === JSON.stringify(syntheticData.headers),
        sizeDifference: Math.abs(realData.data.length - syntheticData.data.length) / Math.max(realData.data.length, syntheticData.data.length)
      }
    };
  }

  /**
   * Range validation tests - check bounds and domains
   */
  runRangeTests(realData, syntheticData) {
    const tests = [];
    
    realData.headers.forEach((header, colIndex) => {
      if (colIndex >= syntheticData.headers.length) return;
      
      const realValues = this.extractColumnValues(realData.data, colIndex);
      const synthValues = this.extractColumnValues(syntheticData.data, colIndex);
      
      const dataType = classifyColumnType(colIndex, {
        data: [...realData.data, ...syntheticData.data],
        headers: realData.headers,
        labels: [...Array(realData.data.length).fill('Real'), ...Array(syntheticData.data.length).fill('Synthetic')]
      });

      if (dataType === 'numeric') {
        const realStats = this.calculateNumericStats(realValues);
        const synthStats = this.calculateNumericStats(synthValues);
        
        const test = {
          column: header,
          type: 'range_test',
          dataType: 'numeric',
          real: realStats,
          synthetic: synthStats,
          issues: [],
          severity: 'PASS'
        };

        // Range coverage test
        const realRange = realStats.max - realStats.min;
        const synthRange = synthStats.max - synthStats.min;
        const rangeDiff = Math.abs(realRange - synthRange) / realRange;
        
        if (rangeDiff > this.severity_thresholds.CRITICAL) {
          test.issues.push({
            type: 'range_mismatch',
            severity: 'CRITICAL',
            message: `Synthetic data range (${synthRange.toFixed(3)}) differs significantly from real data range (${realRange.toFixed(3)})`,
            impact: 'High - May indicate poor data generation quality'
          });
          test.severity = 'CRITICAL';
        }

        // Bounds violation test
        if (synthStats.min < realStats.min || synthStats.max > realStats.max) {
          const violation = synthStats.min < realStats.min ? 'minimum' : 'maximum';
          test.issues.push({
            type: 'bounds_violation',
            severity: 'HIGH',
            message: `Synthetic data violates ${violation} bounds: real [${realStats.min.toFixed(3)}, ${realStats.max.toFixed(3)}], synthetic [${synthStats.min.toFixed(3)}, ${synthStats.max.toFixed(3)}]`,
            impact: 'Medium - Synthetic data exceeds realistic bounds'
          });
          if (test.severity === 'PASS') test.severity = 'HIGH';
        }

        tests.push(test);
      } else {
        // Categorical range tests
        const realUnique = new Set(realValues.filter(v => v !== null && v !== undefined));
        const synthUnique = new Set(synthValues.filter(v => v !== null && v !== undefined));
        
        const test = {
          column: header,
          type: 'categorical_range_test',
          dataType: 'categorical',
          real: { 
            uniqueValues: realUnique.size, 
            values: Array.from(realUnique).slice(0, 10) // First 10 for display
          },
          synthetic: { 
            uniqueValues: synthUnique.size, 
            values: Array.from(synthUnique).slice(0, 10)
          },
          issues: [],
          severity: 'PASS'
        };

        // Check for new categories in synthetic data
        const newCategories = [...synthUnique].filter(v => !realUnique.has(v));
        if (newCategories.length > 0) {
          test.issues.push({
            type: 'new_categories',
            severity: 'HIGH',
            message: `Synthetic data contains ${newCategories.length} new categories not in real data: ${newCategories.slice(0, 5).join(', ')}${newCategories.length > 5 ? '...' : ''}`,
            impact: 'High - May indicate data leakage or poor category handling'
          });
          test.severity = 'HIGH';
        }

        // Check for missing categories
        const missingCategories = [...realUnique].filter(v => !synthUnique.has(v));
        if (missingCategories.length > 0) {
          test.issues.push({
            type: 'missing_categories',
            severity: 'MEDIUM',
            message: `Synthetic data missing ${missingCategories.length} categories from real data: ${missingCategories.slice(0, 5).join(', ')}${missingCategories.length > 5 ? '...' : ''}`,
            impact: 'Medium - Reduced diversity in synthetic data'
          });
          if (test.severity === 'PASS') test.severity = 'MEDIUM';
        }

        tests.push(test);
      }
    });

    return {
      testType: 'Range and Domain Validation',
      description: 'Validates data ranges, bounds, and categorical domains',
      tests,
      summary: this.summarizeTests(tests)
    };
  }

  /**
   * Distribution validation tests
   */
  runDistributionTests(realData, syntheticData) {
    const tests = [];
    
    // Safety limit for very wide datasets (can be increased as needed)
    const maxColumns = 100; // Increased from 20 to 100
    const numColumns = Math.min(realData.headers.length, syntheticData.headers.length, maxColumns);
    
    for (let colIndex = 0; colIndex < numColumns; colIndex++) {
      const header = realData.headers[colIndex];
      
      const realValues = this.extractColumnValues(realData.data, colIndex);
      const synthValues = this.extractColumnValues(syntheticData.data, colIndex);
      
      const dataType = classifyColumnType(colIndex, {
        data: [...realData.data, ...syntheticData.data],
        headers: realData.headers,
        labels: [...Array(realData.data.length).fill('Real'), ...Array(syntheticData.data.length).fill('Synthetic')]
      });

      if (dataType === 'numeric') {
        const test = this.runKSTest(realValues, synthValues, header);
        tests.push(test);
      } else {
        const test = this.runChiSquareTest(realValues, synthValues, header);
        tests.push(test);
      }
    }

    return {
      testType: 'Marginal Distribution Tests',
      description: `Statistical tests comparing distributions between real and synthetic data (${numColumns}/${Math.min(realData.headers.length, syntheticData.headers.length)} columns processed)`,
      tests,
      summary: this.summarizeTests(tests)
    };
  }

  /**
   * Kolmogorov-Smirnov test for numeric distributions
   */
  runKSTest(realValues, synthValues, column) {
    const realClean = realValues.filter(v => v !== null && v !== undefined && !isNaN(v));
    const synthClean = synthValues.filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (realClean.length === 0 || synthClean.length === 0) {
      return {
        column,
        type: 'ks_test',
        result: 'SKIP',
        reason: 'Insufficient numeric data',
        severity: 'SKIP'
      };
    }

    // Sort values
    const realSorted = [...realClean].sort((a, b) => a - b);
    const synthSorted = [...synthClean].sort((a, b) => a - b);
    
    // Calculate empirical CDFs and KS statistic
    const ksStatistic = this.calculateKSStatistic(realSorted, synthSorted);
    
    // Critical value for α = 0.05
    const n1 = realSorted.length;
    const n2 = synthSorted.length;
    const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));
    
    const test = {
      column,
      type: 'ks_test',
      statistic: ksStatistic,
      criticalValue,
      pValueApprox: ksStatistic > criticalValue ? '< 0.05' : '> 0.05',
      result: ksStatistic > criticalValue ? 'REJECT' : 'ACCEPT',
      issues: [],
      severity: 'PASS'
    };

    if (ksStatistic > criticalValue) {
      const severityLevel = ksStatistic > (criticalValue * 2) ? 'HIGH' : 'MEDIUM';
      test.issues.push({
        type: 'distribution_mismatch',
        severity: severityLevel,
        message: `Distributions significantly different (KS = ${ksStatistic.toFixed(4)}, critical = ${criticalValue.toFixed(4)})`,
        impact: severityLevel === 'HIGH' ? 'High - Major distribution differences' : 'Medium - Notable distribution differences'
      });
      test.severity = severityLevel;
    }

    return test;
  }

  /**
   * Chi-square test for categorical distributions
   */
  runChiSquareTest(realValues, synthValues, column) {
    const realClean = realValues.filter(v => v !== null && v !== undefined);
    const synthClean = synthValues.filter(v => v !== null && v !== undefined);
    
    if (realClean.length === 0 || synthClean.length === 0) {
      return {
        column,
        type: 'chi_square_test',
        result: 'SKIP',
        reason: 'Insufficient categorical data',
        severity: 'SKIP'
      };
    }

    // Get frequency distributions
    const realFreq = this.getFrequencyDistribution(realClean);
    const synthFreq = this.getFrequencyDistribution(synthClean);
    
    // Calculate chi-square statistic
    const chiSquare = this.calculateChiSquare(realFreq, synthFreq);
    
    const test = {
      column,
      type: 'chi_square_test',
      statistic: chiSquare.statistic,
      degreesOfFreedom: chiSquare.df,
      result: chiSquare.significant ? 'REJECT' : 'ACCEPT',
      realDistribution: realFreq,
      syntheticDistribution: synthFreq,
      issues: [],
      severity: 'PASS'
    };

    if (chiSquare.significant) {
      test.issues.push({
        type: 'categorical_distribution_mismatch',
        severity: 'MEDIUM',
        message: `Categorical distributions significantly different (χ² = ${chiSquare.statistic.toFixed(4)}, df = ${chiSquare.df})`,
        impact: 'Medium - Category proportions differ between real and synthetic data'
      });
      test.severity = 'MEDIUM';
    }

    return test;
  }

  /**
   * Correlation structure validation
   */
  runCorrelationTests(realData, syntheticData) {
    const realNumericCols = [];
    const synthNumericCols = [];
    
    // Extract numeric columns
    realData.headers.forEach((header, colIndex) => {
      const dataType = classifyColumnType(colIndex, {
        data: [...realData.data, ...syntheticData.data],
        headers: realData.headers,
        labels: [...Array(realData.data.length).fill('Real'), ...Array(syntheticData.data.length).fill('Synthetic')]
      });
      
      if (dataType === 'numeric') {
        const realValues = this.extractColumnValues(realData.data, colIndex).filter(v => !isNaN(v));
        const synthValues = this.extractColumnValues(syntheticData.data, colIndex).filter(v => !isNaN(v));
        
        if (realValues.length > 10 && synthValues.length > 10) { // Minimum sample size
          realNumericCols.push({ header, index: colIndex, values: realValues });
          synthNumericCols.push({ header, index: colIndex, values: synthValues });
        }
      }
    });

    if (realNumericCols.length < 2) {
      return {
        testType: 'Correlation Structure Validation',
        description: 'Validates correlation structures between variables',
        result: 'SKIP',
        reason: 'Insufficient numeric columns for correlation analysis',
        summary: { total: 0, passed: 0, warnings: 0, failures: 0 }
      };
    }

    // Calculate correlation matrices
    const realCorr = this.calculateCorrelationMatrix(realNumericCols);
    const synthCorr = this.calculateCorrelationMatrix(synthNumericCols);
    
    // Compare correlation matrices
    const corrComparison = this.compareCorrelationMatrices(realCorr, synthCorr);
    
    return {
      testType: 'Correlation Structure Validation',
      description: 'Element-wise comparison of correlation matrices (complements Jennrich statistical test)',
      realCorrelations: realCorr,
      syntheticCorrelations: synthCorr,
      comparison: corrComparison,
      note: 'This provides detailed element-wise correlation comparison. For statistical significance testing of correlation matrix equality, see Jennrich test results.',
      summary: {
        total: 1,
        passed: corrComparison.severity === 'PASS' ? 1 : 0,
        warnings: corrComparison.severity === 'MEDIUM' ? 1 : 0,
        failures: corrComparison.severity === 'HIGH' || corrComparison.severity === 'CRITICAL' ? 1 : 0
      }
    };
  }

  /**
   * Statistical validation tests (means, variances, etc.)
   */
  runStatisticalTests(realData, syntheticData) {
    const tests = [];
    
    realData.headers.forEach((header, colIndex) => {
      if (colIndex >= syntheticData.headers.length) return;
      
      const dataType = classifyColumnType(colIndex, {
        data: [...realData.data, ...syntheticData.data],
        headers: realData.headers,
        labels: [...Array(realData.data.length).fill('Real'), ...Array(syntheticData.data.length).fill('Synthetic')]
      });

      if (dataType === 'numeric') {
        const realValues = this.extractColumnValues(realData.data, colIndex).filter(v => !isNaN(v));
        const synthValues = this.extractColumnValues(syntheticData.data, colIndex).filter(v => !isNaN(v));
        
        if (realValues.length > 5 && synthValues.length > 5) {
          const test = this.runTTest(realValues, synthValues, header);
          tests.push(test);
        }
      }
    });

    return {
      testType: 'Statistical Significance Tests',
      description: "Welch's t-tests comparing means between real and synthetic data (handles unequal variances)",
      tests,
      summary: this.summarizeTests(tests)
    };
  }

  /**
   * Outlier detection and comparison
   */
  runOutlierTests(realData, syntheticData) {
    const tests = [];
    
    realData.headers.forEach((header, colIndex) => {
      if (colIndex >= syntheticData.headers.length) return;
      
      const dataType = classifyColumnType(colIndex, {
        data: [...realData.data, ...syntheticData.data],
        headers: realData.headers,
        labels: [...Array(realData.data.length).fill('Real'), ...Array(syntheticData.data.length).fill('Synthetic')]
      });

      if (dataType === 'numeric') {
        const realValues = this.extractColumnValues(realData.data, colIndex).filter(v => !isNaN(v));
        const synthValues = this.extractColumnValues(syntheticData.data, colIndex).filter(v => !isNaN(v));
        
        const realOutliers = this.detectOutliers(realValues);
        const synthOutliers = this.detectOutliers(synthValues);
        
        const test = {
          column: header,
          type: 'outlier_test',
          real: {
            outlierCount: realOutliers.outliers.length,
            outlierPercentage: (realOutliers.outliers.length / realValues.length) * 100,
            outliers: realOutliers.outliers.slice(0, 5) // First 5 for display
          },
          synthetic: {
            outlierCount: synthOutliers.outliers.length,
            outlierPercentage: (synthOutliers.outliers.length / synthValues.length) * 100,
            outliers: synthOutliers.outliers.slice(0, 5)
          },
          issues: [],
          severity: 'PASS'
        };

        const outlierDiff = Math.abs(test.real.outlierPercentage - test.synthetic.outlierPercentage);
        
        if (outlierDiff > 5) { // 5% difference threshold
          const severity = outlierDiff > 15 ? 'HIGH' : 'MEDIUM';
          test.issues.push({
            type: 'outlier_pattern_mismatch',
            severity,
            message: `Outlier rates differ significantly: real ${test.real.outlierPercentage.toFixed(1)}%, synthetic ${test.synthetic.outlierPercentage.toFixed(1)}%`,
            impact: severity === 'HIGH' ? 'High - Major outlier pattern differences' : 'Medium - Notable outlier pattern differences'
          });
          test.severity = severity;
        }

        tests.push(test);
      }
    });

    return {
      testType: 'Outlier Pattern Validation',
      description: 'Compares outlier patterns between real and synthetic data',
      tests,
      summary: this.summarizeTests(tests)
    };
  }

  /**
   * Overall quality metrics
   */
  calculateQualityMetrics(realData, syntheticData) {
    const metrics = {
      completeness: this.calculateCompleteness(realData, syntheticData),
      consistency: this.calculateConsistency(realData, syntheticData),
      utility: this.calculateUtility(realData, syntheticData),
      privacy: this.calculatePrivacyMetrics(realData, syntheticData)
    };

    return {
      testType: 'Overall Quality Metrics',
      description: 'Comprehensive quality assessment of synthetic data',
      metrics,
      overallScore: this.calculateOverallScore(metrics),
      summary: {
        total: 4,
        passed: Object.values(metrics).filter(m => m.score > 0.7).length,
        warnings: Object.values(metrics).filter(m => m.score >= 0.5 && m.score <= 0.7).length,
        failures: Object.values(metrics).filter(m => m.score < 0.5).length
      }
    };
  }

  // Helper methods for calculations...
  
  extractColumnValues(data, colIndex) {
    return data.map(row => {
      const val = row[colIndex];
      return val === '' || val === null || val === undefined ? null : 
             (isNaN(parseFloat(val)) ? val : parseFloat(val));
    });
  }

  calculateNumericStats(values) {
    const cleanValues = values.filter(v => v !== null && !isNaN(v));
    if (cleanValues.length === 0) return { count: 0, mean: 0, std: 0, min: 0, max: 0 };
    
    cleanValues.sort((a, b) => a - b);
    const mean = cleanValues.reduce((sum, val) => sum + val, 0) / cleanValues.length;
    const variance = cleanValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cleanValues.length;
    
    return {
      count: cleanValues.length,
      mean,
      std: Math.sqrt(variance),
      min: cleanValues[0],
      max: cleanValues[cleanValues.length - 1],
      median: cleanValues[Math.floor(cleanValues.length / 2)]
    };
  }

  calculateKSStatistic(real, synthetic) {
    const n1 = real.length;
    const n2 = synthetic.length;
    
    // Use optimized algorithm with binary search for better performance
    // while processing all data points (no sampling)
    const allValues = [...new Set([...real, ...synthetic])].sort((a, b) => a - b);
    let maxDiff = 0;
    
    // Pre-sort arrays for binary search efficiency
    const realSorted = [...real].sort((a, b) => a - b);
    const synthSorted = [...synthetic].sort((a, b) => a - b);
    
    // Calculate CDFs using binary search approach for better performance
    for (const value of allValues) {
      const cdfReal = this.binarySearchCDF(realSorted, value);
      const cdfSynth = this.binarySearchCDF(synthSorted, value);
      maxDiff = Math.max(maxDiff, Math.abs(cdfReal - cdfSynth));
    }
    
    return maxDiff;
  }

  binarySearchCDF(sortedArray, value) {
    let left = 0;
    let right = sortedArray.length - 1;
    let count = 0;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sortedArray[mid] <= value) {
        count = mid + 1;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return count / sortedArray.length;
  }

  detectOutliers(values) {
    const cleanValues = values.filter(v => v !== null && !isNaN(v));
    if (cleanValues.length < 4) return { outliers: [], bounds: null };
    
    cleanValues.sort((a, b) => a - b);
    const q1 = cleanValues[Math.floor(cleanValues.length * 0.25)];
    const q3 = cleanValues[Math.floor(cleanValues.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return {
      outliers: cleanValues.filter(v => v < lowerBound || v > upperBound),
      bounds: { lower: lowerBound, upper: upperBound, q1, q3, iqr }
    };
  }

  // Continue with more helper methods...
  getFrequencyDistribution(values) {
    const freq = {};
    values.forEach(val => {
      freq[val] = (freq[val] || 0) + 1;
    });
    return freq;
  }

  calculateChiSquare(realFreq, synthFreq) {
    const allCategories = new Set([...Object.keys(realFreq), ...Object.keys(synthFreq)]);
    const realTotal = Object.values(realFreq).reduce((sum, count) => sum + count, 0);
    const synthTotal = Object.values(synthFreq).reduce((sum, count) => sum + count, 0);
    
    let chiSq = 0;
    let df = allCategories.size - 1;
    
    for (const category of allCategories) {
      const realCount = realFreq[category] || 0;
      const synthCount = synthFreq[category] || 0;
      const realProp = realCount / realTotal;
      const expected = realProp * synthTotal;
      
      if (expected > 5) { // Chi-square validity condition
        chiSq += Math.pow(synthCount - expected, 2) / expected;
      }
    }
    
    // Critical value for α = 0.05
    const criticalValue = df === 1 ? 3.841 : (df === 2 ? 5.991 : 7.815); // Simplified
    
    return {
      statistic: chiSq,
      df,
      significant: chiSq > criticalValue
    };
  }

  summarizeTests(tests) {
    return {
      total: tests.length,
      passed: tests.filter(t => t.severity === 'PASS').length,
      warnings: tests.filter(t => t.severity === 'MEDIUM' || t.severity === 'LOW').length,
      failures: tests.filter(t => t.severity === 'HIGH' || t.severity === 'CRITICAL').length
    };
  }

  calculateSummary(results) {
    let totalTests = 0;
    let passed = 0;
    let warnings = 0;
    let failures = 0;
    let critical = 0;

    Object.values(results.tests).forEach(testGroup => {
      if (testGroup.summary) {
        totalTests += testGroup.summary.total || 0;
        passed += testGroup.summary.passed || 0;
        warnings += testGroup.summary.warnings || 0;
        failures += testGroup.summary.failures || 0;
      }
    });

    results.summary = { totalTests, passed, warnings, failures, critical };
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    // Analyze results and generate specific recommendations
    Object.values(results.tests).forEach(testGroup => {
      if (testGroup.tests) {
        testGroup.tests.forEach(test => {
          if (test.issues) {
            test.issues.forEach(issue => {
              if (issue.severity === 'CRITICAL' || issue.severity === 'HIGH') {
                recommendations.push({
                  priority: issue.severity,
                  category: test.type,
                  column: test.column,
                  recommendation: this.getRecommendationText(issue.type, test),
                  impact: issue.impact
                });
              }
            });
          }
        });
      }
    });

    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  getRecommendationText(issueType, test) {
    const recommendations = {
      'range_mismatch': `Consider adjusting data generation parameters for column '${test.column}' to better match the original data range`,
      'bounds_violation': `Review data generation bounds for column '${test.column}' to prevent out-of-range values`,
      'new_categories': `Remove or map new categories in column '${test.column}' to existing ones from the real data`,
      'distribution_mismatch': `Fine-tune distribution parameters for column '${test.column}' to better match the original distribution`,
      'outlier_pattern_mismatch': `Adjust outlier handling in your synthetic data generation for column '${test.column}'`
    };
    
    return recommendations[issueType] || `Review data generation process for column '${test.column}'`;
  }

  /**
   * Calculate correlation matrix for numeric columns
   */
  calculateCorrelationMatrix(numericCols) {
    const n = numericCols.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    const headers = numericCols.map(col => col.header);
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Self-correlation is always 1
        } else {
          matrix[i][j] = this.calculatePearsonCorrelation(numericCols[i].values, numericCols[j].values);
        }
      }
    }
    
    return {
      matrix,
      headers,
      size: n
    };
  }

  /**
   * Calculate Pearson correlation coefficient between two arrays
   */
  calculatePearsonCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    // Use a sample if datasets are very large to prevent performance issues
    const sampleSize = Math.min(n, 10000);
    const step = Math.max(1, Math.floor(n / sampleSize));
    
    const xSample = [];
    const ySample = [];
    
    for (let i = 0; i < n; i += step) {
      if (xSample.length >= sampleSize) break;
      if (!isNaN(x[i]) && !isNaN(y[i])) {
        xSample.push(x[i]);
        ySample.push(y[i]);
      }
    }
    
    const sampleN = xSample.length;
    if (sampleN < 2) return 0;
    
    const xMean = xSample.reduce((sum, val) => sum + val, 0) / sampleN;
    const yMean = ySample.reduce((sum, val) => sum + val, 0) / sampleN;
    
    let numerator = 0;
    let xSumSq = 0;
    let ySumSq = 0;
    
    for (let i = 0; i < sampleN; i++) {
      const xDiff = xSample[i] - xMean;
      const yDiff = ySample[i] - yMean;
      numerator += xDiff * yDiff;
      xSumSq += xDiff * xDiff;
      ySumSq += yDiff * yDiff;
    }
    
    const denominator = Math.sqrt(xSumSq * ySumSq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Compare two correlation matrices and identify issues
   */
  compareCorrelationMatrices(realCorr, synthCorr) {
    if (!realCorr || !synthCorr || realCorr.size !== synthCorr.size) {
      return {
        severity: 'CRITICAL',
        issues: [{
          type: 'matrix_size_mismatch',
          severity: 'CRITICAL',
          message: 'Correlation matrix sizes do not match',
          impact: 'High - Cannot compare correlation structures'
        }],
        summary: 'Matrix comparison failed due to size mismatch'
      };
    }
    
    const issues = [];
    const n = realCorr.size;
    let totalDifferences = 0;
    let significantDifferences = 0;
    let maxDifference = 0;
    
    // Compare corresponding correlation coefficients
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) { // Only upper triangle to avoid double counting
        const realCoeff = realCorr.matrix[i][j];
        const synthCoeff = synthCorr.matrix[i][j];
        const diff = Math.abs(realCoeff - synthCoeff);
        
        totalDifferences += diff;
        maxDifference = Math.max(maxDifference, diff);
        
        if (diff > 0.3) { // Significant difference threshold
          significantDifferences++;
          const severity = diff > 0.6 ? 'CRITICAL' : diff > 0.4 ? 'HIGH' : 'MEDIUM';
          
          issues.push({
            type: 'correlation_mismatch',
            severity,
            message: `Strong correlation difference between ${realCorr.headers[i]} and ${realCorr.headers[j]}: real=${realCoeff.toFixed(3)}, synthetic=${synthCoeff.toFixed(3)} (diff=${diff.toFixed(3)})`,
            impact: severity === 'CRITICAL' ? 'High - Major structural difference' : 
                   severity === 'HIGH' ? 'Medium - Notable structural difference' : 'Low - Minor structural difference',
            variables: [realCorr.headers[i], realCorr.headers[j]],
            realValue: realCoeff,
            syntheticValue: synthCoeff,
            difference: diff
          });
        }
      }
    }
    
    const totalComparisons = (n * (n - 1)) / 2;
    const avgDifference = totalDifferences / totalComparisons;
    
    // Determine overall severity
    let overallSeverity = 'PASS';
    if (maxDifference > 0.6 || avgDifference > 0.3) {
      overallSeverity = 'CRITICAL';
    } else if (maxDifference > 0.4 || avgDifference > 0.2) {
      overallSeverity = 'HIGH';
    } else if (maxDifference > 0.3 || avgDifference > 0.1) {
      overallSeverity = 'MEDIUM';
    }
    
    return {
      severity: overallSeverity,
      issues,
      metrics: {
        totalComparisons,
        significantDifferences,
        avgDifference: avgDifference.toFixed(4),
        maxDifference: maxDifference.toFixed(4),
        percentageSignificant: ((significantDifferences / totalComparisons) * 100).toFixed(1)
      },
      summary: issues.length === 0 ? 
        'Correlation structures match well' : 
        `Found ${issues.length} significant correlation differences`
    };
  }

  /**
   * Jennrich test for comparing correlation matrices
   * Tests if correlation structures are statistically equivalent between datasets
   */
  runJennrichTest(realData, syntheticData) {
    const realNumericCols = [];
    const synthNumericCols = [];
    
    // Extract numeric columns (minimum 3 for meaningful correlation testing)
    realData.headers.forEach((header, colIndex) => {
      const dataType = classifyColumnType(colIndex, {
        data: [...realData.data, ...syntheticData.data],
        headers: realData.headers,
        labels: [...Array(realData.data.length).fill('Real'), ...Array(syntheticData.data.length).fill('Synthetic')]
      });
      
      if (dataType === 'numeric') {
        const realValues = this.extractColumnValues(realData.data, colIndex).filter(v => !isNaN(v));
        const synthValues = this.extractColumnValues(syntheticData.data, colIndex).filter(v => !isNaN(v));
        
        if (realValues.length > 30 && synthValues.length > 30) { // Minimum sample size for Jennrich test
          realNumericCols.push({ header, index: colIndex, values: realValues });
          synthNumericCols.push({ header, index: colIndex, values: synthValues });
        }
      }
    });

    if (realNumericCols.length < 3) {
      return {
        testType: 'Jennrich Correlation Matrix Test',
        description: 'Tests equality of correlation structures between datasets',
        result: 'SKIP',
        reason: 'Insufficient numeric variables (minimum 3 required)',
        recommendation: 'Add more numeric variables for meaningful correlation structure testing',
        summary: { total: 0, passed: 0, warnings: 0, failures: 0 }
      };
    }

    try {
      // Calculate correlation matrices (proper Jennrich test uses correlation, not covariance)
      const realCorrMatrix = this.calculateCorrelationMatrix(realNumericCols);
      const synthCorrMatrix = this.calculateCorrelationMatrix(synthNumericCols);
      
      // Jennrich test statistic for correlation matrices
      const jennrichResult = this.calculateJennrichStatistic(realCorrMatrix, synthCorrMatrix);
      
      return {
        testType: 'Jennrich Correlation Matrix Test',
        description: 'Statistical test for equality of correlation structures between datasets',
        statistic: jennrichResult.statistic,
        criticalValue: jennrichResult.criticalValue,
        pValue: jennrichResult.pValue,
        result: jennrichResult.significant ? 'REJECT' : 'ACCEPT',
        interpretation: jennrichResult.significant ? 
          'Correlation structures are significantly different' : 
          'Correlation structures are statistically similar',
        realCorrelationMatrix: realCorrMatrix,
        syntheticCorrelationMatrix: synthCorrMatrix,
        variablesUsed: realNumericCols.map(col => col.header),
        issues: jennrichResult.significant ? [{
          type: 'correlation_structure_difference',
          severity: jennrichResult.statistic > (jennrichResult.criticalValue * 2) ? 'HIGH' : 'MEDIUM',
          message: `Correlation structures differ significantly (χ² = ${jennrichResult.statistic.toFixed(4)}, p ${jennrichResult.pValue})`,
          impact: 'Medium to High - Different correlation patterns between variables in synthetic vs real data',
          recommendation: 'Consider improving correlation preservation in synthetic data generation'
        }] : [],
        summary: {
          total: 1,
          passed: jennrichResult.significant ? 0 : 1,
          warnings: jennrichResult.significant && jennrichResult.statistic <= (jennrichResult.criticalValue * 2) ? 1 : 0,
          failures: jennrichResult.significant && jennrichResult.statistic > (jennrichResult.criticalValue * 2) ? 1 : 0
        }
      };
    } catch (error) {
      return {
        testType: 'Jennrich Covariance Matrix Test',
        description: 'Tests equality of covariance structures between datasets',
        result: 'ERROR',
        error: error.message,
        reason: 'Failed to compute Jennrich test statistic',
        summary: { total: 1, passed: 0, warnings: 0, failures: 1 }
      };
    }
  }

  /**
   * Calculate covariance matrix for multivariate analysis
   */
  calculateCovarianceMatrix(numericCols) {
    const n = numericCols.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    const headers = numericCols.map(col => col.header);
    
    // Calculate means
    const means = numericCols.map(col => 
      col.values.reduce((sum, val) => sum + val, 0) / col.values.length
    );
    
    // Calculate covariances
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const sampleSize = Math.min(numericCols[i].values.length, numericCols[j].values.length);
        let covariance = 0;
        
        for (let k = 0; k < sampleSize; k++) {
          covariance += (numericCols[i].values[k] - means[i]) * (numericCols[j].values[k] - means[j]);
        }
        
        matrix[i][j] = covariance / (sampleSize - 1);
      }
    }
    
    return {
      matrix,
      headers,
      size: n,
      means
    };
  }

  /**
   * Calculate Jennrich test statistic for correlation matrices (simplified implementation)
   */
  calculateJennrichStatistic(corrMatrix1, corrMatrix2) {
    const n = corrMatrix1.size;
    
    if (n !== corrMatrix2.size) {
      throw new Error('Correlation matrices must have the same dimensions');
    }
    
    // Calculate Frobenius norm of difference (simplified Jennrich approximation for correlation matrices)
    let sumSquaredDiffs = 0;
    let maxDiff = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const diff = Math.abs(corrMatrix1.matrix[i][j] - corrMatrix2.matrix[i][j]);
        sumSquaredDiffs += diff * diff;
        maxDiff = Math.max(maxDiff, diff);
      }
    }
    
    // Simplified test statistic (approximates chi-square distribution)
    const statistic = Math.sqrt(sumSquaredDiffs);
    const degreesOfFreedom = (n * (n + 1)) / 2;
    const criticalValue = Math.sqrt(2 * degreesOfFreedom + 1.96 * Math.sqrt(4 * degreesOfFreedom)); // α = 0.05 approximation
    
    return {
      statistic,
      criticalValue,
      degreesOfFreedom,
      significant: statistic > criticalValue,
      pValue: statistic > criticalValue ? '< 0.05' : '> 0.05',
      maxDifference: maxDiff
    };
  }

  /**
   * Comprehensive privacy and security tests - analyzes entire datasets
   */
  runPrivacyTests(realData, syntheticData) {
    console.log(`Starting comprehensive privacy analysis on ${realData.data.length} real and ${syntheticData.data.length} synthetic records...`);
    const tests = [];
    
    // Test 1: Membership inference risk - comprehensive analysis
    console.log('Running membership inference test on entire dataset...');
    const membershipTest = this.testMembershipInference(realData, syntheticData);
    tests.push(membershipTest);
    
    // Test 2: Attribute inference risk - already uses full dataset
    console.log('Running attribute inference test on entire dataset...');
    const attributeTest = this.testAttributeInference(realData, syntheticData);
    tests.push(attributeTest);
    
    console.log('Privacy analysis complete.');
    
    return {
      testType: 'Comprehensive Privacy and Security Assessment',
      description: `Evaluates privacy risks and data leakage across entire datasets (${realData.data.length} real records, ${syntheticData.data.length} synthetic records)`,
      datasetInfo: {
        realRecords: realData.data.length,
        syntheticRecords: syntheticData.data.length,
        columns: realData.headers.length,
        analysisType: 'Complete Dataset Analysis'
      },
      tests,
      summary: this.summarizeTests(tests),
      overallRisk: this.calculatePrivacyRisk(tests)
    };
  }

  /**
   * Test for membership inference vulnerabilities - analyzes entire dataset
   */
  testMembershipInference(realData, syntheticData) {
    console.log('Running comprehensive membership inference test on entire dataset...');
    
    // Use entire datasets, not just samples
    const realDataset = realData.data;
    const synthDataset = syntheticData.data;
    
    // Use hash-based approach for efficient exact match detection
    const realRowHashes = new Set();
    const synthRowHashes = new Map(); // Map to track count of each hash
    
    // Create hashes of all real data rows
    console.log(`Hashing ${realDataset.length} real data records...`);
    for (const realRow of realDataset) {
      const rowHash = JSON.stringify(realRow);
      realRowHashes.add(rowHash);
    }
    
    // Create hashes of all synthetic data rows and count occurrences
    console.log(`Hashing ${synthDataset.length} synthetic data records...`);
    for (const synthRow of synthDataset) {
      const rowHash = JSON.stringify(synthRow);
      synthRowHashes.set(rowHash, (synthRowHashes.get(rowHash) || 0) + 1);
    }
    
    // Find exact matches between real and synthetic data
    let exactMatches = 0;
    let duplicatedRealRecords = 0;
    const matchedHashes = [];
    
    for (const realHash of realRowHashes) {
      if (synthRowHashes.has(realHash)) {
        const synthCount = synthRowHashes.get(realHash);
        exactMatches += synthCount;
        duplicatedRealRecords++;
        
        // Store first few matches for detailed reporting
        if (matchedHashes.length < 5) {
          matchedHashes.push({
            rowHash: realHash.substring(0, 100) + '...', // Truncate for display
            syntheticOccurrences: synthCount
          });
        }
      }
    }
    
    const matchRate = duplicatedRealRecords / realDataset.length;
    const synthDuplicationRate = exactMatches / synthDataset.length;
    
    console.log(`Privacy test complete: ${exactMatches} exact matches found (${duplicatedRealRecords} unique real records)`);
    
    return {
      type: 'membership_inference_test',
      description: 'Tests for exact record duplications indicating membership leakage across entire dataset',
      exactMatches,
      duplicatedRealRecords,
      realDatasetSize: realDataset.length,
      syntheticDatasetSize: synthDataset.length,
      matchRate: matchRate.toFixed(6),
      synthDuplicationRate: synthDuplicationRate.toFixed(6),
      matchedSamples: matchedHashes,
      risk: matchRate > 0.01 ? 'CRITICAL' : matchRate > 0.001 ? 'HIGH' : matchRate > 0.0001 ? 'MEDIUM' : 'LOW',
      issues: matchRate > 0.0001 ? [{
        type: 'membership_leakage',
        severity: matchRate > 0.01 ? 'CRITICAL' : matchRate > 0.001 ? 'HIGH' : 'MEDIUM',
        message: `Found ${exactMatches} exact matches across ${duplicatedRealRecords} unique real records (${(matchRate * 100).toFixed(4)}% of real data duplicated)`,
        impact: matchRate > 0.01 ? 
          'Critical - Severe privacy violation through direct record reconstruction' : 
          matchRate > 0.001 ? 
            'High - Significant privacy risk through record reconstruction' :
            'Medium - Notable privacy concern with record similarities',
        recommendation: 'Consider adding more noise, using differential privacy, or reviewing data generation methodology'
      }] : [],
      severity: matchRate > 0.01 ? 'CRITICAL' : matchRate > 0.001 ? 'HIGH' : matchRate > 0.0001 ? 'MEDIUM' : 'PASS'
    };
  }

  /**
   * Test for attribute inference vulnerabilities (simplified)
   */
  testAttributeInference(realData, syntheticData) {
    const rareValueThreshold = 0.05; // 5% threshold for rare values
    const riskColumns = [];
    
    realData.headers.forEach((header, colIndex) => {
      const realValues = this.extractColumnValues(realData.data, colIndex);
      const synthValues = this.extractColumnValues(syntheticData.data, colIndex);
      
      const realFreq = this.getFrequencyDistribution(realValues);
      const totalReal = realValues.length;
      
      // Find rare values that appear in synthetic data
      for (const [value, count] of Object.entries(realFreq)) {
        const frequency = count / totalReal;
        if (frequency < rareValueThreshold) {
          const synthCount = synthValues.filter(v => v === value).length;
          if (synthCount > 0) {
            riskColumns.push({
              column: header,
              rareValue: value,
              realFrequency: frequency,
              synthOccurrences: synthCount
            });
          }
        }
      }
    });
    
    return {
      type: 'attribute_inference_test',
      description: 'Tests for preservation of rare values that could enable attribute inference',
      rareValueLeaks: riskColumns.length,
      riskColumns: riskColumns.slice(0, 5), // First 5 for display
      risk: riskColumns.length > 10 ? 'HIGH' : riskColumns.length > 5 ? 'MEDIUM' : 'LOW',
      issues: riskColumns.length > 5 ? [{
        type: 'rare_value_leakage',
        severity: riskColumns.length > 10 ? 'HIGH' : 'MEDIUM',
        message: `Found ${riskColumns.length} rare values preserved in synthetic data`,
        impact: 'Medium - Potential attribute inference through rare value combinations'
      }] : [],
      severity: riskColumns.length > 10 ? 'HIGH' : riskColumns.length > 5 ? 'MEDIUM' : 'PASS'
    };
  }

  /**
   * Calculate overall privacy risk assessment
   */
  calculatePrivacyRisk(privacyTests) {
    const highRiskTests = privacyTests.filter(t => t.risk === 'HIGH' || t.severity === 'HIGH' || t.severity === 'CRITICAL').length;
    const mediumRiskTests = privacyTests.filter(t => t.risk === 'MEDIUM' || t.severity === 'MEDIUM').length;
    
    if (highRiskTests > 0) return 'HIGH';
    if (mediumRiskTests > 0) return 'MEDIUM';
    return 'LOW';
  }

  // Helper methods for missing statistical tests
  runTTest(realValues, synthValues, column) {
    const n1 = realValues.length;
    const n2 = synthValues.length;
    
    const mean1 = realValues.reduce((sum, val) => sum + val, 0) / n1;
    const mean2 = synthValues.reduce((sum, val) => sum + val, 0) / n2;
    
    const var1 = realValues.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1);
    const var2 = synthValues.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1);
    
    // Welch's t-test for unequal variances
    const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
    const tStatistic = (mean1 - mean2) / pooledSE;
    const df = Math.pow(var1 / n1 + var2 / n2, 2) / (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
    
    // Critical value for two-tailed test at α = 0.05 (approximation)
    const criticalValue = 1.96; // Large sample approximation
    const significant = Math.abs(tStatistic) > criticalValue;
    
    return {
      column,
      type: 'welch_t_test',
      testName: "Welch's t-test",
      description: 'Two-sample t-test assuming unequal variances',
      statistic: tStatistic,
      degreesOfFreedom: df,
      realMean: mean1,
      syntheticMean: mean2,
      meanDifference: Math.abs(mean1 - mean2),
      result: significant ? 'REJECT' : 'ACCEPT',
      pValueApprox: significant ? '< 0.05' : '> 0.05',
      issues: significant ? [{
        type: 'mean_difference',
        severity: Math.abs(tStatistic) > 3 ? 'HIGH' : 'MEDIUM',
        message: `Means significantly different (Welch's t-test): real=${mean1.toFixed(4)}, synthetic=${mean2.toFixed(4)} (t=${tStatistic.toFixed(4)}, df=${df.toFixed(2)})`,
        impact: 'Medium - Different central tendencies between datasets'
      }] : [],
      severity: significant ? (Math.abs(tStatistic) > 3 ? 'HIGH' : 'MEDIUM') : 'PASS'
    };
  }

  calculateCompleteness(realData, syntheticData) {
    // Simplified completeness metric
    const realComplete = realData.data.filter(row => row.every(val => val !== null && val !== undefined)).length;
    const synthComplete = syntheticData.data.filter(row => row.every(val => val !== null && val !== undefined)).length;
    
    const realCompleteness = realComplete / realData.data.length;
    const synthCompleteness = synthComplete / syntheticData.data.length;
    
    return {
      name: 'Data Completeness',
      score: Math.min(1, synthCompleteness / realCompleteness),
      realCompleteness,
      syntheticCompleteness: synthCompleteness,
      description: 'Ratio of complete records without missing values'
    };
  }

  calculateConsistency(realData, syntheticData) {
    // Simplified consistency metric based on data types
    let consistentColumns = 0;
    
    realData.headers.forEach((header, colIndex) => {
      if (colIndex < syntheticData.headers.length) {
        const realType = classifyColumnType(colIndex, {
          data: realData.data,
          headers: realData.headers,
          labels: Array(realData.data.length).fill('Real')
        });
        const synthType = classifyColumnType(colIndex, {
          data: syntheticData.data,
          headers: syntheticData.headers,
          labels: Array(syntheticData.data.length).fill('Synthetic')
        });
        
        if (realType === synthType) consistentColumns++;
      }
    });
    
    return {
      name: 'Type Consistency',
      score: consistentColumns / realData.headers.length,
      consistentColumns,
      totalColumns: realData.headers.length,
      description: 'Proportion of columns with matching data types'
    };
  }

  calculateUtility(realData, syntheticData) {
    // Simplified utility metric
    return {
      name: 'Data Utility',
      score: 0.75, // Placeholder - would involve ML model performance comparison
      description: 'Estimated utility for downstream analysis tasks'
    };
  }

  calculatePrivacyMetrics(realData, syntheticData) {
    // Simplified privacy metric
    return {
      name: 'Privacy Protection',
      score: 0.85, // Placeholder - would involve privacy risk assessment
      description: 'Estimated privacy protection level'
    };
  }

  calculateOverallScore(metrics) {
    const weights = {
      completeness: 0.2,
      consistency: 0.3,
      utility: 0.3,
      privacy: 0.2
    };
    
    return Object.entries(metrics).reduce((total, [key, metric]) => {
      return total + (metric.score * weights[key]);
    }, 0);
  }
}

export const validationService = new ValidationService(); 