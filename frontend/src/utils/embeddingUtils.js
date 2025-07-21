/**
 * Enhanced utility functions for embedding visualization and analysis
 */

import * as d3 from 'd3';
import { saveAs } from 'file-saver';

// Export formats and utilities
export const ExportFormats = {
  PNG: 'png',
  SVG: 'svg',
  JSON: 'json',
  CSV: 'csv'
};

// Performance monitoring
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderTimes: [],
      apiCalls: [],
      userInteractions: [],
      memoryUsage: []
    };
  }

  recordRenderTime(componentName, duration) {
    this.metrics.renderTimes.push({
      component: componentName,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last 50 entries
    if (this.metrics.renderTimes.length > 50) {
      this.metrics.renderTimes.shift();
    }
  }

  recordApiCall(endpoint, duration, status) {
    this.metrics.apiCalls.push({
      endpoint,
      duration,
      status,
      timestamp: Date.now()
    });
    
    if (this.metrics.apiCalls.length > 100) {
      this.metrics.apiCalls.shift();
    }
  }

  recordUserInteraction(action, details = {}) {
    this.metrics.userInteractions.push({
      action,
      details,
      timestamp: Date.now()
    });
    
    if (this.metrics.userInteractions.length > 200) {
      this.metrics.userInteractions.shift();
    }
  }

  recordMemoryUsage() {
    if (performance.memory) {
      this.metrics.memoryUsage.push({
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      });
      
      if (this.metrics.memoryUsage.length > 30) {
        this.metrics.memoryUsage.shift();
      }
    }
  }

  getAverageRenderTime(componentName) {
    const renders = this.metrics.renderTimes.filter(r => r.component === componentName);
    if (renders.length === 0) return 0;
    return renders.reduce((sum, r) => sum + r.duration, 0) / renders.length;
  }

  getMetricsSummary() {
    return {
      averageRenderTime: this.getAverageRenderTime('EmbeddingPlot'),
      totalApiCalls: this.metrics.apiCalls.length,
      averageApiResponseTime: this.metrics.apiCalls.length > 0 
        ? this.metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / this.metrics.apiCalls.length 
        : 0,
      userInteractionCount: this.metrics.userInteractions.length,
      currentMemoryUsage: this.metrics.memoryUsage.length > 0 
        ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] 
        : null
    };
  }
}

// Data export utilities
export class EmbeddingExporter {
  static exportToPNG(svgElement, filename = 'embedding_plot.png', scale = 2) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = function() {
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob(function(blob) {
            saveAs(blob, filename);
            URL.revokeObjectURL(url);
            resolve();
          });
        };
        
        img.onerror = reject;
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  }

  static exportToSVG(svgElement, filename = 'embedding_plot.svg') {
    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(svgBlob, filename);
    } catch (error) {
      console.error('Error exporting SVG:', error);
      throw error;
    }
  }

  static exportToJSON(data, metadata, filename = 'embedding_data.json') {
    try {
      const exportData = {
        embedding_data: data,
        metadata: metadata,
        export_timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      saveAs(jsonBlob, filename);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      throw error;
    }
  }

  static exportToCSV(data, labels, headers = null, filename = 'embedding_data.csv') {
    try {
      let csvContent = '';
      
      // Headers
      if (headers) {
        csvContent += headers.join(',') + ',Type\n';
      } else {
        const numDims = data[0]?.length || 2;
        const dimHeaders = Array.from({ length: numDims }, (_, i) => `Dim_${i + 1}`);
        csvContent += dimHeaders.join(',') + ',Type\n';
      }
      
      // Data rows
      data.forEach((point, index) => {
        const row = point.join(',') + ',' + (labels[index] || 'Unknown');
        csvContent += row + '\n';
      });
      
      const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      saveAs(csvBlob, filename);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      throw error;
    }
  }
}

// Advanced data analysis utilities
export class EmbeddingAnalyzer {
  static calculateClusterMetrics(data, labels) {
    if (!data || !labels || data.length !== labels.length) {
      return null;
    }

    const clusters = {};
    
    // Group points by label
    data.forEach((point, index) => {
      const label = labels[index];
      if (!clusters[label]) {
        clusters[label] = [];
      }
      clusters[label].push(point);
    });

    const metrics = {};
    
    Object.entries(clusters).forEach(([label, points]) => {
      if (points.length === 0) return;
      
      // Calculate centroid
      const dims = points[0].length;
      const centroid = new Array(dims).fill(0);
      
      points.forEach(point => {
        point.forEach((value, dim) => {
          centroid[dim] += value;
        });
      });
      
      centroid.forEach((sum, dim) => {
        centroid[dim] = sum / points.length;
      });

      // Calculate intra-cluster distances
      const distances = points.map(point => 
        Math.sqrt(
          point.reduce((sum, value, dim) => 
            sum + Math.pow(value - centroid[dim], 2), 0
          )
        )
      );

      metrics[label] = {
        count: points.length,
        centroid,
        avgDistanceFromCentroid: distances.reduce((sum, d) => sum + d, 0) / distances.length,
        maxDistanceFromCentroid: Math.max(...distances),
        spread: {
          x: [Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0]))],
          y: [Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1]))]
        }
      };
    });

    return metrics;
  }

  static calculateSeparation(realPoints, syntheticPoints) {
    if (!realPoints || !syntheticPoints || realPoints.length === 0 || syntheticPoints.length === 0) {
      return null;
    }

    // Calculate minimum distance between real and synthetic points
    let minDistance = Infinity;
    let avgDistance = 0;
    let totalPairs = 0;

    realPoints.forEach(realPoint => {
      syntheticPoints.forEach(synthPoint => {
        const distance = Math.sqrt(
          realPoint.reduce((sum, value, dim) => 
            sum + Math.pow(value - synthPoint[dim], 2), 0
          )
        );
        
        minDistance = Math.min(minDistance, distance);
        avgDistance += distance;
        totalPairs++;
      });
    });

    avgDistance /= totalPairs;

    return {
      minDistance,
      avgDistance,
      separationRatio: avgDistance / minDistance
    };
  }

  static detectOutliers(points, threshold = 2.5) {
    if (!points || points.length === 0) return [];

    // Calculate centroid
    const dims = points[0].length;
    const centroid = new Array(dims).fill(0);
    
    points.forEach(point => {
      point.forEach((value, dim) => {
        centroid[dim] += value;
      });
    });
    
    centroid.forEach((sum, dim) => {
      centroid[dim] = sum / points.length;
    });

    // Calculate distances from centroid
    const distances = points.map(point => 
      Math.sqrt(
        point.reduce((sum, value, dim) => 
          sum + Math.pow(value - centroid[dim], 2), 0
        )
      )
    );

    // Calculate standard deviation
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const stdDev = Math.sqrt(
      distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length
    );

    // Identify outliers
    const outlierIndices = [];
    distances.forEach((distance, index) => {
      if (Math.abs(distance - avgDistance) > threshold * stdDev) {
        outlierIndices.push(index);
      }
    });

    return outlierIndices;
  }
}

// Visualization enhancement utilities
export class VisualizationEnhancer {
  static createColorPalette(numColors, type = 'qualitative') {
    const palettes = {
      qualitative: d3.schemeCategory10,
      sequential: d3.interpolateViridis,
      diverging: d3.interpolateRdBu
    };

    if (type === 'qualitative') {
      const palette = palettes.qualitative;
      return Array.from({ length: numColors }, (_, i) => 
        palette[i % palette.length]
      );
    } else if (type === 'sequential') {
      return Array.from({ length: numColors }, (_, i) => 
        palettes.sequential(i / (numColors - 1))
      );
    } else {
      return Array.from({ length: numColors }, (_, i) => 
        palettes.diverging(i / (numColors - 1))
      );
    }
  }

  static addTooltips(svg, data, metadata) {
    const tooltip = d3.select('body').append('div')
      .attr('class', 'embedding-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('font-size', '12px')
      .style('z-index', 1000);

    svg.selectAll('circle')
      .on('mouseover', function(event, d) {
        const pointIndex = d3.select(this).datum().index;
        const pointData = data[pointIndex];
        const label = metadata.labels[pointIndex];
        
        tooltip.transition().duration(200).style('opacity', 0.9);
        tooltip.html(`
          <strong>Type:</strong> ${label}<br/>
          <strong>Index:</strong> ${pointIndex}<br/>
          <strong>Coordinates:</strong> (${pointData[0].toFixed(3)}, ${pointData[1].toFixed(3)})
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function(d) {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    return tooltip;
  }

  static addZoomAndPan(svg, plotGroup, width, height) {
    const zoom = d3.zoom()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        plotGroup.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Add zoom controls
    const controls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', `translate(${width - 60}, 20)`);

    const zoomIn = controls.append('g')
      .attr('class', 'zoom-in')
      .style('cursor', 'pointer');

    zoomIn.append('rect')
      .attr('width', 30)
      .attr('height', 30)
      .attr('fill', 'rgba(255, 255, 255, 0.8)')
      .attr('stroke', '#ccc')
      .attr('rx', 4);

    zoomIn.append('text')
      .attr('x', 15)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('+');

    const zoomOut = controls.append('g')
      .attr('class', 'zoom-out')
      .attr('transform', 'translate(0, 35)')
      .style('cursor', 'pointer');

    zoomOut.append('rect')
      .attr('width', 30)
      .attr('height', 30)
      .attr('fill', 'rgba(255, 255, 255, 0.8)')
      .attr('stroke', '#ccc')
      .attr('rx', 4);

    zoomOut.append('text')
      .attr('x', 15)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', 'bold')
      .text('−');

    // Zoom event handlers
    zoomIn.on('click', () => {
      svg.transition().call(zoom.scaleBy, 1.5);
    });

    zoomOut.on('click', () => {
      svg.transition().call(zoom.scaleBy, 1 / 1.5);
    });

    return zoom;
  }

  static addLegend(svg, labels, colors, width, height) {
    const uniqueLabels = [...new Set(labels)];
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 120}, ${height - uniqueLabels.length * 20 - 20})`);

    const legendItems = legend.selectAll('.legend-item')
      .data(uniqueLabels)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    legendItems.append('circle')
      .attr('cx', 6)
      .attr('cy', 6)
      .attr('r', 6)
      .attr('fill', (d, i) => colors[i % colors.length]);

    legendItems.append('text')
      .attr('x', 18)
      .attr('y', 6)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('fill', '#333')
      .text(d => d);

    return legend;
  }
}

// Animation utilities
export class AnimationController {
  static animatePoints(selection, duration = 1000) {
    return selection
      .transition()
      .duration(duration)
      .attr('r', 0)
      .transition()
      .duration(duration)
      .attr('r', d => d.radius || 4)
      .style('opacity', 1);
  }

  static animateSelection(selection, scale = 1.5, duration = 300) {
    return selection
      .transition()
      .duration(duration)
      .attr('r', d => (d.radius || 4) * scale)
      .style('stroke-width', 2)
      .style('stroke', '#ff6b35');
  }

  static animateDeselection(selection, duration = 300) {
    return selection
      .transition()
      .duration(duration)
      .attr('r', d => d.radius || 4)
      .style('stroke-width', 0.5)
      .style('stroke', 'white');
  }
}

// Performance optimization utilities
export class OptimizationUtils {
  static sampleData(data, labels, maxPoints = 10000) {
    if (data.length <= maxPoints) {
      return { 
        data, 
        labels, 
        indices: Array.from({ length: data.length }, (_, i) => i),
        sampled: false 
      };
    }

    // Stratified sampling to maintain class balance
    const groups = {};
    data.forEach((point, index) => {
      const label = labels[index];
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push({ point, label, index });
    });

    const sampledIndices = [];
    const groupNames = Object.keys(groups);
    const pointsPerGroup = Math.floor(maxPoints / groupNames.length);

    groupNames.forEach(groupName => {
      const group = groups[groupName];
      const sampleSize = Math.min(pointsPerGroup, group.length);
      
      // Random sampling within group
      const shuffled = group.sort(() => 0.5 - Math.random());
      for (let i = 0; i < sampleSize; i++) {
        sampledIndices.push(shuffled[i].index);
      }
    });

    const sampledData = sampledIndices.map(i => data[i]);
    const sampledLabels = sampledIndices.map(i => labels[i]);

    return {
      data: sampledData,
      labels: sampledLabels,
      indices: sampledIndices,
      sampled: true,
      originalSize: data.length,
      sampledSize: sampledData.length
    };
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

// Global instances
export const performanceMonitor = new PerformanceMonitor();

// Auto-start performance monitoring
if (typeof window !== 'undefined') {
  // Monitor memory usage every 10 seconds
  setInterval(() => performanceMonitor.recordMemoryUsage(), 10000);
  
  // Monitor page visibility for performance optimization
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      performanceMonitor.recordUserInteraction('page_hidden');
    } else {
      performanceMonitor.recordUserInteraction('page_visible');
    }
  });
}

export default {
  ExportFormats,
  PerformanceMonitor,
  EmbeddingExporter,
  EmbeddingAnalyzer,
  VisualizationEnhancer,
  AnimationController,
  OptimizationUtils,
  performanceMonitor
}; 