import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Box, Typography } from '@mui/material';

const CorrelationPlot = ({
  realData,
  syntheticData,
  realHeaders,
  syntheticHeaders,
  embeddingData,
  metadata,
  selectedPoints,
  maxColumns = 20,
  sampleSize = 2000
}) => {
  const rowRef = useRef(null);
  const scatterRowRef = useRef(null);
  const realRef = useRef(null);
  const synthRef = useRef(null);
  const diffRef = useRef(null);
  const legendRef = useRef(null);
  const realScatterRef = useRef(null);
  const synthScatterRef = useRef(null);

  const [selectedPair, setSelectedPair] = useState(null); // {i, j, xName, yName}

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

  const hasData = (arr) => Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0]);

  // Choose a common set of headers to compare (intersection)
  const commonHeaders = useMemo(() => {
    if (!Array.isArray(realHeaders) || !Array.isArray(syntheticHeaders)) return [];
    const set = new Set(syntheticHeaders);
    return realHeaders.filter(h => set.has(h));
  }, [realHeaders, syntheticHeaders]);

  const sampleRows = (rows) => {
    if (!hasData(rows)) return [];
    return rows.slice(0, sampleSize);
  };
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

  const parseNum = (v) => (typeof v === 'number' ? v : parseFloat(v));
  const isFiniteNum = (v) => Number.isFinite(v) && !Number.isNaN(v);

  // Metrics
  const pearsonForPair = (rows, i, j) => {
    let n = 0;
    let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
    for (let r = 0; r < rows.length; r++) {
      const vx = parseNum(rows[r]?.[i]);
      const vy = parseNum(rows[r]?.[j]);
      if (!isFiniteNum(vx) || !isFiniteNum(vy)) continue;
      n++;
      sumX += vx; sumY += vy;
      sumXX += vx * vx; sumYY += vy * vy; sumXY += vx * vy;
    }
    if (n <= 1) return 0;
    const cov = sumXY - (sumX * sumY) / n;
    const varX = sumXX - (sumX * sumX) / n;
    const varY = sumYY - (sumY * sumY) / n;
    const denom = Math.sqrt(varX * varY);
    return denom > 1e-12 ? (cov / denom) : 0;
  };

  const cramersV = (rows, i, j) => {
    // Build contingency table
    const aMap = new Map(); // category -> row index
    const bMap = new Map(); // category -> col index
    let aCount = 0, bCount = 0;
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
    const rDim = aCount, cDim = bCount;
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
    const groups = new Map(); // cat -> {n, sum}
    let N = 0;
    let sumY = 0, sumYY = 0;
    for (let r = 0; r < rows.length; r++) {
      const cRaw = rows[r]?.[catIdx];
      const yRaw = rows[r]?.[numIdx];
      if (cRaw === null || cRaw === undefined || cRaw === '' ) continue;
      const y = parseNum(yRaw);
      if (!isFiniteNum(y)) continue;
      const c = String(cRaw);
      const g = groups.get(c) || { n: 0, sum: 0 };
      g.n += 1; g.sum += y;
      groups.set(c, g);
      N += 1; sumY += y; sumYY += y * y;
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

  // Build aligned mixed-type matrices for real and synthetic
  const { cols, colTypes, realCorr, synthCorr, diffCorr, metricAt, realIndices, synthIndices } = useMemo(() => {
    const realRows = sampleRows(realData);
    const synthRows = sampleRows(syntheticData);
    if (!hasData(realRows) || !hasData(synthRows) || !Array.isArray(commonHeaders) || commonHeaders.length === 0) {
      return { cols: [], colTypes: [], realCorr: [], synthCorr: [], diffCorr: [], metricAt: () => 'Value', realIndices: [], synthIndices: [] };
    }

    // Column indices for each in the common headers order
    const realIdxAll = commonHeaders.map(h => realHeaders?.indexOf(h)).filter(i => i >= 0);
    const synthIdxAll = commonHeaders.map(h => syntheticHeaders?.indexOf(h)).filter(i => i >= 0);

    // Determine a consistent type per header across datasets: numeric only if numeric in BOTH
    const typesAll = commonHeaders.map((h, idx) => {
      const ri = realIdxAll[idx];
      const si = synthIdxAll[idx];
      const realNum = isNumericColumn(realRows, ri);
      const synthNum = isNumericColumn(synthRows, si);
      return realNum && synthNum ? 'numeric' : 'categorical';
    });

    // Limit columns
    const limitedHeaders = commonHeaders.slice(0, Math.max(1, maxColumns));
    const limitedTypes = typesAll.slice(0, Math.max(1, maxColumns));
  const realIndices = limitedHeaders.map(h => realHeaders.indexOf(h));
  const synthIndices = limitedHeaders.map(h => syntheticHeaders.indexOf(h));

    const n = limitedHeaders.length;
    if (n === 0) {
      return { cols: [], colTypes: [], realCorr: [], synthCorr: [], diffCorr: [], metricAt: () => 'Value', realIndices: [], synthIndices: [] };
    }

    const computeMatrix = (rows, indices, types) => {
      const M = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        M[i][i] = 1;
        for (let j = i + 1; j < n; j++) {
          const ti = types[i], tj = types[j];
          let val = 0;
          if (ti === 'numeric' && tj === 'numeric') {
            val = pearsonForPair(rows, indices[i], indices[j]);
          } else if (ti === 'categorical' && tj === 'categorical') {
            val = cramersV(rows, indices[i], indices[j]);
          } else {
            const catIdx = ti === 'categorical' ? indices[i] : indices[j];
            const numIdx = ti === 'numeric' ? indices[i] : indices[j];
            const { eta } = correlationRatioEta(rows, catIdx, numIdx);
            val = eta; // in [0,1]
          }
          // fill both upper and lower triangle
          M[i][j] = val;
          M[j][i] = val;
        }
      }
      return M;
    };

    const rCorr = computeMatrix(realRows, realIndices, limitedTypes);
    const sCorr = computeMatrix(synthRows, synthIndices, limitedTypes);

    // Difference matrix (synthetic - real)
    const dCorr = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      dCorr[i][i] = 0;
      for (let j = i + 1; j < n; j++) {
        const rv = (rCorr[i] && rCorr[i][j] != null) ? rCorr[i][j] : 0;
        const sv = (sCorr[i] && sCorr[i][j] != null) ? sCorr[i][j] : 0;
        const diff = sv - rv;
        dCorr[i][j] = diff;
        dCorr[j][i] = diff;
      }
    }

    const metricAt = (i, j) => {
      const ti = limitedTypes[i];
      const tj = limitedTypes[j];
      if (ti === 'numeric' && tj === 'numeric') return 'Pearson r';
      if (ti === 'categorical' && tj === 'categorical') return "Cramér's V";
      return 'Correlation ratio η';
    };

    return { cols: limitedHeaders, colTypes: limitedTypes, realCorr: rCorr, synthCorr: sCorr, diffCorr: dCorr, metricAt, realIndices, synthIndices };
  }, [realData, syntheticData, realHeaders, syntheticHeaders, maxColumns, sampleSize, commonHeaders]);

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

    // Axes
    const xAxis = d3.axisBottom(x).tickSize(0);
    const yAxis = d3.axisLeft(y).tickSize(0);
    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '9px')
      .style('text-anchor', 'end')
      .attr('transform', 'rotate(-45)');
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '9px');
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

  const drawLegend = (container, zmin, zmax, height) => {
    if (!container) return;
    const width = 70;
    const margin = { top: 40, right: 10, bottom: 70, left: 20 };
    const innerHeight = height - margin.top - margin.bottom;
    const sel = d3.select(container);
    sel.selectAll('*').remove();
    const svg = sel.append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const colors = d3.interpolateRdBu;
    const color = d3.scaleSequential(colors).domain([zmax, zmin]);

    const gradId = `legend-grad-shared-${Math.random().toString(36).slice(2)}`;
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    const stops = d3.range(0, 1.001, 0.1);
    stops.forEach(t => {
      const val = zmax + (zmin - zmax) * t;
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color(val));
    });

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

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#374151')
      .text('Legend');
  };

  useEffect(() => {
    const drawAll = () => {
      if (!cols || cols.length === 0) {
        [realRef, synthRef, diffRef].forEach(ref => {
          if (ref.current) d3.select(ref.current).selectAll('*').remove();
        });
        if (legendRef.current) d3.select(legendRef.current).selectAll('*').remove();
        return;
      }
      const container = rowRef.current;
      const gapPx = 8; // MUI gap: 1 ~ 8px
      const totalWidth = container ? container.getBoundingClientRect().width : 1020;
      // Reserve 70px for shared legend area plus one gap
      const legendReserve = 78; // approx legend width + gap
      const usable = Math.max(300, totalWidth - legendReserve - 2 * gapPx);
      const perWidth = Math.max(220, Math.floor(usable / 3));
      const perHeight = perWidth; // square
      const commonOpts = { width: perWidth, height: perHeight, margin: { top: 40, right: 20, bottom: 70, left: 70 } };

      // Shared legend range across all three matrices: fix to [-1,1] for mixed metrics
      const zmin = -1;
      const zmax = 1;

      const getMetric = (i, j) => metricAt(i, j);

      const onCellClick = (i, j) => {
        // Toggle selection if same pair (order-insensitive)
        setSelectedPair(prev => {
          if (prev) {
            const same = (prev.i === i && prev.j === j) || (prev.i === j && prev.j === i);
            if (same) return null;
          }
          const xName = cols[j];
          const yName = cols[i];
          return { i, j, xName, yName };
        });
      };

      drawHeatmap(realRef.current, realCorr, cols, { ...commonOpts, title: 'Real', zmin, zmax, getMetricForPair: getMetric, onCellClick, selectedPair });
      drawHeatmap(synthRef.current, synthCorr, cols, { ...commonOpts, title: 'Synthetic', zmin, zmax, getMetricForPair: getMetric, onCellClick, selectedPair });
      drawHeatmap(diffRef.current, diffCorr, cols, { ...commonOpts, title: 'Difference (Synthetic - Real)', zmin, zmax, getMetricForPair: (i,j) => `Δ ${metricAt(i,j)}` , onCellClick, selectedPair});

      // Draw shared legend
      drawLegend(legendRef.current, zmin, zmax, perHeight);
    };

    drawAll();
    window.addEventListener('resize', drawAll);
    return () => window.removeEventListener('resize', drawAll);
  }, [cols, realCorr, synthCorr, diffCorr, metricAt, selectedPair]);

  // Scatter drawing helper
  const drawScatter = (container, points, domains, options) => {
    if (!container) return;
    const {
      title = '',
      width = 340,
      height = 340,
      margin = { top: 36, right: 24, bottom: 40, left: 44 },
      color = '#1f77b4',
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
        .attr('stroke', '#ef4444')
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
      color = '#1f77b4',
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
          .attr('stroke', '#ef4444')
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
      // Clear if nothing selected or insufficient info
      if (!selectedPair || !cols || cols.length === 0) {
        [realScatterRef, synthScatterRef].forEach(ref => { if (ref.current) d3.select(ref.current).selectAll('*').remove(); });
        return;
      }
      const { i, j } = selectedPair;
      if (!Number.isInteger(i) || !Number.isInteger(j)) return;

      const container = scatterRowRef.current;
      const totalWidth = container ? container.getBoundingClientRect().width : 1020;
      const gapPx = 8;
      const perWidth = Math.max(220, Math.floor((totalWidth - gapPx) / 2));
      const perHeight = perWidth; // square

      const realRows = sampleRows(realData);
      const synthRows = sampleRows(syntheticData);
      const ti = colTypes[i];
      const tj = colTypes[j];

      const xIdxReal = realIndices[j]; // x corresponds to column j
      const yIdxReal = realIndices[i]; // y corresponds to row i
      const xIdxSynth = synthIndices[j];
      const yIdxSynth = synthIndices[i];

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
          { title: 'Real', width: perWidth, height: perHeight, color: '#2563eb', xLabel: selectedPair.xName, yLabel: selectedPair.yName, highlightIndices: selectedRowSets.realSet }
        );
        drawScatter(
          synthScatterRef.current,
          synthPts,
          domains,
          { title: 'Synthetic', width: perWidth, height: perHeight, color: '#10b981', xLabel: selectedPair.xName, yLabel: selectedPair.yName, highlightIndices: selectedRowSets.synthSet }
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
        const allCats = Array.from(new Set([...
          Array.from(realGroups.keys()), ...Array.from(synthGroups.keys())
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
          { title: 'Real', width: perWidth, height: perHeight, color: '#2563eb', xLabel: xLab, yLabel: yLab, selectedGroups: realSelGroups, pointRadius: 2.5 }
        );
        drawBeeswarm(
          synthScatterRef.current,
          allCats,
          synthGroups,
          yDomain,
          { title: 'Synthetic', width: perWidth, height: perHeight, color: '#10b981', xLabel: xLab, yLabel: yLab, selectedGroups: synthSelGroups, pointRadius: 2.5 }
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
      const rowCats = Array.from(new Set([...
        buildCats(realRows, yIdxReal), ...buildCats(synthRows, yIdxSynth)
      ])).sort();
      const colCats = Array.from(new Set([...
        buildCats(realRows, xIdxReal), ...buildCats(synthRows, xIdxSynth)
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
  }, [selectedPair, cols, colTypes, realData, syntheticData, realIndices, synthIndices, selectedRowSets]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 500 }}>
        Correlation Matrices
      </Typography>
      {(!cols || cols.length === 0) ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No common columns found to compute mixed correlations.
          </Typography>
        </Box>
      ) : (
        <>
          <Box ref={rowRef} sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'flex-start' }}>
            <Box ref={realRef} sx={{ flex: '0 0 auto' }} />
            <Box ref={synthRef} sx={{ flex: '0 0 auto' }} />
            <Box ref={diffRef} sx={{ flex: '0 0 auto' }} />
            <Box ref={legendRef} sx={{ flex: '0 0 auto' }} />
          </Box>
          <Box sx={{ mt: 1 }}>
            {!selectedPair ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
                Tip: click a matrix cell to view scatterplots for that pair.
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
