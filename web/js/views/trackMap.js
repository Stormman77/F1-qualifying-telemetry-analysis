// Track map: the circuit outline with one dot per corner, colored by which of
// the two selected teams was faster there and sized by the time gap.

import { state } from "../state.js";
import { color } from "../theme.js";
import { teamEntry, cornerGap } from "../race.js";
import { chartWidth, dot, fmtMs } from "../utils.js";
import { showTooltip, hideTooltip } from "../tooltip.js";
import { setHoverCorner, updateHighlights, focusCorner } from "../highlight.js";

export function renderTrackMap() {
  const container = d3.select("#track-map");
  container.selectAll("*").remove();
  const width = chartWidth(container);
  const height = Math.max(280, Math.min(460, width * 0.75));
  const pad = 28;

  // Equal scale on both axes so the track keeps its real shape; y is flipped for SVG.
  const pts = state.race.outline;
  const xExt = d3.extent(pts, (d) => d[0]);
  const yExt = d3.extent(pts, (d) => d[1]);
  const k = Math.min((width - 2 * pad) / (xExt[1] - xExt[0]), (height - 2 * pad) / (yExt[1] - yExt[0]));
  const ox = (width - k * (xExt[1] - xExt[0])) / 2;
  const oy = (height - k * (yExt[1] - yExt[0])) / 2;
  const px = (x) => ox + (x - xExt[0]) * k;
  const py = (y) => height - oy - (y - yExt[0]) * k;

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img").attr("aria-label", `Track map of the ${state.race.event}`);

  svg.append("path")
    .datum([...pts, pts[0]])
    .attr("d", d3.line().x((d) => px(d[0])).y((d) => py(d[1])))
    .attr("fill", "none")
    .attr("stroke", color.track)
    .attr("stroke-width", 6)
    .attr("stroke-linejoin", "round");

  const gaps = state.race.corners.map(cornerGap).filter((g) => g !== null);
  const r = d3.scaleSqrt().domain([0, d3.max(gaps, Math.abs) || 0.01]).range([5, 14]);
  const radius = (d) => (cornerGap(d) === null ? 5 : r(Math.abs(cornerGap(d))));

  const corners = svg.append("g").selectAll("g").data(state.race.corners).join("g")
    .attr("transform", (d) => `translate(${px(d.x)},${py(d.y)})`)
    .attr("class", "corner")
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => { setHoverCorner(d.label); showTooltip(event, cornerTooltip(d)); })
    .on("mouseleave", () => { setHoverCorner(null); hideTooltip(); })
    .on("click", (event, d) => focusCorner(d.label));  // zooms the speed trace to this corner

  // invisible larger hit target, so small dots are easy to hover
  corners.append("circle").attr("r", 18).attr("fill", "transparent");
  corners.append("circle")
    .attr("class", "corner-dot")
    .attr("r", radius)
    .attr("fill", (d) => {
      const gap = cornerGap(d);
      return gap === null ? color.track : gap < 0 ? color["team-a"] : color["team-b"];
    })
    .attr("stroke", color.surface)
    .attr("stroke-width", 2);
  corners.append("text")
    .text((d) => d.label)
    .attr("x", (d) => radius(d) + 3)
    .attr("y", -4)
    .attr("font-size", 11)
    .attr("fill", color["text-secondary"]);

  d3.select("#map-legend").html(
    `<span class="legend-item">${dot(color["team-a"])}${state.teamA} faster</span>`
    + `<span class="legend-item">${dot(color["team-b"])}${state.teamB} faster</span>`
    + `<span class="legend-item">Larger dot = bigger gap</span>`);
  updateHighlights();
}

function cornerTooltip(d) {
  const gap = cornerGap(d);
  const a = teamEntry(state.teamA), b = teamEntry(state.teamB);
  let rows = `<div class="tt-muted">${d.type} corner · min speed ${d.min_speed} km/h</div>`;
  if (gap !== null) {
    const faster = gap < 0 ? a : b;
    rows += `<div class="tt-row">${dot(gap < 0 ? color["team-a"] : color["team-b"])}`
      + `${faster.driver} faster by ${Math.abs(gap * 1000).toFixed(0)} ms</div>`;
  }
  rows += `<div class="tt-muted">vs median team: ${a ? `${a.driver} ${fmtMs(d.deltas[state.teamA])}` : ""}`
    + `${b ? `, ${b.driver} ${fmtMs(d.deltas[state.teamB])}` : ""}</div>`;
  return `<div class="tt-title">${d.label} · ${state.race.event}</div>${rows}`;
}
