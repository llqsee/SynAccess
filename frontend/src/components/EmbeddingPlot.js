import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const EmbeddingPlot = ({ 
  data, 
  metadata, 
  width = 800, 
  height = 600,
  pointSize = 0.2,  
  pointOpacity = 0.3  
}) => {
  const svgRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    if (!data || !metadata || !data.length || !metadata.labels) {
      return;
    }

    const container = containerRef.current;
    const plotWidth = container.clientWidth || width;
    const plotHeight = container.clientHeight || height;

    // Auto-adjust point size for large datasets
    const numPoints = data.length;
    const adjustedPointSize = Math.max(0.5, Math.min(pointSize * (800 / Math.sqrt(numPoints)), 3));

    // Clear previous plot
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", plotWidth)
      .attr("height", plotHeight)
      .attr("viewBox", `0 0 ${plotWidth} ${plotHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const margin = { top: 40, right: 20, bottom: 50, left: 50 };
    const innerWidth = plotWidth - margin.left - margin.right;
    const innerHeight = plotHeight - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Extract coordinates and create scales
    const x = data.map(d => d[0]);
    const y = data.map(d => d[1]);

    const xScale = d3.scaleLinear()
      .domain(d3.extent(x))
      .range([0, innerWidth])
      .nice();

    const yScale = d3.scaleLinear()
      .domain(d3.extent(y))
      .range([innerHeight, 0])
      .nice();

    const colorScale = d3.scaleOrdinal()
      .domain(["Real", "Synthetic"])
      .range(["steelblue", "#e74c3c"]);

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .attr("class", "axis")
      .call(d3.axisBottom(xScale))
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 40)
      .attr("fill", "black")
      .attr("font-weight", "bold")
      .text(`${metadata.method.toUpperCase()}_1`);

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(yScale))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -40)
      .attr("x", -innerHeight / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "black")
      .attr("font-weight", "bold")
      .text(`${metadata.method.toUpperCase()}_2`);

    // Style axes
    svg.selectAll(".axis line, .axis path")
      .style("stroke", "#cccccc");

    // Add title
    svg.append("text")
      .attr("x", plotWidth / 2)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text(`${metadata.method.toUpperCase()} Embedding - ${metadata.runtime.toFixed(2)}s`);

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Add data points
    g.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d[0]))
      .attr("cy", (d) => yScale(d[1]))
      .attr("r", adjustedPointSize)
      .attr("fill", (_, i) => colorScale(metadata.labels[i]))
      .attr("stroke", (_, i) => d3.color(colorScale(metadata.labels[i])).darker(0.5))
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.3);

    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${plotWidth - margin.right - 120}, ${margin.top})`);

    ["Real", "Synthetic"].forEach((label, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 25})`);

      legendRow.append("rect")
        .attr("x", -5)
        .attr("y", -10)
        .attr("width", 100)
        .attr("height", 20)
        .attr("fill", "white")
        .attr("opacity", 0.8)
        .attr("rx", 5);

      legendRow.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", adjustedPointSize * 2)
        .attr("fill", colorScale(label))
        .attr("stroke", d3.color(colorScale(label)).darker(0.5))
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.5);

      legendRow.append("text")
        .attr("x", 15)
        .attr("y", 5)
        .text(label)
        .style("font-size", "12px")
        .style("font-weight", "bold");
    });
  }, [data, metadata, width, height, pointSize, pointOpacity]);

  return (
    <div 
      ref={containerRef} 
      className="embedding-plot" 
      style={{ 
        width: '100%', 
        height: '600px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <svg 
        ref={svgRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />
    </div>
  );
};

export default EmbeddingPlot; 