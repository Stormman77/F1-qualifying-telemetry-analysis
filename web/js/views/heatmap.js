// Season fingerprint: teams x corner types, colored by average time gained
// (teal) or lost (red) per corner against the median team.

import { state, TYPES } from "../state.js";
import { color, css } from "../theme.js";
import { chartWidth, dot, fmtMs } from "../utils.js";
import { showTooltip, hideTooltip } from "../tooltip.js";
import { updateHighlights } from "../highlight.js";

export function renderHeatmap() {
  const container = d3.select("#heatmap");
  container.selectAll("*").remove();
  const width = chartWidth(container);
  const m = { top: 26, right: 8, bottom: 8, left: 120 };

  // rows sorted from fastest to slowest team overall
  const teams = d3.groups(state.fingerprint, (d) => d.team)
    .map(([team, rows]) => ({ team, avg: d3.mean(rows, (r) => r.mean_delta) }))
    .sort((a, b) => a.avg - b.avg)
    .map((d) => d.team);
  const rowH = 30;
  const height = m.top + m.bottom + rowH * teams.length;

  const x = d3.scaleBand().domain(TYPES).range([m.left, width - m.right]).padding(0.04);
  const y = d3.scaleBand().domain(teams).range([m.top, height - m.bottom]).padding(0.06);
  const maxAbs = d3.max(state.fingerprint, (d) => Math.abs(d.mean_delta));
  const fill = d3.scaleDiverging()
    .domain([-maxAbs, 0, maxAbs])
    .interpolator(d3.piecewise(d3.interpolateLab, [color.faster, color.neutral, color.slower]));

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img").attr("aria-label", "Heatmap of average time gained per corner type by team");

  // soft background band behind a column, shown when a corner of that type is hovered
  svg.append("g").selectAll("rect").data(TYPES).join("rect")
    .attr("class", "col-band")
    .attr("x", (d) => x(d) - 4).attr("width", x.bandwidth() + 8)
    .attr("y", 2).attr("height", height - 4).attr("rx", 8)
    .attr("fill", css("--highlight"))
    .attr("opacity", 0);

  drawLabels(svg, x, y, m, teams);
  drawCells(svg, x, y, fill, maxAbs);

  d3.select("#heatmap-legend").html(
    `<span class="legend-item">${dot(color.faster)}faster than median team</span>`
    + `<span class="legend-item">${dot(color.neutral)}about the same</span>`
    + `<span class="legend-item">${dot(color.slower)}slower</span>`
    + `<span class="legend-item">Values in ms per corner</span>`);
  updateHighlights();
}

function drawLabels(svg, x, y, m, teams) {
  svg.append("g").selectAll("text").data(TYPES).join("text")
    .attr("class", "col-label")
    .attr("x", (d) => x(d) + x.bandwidth() / 2).attr("y", m.top - 9)
    .attr("text-anchor", "middle").attr("font-size", 12)
    .attr("fill", color["text-secondary"])
    .text((d) => `${d} corners`);

  svg.append("g").selectAll("text").data(teams).join("text")
    .attr("class", "row-label")
    .attr("x", m.left - 8).attr("y", (d) => y(d) + y.bandwidth() / 2)
    .attr("dy", "0.35em").attr("text-anchor", "end").attr("font-size", 12)
    .attr("font-weight", (d) => (d === state.teamA || d === state.teamB ? 700 : 400))
    .attr("fill", color["text-primary"])
    .text((d) => d);

  // team A / B color markers next to their rows
  svg.append("g").selectAll("rect")
    .data([[state.teamA, color["team-a"]], [state.teamB, color["team-b"]]]).join("rect")
    .attr("x", 4).attr("y", (d) => y(d[0]) + y.bandwidth() / 2 - 5)
    .attr("width", 10).attr("height", 10).attr("rx", 3)
    .attr("fill", (d) => d[1]);
}

function drawCells(svg, x, y, fill, maxAbs) {
  const cells = svg.append("g").selectAll("g").data(state.fingerprint).join("g")
    .attr("class", "cell")
    .attr("transform", (d) => `translate(${x(d.type)},${y(d.team)})`)
    .on("mousemove", (event, d) => showTooltip(event,
      `<div class="tt-title">${d.team} · ${d.type} corners</div>`
      + `<div>${fmtMs(d.mean_delta)} per corner vs median team</div>`
      + `<div class="tt-muted">average over ${d.corners} corners, 24 races</div>`))
    .on("mouseleave", hideTooltip);
  cells.append("rect")
    .attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("rx", 4)
    .attr("fill", (d) => fill(d.mean_delta));
  cells.append("text")
    .attr("x", x.bandwidth() / 2).attr("y", y.bandwidth() / 2).attr("dy", "0.35em")
    .attr("text-anchor", "middle").attr("font-size", 12)
    // white text on the strongest colors, normal ink elsewhere
    .attr("fill", (d) => (Math.abs(d.mean_delta) > maxAbs * 0.55 ? "#ffffff" : color["text-primary"]))
    .style("font-variant-numeric", "tabular-nums")
    .text((d) => `${d.mean_delta > 0 ? "+" : d.mean_delta < 0 ? "−" : ""}${Math.abs(d.mean_delta * 1000).toFixed(0)}`);
}
