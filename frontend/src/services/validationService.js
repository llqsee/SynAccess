// Raw Data Validation and Statistics Service
// This service only computes raw statistics and test results
// All interpretation, severity assessment, and recommendations are handled by the AI agent
import { classifyColumnType } from '../utils/dataUtils';

export class ValidationService {
  constructor() {
    this.validationResults = null;
    
    // Optimal sample sizes for different tests
    this.optimal_sample_sizes = {
      ks_test: 1000,        // KS test optimal size
      t_test: 500,          // t-test optimal size
      chi_square: 1000,     // Chi-square optimal size
      correlation: 500,      // Correlation analysis optimal size
      outlier: 2000,        // Outlier detection optimal size
      range: 2000,          // Range validation optimal size
      distribution: 1500     // Distribution tests optimal size
    };
    
    // Minimum sample sizes for meaningful tests
    this.min_sample_sizes = {
      ks_test: 30,
      t_test: 20,
      chi_square: 50,
      correlation: 30,
      outlier: 50,
      range: 10,
      distribution: 30
    };
    
    // Multiple sampling runs for robust results
    this.multiple_sampling_runs = {
      ks_test: 5,        // Run KS test 5 times with different samples
      t_test: 3,         // Run t-test 3 times
      chi_square: 3,     // Run chi-square 3 times
      correlation: 1,    // Correlation analysis (single run due to complexity)
      outlier: 3,        // Run outlier detection 3 times
      range: 1,          // Range validation (single run)
      distribution: 1    // Distribution tests (single run)
    };
  }

  /**
   * Main validation function that computes raw statistics
   * Structured for AI analysis with clear sections for Executive Summary, Key Findings, etc.
   */
  async computeValidationStatistics(realData, syntheticData, options = {}) {
    const startTime = performance.now();
    
    try {
      const results = {
        timestamp: new Date().toISOString(),
        datasetInfo: this.getDatasetInfo(realData, syntheticData),
        processingTime: 0,
        
        // Structured sections for AI analysis
        executiveSummary: {
          datasetOverview: this.getDatasetOverview(realData, syntheticData),
          overallAssessment: this.getOverallAssessment(realData, syntheticData)
        },
        
        keyFindings: {
          statisticalTests: {},
          distributionAnalysis: {},
          correlationAnalysis: {},
          qualityMetrics: {}
        },
        
        statisticalQuality: {
          testResults: {},
          significanceLevels: {},
          effectSizes: {}
        },
        
        practicalUsefulness: {
          dataUtility: {},
          privacyProtection: {},
          domainSpecific: {}
        },
        
        criticalIssues: [],
        
        recommendations: {
          dataQuality: [],
          privacyEnhancement: [],
          utilityImprovement: []
        },
        
        riskAssessment: {
          overallRisk: 'UNKNOWN',
          riskFactors: {},
          justification: ''
        },
        
        // Raw test data for detailed analysis
        tests: {}
      };

      // Compute and structure range statistics
      const rangeStats = this.computeRangeStatistics(realData, syntheticData);
      results.tests.rangeValidation = rangeStats;
      results.keyFindings.statisticalTests.rangeAnalysis = this.extractRangeFindings(rangeStats);
      await this.yield();
      
      // Compute and structure distribution statistics
      const distributionStats = this.computeDistributionStatistics(realData, syntheticData);
      results.tests.distributionValidation = distributionStats;
      results.keyFindings.distributionAnalysis = this.extractDistributionFindings(distributionStats);
      results.statisticalQuality.testResults.distribution = this.extractDistributionQuality(distributionStats);
      await this.yield();
      
      // Compute and structure correlation statistics
      const correlationStats = this.computeCorrelationStatistics(realData, syntheticData);
      results.tests.correlationValidation = correlationStats;
      results.keyFindings.correlationAnalysis = this.extractCorrelationFindings(correlationStats);
      results.statisticalQuality.testResults.correlation = this.extractCorrelationQuality(correlationStats);
      await this.yield();
      
      // Compute and structure statistical tests
      const statisticalTests = this.computeStatisticalTests(realData, syntheticData);
      results.tests.statisticalValidation = statisticalTests;
      results.statisticalQuality.testResults.statistical = this.extractStatisticalQuality(statisticalTests);
      await this.yield();
      
      // Compute and structure outlier statistics
      const outlierStats = this.computeOutlierStatistics(realData, syntheticData);
      results.tests.outlierValidation = outlierStats;
      results.keyFindings.statisticalTests.outlierAnalysis = this.extractOutlierFindings(outlierStats);
      await this.yield();
      
      // Compute and structure quality metrics
      const qualityMetrics = this.computeQualityMetrics(realData, syntheticData);
      results.tests.qualityMetrics = qualityMetrics;
      results.keyFindings.qualityMetrics = this.extractQualityFindings(qualityMetrics);
      results.practicalUsefulness.dataUtility = this.extractUtilityMetrics(qualityMetrics);
      await this.yield();

      // Additional advanced tests if enabled
      if (options.enableAdvancedTests) {
        const jennrichTest = this.computeJennrichTest(realData, syntheticData);
        results.tests.jennrichTest = jennrichTest;
        results.statisticalQuality.testResults.jennrich = this.extractJennrichQuality(jennrichTest);
        await this.yield();
        
        const privacyTests = this.computePrivacyStatistics(realData, syntheticData);
        results.tests.privacyTests = privacyTests;
        results.practicalUsefulness.privacyProtection = this.extractPrivacyMetrics(privacyTests);
        await this.yield();
      }

      // Calculate overall risk assessment
      results.riskAssessment = this.calculateOverallRisk(results);
      
      // Generate initial recommendations
      results.recommendations = this.generateInitialRecommendations(results);
      
      // Identify critical issues
      results.criticalIssues = this.identifyCriticalIssues(results);
      
      // Calculate summary statistics
      this.calculateSummary(results);
      
      results.processingTime = Math.round(performance.now() - startTime);
      this.validationResults = results;
      
      return results;
    } catch (error) {
      throw new Error(`Validation computation failed: ${error.message}`);
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
   * Compute range statistics - no rule-based decisions
   */
  computeRangeStatistics(realData, syntheticData) {
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
        const realClean = realValues.filter(v => v !== null && v !== undefined && !isNaN(v));
        const synthClean = synthValues.filter(v => v !== null && v !== undefined && !isNaN(v));
        
        if (realClean.length < 5 || synthClean.length < 5) {
          return; // Skip if insufficient data
        }
        
        // Get optimal sample sizes for range validation
        const sampling = this.getOptimalSampleSize('range', realClean.length, synthClean.length);
        
        // Sample data for range validation
        const realSampled = this.sampleDataRandomly(realClean, sampling.realSampleSize, 42);
        const synthSampled = this.sampleDataRandomly(synthClean, sampling.synthSampleSize, 42);
        
        const realStats = this.calculateNumericStats(realSampled);
        const synthStats = this.calculateNumericStats(synthSampled);
        
        const test = {
          column: header,
          type: 'range_test',
          dataType: 'numeric',
          real: realStats,
          synthetic: synthStats,
          statistics: {
            rangeDiff: Math.abs((realStats.max - realStats.min) - (synthStats.max - synthStats.min)) / (realStats.max - realStats.min),
            minDiff: Math.abs(realStats.min - synthStats.min),
            maxDiff: Math.abs(realStats.max - synthStats.max),
            meanDiff: Math.abs(realStats.mean - synthStats.mean),
            stdDiff: Math.abs(realStats.std - synthStats.std)
          },
          sampling: {
            method: sampling.samplingMethod,
            realOriginalSize: realClean.length,
            synthOriginalSize: synthClean.length,
            realSampleSize: realSampled.length,
            synthSampleSize: synthSampled.length,
            samplingRatio: sampling.samplingRatio
          }
        };

        tests.push(test);
      } else {
        // Categorical range statistics
        const realUnique = new Set(realValues.filter(v => v !== null && v !== undefined));
        const synthUnique = new Set(synthValues.filter(v => v !== null && v !== undefined));
        
        const newCategories = [...synthUnique].filter(v => !realUnique.has(v));
        const missingCategories = [...realUnique].filter(v => !synthUnique.has(v));
        
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
          statistics: {
            newCategories: newCategories.length,
            missingCategories: missingCategories.length,
            categoryOverlap: realUnique.size - missingCategories.length,
            overlapRatio: (realUnique.size - missingCategories.length) / realUnique.size
          }
        };

        tests.push(test);
      }
    });

    return {
      testType: 'Range and Domain Statistics',
      description: 'Raw statistics for data ranges, bounds, and categorical domains',
      tests,
      summary: {
        total: tests.length,
        numericTests: tests.filter(t => t.dataType === 'numeric').length,
        categoricalTests: tests.filter(t => t.dataType === 'categorical').length
      }
    };
  }

  /**
   * Compute distribution statistics - no rule-based decisions
   */
  computeDistributionStatistics(realData, syntheticData) {
    const tests = [];
    
    // Safety limit for very wide datasets
    const maxColumns = 100;
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
        const test = this.computeKSTest(realValues, synthValues, header);
        tests.push(test);
      } else {
        const test = this.computeChiSquareTest(realValues, synthValues, header);
        tests.push(test);
      }
    }

    return {
      testType: 'Distribution Statistics',
      description: `Raw distribution statistics comparing real and synthetic data (${numColumns}/${Math.min(realData.headers.length, syntheticData.headers.length)} columns processed)`,
      tests,
      summary: {
        total: tests.length,
        numericTests: tests.filter(t => t.type === 'ks_test').length,
        categoricalTests: tests.filter(t => t.type === 'chi_square_test').length
      }
    };
  }

  /**
   * Compute KS test statistics - no rule-based decisions
   */
  computeKSTest(realValues, synthValues, column) {
    const realClean = realValues.filter(v => v !== null && v !== undefined && !isNaN(v));
    const synthClean = synthValues.filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (realClean.length === 0 || synthClean.length === 0) {
      return {
        column,
        type: 'ks_test',
        result: 'INSUFFICIENT_DATA',
        reason: 'Insufficient numeric data',
        statistics: null
      };
    }

    // Use multiple sampling iterations for robust results
    return this.runMultipleSamplingIterations('ks_test', realClean, synthClean, column, (realSampled, synthSampled, col) => {
    // Sort values
      const realSorted = [...realSampled].sort((a, b) => a - b);
      const synthSorted = [...synthSampled].sort((a, b) => a - b);
    
    // Calculate empirical CDFs and KS statistic
    const ksStatistic = this.calculateKSStatistic(realSorted, synthSorted);
    
      // Critical value for α = 0.05 (adjusted for sample size)
    const n1 = realSorted.length;
    const n2 = synthSorted.length;
    const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));
    
      return {
        column: col,
      type: 'ks_test',
      statistic: ksStatistic,
      criticalValue,
      pValueApprox: ksStatistic > criticalValue ? '< 0.05' : '> 0.05',
        sampleSizes: {
          real: n1,
          synthetic: n2
        },
        effectSize: ksStatistic / criticalValue
      };
    });
  }

  /**
   * Compute Chi-square test statistics - no rule-based decisions
   */
  computeChiSquareTest(realValues, synthValues, column) {
    const realClean = realValues.filter(v => v !== null && v !== undefined);
    const synthClean = synthValues.filter(v => v !== null && v !== undefined);
    
    if (realClean.length === 0 || synthClean.length === 0) {
      return {
        column,
        type: 'chi_square_test',
        result: 'INSUFFICIENT_DATA',
        reason: 'Insufficient categorical data',
        statistics: null
      };
    }

    // Get optimal sample sizes for Chi-square test
    const sampling = this.getOptimalSampleSize('chi_square', realClean.length, synthClean.length);
    
    // Sample data if needed
    const realSampled = this.sampleDataRandomly(realClean, sampling.realSampleSize, 42);
    const synthSampled = this.sampleDataRandomly(synthClean, sampling.synthSampleSize, 42);

    // Get frequency distributions
    const realFreq = this.getFrequencyDistribution(realSampled);
    const synthFreq = this.getFrequencyDistribution(synthSampled);
    
    // Calculate chi-square statistic
    const chiSquare = this.calculateChiSquare(realFreq, synthFreq);
    
    return {
      column,
      type: 'chi_square_test',
      statistic: chiSquare.statistic,
      degreesOfFreedom: chiSquare.df,
      realDistribution: realFreq,
      syntheticDistribution: synthFreq,
      sampling: {
        method: sampling.samplingMethod,
        realOriginalSize: realClean.length,
        synthOriginalSize: synthClean.length,
        realSampleSize: realSampled.length,
        synthSampleSize: synthSampled.length,
        samplingRatio: sampling.samplingRatio
      }
    };
  }

  /**
   * Correlation structure validation
   */
  computeCorrelationStatistics(realData, syntheticData) {
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
        
        if (realValues.length > 10 && synthValues.length > 10) {
          realNumericCols.push({ header, index: colIndex, values: realValues });
          synthNumericCols.push({ header, index: colIndex, values: synthValues });
        }
      }
    });

    if (realNumericCols.length < 2) {
      return {
        testType: 'Correlation Structure Validation',
        description: 'Element-wise comparison of correlation matrices',
        result: 'SKIP',
        reason: 'Insufficient numeric variables (minimum 2 required)',
        status: 'SKIP',
        severity: 'LOW'
      };
    }

    // Get optimal sample sizes for correlation analysis
    const sampling = this.getOptimalSampleSize('correlation', realData.data.length, syntheticData.data.length);
    
    // Sample data for correlation analysis
    const realSampled = this.sampleDataRandomly(realData.data, sampling.realSampleSize, 42);
    const synthSampled = this.sampleDataRandomly(syntheticData.data, sampling.synthSampleSize, 42);
    
    // Rebuild numeric columns with sampled data
    const realNumericColsSampled = [];
    const synthNumericColsSampled = [];
    
    realData.headers.forEach((header, colIndex) => {
      const dataType = classifyColumnType(colIndex, {
        data: [...realSampled, ...synthSampled],
        headers: realData.headers,
        labels: [...Array(realSampled.length).fill('Real'), ...Array(synthSampled.length).fill('Synthetic')]
      });
      
      if (dataType === 'numeric') {
        const realValues = this.extractColumnValues(realSampled, colIndex).filter(v => !isNaN(v));
        const synthValues = this.extractColumnValues(synthSampled, colIndex).filter(v => !isNaN(v));
        
        if (realValues.length > 10 && synthValues.length > 10) {
          realNumericColsSampled.push({ header, index: colIndex, values: realValues });
          synthNumericColsSampled.push({ header, index: colIndex, values: synthValues });
        }
      }
    });

    const realCorr = this.calculateCorrelationMatrix(realNumericColsSampled);
    const synthCorr = this.calculateCorrelationMatrix(synthNumericColsSampled);
    
    // Compare correlation matrices
    const corrComparison = this.compareCorrelationMatrices(realCorr, synthCorr);
    
    return {
      testType: 'Correlation Structure Validation',
      description: 'Element-wise comparison of correlation matrices (raw statistics only)',
      realCorrelations: realCorr,
      syntheticCorrelations: synthCorr,
      comparison: corrComparison,
      note: 'This provides detailed element-wise correlation comparison. For statistical significance testing of correlation matrix equality, see Jennrich test results.',
      sampling: {
        method: sampling.samplingMethod,
        realOriginalSize: realData.data.length,
        synthOriginalSize: syntheticData.data.length,
        realSampleSize: realSampled.length,
        synthSampleSize: synthSampled.length,
        samplingRatio: sampling.samplingRatio
      },
      summary: {
        total: 1,
        correlationComparisons: 1
      }
    };
  }

  /**
   * Statistical validation tests (means, variances, etc.)
   */
  computeStatisticalTests(realData, syntheticData) {
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
          const test = this.computeTTest(realValues, synthValues, header);
          tests.push(test);
        }
      }
    });

    return {
      testType: 'Statistical Significance Tests',
      description: "Welch's t-tests comparing means between real and synthetic data (raw statistics only)",
      tests,
      summary: {
        total: tests.length,
        tTests: tests.filter(t => t.type === 'welch_t_test').length
      }
    };
  }

  /**
   * Outlier detection and comparison with dynamic sampling
   */
  computeOutlierStatistics(realData, syntheticData) {
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
        
        if (realValues.length < 10 || synthValues.length < 10) {
          return; // Skip if insufficient data
        }
        
        // Get optimal sample sizes for outlier detection
        const sampling = this.getOptimalSampleSize('outlier', realValues.length, synthValues.length);
        
        // Sample data for outlier detection
        const realSampled = this.sampleDataRandomly(realValues, sampling.realSampleSize, 42);
        const synthSampled = this.sampleDataRandomly(synthValues, sampling.synthSampleSize, 42);
        
        const realOutliers = this.detectOutliers(realSampled);
        const synthOutliers = this.detectOutliers(synthSampled);
        
        const test = {
          column: header,
          type: 'outlier_test',
          real: {
            outlierCount: realOutliers.outliers.length,
            outlierPercentage: (realOutliers.outliers.length / realSampled.length) * 100,
            outliers: realOutliers.outliers.slice(0, 5) // First 5 for display
          },
          synthetic: {
            outlierCount: synthOutliers.outliers.length,
            outlierPercentage: (synthOutliers.outliers.length / synthSampled.length) * 100,
            outliers: synthOutliers.outliers.slice(0, 5)
          },
          sampling: {
            method: sampling.samplingMethod,
            realOriginalSize: realValues.length,
            synthOriginalSize: synthValues.length,
            realSampleSize: realSampled.length,
            synthSampleSize: synthSampled.length,
            samplingRatio: sampling.samplingRatio
          }
        };

        tests.push(test);
      }
    });

    return {
      testType: 'Outlier Detection and Comparison',
      description: 'Compares outlier patterns between real and synthetic data (raw statistics only)',
      tests,
      summary: {
        total: tests.length,
        numericTests: tests.filter(t => t.type === 'outlier_test').length
      }
    };
  }

  /**
   * Raw data completeness and consistency statistics (no rule-based assessment)
   */
  computeQualityMetrics(realData, syntheticData) {
    const completeness = this.computeCompleteness(realData, syntheticData);
    const consistency = this.computeConsistency(realData, syntheticData);

    return {
      testType: 'Data Completeness and Consistency Statistics',
      description: 'Raw statistics for data completeness and type consistency (no rule-based assessment)',
      completeness,
      consistency,
      summary: {
        total: 2,
        completenessTests: 1,
        consistencyTests: 1
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

  calculateSummary(results) {
    let totalTests = 0;
    let testCategories = 0;

    Object.values(results.tests).forEach(testGroup => {
      if (testGroup.summary) {
        totalTests += testGroup.summary.total || 0;
        testCategories += 1;
      }
    });

    results.summary = { 
      totalTests, 
      testCategories,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract dataset overview for Executive Summary
   */
  getDatasetOverview(realData, syntheticData) {
    return {
      realDataset: {
        rows: realData.data.length,
        columns: realData.headers.length,
        fileName: realData.metadata?.fileName || 'Unknown'
      },
      syntheticDataset: {
        rows: syntheticData.data.length,
        columns: syntheticData.headers.length,
        fileName: syntheticData.metadata?.fileName || 'Unknown'
      },
      sizeComparison: {
        rowRatio: syntheticData.data.length / realData.data.length,
        columnMatch: realData.headers.length === syntheticData.headers.length,
        headerMatch: JSON.stringify(realData.headers) === JSON.stringify(syntheticData.headers)
      }
    };
  }

  /**
   * Get overall assessment for Executive Summary
   */
  getOverallAssessment(realData, syntheticData) {
    const realSize = realData.data.length;
    const synthSize = syntheticData.data.length;
    const sizeRatio = synthSize / realSize;
    
    return {
      datasetSize: {
        real: realSize,
        synthetic: synthSize,
        ratio: sizeRatio,
        assessment: sizeRatio >= 0.5 ? 'Adequate' : 'Small'
      },
      columnCompatibility: {
        sameCount: realData.headers.length === syntheticData.headers.length,
        sameHeaders: JSON.stringify(realData.headers) === JSON.stringify(syntheticData.headers),
        assessment: realData.headers.length === syntheticData.headers.length ? 'Compatible' : 'Incompatible'
      }
    };
  }

  /**
   * Extract key findings from range statistics
   */
  extractRangeFindings(rangeStats) {
    if (!rangeStats || !rangeStats.tests) return {};
    
    const numericTests = rangeStats.tests.filter(t => t.dataType === 'numeric');
    const categoricalTests = rangeStats.tests.filter(t => t.dataType === 'categorical');
    
    return {
      numericVariables: {
        total: numericTests.length,
        significantDifferences: numericTests.filter(t => t.statistics?.rangeDiff > 0.1).length,
        averageRangeDifference: numericTests.reduce((sum, t) => sum + (t.statistics?.rangeDiff || 0), 0) / numericTests.length || 0
      },
      categoricalVariables: {
        total: categoricalTests.length,
        perfectOverlap: categoricalTests.filter(t => t.statistics?.overlapRatio === 1).length,
        averageOverlap: categoricalTests.reduce((sum, t) => sum + (t.statistics?.overlapRatio || 0), 0) / categoricalTests.length || 0
      }
    };
  }

  /**
   * Extract key findings from distribution statistics
   */
  extractDistributionFindings(distributionStats) {
    if (!distributionStats || !distributionStats.tests) return {};
    
    const ksTests = distributionStats.tests.filter(t => t.type === 'ks_test');
    const chiSquareTests = distributionStats.tests.filter(t => t.type === 'chi_square_test');
    
    return {
      kolmogorovSmirnov: {
        total: ksTests.length,
        significant: ksTests.filter(t => t.statistic > t.criticalValue).length,
        averageStatistic: ksTests.reduce((sum, t) => sum + (t.statistic || 0), 0) / ksTests.length || 0
      },
      chiSquare: {
        total: chiSquareTests.length,
        significant: chiSquareTests.filter(t => t.statistic > 3.841).length, // α = 0.05
        averageStatistic: chiSquareTests.reduce((sum, t) => sum + (t.statistic || 0), 0) / chiSquareTests.length || 0
      }
    };
  }

  /**
   * Extract key findings from correlation statistics
   */
  extractCorrelationFindings(correlationStats) {
    if (!correlationStats || correlationStats.result === 'SKIP') return {};
    
    return {
      correlationMatrix: {
        size: correlationStats.realCorrelations?.size || 0,
        significantDifferences: correlationStats.comparison?.significantDifferences || 0,
        averageDifference: correlationStats.comparison?.avgDifference || 0,
        maxDifference: correlationStats.comparison?.maxDifference || 0
      }
    };
  }

  /**
   * Extract key findings from quality metrics
   */
  extractQualityFindings(qualityMetrics) {
    if (!qualityMetrics) return {};
    
    return {
      completeness: {
        realCompleteness: qualityMetrics.completeness?.realCompleteness || 0,
        syntheticCompleteness: qualityMetrics.completeness?.syntheticCompleteness || 0,
        ratio: qualityMetrics.completeness?.score || 0
      },
      consistency: {
        consistentColumns: qualityMetrics.consistency?.consistentColumns || 0,
        totalColumns: qualityMetrics.consistency?.totalColumns || 0,
        ratio: qualityMetrics.consistency?.score || 0
      }
    };
  }

  /**
   * Extract key findings from outlier statistics
   */
  extractOutlierFindings(outlierStats) {
    if (!outlierStats || !outlierStats.tests) return {};
    
    const outlierTests = outlierStats.tests.filter(t => t.type === 'outlier_detection');
    const realOutliers = outlierTests.reduce((sum, t) => sum + (t.realOutliers || 0), 0);
    const synthOutliers = outlierTests.reduce((sum, t) => sum + (t.syntheticOutliers || 0), 0);
    const totalRealValues = outlierTests.reduce((sum, t) => sum + (t.realCount || 0), 0);
    const totalSynthValues = outlierTests.reduce((sum, t) => sum + (t.syntheticCount || 0), 0);
    
    return {
      totalTests: outlierTests.length,
      realOutlierRate: totalRealValues > 0 ? realOutliers / totalRealValues : 0,
      syntheticOutlierRate: totalSynthValues > 0 ? synthOutliers / totalSynthValues : 0,
      outlierRateDifference: totalSynthValues > 0 && totalRealValues > 0 ? 
        (synthOutliers / totalSynthValues) - (realOutliers / totalRealValues) : 0,
      columnsWithOutliers: outlierTests.filter(t => t.realOutliers > 0 || t.syntheticOutliers > 0).length,
      averageOutlierCount: outlierTests.length > 0 ? 
        (realOutliers + synthOutliers) / (outlierTests.length * 2) : 0
    };
  }

  /**
   * Extract distribution quality metrics
   */
  extractDistributionQuality(distributionStats) {
    if (!distributionStats || !distributionStats.tests) return {};
    
    const ksTests = distributionStats.tests.filter(t => t.type === 'ks_test');
    const significantTests = ksTests.filter(t => t.statistic > t.criticalValue);
    
    return {
      totalTests: ksTests.length,
      significantTests: significantTests.length,
      significanceRate: significantTests.length / ksTests.length || 0,
      averageEffectSize: ksTests.reduce((sum, t) => sum + (t.effectSize || 0), 0) / ksTests.length || 0
    };
  }

  /**
   * Extract correlation quality metrics
   */
  extractCorrelationQuality(correlationStats) {
    if (!correlationStats || correlationStats.result === 'SKIP') return {};
    
    return {
      matrixSize: correlationStats.realCorrelations?.size || 0,
      significantDifferences: correlationStats.comparison?.significantDifferences || 0,
      percentageSignificant: correlationStats.comparison?.percentageSignificant || 0,
      averageDifference: correlationStats.comparison?.avgDifference || 0
    };
  }

  /**
   * Extract statistical quality metrics
   */
  extractStatisticalQuality(statisticalTests) {
    if (!statisticalTests || !statisticalTests.tests) return {};
    
    const tTests = statisticalTests.tests.filter(t => t.type === 'welch_t_test');
    const significantTests = tTests.filter(t => t.result === 'REJECT');
    
    return {
      totalTests: tTests.length,
      significantTests: significantTests.length,
      significanceRate: significantTests.length / tTests.length || 0,
      averageTStatistic: tTests.reduce((sum, t) => sum + Math.abs(t.statistic || 0), 0) / tTests.length || 0
    };
  }

  /**
   * Extract Jennrich test quality metrics
   */
  extractJennrichQuality(jennrichTest) {
    if (!jennrichTest || jennrichTest.result === 'SKIP') return {};
    
    return {
      testPerformed: jennrichTest.result !== 'SKIP',
      significant: jennrichTest.result === 'REJECT',
      statistic: jennrichTest.statistic || 0,
      criticalValue: jennrichTest.criticalValue || 0,
      interpretation: jennrichTest.interpretation || 'Test not performed'
    };
  }

  /**
   * Extract utility metrics
   */
  extractUtilityMetrics(qualityMetrics) {
    if (!qualityMetrics) return {};
    
    return {
      completenessRatio: qualityMetrics.completeness?.score || 0,
      consistencyRatio: qualityMetrics.consistency?.score || 0,
      overallUtility: (qualityMetrics.completeness?.score + qualityMetrics.consistency?.score) / 2 || 0
    };
  }

  /**
   * Extract privacy metrics
   */
  extractPrivacyMetrics(privacyTests) {
    if (!privacyTests || !privacyTests.tests) return {};
    
    const membershipTest = privacyTests.tests.find(t => t.type === 'membership_inference_test');
    const attributeTest = privacyTests.tests.find(t => t.type === 'attribute_inference_test');
    
    return {
      membershipInference: {
        exactMatches: membershipTest?.exactMatches || 0,
        matchRate: membershipTest?.matchRate || 0,
        riskLevel: membershipTest?.matchRate > 0.01 ? 'HIGH' : 'LOW'
      },
      attributeInference: {
        rareValueLeaks: attributeTest?.rareValueLeaks || 0,
        riskLevel: attributeTest?.rareValueLeaks > 0 ? 'MEDIUM' : 'LOW'
      }
    };
  }

  /**
   * Calculate overall risk assessment
   */
  calculateOverallRisk(results) {
    const riskFactors = {
      statisticalRisk: 'LOW',
      privacyRisk: 'LOW',
      utilityRisk: 'LOW',
      correlationRisk: 'LOW'
    };
    
    let overallRisk = 'LOW';
    let justification = '';
    
    // Assess statistical risk
    const distributionQuality = results.statisticalQuality?.testResults?.distribution;
    if (distributionQuality && distributionQuality.significanceRate > 0.3) {
      riskFactors.statisticalRisk = 'MEDIUM';
    }
    if (distributionQuality && distributionQuality.significanceRate > 0.5) {
      riskFactors.statisticalRisk = 'HIGH';
    }
    
    // Assess privacy risk
    const privacyProtection = results.practicalUsefulness?.privacyProtection;
    if (privacyProtection?.membershipInference?.riskLevel === 'HIGH') {
      riskFactors.privacyRisk = 'HIGH';
    }
    if (privacyProtection?.attributeInference?.riskLevel === 'HIGH') {
      riskFactors.privacyRisk = 'HIGH';
    }
    
    // Assess utility risk
    const dataUtility = results.practicalUsefulness?.dataUtility;
    if (dataUtility && dataUtility.overallUtility < 0.7) {
      riskFactors.utilityRisk = 'MEDIUM';
    }
    if (dataUtility && dataUtility.overallUtility < 0.5) {
      riskFactors.utilityRisk = 'HIGH';
    }
    
    // Determine overall risk
    const highRisks = Object.values(riskFactors).filter(r => r === 'HIGH').length;
    const mediumRisks = Object.values(riskFactors).filter(r => r === 'MEDIUM').length;
    
    if (highRisks > 0) {
      overallRisk = 'HIGH';
      justification = 'Multiple high-risk factors detected including statistical differences and privacy concerns.';
    } else if (mediumRisks > 1) {
      overallRisk = 'MEDIUM';
      justification = 'Several medium-risk factors indicate potential issues with data quality or privacy.';
    } else {
      overallRisk = 'LOW';
      justification = 'Overall risk assessment indicates acceptable levels across all factors.';
    }
    
    return {
      overallRisk,
      riskFactors,
      justification
    };
  }

  /**
   * Generate initial recommendations
   */
  generateInitialRecommendations(results) {
    const recommendations = {
      dataQuality: [],
      privacyEnhancement: [],
      utilityImprovement: []
    };
    
    // Data quality recommendations
    const distributionQuality = results.statisticalQuality?.testResults?.distribution;
    if (distributionQuality && distributionQuality.significanceRate > 0.3) {
      recommendations.dataQuality.push('Review synthetic data generation parameters to improve distribution matching');
    }
    
    // Privacy recommendations
    const privacyProtection = results.practicalUsefulness?.privacyProtection;
    if (privacyProtection?.membershipInference?.riskLevel === 'HIGH') {
      recommendations.privacyEnhancement.push('Implement additional privacy protection measures to reduce membership inference risk');
    }
    
    // Utility recommendations
    const dataUtility = results.practicalUsefulness?.dataUtility;
    if (dataUtility && dataUtility.overallUtility < 0.7) {
      recommendations.utilityImprovement.push('Enhance data completeness and consistency to improve overall utility');
    }
    
    return recommendations;
  }

  /**
   * Identify critical issues
   */
  identifyCriticalIssues(results) {
    const issues = [];
    
    // Check for critical statistical issues
    const distributionQuality = results.statisticalQuality?.testResults?.distribution;
    if (distributionQuality && distributionQuality.significanceRate > 0.5) {
      issues.push({
        type: 'STATISTICAL',
        severity: 'HIGH',
        description: 'More than 50% of distribution tests show significant differences',
        impact: 'May affect downstream analysis reliability'
      });
    }
    
    // Check for critical privacy issues
    const privacyProtection = results.practicalUsefulness?.privacyProtection;
    if (privacyProtection?.membershipInference?.riskLevel === 'HIGH') {
      issues.push({
        type: 'PRIVACY',
        severity: 'CRITICAL',
        description: 'High membership inference risk detected',
        impact: 'Potential data leakage and privacy breach'
      });
    }
    
    // Check for critical utility issues
    const dataUtility = results.practicalUsefulness?.dataUtility;
    if (dataUtility && dataUtility.overallUtility < 0.5) {
      issues.push({
        type: 'UTILITY',
        severity: 'HIGH',
        description: 'Low data utility score indicates poor synthetic data quality',
        impact: 'May not be suitable for intended use cases'
      });
    }
    
    return issues;
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
        matrixSizeMatch: false,
        realSize: realCorr?.size || 0,
        syntheticSize: synthCorr?.size || 0,
        summary: 'Matrix comparison failed due to size mismatch'
      };
    }
    
    const n = realCorr.size;
    let totalDifferences = 0;
    let significantDifferences = 0;
    let maxDifference = 0;
    const differences = [];
    
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
          differences.push({
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
    
    return {
      matrixSizeMatch: true,
        totalComparisons,
        significantDifferences,
        avgDifference: avgDifference.toFixed(4),
        maxDifference: maxDifference.toFixed(4),
      percentageSignificant: ((significantDifferences / totalComparisons) * 100).toFixed(1),
      differences: differences.slice(0, 10), // First 10 for display
      summary: significantDifferences === 0 ? 
        'Correlation structures match well' : 
        `Found ${significantDifferences} significant correlation differences`
    };
  }

  /**
   * Jennrich test for comparing correlation matrices
   * Tests if correlation structures are statistically equivalent between datasets
   */
  computeJennrichTest(realData, syntheticData) {
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
        summary: {
          total: 1,
          jennrichTests: 1
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
  computePrivacyStatistics(realData, syntheticData) {
    const tests = [];
    
    // Test 1: Membership inference risk - comprehensive analysis
    const membershipTest = this.testMembershipInference(realData, syntheticData);
    tests.push(membershipTest);
    
    // Test 2: Attribute inference risk - already uses full dataset
    const attributeTest = this.testAttributeInference(realData, syntheticData);
    tests.push(attributeTest);
    
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
      summary: {
        total: tests.length,
        privacyTests: tests.filter(t => t.type === 'membership_inference_test' || t.type === 'attribute_inference_test').length
      },
      overallRisk: this.calculatePrivacyRisk(tests)
    };
  }

  /**
   * Test for membership inference vulnerabilities - analyzes entire dataset
   */
  testMembershipInference(realData, syntheticData) {
    // Use entire datasets, not just samples
    const realDataset = realData.data;
    const synthDataset = syntheticData.data;
    
    // Use hash-based approach for efficient exact match detection
    const realRowHashes = new Set();
    const synthRowHashes = new Map(); // Map to track count of each hash
    
    // Create hashes of all real data rows
    for (const realRow of realDataset) {
      const rowHash = JSON.stringify(realRow);
      realRowHashes.add(rowHash);
    }
    
    // Create hashes of all synthetic data rows and count occurrences
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
    
    return {
      type: 'membership_inference_test',
      description: 'Tests for exact record duplications indicating membership leakage across entire dataset',
      exactMatches,
      duplicatedRealRecords,
      realDatasetSize: realDataset.length,
      syntheticDatasetSize: synthDataset.length,
      matchRate: matchRate.toFixed(6),
      synthDuplicationRate: synthDuplicationRate.toFixed(6),
      matchedSamples: matchedHashes
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
      rareValueThreshold: rareValueThreshold
    };
  }

  /**
   * Calculate overall privacy risk assessment
   */
  calculatePrivacyRisk(privacyTests) {
    return {
      totalTests: privacyTests.length,
      membershipTests: privacyTests.filter(t => t.type === 'membership_inference_test').length,
      attributeTests: privacyTests.filter(t => t.type === 'attribute_inference_test').length
    };
  }

  // Helper methods for missing statistical tests
  computeTTest(realValues, synthValues, column) {
    const realClean = realValues.filter(v => v !== null && v !== undefined && !isNaN(v));
    const synthClean = synthValues.filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (realClean.length === 0 || synthClean.length === 0) {
      return {
        column,
        type: 'welch_t_test',
        result: 'INSUFFICIENT_DATA',
        reason: 'Insufficient numeric data'
      };
    }

    // Use multiple sampling iterations for robust results
    return this.runMultipleSamplingIterations('t_test', realClean, synthClean, column, (realSampled, synthSampled, col) => {
      const n1 = realSampled.length;
      const n2 = synthSampled.length;
      
      const mean1 = realSampled.reduce((sum, val) => sum + val, 0) / n1;
      const mean2 = synthSampled.reduce((sum, val) => sum + val, 0) / n2;
      
      const var1 = realSampled.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1);
      const var2 = synthSampled.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1);
    
    // Welch's t-test for unequal variances
    const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
    const tStatistic = (mean1 - mean2) / pooledSE;
    const df = Math.pow(var1 / n1 + var2 / n2, 2) / (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
    
    // Critical value for two-tailed test at α = 0.05 (approximation)
    const criticalValue = 1.96; // Large sample approximation
    const significant = Math.abs(tStatistic) > criticalValue;
    
    return {
        column: col,
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
        criticalValue: criticalValue,
        significant: significant
      };
    });
  }

  computeCompleteness(realData, syntheticData) {
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

  computeConsistency(realData, syntheticData) {
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

  computeUtility(realData, syntheticData) {
    // Simplified utility metric
    return {
      name: 'Data Utility',
      score: 0.75, // Placeholder - would involve ML model performance comparison
      description: 'Estimated utility for downstream analysis tasks'
    };
  }

  computePrivacyMetrics(realData, syntheticData) {
    // Simplified privacy metric
    return {
      name: 'Privacy Protection',
      score: 0.85, // Placeholder - would involve privacy risk assessment
      description: 'Estimated privacy protection level'
    };
  }

  computeOverallScore(metrics) {
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

  /**
   * Dynamic sampling strategy that adapts to dataset size and test requirements
   */
  getOptimalSampleSize(testType, realSize, synthSize) {
    const optimalSize = this.optimal_sample_sizes[testType] || 1000;
    const minSize = this.min_sample_sizes[testType] || 30;
    
    // For small datasets, use all available data
    if (realSize <= optimalSize && synthSize <= optimalSize) {
      return {
        realSampleSize: realSize,
        synthSampleSize: synthSize,
        samplingMethod: 'full_dataset',
        samplingRatio: 1.0
      };
    }
    
    // For medium datasets, use optimal size
    if (realSize <= optimalSize * 2 && synthSize <= optimalSize * 2) {
      const realSample = Math.min(realSize, optimalSize);
      const synthSample = Math.min(synthSize, optimalSize);
      return {
        realSampleSize: realSample,
        synthSampleSize: synthSample,
        samplingMethod: 'optimal_size',
        samplingRatio: Math.min(realSample / realSize, synthSample / synthSize)
      };
    }
    
    // For large datasets, use optimal size with random sampling
    const realSample = Math.min(realSize, optimalSize);
    const synthSample = Math.min(synthSize, optimalSize);
    
    return {
      realSampleSize: realSample,
      synthSampleSize: synthSample,
      samplingMethod: 'random_sampling',
      samplingRatio: Math.min(realSample / realSize, synthSample / synthSize)
    };
  }

  /**
   * Sample data randomly while preserving distribution characteristics
   */
  sampleDataRandomly(data, sampleSize, seed = null) {
    if (data.length <= sampleSize) {
      return data; // Return all data if sample size is larger
    }
    
    // Use seed for reproducible sampling
    if (seed !== null) {
      const rng = this.seededRandom(seed);
      const indices = [];
      for (let i = 0; i < data.length; i++) {
        indices.push(i);
      }
      
      // Fisher-Yates shuffle with seeded random
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      
      return indices.slice(0, sampleSize).map(i => data[i]);
    } else {
      // Simple random sampling without seed
      const indices = new Set();
      while (indices.size < sampleSize) {
        indices.add(Math.floor(Math.random() * data.length));
      }
      return Array.from(indices).map(i => data[i]);
    }
  }

  /**
   * Seeded random number generator for reproducible sampling
   */
  seededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  /**
   * Run multiple sampling iterations for robust statistical testing
   */
  runMultipleSamplingIterations(testType, realValues, synthValues, column, testFunction) {
    const numRuns = this.multiple_sampling_runs[testType] || 1;
    
    if (numRuns === 1) {
      // Single run - use existing logic
      return testFunction(realValues, synthValues, column);
    }
    
    const results = [];
    const seeds = [42, 123, 456, 789, 999]; // Different seeds for each run
    
    // Run multiple iterations
    for (let i = 0; i < numRuns; i++) {
      const seed = seeds[i % seeds.length];
      const sampling = this.getOptimalSampleSize(testType, realValues.length, synthValues.length);
      
      // Sample data with different seed for each run
      const realSampled = this.sampleDataRandomly(realValues, sampling.realSampleSize, seed);
      const synthSampled = this.sampleDataRandomly(synthValues, sampling.synthSampleSize, seed);
      
      // Run the test function with sampled data
      const result = testFunction(realSampled, synthSampled, column);
      result.sampling = {
        method: sampling.samplingMethod,
        realOriginalSize: realValues.length,
        synthOriginalSize: synthValues.length,
        realSampleSize: realSampled.length,
        synthSampleSize: synthSampled.length,
        samplingRatio: sampling.samplingRatio,
        iteration: i + 1,
        totalIterations: numRuns,
        seed: seed
      };
      
      results.push(result);
    }
    
    // Aggregate results
    return this.aggregateMultipleResults(results, testType);
  }

  /**
   * Aggregate results from multiple sampling iterations
   */
  aggregateMultipleResults(results, testType) {
    const firstResult = results[0];
    const baseResult = {
      column: firstResult.column,
      type: firstResult.type,
      iterations: results.length,
      sampling: {
        method: 'multiple_sampling',
        totalIterations: results.length,
        iterations: results.map(r => r.sampling)
      }
    };
    
    // For KS test, aggregate statistics
    if (testType === 'ks_test') {
      const statistics = results.map(r => r.statistic);
      const criticalValues = results.map(r => r.criticalValue);
      const meanStatistic = statistics.reduce((sum, stat) => sum + stat, 0) / statistics.length;
      const meanCriticalValue = criticalValues.reduce((sum, cv) => sum + cv, 0) / criticalValues.length;
      
      // Count how many iterations rejected the null hypothesis
      const rejections = results.filter(r => r.result === 'REJECT').length;
      const rejectionRate = rejections / results.length;
      
      baseResult.statistic = meanStatistic;
      baseResult.criticalValue = meanCriticalValue;
      baseResult.rejectionRate = rejectionRate;
      baseResult.rejections = rejections;
      baseResult.totalIterations = results.length;
    }
    
    // For t-test, aggregate means and statistics
    else if (testType === 't_test') {
      const tStatistics = results.map(r => r.statistic);
      const meanTStatistic = tStatistics.reduce((sum, stat) => sum + stat, 0) / tStatistics.length;
      const significantResults = results.filter(r => r.result === 'REJECT').length;
      const significanceRate = significantResults / results.length;
      
      baseResult.statistic = meanTStatistic;
      baseResult.significanceRate = significanceRate;
      baseResult.significantResults = significantResults;
    }
    
    return baseResult;
  }
}

export const validationService = new ValidationService(); 