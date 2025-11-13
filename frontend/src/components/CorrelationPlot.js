import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Box, Typography } from '@mui/material';

// Shared palette with EmbeddingPlot so correlation visuals stay aligned with overall analysis.
const REAL_COLOR = '#3b82f6';
const SYNTH_COLOR = '#dc2626';
const HIGHLIGHT_STROKE = '#000000';

const parseNum = (value) => (typeof value === 'number' ? value : parseFloat(value));

const isFiniteNum = (value) => Number.isFinite(value) && !Number.isNaN(value);

const pearsonForPair = (rows, i, j) => {
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let r = 0; r < rows.length; r++) {
    const vx = parseNum(rows[r]?.[i]);
    const vy = parseNum(rows[r]?.[j]);
    if (!isFiniteNum(vx) || !isFiniteNum(vy)) continue;
    n++;
    sumX += vx;
    sumY += vy;
    sumXX += vx * vx;
    sumYY += vy * vy;
    sumXY += vx * vy;
  }
  if (n <= 1) return 0;
  const cov = sumXY - (sumX * sumY) / n;
  const varX = sumXX - (sumX * sumX) / n;
  const varY = sumYY - (sumY * sumY) / n;
  const denom = Math.sqrt(varX * varY);
  return denom > 1e-12 ? (cov / denom) : 0;
};

const cramersV = (rows, i, j) => {
  const aMap = new Map();
  const bMap = new Map();
  let aCount = 0;
  let bCount = 0;
  const pairs = [];
  for (let r = 0; r < rows.length; r++) {
    const aRaw = rows[r]?.[i];
    const bRaw = rows[r]?.[j];
    if (aRaw === null || aRaw === undefined || aRaw === '' || bRaw === null || bRaw === undefined || bRaw === '') continue;
    const a = String(aRaw);
    const b = String(bRaw);
    if (!aMap.has(a)) aMap.set(a, aCount++);
    if (!bMap.has(b)) bMap.set(b, bCount++);
    pairs.push([aMap.get(a), bMap.get(b)]);
  }
  const rDim = aCount;
  const cDim = bCount;
  const n = pairs.length;
  if (n === 0 || rDim === 0 || cDim === 0) return 0;
  const table = Array.from({ length: rDim }, () => new Array(cDim).fill(0));
  for (const [ri, ci] of pairs) table[ri][ci] += 1;
  const rowSum = table.map(row => row.reduce((a, b) => a + b, 0));
  const colSum = Array.from({ length: cDim }, (_, j2) => table.reduce((acc, row) => acc + row[j2], 0));
  let chi2 = 0;
  for (let r2 = 0; r2 < rDim; r2++) {
    for (let c2 = 0; c2 < cDim; c2++) {
      const expected = (rowSum[r2] * colSum[c2]) / n;
      if (expected > 0) {
        const diff = table[r2][c2] - expected;
        chi2 += (diff * diff) / expected;
      }
    }
  }
  const k = Math.min(rDim - 1, cDim - 1);
  if (k <= 0) return 0;
  const v = Math.sqrt(chi2 / (n * k));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
};

const correlationRatioEta = (rows, catIdx, numIdx) => {
  const groups = new Map();
  let N = 0;
  let sumY = 0;
  let sumYY = 0;
  for (let r = 0; r < rows.length; r++) {
    const cRaw = rows[r]?.[catIdx];
    const yRaw = rows[r]?.[numIdx];
    if (cRaw === null || cRaw === undefined || cRaw === '') continue;
    const y = parseNum(yRaw);
    if (!isFiniteNum(y)) continue;
    const c = String(cRaw);
    const g = groups.get(c) || { n: 0, sum: 0 };
    g.n += 1;
    g.sum += y;
    groups.set(c, g);
    N += 1;
    sumY += y;
    sumYY += y * y;
  }
  if (N <= 1 || groups.size <= 1) return { eta: 0, eta2: 0 };
  const mu = sumY / N;
  const SST = sumYY - N * mu * mu;
  if (SST <= 1e-12) return { eta: 0, eta2: 0 };
  let SSB = 0;
  for (const { n, sum } of groups.values()) {
    const muK = sum / n;
    SSB += n * (muK - mu) * (muK - mu);
  }
  const eta2 = Math.max(0, Math.min(1, SSB / SST));
  const eta = Math.sqrt(eta2);
  return { eta, eta2 };
};

const CorrelationPlot = ({
  realData,
  syntheticData,
  realHeaders,
  syntheticHeaders,
  embeddingData,
  metadata,
  selectedPoints,
  sampleSize = 2000
}) => {
  const rowRef = useRef(null);
  const scatterRowRef = useRef(null);
  const realRef = useRef(null);
  const synthRef = useRef(null);
  const diffRef = useRef(null);
  const legendRef = useRef(null);
  const diffLegendRef = useRef(null);
  const realScatterRef = useRef(null);
  const synthScatterRef = useRef(null);

  const [selectedPair, setSelectedPair] = useState(null); // { xName, yName }

  // Determine embedded datasets and headers to use throughout (prefer exact metadata datasets)
  const embeddedSource = useMemo(() => {
    // Prefer exact embedded data from metadata if present
    let embRealRows = Array.isArray(metadata?.realData?.data) ? metadata.realData.data : null;
    let embSynthRows = Array.isArray(metadata?.syntheticData?.data) ? metadata.syntheticData.data : null;
    let embRealHeaders = Array.isArray(metadata?.realData?.headers) ? metadata.realData.headers : realHeaders;
    let embSynthHeaders = Array.isArray(metadata?.syntheticData?.headers) ? metadata.syntheticData.headers : syntheticHeaders;

    // If not available, infer sizes from labels and slice the provided arrays
    if (!embRealRows || !embSynthRows) {
      let realCount = 0, synthCount = 0;
      if (Array.isArray(metadata?.labels)) {
        for (const l of metadata.labels) {
          if (l === 'Real') realCount++;
          else if (l === 'Synthetic') synthCount++;
        }
      }
      embRealRows = Array.isArray(realData) ? realData.slice(0, realCount > 0 ? Math.min(realCount, realData.length) : 0) : [];
      embSynthRows = Array.isArray(syntheticData) ? syntheticData.slice(0, synthCount > 0 ? Math.min(synthCount, syntheticData.length) : 0) : [];
      embRealHeaders = realHeaders;
      embSynthHeaders = syntheticHeaders;
    }

    // Final fallback to avoid empty UI before embeddings exist
    if ((!embRealRows || embRealRows.length === 0) && Array.isArray(realData)) embRealRows = realData;
    if ((!embSynthRows || embSynthRows.length === 0) && Array.isArray(syntheticData)) embSynthRows = syntheticData;

    return {
      embRealRows: Array.isArray(embRealRows) ? embRealRows : [],
      embSynthRows: Array.isArray(embSynthRows) ? embSynthRows : [],
      embRealHeaders: Array.isArray(embRealHeaders) ? embRealHeaders : [],
      embSynthHeaders: Array.isArray(embSynthHeaders) ? embSynthHeaders : [],
    };
  }, [metadata, realData, syntheticData, realHeaders, syntheticHeaders]);

  // Map embedding indices to original data row indices per class for highlighting
  const classRanks = useMemo(() => {
    if (!metadata?.labels || !Array.isArray(embeddingData)) return null;
    const labels = metadata.labels;
    if (!Array.isArray(labels) || labels.length !== embeddingData.length) return null;
    const realRank = new Array(labels.length).fill(0);
    const synthRank = new Array(labels.length).fill(0);
    let rc = 0, sc = 0;
    for (let i = 0; i < labels.length; i++) {
      const lab = labels[i];
      if (lab === 'Real') {
        rc += 1; realRank[i] = rc; synthRank[i] = sc;
      } else if (lab === 'Synthetic') {
        sc += 1; synthRank[i] = sc; realRank[i] = rc;
      } else {
        realRank[i] = rc; synthRank[i] = sc;
      }
    }
    return { realRank, synthRank };
  }, [metadata, embeddingData]);

  const selectedRowSets = useMemo(() => {
    const realSet = new Set();
    const synthSet = new Set();
    if (!Array.isArray(selectedPoints) || !classRanks || !metadata?.labels) return { realSet, synthSet };
    for (const embIdx of selectedPoints) {
      if (embIdx < 0 || embIdx >= metadata.labels.length) continue;
      const lab = metadata.labels[embIdx];
      if (lab === 'Real') {
        const rank = classRanks.realRank[embIdx] - 1; // 0-based row index
        if (rank >= 0) realSet.add(rank);
      } else if (lab === 'Synthetic') {
        const rank = classRanks.synthRank[embIdx] - 1;
        if (rank >= 0) synthSet.add(rank);
      }
    }
    return { realSet, synthSet };
  }, [selectedPoints, classRanks, metadata]);

  // Selection summary (matches RightSidebar semantics)
  const selectionSummary = useMemo(() => {
    if (!Array.isArray(selectedPoints) || !metadata?.labels) {
      return { total: 0, real: 0, synthetic: 0 };
    }
    let real = 0, synthetic = 0;
    for (const idx of selectedPoints) {
      if (metadata.labels[idx] === 'Real') real++;
      else if (metadata.labels[idx] === 'Synthetic') synthetic++;
    }
    return { total: selectedPoints.length, real, synthetic };
  }, [selectedPoints, metadata]);

  // Dataset totals based on embedding labels (filtered DR subset)
  const datasetTotals = useMemo(() => {
    const labels = metadata?.labels;
    if (!Array.isArray(labels) || labels.length === 0) {
      return { total: 0, real: 0, synthetic: 0 };
    }
    let real = 0, synthetic = 0;
    for (const l of labels) {
      if (l === 'Real') real++;
      else if (l === 'Synthetic') synthetic++;
    }
    return { total: labels.length, real, synthetic };
  }, [metadata]);

  const hasData = (arr) => Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0]);

  const sampleRows = useCallback((rows) => {
    if (!hasData(rows)) return [];
    return rows.slice(0, sampleSize);
  }, [sampleSize]);
  // Helpers: numeric detection and parsing
  const isNumericColumn = (rows, colIdx) => {
    if (!rows || rows.length === 0) return false;
    const maxCheck = Math.min(rows.length, 200);
    let numericCount = 0, checked = 0;
    for (let r = 0; r < maxCheck; r++) {
      const v = rows[r]?.[colIdx];
      if (v === null || v === undefined || v === '') continue;
      const num = typeof v === 'number' ? v : parseFloat(v);
      if (!Number.isNaN(num) && Number.isFinite(num)) numericCount++;
      checked++;
    }
    if (checked === 0) return false;
    return (numericCount / checked) >= 0.8;
  };


  // Build aligned mixed-type matrices for real and synthetic
  const { realMatrix, synthMatrix, diffMatrix } = useMemo(() => {
    const emptyReal = {
      cols: [],
      types: [],
      matrix: [],
      metricAt: () => 'Value',
      indices: []
    };
    const emptySynth = {
      cols: [],
      types: [],
      matrix: [],
      metricAt: () => 'Value',
      indices: []
    };
    const emptyDiff = {
      cols: [],
      types: [],
      matrix: [],
      metricAt: () => 'Value',
      realIndices: [],
      synthIndices: []
    };

    const { embRealRows, embSynthRows, embRealHeaders, embSynthHeaders } = embeddedSource;
    const realRows = sampleRows(embRealRows);
    const synthRows = sampleRows(embSynthRows);

    const hasReal = hasData(realRows) && Array.isArray(embRealHeaders) && embRealHeaders.length > 0;
    const hasSynth = hasData(synthRows) && Array.isArray(embSynthHeaders) && embSynthHeaders.length > 0;

    const metricLabel = (types, i, j) => {
      const ti = types[i];
      const tj = types[j];
      if (ti === 'numeric' && tj === 'numeric') return 'Pearson r';
      if (ti === 'categorical' && tj === 'categorical') return "Cramér's V";
      return 'Correlation ratio η';
    };

    const buildMetricAt = (types, prefix = '') => (i, j) => {
      const base = metricLabel(types, i, j);
      return prefix ? `${prefix}${base}` : base;
    };

    const computeMatrix = (rows, indices, types) => {
      const n = Math.min(indices.length, types.length);
      if (!rows || rows.length === 0 || n === 0) return [];
      const M = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        M[i][i] = 1;
        for (let j = i + 1; j < n; j++) {
          const ti = types[i];
          const tj = types[j];
          let val = 0;
          if (ti === 'numeric' && tj === 'numeric') {
            val = pearsonForPair(rows, indices[i], indices[j]);
          } else if (ti === 'categorical' && tj === 'categorical') {
            val = cramersV(rows, indices[i], indices[j]);
          } else {
            const catIdx = ti === 'categorical' ? indices[i] : indices[j];
            const numIdx = ti === 'numeric' ? indices[i] : indices[j];
            const { eta } = correlationRatioEta(rows, catIdx, numIdx);
            val = eta;
          }
          M[i][j] = val;
          M[j][i] = val;
        }
      }
      return M;
    };

    let realMatrix = emptyReal;
    if (hasReal) {
      const sourceHeaders = Array.isArray(embRealHeaders) ? embRealHeaders : [];
      const realPairs = sourceHeaders
        .map(header => ({ header, index: embRealHeaders.indexOf(header) }))
        .filter(pair => pair.index >= 0);
      const cols = realPairs.map(pair => pair.header);
      const indices = realPairs.map(pair => pair.index);
      const types = realPairs.map(pair => (isNumericColumn(realRows, pair.index) ? 'numeric' : 'categorical'));
      const matrix = computeMatrix(realRows, indices, types);
      realMatrix = {
        cols,
        types,
        matrix,
        metricAt: buildMetricAt(types),
        indices
      };
    }

    let synthMatrix = emptySynth;
    if (hasSynth) {
      const sourceHeaders = Array.isArray(embSynthHeaders) ? embSynthHeaders : [];
      const synthPairs = sourceHeaders
        .map(header => ({ header, index: embSynthHeaders.indexOf(header) }))
        .filter(pair => pair.index >= 0);
      const cols = synthPairs.map(pair => pair.header);
      const indices = synthPairs.map(pair => pair.index);
      const types = synthPairs.map(pair => (isNumericColumn(synthRows, pair.index) ? 'numeric' : 'categorical'));
      const matrix = computeMatrix(synthRows, indices, types);
      synthMatrix = {
        cols,
        types,
        matrix,
        metricAt: buildMetricAt(types),
        indices
      };
    }

    let diffMatrix = emptyDiff;
    if (hasReal && hasSynth) {
      const synthSet = new Set(embSynthHeaders);
      const intersection = embRealHeaders.filter(h => synthSet.has(h));
      const diffPairs = intersection
        .map(header => ({
          header,
          realIndex: embRealHeaders.indexOf(header),
          synthIndex: embSynthHeaders.indexOf(header)
        }))
        .filter(pair => pair.realIndex >= 0 && pair.synthIndex >= 0);
      const cols = diffPairs.map(pair => pair.header);
      const realIndices = diffPairs.map(pair => pair.realIndex);
      const synthIndices = diffPairs.map(pair => pair.synthIndex);
      const types = diffPairs.map(pair => {
        const realNum = isNumericColumn(realRows, pair.realIndex);
        const synthNum = isNumericColumn(synthRows, pair.synthIndex);
        return realNum && synthNum ? 'numeric' : 'categorical';
      });
      const realCorr = computeMatrix(realRows, realIndices, types);
      const synthCorr = computeMatrix(synthRows, synthIndices, types);
      const n = cols.length;
      const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        matrix[i][i] = 0;
        for (let j = i + 1; j < n; j++) {
          const rv = (realCorr[i] && realCorr[i][j] != null) ? realCorr[i][j] : 0;
          const sv = (synthCorr[i] && synthCorr[i][j] != null) ? synthCorr[i][j] : 0;
          const diff = sv - rv;
          matrix[i][j] = diff;
          matrix[j][i] = diff;
        }
      }
      diffMatrix = {
        cols,
        types,
        matrix,
        metricAt: buildMetricAt(types, 'Δ '),
        realIndices,
        synthIndices
      };
    }

    return { realMatrix, synthMatrix, diffMatrix };
  }, [embeddedSource, sampleRows]);

  // Heatmap helper for correlation matrices (lower triangle only)
  const drawHeatmap = (container, matrix, labels, options) => {
    if (!container || !Array.isArray(matrix) || matrix.length === 0) return;
    const {
      title = '',
      width = 340,
      height = 340,
      margin = { top: 40, right: 20, bottom: 70, left: 70 },
      zmin = -1,
      zmax = 1,
      getMetricForPair = (i, j) => 'Value',
      onCellClick = null,
      selectedPair = null
    } = options || {};

    const sel = d3.select(container);
    sel.selectAll('*').remove();

    const svg = sel.append('svg').attr('width', width).attr('height', height);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(labels).range([0, innerWidth]).padding(0);
    const y = d3.scaleBand().domain(labels).range([0, innerHeight]).padding(0);
    const color = d3.scaleSequential(d3.interpolateRdBu).domain([zmax, zmin]);

    // Build lower-triangle data
    const data = [];
    for (let i = 0; i < labels.length; i++) {
      for (let j = 0; j <= i; j++) {
        const v = (matrix[i] && matrix[i][j] != null) ? matrix[i][j] : (i === j ? 1 : 0);
        data.push({ i, j, x: labels[j], y: labels[i], v });
      }
    }

    const cells = g.selectAll('rect.cell')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', d => x(d.x))
      .attr('y', d => y(d.y))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => color(d.v));

    // Interactions
    cells.on('click', (event, d) => {
      if (typeof onCellClick === 'function' && d.i !== d.j) onCellClick(d.i, d.j);
    })
    .on('mouseover', function (event, d) {
      const metric = getMetricForPair(d.i, d.j);
      d3.select(this).attr('stroke', '#111827').attr('stroke-width', 1);
      // Tooltip
      const tip = d3.select('body')
        .append('div')
        .attr('class', 'corr-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0,0,0,0.7)')
        .style('color', '#fff')
        .style('padding', '6px 8px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .html(`<b>${d.y}</b> vs <b>${d.x}</b><br/>${metric}: ${Number.isFinite(d.v) ? d.v.toFixed(3) : 'NaN'}`);
      tip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY + 10}px`);
    })
    .on('mousemove', function (event) {
      d3.selectAll('.corr-tooltip')
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY + 10}px`);
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', 'none');
      d3.selectAll('.corr-tooltip').remove();
    });

    // Selection highlight overlay
    if (selectedPair && Number.isInteger(selectedPair.i) && Number.isInteger(selectedPair.j)) {
      const iSel = selectedPair.i;
      const jSel = selectedPair.j;
      const xLabel = labels[jSel];
      const yLabel = labels[iSel];
      g.append('rect')
        .attr('x', x(xLabel))
        .attr('y', y(yLabel))
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('fill', 'none')
        .attr('stroke', '#111827')
        .attr('stroke-width', 2)
        .style('pointer-events', 'none');
    }

    // Axes with dynamic label sizing/visibility based on variable count
    const nVars = labels.length;
    const xAxis = d3.axisBottom(x).tickSize(0);
    const yAxis = d3.axisLeft(y).tickSize(0);
    const gxAxis = g.append('g').attr('transform', `translate(0, ${innerHeight})`).call(xAxis);
    const gyAxis = g.append('g').call(yAxis);

    if (nVars > 10) {
      // Hide tick labels when too many variables
      gxAxis.selectAll('text').remove();
      gyAxis.selectAll('text').remove();
    } else {
      const fontSize = nVars < 5 ? '12px' : '9px';
      gxAxis.selectAll('text')
        .style('font-size', fontSize)
        .style('text-anchor', 'end')
        .attr('transform', 'rotate(-45)');
      gyAxis.selectAll('text')
        .style('font-size', fontSize);
    }
    g.selectAll('.domain').remove();
    g.selectAll('.tick line').remove();

    // Title
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 600)
      .style('fill', '#374151')
      .text(title);
  };

  const drawLegend = (container, zmin, zmax, width, height, title = 'Legend', orientation = 'horizontal') => {
    if (!container) return;
    const sel = d3.select(container);
    sel.selectAll('*').remove();

    const margin = orientation === 'horizontal'
      ? { top: 18, right: 14, bottom: 20, left: 14 }
      : { top: 40, right: 10, bottom: 70, left: 20 };
    const innerWidth = Math.max(10, width - margin.left - margin.right);
    const innerHeight = Math.max(10, height - margin.top - margin.bottom);

    const svg = sel.append('svg')
      .attr('width', width)
      .attr('height', height);

    // Title
    svg.append('text')
      .attr('x', margin.left)
      .attr('y', 12)
      .attr('text-anchor', 'start')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(title);

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const colors = d3.interpolateRdBu;
    const color = d3.scaleSequential(colors).domain([zmax, zmin]);

    const gradId = `legend-grad-${Math.random().toString(36).slice(2)}`;
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', gradId);

    if (orientation === 'horizontal') {
      gradient.attr('x1', '0%').attr('y1', '0%')
              .attr('x2', '100%').attr('y2', '0%');
    } else {
      gradient.attr('x1', '0%').attr('y1', '0%')
              .attr('x2', '0%').attr('y2', '100%');
    }

    const stops = d3.range(0, 1.001, 0.1);
    stops.forEach(t => {
      const val = zmin + (zmax - zmin) * t;
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color(val));
    });

    if (orientation === 'horizontal') {
      const barHeight = 10;
      g.append('rect')
        .attr('x', 0)
        .attr('y', 6)
        .attr('width', innerWidth)
        .attr('height', barHeight)
        .attr('fill', `url(#${gradId})`)
        .attr('rx', 2);

      const legendScale = d3.scaleLinear().domain([zmin, zmax]).range([0, innerWidth]);
      const legendAxis = d3.axisBottom(legendScale).ticks(4).tickFormat(d3.format('.2f'));
      g.append('g')
        .attr('transform', `translate(0, ${6 + barHeight})`)
        .call(legendAxis)
        .selectAll('text')
        .style('font-size', '10px');
    } else {
      const barWidth = 12;
      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', barWidth)
        .attr('height', innerHeight)
        .attr('fill', `url(#${gradId})`)
        .attr('rx', 2);

      const legendScale = d3.scaleLinear().domain([zmax, zmin]).range([0, innerHeight]);
      const legendAxis = d3.axisRight(legendScale).ticks(4).tickFormat(d3.format('.2f'));
      g.append('g')
        .attr('transform', `translate(${barWidth}, 0)`) 
        .call(legendAxis)
        .selectAll('text')
        .style('font-size', '10px');
    }
  };

  useEffect(() => {
    if (!selectedPair) return;
    const { xName, yName } = selectedPair;
    if (!diffMatrix.cols.includes(xName) || !diffMatrix.cols.includes(yName)) {
      setSelectedPair(null);
    }
  }, [selectedPair, diffMatrix]);

  const hasRealMatrix = Array.isArray(realMatrix.cols) && realMatrix.cols.length > 0 && Array.isArray(realMatrix.matrix) && realMatrix.matrix.length > 0;
  const hasSynthMatrix = Array.isArray(synthMatrix.cols) && synthMatrix.cols.length > 0 && Array.isArray(synthMatrix.matrix) && synthMatrix.matrix.length > 0;
  const hasDiffMatrix = Array.isArray(diffMatrix.cols) && diffMatrix.cols.length > 0 && Array.isArray(diffMatrix.matrix) && diffMatrix.matrix.length > 0;
  const hasAnyMatrix = hasRealMatrix || hasSynthMatrix || hasDiffMatrix;

  useEffect(() => {
    const drawAll = () => {
      const realContainer = realRef.current;
      const synthContainer = synthRef.current;
      const diffContainer = diffRef.current;

      if (!hasRealMatrix && realContainer) d3.select(realContainer).selectAll('*').remove();
      if (!hasSynthMatrix && synthContainer) d3.select(synthContainer).selectAll('*').remove();
      if (!hasDiffMatrix && diffContainer) d3.select(diffContainer).selectAll('*').remove();

      if (!hasRealMatrix && !hasSynthMatrix && !hasDiffMatrix) {
        if (legendRef.current) d3.select(legendRef.current).selectAll('*').remove();
        if (diffLegendRef.current) d3.select(diffLegendRef.current).selectAll('*').remove();
        return;
      }

      const container = rowRef.current;
      const gapPx = 8;
      const totalWidth = container ? container.getBoundingClientRect().width : 1020;
      const legendWidth = 80;
      const legendCount = (hasRealMatrix || hasSynthMatrix ? 1 : 0) + (hasDiffMatrix ? 1 : 0);
      const heatmapCount = (hasRealMatrix ? 1 : 0) + (hasSynthMatrix ? 1 : 0) + (hasDiffMatrix ? 1 : 0);
      const itemCount = heatmapCount + legendCount;
      const nGaps = Math.max(0, itemCount - 1);
      const legendsTotal = legendCount * legendWidth;
      const usableForHeatmaps = Math.max(200, totalWidth - (nGaps * gapPx) - legendsTotal);
      const perWidth = Math.max(200, Math.floor(usableForHeatmaps / Math.max(1, heatmapCount)));
      const perHeight = perWidth;
      const commonOpts = { width: perWidth, height: perHeight, margin: { top: 40, right: 20, bottom: 70, left: 70 } };
      const zmin = -1;
      const zmax = 1;

      const selectedForLabels = (labels) => {
        if (!selectedPair) return null;
        const i = labels.indexOf(selectedPair.yName);
        const j = labels.indexOf(selectedPair.xName);
        if (i === -1 || j === -1) return null;
        return { i, j };
      };

      const handlePairClick = (xName, yName) => {
        if (!xName || !yName) return;
        if (!diffMatrix.cols.includes(xName) || !diffMatrix.cols.includes(yName)) return;
        setSelectedPair(prev => {
          if (prev) {
            const same = (prev.xName === xName && prev.yName === yName) || (prev.xName === yName && prev.yName === xName);
            if (same) return null;
          }
          return { xName, yName };
        });
      };

      if (hasRealMatrix && realContainer) {
        drawHeatmap(
          realContainer,
          realMatrix.matrix,
          realMatrix.cols,
          {
            ...commonOpts,
            title: 'Real',
            zmin,
            zmax,
            getMetricForPair: realMatrix.metricAt,
            onCellClick: (i, j) => {
              const xName = realMatrix.cols[j];
              const yName = realMatrix.cols[i];
              handlePairClick(xName, yName);
            },
            selectedPair: selectedForLabels(realMatrix.cols)
          }
        );
      }

      if (hasSynthMatrix && synthContainer) {
        drawHeatmap(
          synthContainer,
          synthMatrix.matrix,
          synthMatrix.cols,
          {
            ...commonOpts,
            title: 'Synthetic',
            zmin,
            zmax,
            getMetricForPair: synthMatrix.metricAt,
            onCellClick: (i, j) => {
              const xName = synthMatrix.cols[j];
              const yName = synthMatrix.cols[i];
              handlePairClick(xName, yName);
            },
            selectedPair: selectedForLabels(synthMatrix.cols)
          }
        );
      }

      if (hasDiffMatrix && diffContainer) {
        let diffAbsMax = 0;
        for (let i = 0; i < diffMatrix.matrix.length; i++) {
          for (let j = 0; j < diffMatrix.matrix[i].length; j++) {
            if (i === j) continue;
            const v = diffMatrix.matrix[i][j];
            if (Number.isFinite(v)) diffAbsMax = Math.max(diffAbsMax, Math.abs(v));
          }
        }
        const dz = Math.max(0.01, diffAbsMax);

        drawHeatmap(
          diffContainer,
          diffMatrix.matrix,
          diffMatrix.cols,
          {
            ...commonOpts,
            title: 'Difference (Synthetic - Real)',
            zmin: -dz,
            zmax: dz,
            getMetricForPair: diffMatrix.metricAt,
            onCellClick: (i, j) => {
              const xName = diffMatrix.cols[j];
              const yName = diffMatrix.cols[i];
              handlePairClick(xName, yName);
            },
            selectedPair: selectedForLabels(diffMatrix.cols)
          }
        );

        if (diffLegendRef.current) {
          drawLegend(diffLegendRef.current, -dz, dz, legendWidth, perHeight, 'Difference', 'vertical');
        }
      } else if (diffLegendRef.current) {
        d3.select(diffLegendRef.current).selectAll('*').remove();
      }

      if ((hasRealMatrix || hasSynthMatrix) && legendRef.current) {
        drawLegend(legendRef.current, zmin, zmax, legendWidth, perHeight, 'Real/Synth', 'vertical');
      } else if (legendRef.current) {
        d3.select(legendRef.current).selectAll('*').remove();
      }
    };

    drawAll();
    window.addEventListener('resize', drawAll);
    return () => window.removeEventListener('resize', drawAll);
  }, [hasRealMatrix, hasSynthMatrix, hasDiffMatrix, realMatrix, synthMatrix, diffMatrix, selectedPair]);

  // Scatter drawing helper
  const drawScatter = (container, points, domains, options) => {
    if (!container) return;
    const {
      title = '',
      width = 340,
      height = 340,
      margin = { top: 36, right: 24, bottom: 40, left: 44 },
      color = REAL_COLOR,
      pointRadius = 2,
      xLabel = 'x',
      yLabel = 'y',
      highlightIndices = new Set(),
      getRowIndex = (d) => d.rowIndex
    } = options || {};

    const sel = d3.select(container);
    sel.selectAll('*').remove();

    const svg = sel.append('svg').attr('width', width).attr('height', height);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(domains.x).nice().range([0, innerWidth]);
    const y = d3.scaleLinear().domain(domains.y).nice().range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x).ticks(5);
    const yAxis = d3.axisLeft(y).ticks(5);

    g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis);
    g.append('g').call(yAxis);

    // Axis labels
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', height - 6)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(xLabel);
    svg.append('text')
      .attr('transform', `translate(12, ${margin.top + innerHeight / 2}) rotate(-90) `)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(yLabel);

    // Base points
    g.append('g')
      .attr('fill', color)
      .attr('fill-opacity', 0.5)
      .selectAll('circle')
      .data(points)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))
      .attr('r', pointRadius);

    // Highlighted points overlay
    const highlighted = points.filter(d => highlightIndices.has(getRowIndex(d)));
    if (highlighted.length > 0) {
      g.append('g')
        .attr('fill', 'none')
        .attr('stroke', HIGHLIGHT_STROKE)
        .attr('stroke-width', 1.2)
        .selectAll('circle')
        .data(highlighted)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', Math.max(pointRadius + 1.5, 3));
    }

    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 600)
      .style('fill', '#374151')
      .text(title);
  };

  // Beeswarm drawing helper (jittered points per category)
  const drawBeeswarm = (container, categories, groups, yDomain, options) => {
    if (!container) return;
    const {
      title = '',
      width = 340,
      height = 340,
      margin = { top: 36, right: 24, bottom: 60, left: 50 },
      color = REAL_COLOR,
      xLabel = 'Category',
      yLabel = 'Value',
      selectedGroups = new Map(),
      pointRadius = 2.5
    } = options || {};

    const sel = d3.select(container);
    sel.selectAll('*').remove();

    const svg = sel.append('svg').attr('width', width).attr('height', height);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(categories).range([0, innerWidth]).padding(0.2);
    const y = d3.scaleLinear().domain(yDomain).nice().range([innerHeight, 0]);

    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y).ticks(5);
    g.append('g').attr('transform', `translate(0,${innerHeight})`).call(xAxis)
      .selectAll('text').style('font-size', '10px').attr('transform', 'rotate(-30)').style('text-anchor', 'end');
    g.append('g').call(yAxis).selectAll('text').style('font-size', '10px');

    // Axis labels
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', height - 6)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(xLabel);
    svg.append('text')
      .attr('transform', `translate(14, ${margin.top + innerHeight / 2}) rotate(-90) `)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(yLabel);

    // Jitter horizontally within each category to avoid overlap
    const maxHalfWidth = Math.max(4, (x.bandwidth() / 2) * 0.95);
    const getJitter = (vals) => {
      const placed = [];
      const r = Math.max(pointRadius, 2);
      const offsets = new Array(vals.length).fill(0);
      const yPix = vals.map(v => y(v));
      for (let i = 0; i < vals.length; i++) {
        let ox = 0;
        let step = r;
        let iter = 0;
        const maxIter = 200;
        const fits = (testX) => placed.every(p => Math.hypot(p.x - testX, p.y - yPix[i]) >= 2 * r);
        if (!fits(0)) {
          while (iter++ < maxIter) {
            const candidate = ((iter % 2 === 0) ? 1 : -1) * Math.ceil(iter / 2) * step;
            if (Math.abs(candidate) > maxHalfWidth - r) break;
            if (fits(candidate)) { ox = candidate; break; }
          }
        }
        placed.push({ x: ox, y: yPix[i] });
        offsets[i] = ox;
      }
      return offsets;
    };

    categories.forEach(cat => {
      const vals = groups.get(cat) || [];
      const gx = x(cat) + x.bandwidth() / 2;
      const offsets = getJitter(vals);
      const selVals = new Set((selectedGroups.get(cat) || []).map(v => +v));

      // Base points
      g.append('g')
        .attr('transform', `translate(${gx},0)`)
        .attr('fill', color)
        .attr('fill-opacity', 0.6)
        .selectAll('circle')
        .data(vals.map((v, idx) => ({ v, ox: offsets[idx] })))
        .enter()
        .append('circle')
        .attr('cx', d => d.ox)
        .attr('cy', d => y(d.v))
        .attr('r', pointRadius);

      // Highlight selected points in this category
      const highlighted = vals
        .map((v, idx) => ({ v, ox: offsets[idx] }))
        .filter(d => selVals.has(+d.v));
      if (highlighted.length > 0) {
        g.append('g')
          .attr('transform', `translate(${gx},0)`)
          .attr('fill', 'none')
          .attr('stroke', HIGHLIGHT_STROKE)
          .attr('stroke-width', 1.2)
          .selectAll('circle')
          .data(highlighted)
          .enter()
          .append('circle')
          .attr('cx', d => d.ox)
          .attr('cy', d => y(d.v))
          .attr('r', Math.max(pointRadius + 1.5, 3));
      }
    });

    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 600)
      .style('fill', '#374151')
    .text(title);
  };

  // Category-category heatmap helper
  const drawCatHeatmap = (container, rowCats, colCats, table, options) => {
    if (!container) return;
    const {
      title = '',
      width = 340,
      height = 340,
      margin = { top: 36, right: 20, bottom: 70, left: 70 },
      colors = d3.interpolateBlues,
      zmin = 0,
      zmax = 1,
      xLabel = 'X',
      yLabel = 'Y',
      selectedTable = null,
      labelColor = '#ef4444',
      showZeroSelected = false
    } = options || {};

    const sel = d3.select(container);
    sel.selectAll('*').remove();

    const svg = sel.append('svg').attr('width', width).attr('height', height);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(colCats).range([0, innerWidth]).padding(0);
    const y = d3.scaleBand().domain(rowCats).range([0, innerHeight]).padding(0);
    const color = d3.scaleSequential(colors).domain([zmin, zmax]);

    const data = [];
    for (let i = 0; i < rowCats.length; i++) {
      for (let j = 0; j < colCats.length; j++) {
        const v = table?.[i]?.[j] || 0;
        const sel = selectedTable?.[i]?.[j] || 0;
        data.push({ i, j, x: colCats[j], y: rowCats[i], v, sel });
      }
    }
    g.selectAll('rect.cell')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', d => x(d.x))
      .attr('y', d => y(d.y))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => color(d.v));

    // Numeric labels in each cell (show number of selected points)
    const labelData = data.filter(d => showZeroSelected ? true : d.sel > 0);
    g.selectAll('text.cell-label')
      .data(labelData)
      .enter()
      .append('text')
      .attr('class', 'cell-label')
      .attr('x', d => x(d.x) + x.bandwidth() / 2)
      .attr('y', d => y(d.y) + y.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '14px')
      .style('font-weight', 600)
      .style('pointer-events', 'none')
      .style('fill', labelColor)
      .text(d => `${d.sel}`);

    const xAxis = d3.axisBottom(x).tickSize(0);
    const yAxis = d3.axisLeft(y).tickSize(0);
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('text-anchor', 'end')
      .attr('transform', 'rotate(-45)');
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '10px');
    g.selectAll('.domain').remove();
    g.selectAll('.tick line').remove();

    // Axis labels
    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', height - 6)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(xLabel);
    svg.append('text')
      .attr('transform', `translate(16, ${margin.top + innerHeight / 2}) rotate(-90) `)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text(yLabel);

    svg.append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 600)
      .style('fill', '#374151')
      .text(title);
  };

  // Render pairwise plots when a pair is selected
  useEffect(() => {
    const render = () => {
      if (!selectedPair || !hasDiffMatrix) {
        [realScatterRef, synthScatterRef].forEach(ref => { if (ref.current) d3.select(ref.current).selectAll('*').remove(); });
        return;
      }

      const { xName, yName } = selectedPair;
      const i = diffMatrix.cols.indexOf(yName);
      const j = diffMatrix.cols.indexOf(xName);
      if (i === -1 || j === -1) {
        [realScatterRef, synthScatterRef].forEach(ref => { if (ref.current) d3.select(ref.current).selectAll('*').remove(); });
        return;
      }

      const container = scatterRowRef.current;
      const totalWidth = container ? container.getBoundingClientRect().width : 1020;
      const gapPx = 8;
      const perWidth = Math.max(220, Math.floor((totalWidth - gapPx) / 2));
      const perHeight = perWidth;

      const { embRealRows, embSynthRows } = embeddedSource;
      const realRows = sampleRows(embRealRows);
      const synthRows = sampleRows(embSynthRows);
      const ti = diffMatrix.types[i];
      const tj = diffMatrix.types[j];

      const xIdxReal = diffMatrix.realIndices[j];
      const yIdxReal = diffMatrix.realIndices[i];
      const xIdxSynth = diffMatrix.synthIndices[j];
      const yIdxSynth = diffMatrix.synthIndices[i];

      const toPoints = (rows, xi, yi) => {
        const pts = [];
        for (let r = 0; r < rows.length; r++) {
          const vx = parseNum(rows[r]?.[xi]);
          const vy = parseNum(rows[r]?.[yi]);
          if (isFiniteNum(vx) && isFiniteNum(vy)) pts.push({ x: vx, y: vy, rowIndex: r });
        }
        return pts;
      };

      const bothNumeric = ti === 'numeric' && tj === 'numeric';
      const bothCategorical = ti === 'categorical' && tj === 'categorical';

      if (bothNumeric) {
        const realPts = toPoints(realRows, xIdxReal, yIdxReal);
        const synthPts = toPoints(synthRows, xIdxSynth, yIdxSynth);
        const allX = realPts.map(p => p.x).concat(synthPts.map(p => p.x));
        const allY = realPts.map(p => p.y).concat(synthPts.map(p => p.y));
        if (allX.length === 0 || allY.length === 0) {
          [realScatterRef, synthScatterRef].forEach(ref => {
            const el = ref.current; if (!el) return;
            const sel = d3.select(el);
            sel.selectAll('*').remove();
            sel.append('div')
              .style('padding', '8px')
              .style('color', '#6b7280')
              .style('font-size', '12px')
              .text('No numeric data found to plot scatter.');
          });
          return;
        }
        const domains = { x: d3.extent(allX), y: d3.extent(allY) };
        drawScatter(
          realScatterRef.current,
          realPts,
          domains,
          { title: 'Real', width: perWidth, height: perHeight, color: REAL_COLOR, xLabel: selectedPair.xName, yLabel: selectedPair.yName, highlightIndices: selectedRowSets.realSet }
        );
        drawScatter(
          synthScatterRef.current,
          synthPts,
          domains,
          { title: 'Synthetic', width: perWidth, height: perHeight, color: SYNTH_COLOR, xLabel: selectedPair.xName, yLabel: selectedPair.yName, highlightIndices: selectedRowSets.synthSet }
        );
        return;
      }

      const catNum = (!bothNumeric && !bothCategorical);
      if (catNum) {
        // Identify which is categorical vs numeric in our (row i, col j) positions
        // If ti is categorical => y is categorical, x is numeric? Our convention: x from j (columns), y from i (rows)
        const catIsRow = ti === 'categorical';
        const catIdxReal = catIsRow ? yIdxReal : xIdxReal;
        const numIdxReal = catIsRow ? xIdxReal : yIdxReal;
        const catIdxSynth = catIsRow ? yIdxSynth : xIdxSynth;
        const numIdxSynth = catIsRow ? xIdxSynth : yIdxSynth;

        // Build category -> values map for each dataset
        const buildGroups = (rows, catIdx, numIdx) => {
          const map = new Map();
          for (let r = 0; r < rows.length; r++) {
            const cRaw = rows[r]?.[catIdx];
            const yRaw = rows[r]?.[numIdx];
            if (cRaw === null || cRaw === undefined || cRaw === '') continue;
            const yv = parseNum(yRaw);
            if (!isFiniteNum(yv)) continue;
            const key = String(cRaw);
            const arr = map.get(key) || [];
            arr.push(yv);
            map.set(key, arr);
          }
          return map;
        };
        const buildSelectedGroups = (rows, catIdx, numIdx, selectedSet) => {
          const map = new Map();
          for (let r = 0; r < rows.length; r++) {
            if (!selectedSet.has(r)) continue;
            const cRaw = rows[r]?.[catIdx];
            const yRaw = rows[r]?.[numIdx];
            if (cRaw === null || cRaw === undefined || cRaw === '') continue;
            const yv = parseNum(yRaw);
            if (!isFiniteNum(yv)) continue;
            const key = String(cRaw);
            const arr = map.get(key) || [];
            arr.push(yv);
            map.set(key, arr);
          }
          return map;
        };

        const realGroups = buildGroups(realRows, catIdxReal, numIdxReal);
        const synthGroups = buildGroups(synthRows, catIdxSynth, numIdxSynth);
        const realSelGroups = buildSelectedGroups(realRows, catIdxReal, numIdxReal, selectedRowSets.realSet);
        const synthSelGroups = buildSelectedGroups(synthRows, catIdxSynth, numIdxSynth, selectedRowSets.synthSet);
        const allCats = Array.from(new Set([
          ...Array.from(realGroups.keys()),
          ...Array.from(synthGroups.keys())
        ])).sort();

        const allVals = [];
        for (const v of realGroups.values()) allVals.push(...v);
        for (const v of synthGroups.values()) allVals.push(...v);
        if (allCats.length === 0 || allVals.length === 0) {
          [realScatterRef, synthScatterRef].forEach(ref => {
            const el = ref.current; if (!el) return;
            const sel = d3.select(el);
            sel.selectAll('*').remove();
            sel.append('div')
              .style('padding', '8px')
              .style('color', '#6b7280')
              .style('font-size', '12px')
              .text('Not enough data to draw violins.');
          });
          return;
        }
        const yDomain = d3.extent(allVals);
        // Draw two violins using same categories and yDomain
        const xLab = catIsRow ? selectedPair.yName : selectedPair.xName;
        const yLab = catIsRow ? selectedPair.xName : selectedPair.yName;
        drawBeeswarm(
          realScatterRef.current,
          allCats,
          realGroups,
          yDomain,
          { title: 'Real', width: perWidth, height: perHeight, color: REAL_COLOR, xLabel: xLab, yLabel: yLab, selectedGroups: realSelGroups, pointRadius: 2.5 }
        );
        drawBeeswarm(
          synthScatterRef.current,
          allCats,
          synthGroups,
          yDomain,
          { title: 'Synthetic', width: perWidth, height: perHeight, color: SYNTH_COLOR, xLabel: xLab, yLabel: yLab, selectedGroups: synthSelGroups, pointRadius: 2.5 }
        );
        return;
      }

      // Categorical-categorical: contingency heatmap
      const buildCats = (rows, idx) => {
        const set = new Set();
        for (let r = 0; r < rows.length; r++) {
          const v = rows[r]?.[idx];
          if (v === null || v === undefined || v === '') continue;
          set.add(String(v));
        }
        return Array.from(set);
      };
      const rowCats = Array.from(new Set([
        ...buildCats(realRows, yIdxReal),
        ...buildCats(synthRows, yIdxSynth)
      ])).sort();
      const colCats = Array.from(new Set([
        ...buildCats(realRows, xIdxReal),
        ...buildCats(synthRows, xIdxSynth)
      ])).sort();

      const buildTable = (rows, yIdx, xIdx, rCats, cCats) => {
        const rMap = new Map(rCats.map((c, k) => [c, k]));
        const cMap = new Map(cCats.map((c, k) => [c, k]));
        const table = Array.from({ length: rCats.length }, () => new Array(cCats.length).fill(0));
        for (let r = 0; r < rows.length; r++) {
          const ry = rows[r]?.[yIdx];
          const rx = rows[r]?.[xIdx];
          if (ry === null || ry === undefined || ry === '' || rx === null || rx === undefined || rx === '') continue;
          const yi = rMap.get(String(ry));
          const xi = cMap.get(String(rx));
          if (yi === undefined || xi === undefined) continue;
          table[yi][xi] += 1;
        }
        return table;
      };
      const buildSelectedTable = (rows, yIdx, xIdx, rCats, cCats, selectedSet) => {
        const rMap = new Map(rCats.map((c, k) => [c, k]));
        const cMap = new Map(cCats.map((c, k) => [c, k]));
        const table = Array.from({ length: rCats.length }, () => new Array(cCats.length).fill(0));
        for (let r = 0; r < rows.length; r++) {
          if (!selectedSet.has(r)) continue;
          const ry = rows[r]?.[yIdx];
          const rx = rows[r]?.[xIdx];
          if (ry === null || ry === undefined || ry === '' || rx === null || rx === undefined || rx === '') continue;
          const yi = rMap.get(String(ry));
          const xi = cMap.get(String(rx));
          if (yi === undefined || xi === undefined) continue;
          table[yi][xi] += 1;
        }
        return table;
      };

  const realTable = buildTable(realRows, yIdxReal, xIdxReal, rowCats, colCats);
  const synthTable = buildTable(synthRows, yIdxSynth, xIdxSynth, rowCats, colCats);
  const realSelTable = buildSelectedTable(realRows, yIdxReal, xIdxReal, rowCats, colCats, selectedRowSets.realSet);
  const synthSelTable = buildSelectedTable(synthRows, yIdxSynth, xIdxSynth, rowCats, colCats, selectedRowSets.synthSet);
      const zmax = Math.max(
        d3.max(realTable.flat()) || 0,
        d3.max(synthTable.flat()) || 0,
        1
      );
      drawCatHeatmap(
        realScatterRef.current,
        rowCats,
        colCats,
        realTable,
        { title: 'Real', width: perWidth, height: perHeight, zmin: 0, zmax, xLabel: selectedPair.xName, yLabel: selectedPair.yName, selectedTable: realSelTable, labelColor: '#ef4444' }
      );
      drawCatHeatmap(
        synthScatterRef.current,
        rowCats,
        colCats,
        synthTable,
        { title: 'Synthetic', width: perWidth, height: perHeight, zmin: 0, zmax, xLabel: selectedPair.xName, yLabel: selectedPair.yName, selectedTable: synthSelTable, labelColor: '#ef4444' }
      );
    };

    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [selectedPair, diffMatrix, embeddedSource, selectedRowSets, hasDiffMatrix, sampleRows]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Box sx={{ p: 1, borderBottom: '0.1px solid', borderColor: 'divider', width: '100%', boxSizing: 'border-box' }}>
        <Typography variant="subtitle2">Correlation Matrices</Typography>
      </Box>
      {/* Selection summary and variable count */}
      <Box sx={{ ml: 1, mb: 1, mt: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Selected: <strong>{selectionSummary.total}</strong>/<strong>{datasetTotals.total}</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Real: <strong>{selectionSummary.real}</strong>/<strong>{datasetTotals.real}</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Synthetic: <strong>{selectionSummary.synthetic}</strong>/<strong>{datasetTotals.synthetic}</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Real vars: <strong>{realMatrix.cols.length}</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Synthetic vars: <strong>{synthMatrix.cols.length}</strong>
          </Typography>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            Intersection vars: <strong>{diffMatrix.cols.length}</strong>
          </Typography>
        </Box>
      </Box>
      {!hasAnyMatrix ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No correlation matrices available for the current datasets.
          </Typography>
        </Box>
      ) : (
        <>
          <Box ref={rowRef} sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'flex-start' }}>
            {hasRealMatrix ? <Box ref={realRef} sx={{ flex: '0 0 auto' }} /> : null}
            {hasSynthMatrix ? <Box ref={synthRef} sx={{ flex: '0 0 auto' }} /> : null}
            {(hasRealMatrix || hasSynthMatrix) ? <Box ref={legendRef} sx={{ flex: '0 0 auto' }} /> : null}
            {hasDiffMatrix ? <Box ref={diffRef} sx={{ flex: '0 0 auto' }} /> : null}
            {hasDiffMatrix ? <Box ref={diffLegendRef} sx={{ flex: '0 0 auto' }} /> : null}
          </Box>
          <Box sx={{ mt: 1 }}>
            {!selectedPair ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
                {hasDiffMatrix ? 'Tip: click a matrix cell to view scatterplots for that pair.' : 'No shared variables between datasets to compare pairwise plots.'}
              </Typography>
            ) : null}
            <Box ref={scatterRowRef} sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'flex-start' }}>
              <Box ref={realScatterRef} sx={{ flex: '0 0 auto' }} />
              <Box ref={synthScatterRef} sx={{ flex: '0 0 auto' }} />
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default CorrelationPlot;
