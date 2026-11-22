// PCA scatter: every corner of the season placed by its first two principal
// components and colored by K-means corner type. Zoomable in both directions.

import { state, TYPES } from "../state.js";
import { color } from "../theme.js";
import { chartWidth, dot } from "../utils.js";
import { showTooltip, hideTooltip } from "../tooltip.js";
import { setHoverCorner, updateHighlights } from "../highlight.js";
import { zoomFilter, attachZoom } from "../zoom.js";

export function renderPca() {
  const container = d3.select("#pca");
  container.selectAll("*").remove();
  const width = chartWidth(container);
  const height = Math.max(260, Math.min(380, width * 0.7));
  const m = { top: 12, right: 12, bottom: 36, left: 40 };
  const typeColor = { slow: color["type-slow"], medium: color["type-medium"], fast: color["type-fast"] };
  const inRace = (d) => d.round === state.round;

  const x = d3.scaleLinear().domain(d3.extent(state.corners, (d) => d.pc1)).nice().range([m.left, width - m.right]);
  const y = d3.scaleLinear().domain(d3.extent(state.corners, (d) => d.pc2)).nice().range([height - m.bottom, m.top]);

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img").attr("aria-label", "Scatter plot of all corners after PCA, colored by corner type");

  svg.append("clipPath").attr("id", "pca-clip")
    .append("rect").attr("x", m.left).attr("y", m.top)
    .attr("width", width - m.left - m.right).attr("height", height - m.top - m.bottom);

  const xAxis = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`);
  const yAxis = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`);
  svg.append("text").attr("class", "axis-title").attr("x", width - m.right).attr("y", height - 4)
    .attr("text-anchor", "end").text("PC1: corner speed (slower ← → faster)");

  // background that receives pan/zoom gestures (dots keep their own hover)
  const background = svg.append("rect")
    .attr("x", m.left).attr("y", m.top)
    .attr("width", width - m.left - m.right).attr("height", height - m.top - m.bottom)
    .attr("fill", "transparent")
    .style("cursor", "grab");

  // selected race drawn last so its outlined dots sit on top
  const data = [...state.corners].sort((a, b) => inRace(a) - inRace(b));
  const dots = svg.append("g").attr("clip-path", "url(#pca-clip)")
    .selectAll("circle").data(data).join("circle")
    .attr("class", "pca-dot")
    .attr("r", (d) => (inRace(d) ? 6 : 4))
    .attr("fill", (d) => typeColor[d.type])
    .attr("fill-opacity", (d) => (inRace(d) ? 1 : 0.55))
    .attr("stroke", (d) => (inRace(d) ? color["text-primary"] : color.surface))
    .attr("stroke-width", (d) => (inRace(d) ? 1.5 : 1))
    .on("mousemove", (event, d) => {
      if (inRace(d)) setHoverCorner(d.corner);
      showTooltip(event, `<div class="tt-title">${d.corner} · ${d.event}</div>`
        + `<div class="tt-row">${dot(typeColor[d.type])}${d.type} corner</div>`
        + `<div class="tt-muted">min ${d.min_speed} km/h · exit ${d.exit_speed} km/h · braking ${d.brake_distance} m</div>`);
    })
    .on("mouseleave", () => { setHoverCorner(null); hideTooltip(); });

  // PC2 is mostly braking distance (loading -0.85): higher PC2 = less braking.
  // Drawn after the dots with a halo in the surface color so it stays readable.
  svg.append("text").attr("class", "axis-title").attr("x", m.left + 4).attr("y", m.top + 10)
    .text("PC2: braking distance (↑ less, ↓ more)")
    .attr("stroke", color.surface).attr("stroke-width", 4).attr("paint-order", "stroke");

  function redraw(zx, zy) {
    dots.attr("cx", (d) => zx(d.pc1)).attr("cy", (d) => zy(d.pc2));
    xAxis.call(d3.axisBottom(zx).ticks(5));
    yAxis.call(d3.axisLeft(zy).ticks(5));
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 12])
    .extent([[m.left, m.top], [width - m.right, height - m.bottom]])
    .translateExtent([[m.left, m.top], [width - m.right, height - m.bottom]])
    .filter(zoomFilter)
    .on("zoom", (event) => redraw(event.transform.rescaleX(x), event.transform.rescaleY(y)));
  attachZoom(container, svg, zoom);

  redraw(x, y);

  d3.select("#pca-legend").html(TYPES.map((t) =>
    `<span class="legend-item">${dot(typeColor[t])}${t}</span>`).join("")
    + `<span class="legend-item">Outlined = ${state.race.event}</span>`);
  updateHighlights();
}
