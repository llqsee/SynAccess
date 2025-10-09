import React, { useMemo, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Box, Typography } from '@mui/material';

const CorrelationPlot = ({
  realData,
  syntheticData,
  realHeaders,
  syntheticHeaders,
  maxColumns = 20,
  sampleSize = 2000
}) => {
  const rowRef = useRef(null);
  const realRef = useRef(null);
  const synthRef = useRef(null);
  const diffRef = useRef(null);
  const legendRef = useRef(null);

  const hasData = (arr) => Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0]);

  // Choose a common set of headers to compare (intersection), then keep only numeric columns in each
  const commonHeaders = useMemo(() => {
    if (!Array.isArray(realHeaders) || !Array.isArray(syntheticHeaders)) return [];
    const set = new Set(syntheticHeaders);
    return realHeaders.filter(h => set.has(h));
  }, [realHeaders, syntheticHeaders]);

  const sampleRows = (rows) => {
    if (!hasData(rows)) return [];
    return rows.slice(0, sampleSize);
  };

  const toNumericMatrix = (rows, headers, selectedIndices) => {
    if (!rows || rows.length === 0 || selectedIndices.length === 0) return [];
    const matrix = rows.map(r => selectedIndices.map(i => {
      const v = r?.[i];
      const num = typeof v === 'number' ? v : parseFloat(v);
      return Number.isFinite(num) ? num : NaN;
    }));
    // Impute NaNs with column means
    const nCols = selectedIndices.length;
    const colMeans = new Array(nCols).fill(0);
    for (let c = 0; c < nCols; c++) {
      let sum = 0, count = 0;
      for (let r = 0; r < matrix.length; r++) {
        const val = matrix[r][c];
        if (!Number.isNaN(val)) { sum += val; count++; }
      }
      colMeans[c] = count > 0 ? (sum / count) : 0;
    }
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < nCols; c++) {
        if (Number.isNaN(matrix[r][c])) matrix[r][c] = colMeans[c];
      }
    }
    return matrix;
  };

  const detectNumericIndices = (rows, headers) => {
    if (!rows || rows.length === 0 || !headers || headers.length === 0) return [];
    const maxCheck = Math.min(rows.length, 200);
    const numericFlags = headers.map((_, colIdx) => {
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
    });
    const indices = headers.map((_, i) => i).filter(i => numericFlags[i]);
    return indices;
  };

  const computeCorr = (matrix) => {
    if (!matrix || matrix.length === 0) return [];
    const nRows = matrix.length;
    const nCols = matrix[0].length;
    const means = new Array(nCols).fill(0);
    const stds = new Array(nCols).fill(0);
    for (let c = 0; c < nCols; c++) {
      let sum = 0;
      for (let r = 0; r < nRows; r++) sum += matrix[r][c];
      means[c] = sum / nRows;
    }
    for (let c = 0; c < nCols; c++) {
      let sq = 0;
      for (let r = 0; r < nRows; r++) {
        const d = matrix[r][c] - means[c];
        sq += d * d;
      }
      stds[c] = Math.sqrt(sq / Math.max(1, nRows - 1));
    }
    const corr = Array.from({ length: nCols }, () => new Array(nCols).fill(0));
    for (let i = 0; i < nCols; i++) {
      corr[i][i] = 1;
      for (let j = i + 1; j < nCols; j++) {
        let cov = 0;
        for (let r = 0; r < nRows; r++) {
          cov += (matrix[r][i] - means[i]) * (matrix[r][j] - means[j]);
        }
        const denom = Math.max(1e-12, (nRows - 1) * stds[i] * stds[j]);
        const val = denom > 0 ? (cov / denom) : 0;
        corr[i][j] = val;
        corr[j][i] = val;
      }
    }
    return corr;
  };

  // Build aligned numeric matrices for real and synthetic
  const { cols, realCorr, synthCorr, diffCorr } = useMemo(() => {
    const realRows = sampleRows(realData);
    const synthRows = sampleRows(syntheticData);
    if (!hasData(realRows) || !hasData(synthRows) || !Array.isArray(commonHeaders) || commonHeaders.length === 0) {
      return { cols: [], realCorr: [], synthCorr: [], diffCorr: [] };
    }
    // Column indices for each in the common headers order
    const realIdxAll = commonHeaders.map(h => realHeaders?.indexOf(h)).filter(i => i >= 0);
    const synthIdxAll = commonHeaders.map(h => syntheticHeaders?.indexOf(h)).filter(i => i >= 0);

    // Detect numeric among these
    const realNumeric = detectNumericIndices(realRows, realHeaders).filter(i => realIdxAll.includes(i));
    const synthNumeric = detectNumericIndices(synthRows, syntheticHeaders).filter(i => synthIdxAll.includes(i));
    // Align via header names: pick headers whose index is numeric in both
    const numericCommon = commonHeaders.filter(h => {
      const ri = realHeaders?.indexOf(h);
      const si = syntheticHeaders?.indexOf(h);
      return ri >= 0 && si >= 0 && realNumeric.includes(ri) && synthNumeric.includes(si);
    });
    const limitedHeaders = numericCommon.slice(0, Math.max(1, maxColumns));
    const realIndices = limitedHeaders.map(h => realHeaders.indexOf(h));
    const synthIndices = limitedHeaders.map(h => syntheticHeaders.indexOf(h));

    if (limitedHeaders.length === 0) return { cols: [], realCorr: [], synthCorr: [], diffCorr: [] };

    const realMat = toNumericMatrix(realRows, realHeaders, realIndices);
    const synthMat = toNumericMatrix(synthRows, syntheticHeaders, synthIndices);
    const rCorr = computeCorr(realMat);
    const sCorr = computeCorr(synthMat);

    // Difference matrix (synthetic - real)
    const n = limitedHeaders.length;
    const dCorr = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
      const rv = (rCorr[i] && rCorr[i][j] != null) ? rCorr[i][j] : 0;
      const sv = (sCorr[i] && sCorr[i][j] != null) ? sCorr[i][j] : 0;
      return sv - rv;
    }));

    return { cols: limitedHeaders, realCorr: rCorr, synthCorr: sCorr, diffCorr: dCorr };
  }, [realData, syntheticData, realHeaders, syntheticHeaders, commonHeaders, maxColumns, sampleSize]);

  const drawHeatmap = (container, z, labels, options) => {
    const {
      title = '',
      width = 340,
      height = 340,
      margin = { top: 40, right: 20, bottom: 70, left: 70 },
      colors = d3.interpolateRdBu,
      zmin = -1,
      zmax = 1
    } = options || {};

    if (!container) return;
    const sel = d3.select(container);
    sel.selectAll('*').remove();

    const svg = sel.append('svg')
      .attr('width', width)
      .attr('height', height);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const n = labels.length;
    if (!z || n === 0) return;

    const x = d3.scaleBand().domain(labels).range([0, innerWidth]).padding(0);
    const y = d3.scaleBand().domain(labels).range([0, innerHeight]).padding(0);
  const color = d3.scaleSequential(colors).domain([zmax, zmin]); // reversed for RdBu

    // Cells
    const data = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        data.push({ x: labels[j], y: labels[i], v: z[i][j] }); // y=i, x=j
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
      .attr('fill', d => color(d.v))
      .on('mouseover', function (event, d) {
        const tip = d3.select('body').append('div')
          .attr('class', 'corr-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.85)')
          .style('color', '#fff')
          .style('padding', '6px 8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .html(`<b>${d.y}</b> vs <b>${d.x}</b><br/>value: ${d.v.toFixed(3)}`);
        tip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY + 10}px`);
      })
      .on('mousemove', function (event) {
        d3.selectAll('.corr-tooltip')
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY + 10}px`);
      })
      .on('mouseout', function () {
        d3.selectAll('.corr-tooltip').remove();
      });

    // Axes labels
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
      .text('Value');
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

      // Shared legend range across all three matrices
      const maxAbsDiff = d3.max(diffCorr.flat().map(v => Math.abs(v))) || 0;
      const sharedMax = Math.max(1, maxAbsDiff);
      const zmin = -sharedMax;
      const zmax = sharedMax;

      drawHeatmap(realRef.current, realCorr, cols, { ...commonOpts, title: 'Real', zmin, zmax });
      drawHeatmap(synthRef.current, synthCorr, cols, { ...commonOpts, title: 'Synthetic', zmin, zmax });
      drawHeatmap(diffRef.current, diffCorr, cols, { ...commonOpts, title: 'Difference (Synthetic - Real)', zmin, zmax });

      // Draw shared legend
      drawLegend(legendRef.current, zmin, zmax, perHeight);
    };

    drawAll();
    window.addEventListener('resize', drawAll);
    return () => window.removeEventListener('resize', drawAll);
  }, [cols, realCorr, synthCorr, diffCorr]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 500 }}>
        Correlation Matrices
      </Typography>
      {(!cols || cols.length === 0) ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No common numeric columns found to compute correlation.
          </Typography>
        </Box>
      ) : (
        <Box ref={rowRef} sx={{ display: 'flex', gap: 1, flexWrap: 'nowrap', overflowX: 'auto', alignItems: 'flex-start' }}>
          <Box ref={realRef} sx={{ flex: '0 0 auto' }} />
          <Box ref={synthRef} sx={{ flex: '0 0 auto' }} />
          <Box ref={diffRef} sx={{ flex: '0 0 auto' }} />
          <Box ref={legendRef} sx={{ flex: '0 0 auto' }} />
        </Box>
      )}
    </Box>
  );
};

export default CorrelationPlot;
