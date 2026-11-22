// Linked hover. Any view can report the corner under the cursor with
// setHoverCorner(); updateHighlights() then restyles every view to match.

import { state } from "./state.js";
import { color, css } from "./theme.js";

// Clicking a corner asks views to focus on it (the speed trace zooms to it).
// Views register a handler instead of being called directly.
const focusHandlers = [];
export const onFocusCorner = (handler) => focusHandlers.push(handler);
export const focusCorner = (label) => focusHandlers.forEach((handler) => handler(label));

export function setHoverCorner(label) {
  if (state.hoverCorner === label) return;
  state.hoverCorner = label;
  updateHighlights();
}

export function updateHighlights() {
  const h = state.hoverCorner;
  const corner = h && state.race ? state.race.corners.find((c) => c.label === h) : null;

  // track map: fade the other corners
  d3.selectAll("#track-map .corner").attr("opacity", (d) => (!h || d.label === h ? 1 : 0.35));

  // speed trace: darken the hovered corner's zone
  d3.selectAll("#speed-trace .zone rect")
    .attr("fill", (d) => (d.label === h ? css("--zone-active") : css("--zone")));

  // PCA scatter: enlarge the hovered corner
  d3.selectAll("#pca .pca-dot").attr("r", (d) =>
    (d.round === state.round && d.corner === h ? 9 : d.round === state.round ? 6 : 4));

  // sector breakdown: highlight the hovered corner's row
  d3.selectAll("#sectors .corner-row").classed("active", (d) => Boolean(h) && d.label === h);

  // heatmap: soft band behind the hovered corner's type column
  d3.selectAll("#heatmap .col-band").attr("opacity", (d) => (corner && d === corner.type ? 1 : 0));
  d3.selectAll("#heatmap .col-label")
    .attr("font-weight", (d) => (corner && d === corner.type ? 700 : 400))
    .attr("fill", (d) => (corner && d === corner.type ? color["text-primary"] : color["text-secondary"]));
}
