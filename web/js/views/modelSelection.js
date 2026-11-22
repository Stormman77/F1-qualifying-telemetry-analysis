// "Why three corner types?": silhouette score per k, plus the average corner
// in each cluster.

import { state, TYPES } from "../state.js";
import { color } from "../theme.js";
import { chartWidth } from "../utils.js";
import { showTooltip, hideTooltip } from "../tooltip.js";

export function renderModel() {
  const container = d3.select("#model");
  container.selectAll("*").remove();
  const width = chartWidth(container);
  const height = 200;
  const m = { top: 18, right: 8, bottom: 34, left: 40 };
  const data = state.model.model_selection;
  const chosen = state.model.k;

  const x = d3.scaleBand().domain(data.map((d) => d.k)).range([m.left, width - m.right]).padding(0.35);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.silhouette) * 1.15]).nice()
    .range([height - m.bottom, m.top]);

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img").attr("aria-label", "Silhouette score by number of clusters");
  svg.append("g").attr("class", "gridline").attr("transform", `translate(${m.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(width - m.left - m.right)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`)
    .call(d3.axisBottom(x).tickFormat((d) => `k = ${d}`));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(4));

  // bars with 4px rounded tops anchored to the baseline; the chosen k is emphasized
  const barPath = (d) => {
    const x0 = x(d.k), w = x.bandwidth(), y0 = y(d.silhouette), yb = y(0), r = Math.min(4, w / 2);
    return `M${x0},${yb}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + w - r}Q${x0 + w},${y0} ${x0 + w},${y0 + r}V${yb}Z`;
  };
  svg.append("g").selectAll("path").data(data).join("path")
    .attr("d", barPath)
    .attr("fill", (d) => (d.k === chosen ? color["type-medium"] : color.track))
    .on("mousemove", (event, d) => showTooltip(event,
      `<div class="tt-title">k = ${d.k}</div><div>silhouette ${d.silhouette.toFixed(3)}</div>`
      + `<div class="tt-muted">inertia ${d.inertia}</div>`))
    .on("mouseleave", hideTooltip);
  svg.append("g").selectAll("text").data(data).join("text")
    .attr("x", (d) => x(d.k) + x.bandwidth() / 2).attr("y", (d) => y(d.silhouette) - 5)
    .attr("text-anchor", "middle").attr("font-size", 11)
    .attr("font-weight", (d) => (d.k === chosen ? 700 : 400))
    .attr("fill", color["text-secondary"])
    .text((d) => d.silhouette.toFixed(2));

  renderCentersTable();
}

function renderCentersTable() {
  const c = state.model.cluster_centers;
  d3.select("#model-centers").html(
    `<caption>Average corner in each cluster (k = ${state.model.k})</caption>`
    + `<tr><th>Type</th><th>Corners</th><th>Min speed</th><th>Exit speed</th><th>Braking</th></tr>`
    + TYPES.map((t) => `<tr><td>${t}</td><td>${state.model.cluster_sizes[t]}</td>`
      + `<td>${c[t].min_speed} km/h</td><td>${c[t].exit_speed} km/h</td><td>${c[t].brake_distance} m</td></tr>`).join(""));
}
