// Speed trace: the two compared laps (teams or teammates), in three stacked
// panels that share the distance axis: speed, throttle and brake. Corner
// zones are shaded, a crosshair tooltip follows the cursor, and the distance
// axis is zoomable.

import { state } from "../state.js";
import { color, css } from "../theme.js";
import { getSides } from "../race.js";
import { chartWidth, dot } from "../utils.js";
import { showTooltip, hideTooltip } from "../tooltip.js";
import { setHoverCorner, updateHighlights, onFocusCorner } from "../highlight.js";
import { zoomFilter, attachZoom } from "../zoom.js";

const M = { top: 22, right: 16, bottom: 36, left: 56 };
// vertical layout of the three panels (pixels from the top of the SVG)
const PANELS = {
  speed: [22, 250],
  throttle: [270, 340],
  brake: [358, 390],
};
const HEIGHT = PANELS.brake[1] + M.bottom + 10;

// Set by renderSpeedTrace; lets a click on the track map zoom to a corner.
let zoomToCorner = () => {};
onFocusCorner((label) => zoomToCorner(label));

export function renderSpeedTrace() {
  const container = d3.select("#speed-trace");
  container.selectAll("*").remove();
  const width = chartWidth(container);
  const height = HEIGHT;
  const m = M;
  const plotTop = PANELS.speed[0];
  const plotBottom = PANELS.brake[1];

  const { a, b } = getSides();
  const series = [a, b].filter(Boolean)
    .map((side) => ({ team: side.entry.team, entry: side.entry, color: side.color }));
  const step = state.race.step;
  const maxLen = d3.max(series, (s) => s.entry.speed.length) || 1;

  const x = d3.scaleLinear().domain([0, state.race.lap_length]).range([m.left, width - m.right]);
  let zx = x;  // x scale after zooming; everything below draws with zx
  const ySpeed = d3.scaleLinear()
    .domain([0, (d3.max(series, (s) => d3.max(s.entry.speed)) || 350) * 1.05]).nice()
    .range([PANELS.speed[1], PANELS.speed[0]]);
  const yThrottle = d3.scaleLinear().domain([0, 100]).range([PANELS.throttle[1], PANELS.throttle[0]]);
  const brakeRow = d3.scaleBand().domain(series.map((s) => s.entry.driver))
    .range(PANELS.brake).paddingInner(0.25);

  const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img").attr("aria-label", "Speed, throttle and brake against lap distance for the two compared laps");

  // anything drawn in the plot area is clipped, so zoomed lines don't spill over the axis
  svg.append("clipPath").attr("id", "trace-clip")
    .append("rect").attr("x", m.left).attr("y", 0)
    .attr("width", width - m.left - m.right).attr("height", height);

  drawPanelAxes(svg, { ySpeed, yThrottle, brakeRow, series, m, width });
  const plot = svg.append("g").attr("clip-path", "url(#trace-clip)");
  const zones = drawZones(plot, plotTop, plotBottom);
  const xAxis = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${plotBottom + 6})`);
  svg.append("text").attr("class", "axis-title")
    .attr("x", width - m.right).attr("y", height - 4).attr("text-anchor", "end")
    .text("Distance along the lap (m)");

  const speedLine = d3.line().x((d, i) => zx(i * step)).y((d) => ySpeed(d));
  const throttleLine = d3.line().x((d, i) => zx(i * step)).y((d) => yThrottle(d));
  const lineStyle = (sel) => sel.attr("fill", "none").attr("stroke", (s) => s.color)
    .attr("stroke-width", 2).attr("stroke-linejoin", "round");
  const speedPaths = plot.append("g").selectAll("path").data(series).join("path").call(lineStyle);
  const throttlePaths = plot.append("g").selectAll("path").data(series).join("path").call(lineStyle)
    .attr("stroke-width", 1.5);

  // brake: one row per driver, a filled block wherever the brake is pressed
  const brakeBlocks = plot.append("g").selectAll("g").data(series).join("g")
    .selectAll("rect").data((s) => brakeRuns(s.entry.brake).map((run) => ({ ...run, s })))
    .join("rect")
    .attr("y", (d) => brakeRow(d.s.entry.driver))
    .attr("height", brakeRow.bandwidth())
    .attr("rx", 2)
    .attr("fill", (d) => d.s.color);

  drawKey(svg, series, m, width);

  // redraw everything that depends on the x scale
  function redraw() {
    speedPaths.attr("d", (s) => speedLine(s.entry.speed));
    throttlePaths.attr("d", (s) => throttleLine(s.entry.throttle));
    brakeBlocks
      .attr("x", (d) => zx(d.start * step))
      .attr("width", (d) => Math.max(1, zx(d.end * step) - zx(d.start * step)));
    zones.select("rect")
      .attr("x", (d) => zx(d.zone[0]))
      .attr("width", (d) => Math.max(1, zx(d.zone[1]) - zx(d.zone[0])));
    zones.select("text")
      .attr("x", (d) => zx((d.zone[0] + d.zone[1]) / 2))
      .style("display", (d) => {
        const cx = zx((d.zone[0] + d.zone[1]) / 2);
        return cx < m.left || cx > width - m.right ? "none" : null;
      });
    xAxis.call(d3.axisBottom(zx).ticks(8).tickFormat((d) => `${d3.format(",")(d)}`));
  }

  const overlay = drawCrosshair(svg, {
    getX: () => zx, ySpeed, yThrottle, m, width, plotTop, plotBottom, series, step, maxLen,
  });

  // horizontal-only zoom, limited to the lap
  const zoom = d3.zoom()
    .scaleExtent([1, 30])
    .extent([[m.left, 0], [width - m.right, height]])
    .translateExtent([[m.left, 0], [width - m.right, height]])
    .filter(zoomFilter)
    .on("zoom", (event) => {
      zx = event.transform.rescaleX(x);
      redraw();
    });
  attachZoom(container, overlay, zoom);

  zoomToCorner = (label) => {
    const corner = state.race.corners.find((c) => c.label === label);
    if (!corner) return;
    // show the corner zone plus 150 m on each side
    const [d0, d1] = [Math.max(0, corner.zone[0] - 150), Math.min(state.race.lap_length, corner.zone[1] + 150)];
    const k = (width - m.left - m.right) / (x(d1) - x(d0));
    const transform = d3.zoomIdentity.translate(m.left - k * x(d0), 0).scale(k);
    overlay.transition().duration(500).call(zoom.transform, transform);
  };

  redraw();
  updateHighlights();
}

// Turn a 0/1 brake array into runs of consecutive braking samples.
function brakeRuns(brake) {
  const runs = [];
  let start = null;
  brake.forEach((on, i) => {
    if (on && start === null) start = i;
    if (!on && start !== null) { runs.push({ start, end: i }); start = null; }
  });
  if (start !== null) runs.push({ start, end: brake.length });
  return runs;
}

// Corner zones as shaded bands across all three panels, with labels on top.
function drawZones(plot, top, bottom) {
  const zones = plot.append("g").selectAll("g").data(state.race.corners).join("g").attr("class", "zone");
  zones.append("rect")
    .attr("y", top)
    .attr("height", bottom - top)
    .attr("fill", css("--zone"));
  zones.append("text")
    .text((d) => d.label)
    .attr("y", top - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("fill", color["text-secondary"]);
  return zones;
}

// Y axes, gridlines and titles for each panel. These do not change when zooming.
function drawPanelAxes(svg, { ySpeed, yThrottle, brakeRow, series, m, width }) {
  const gridWidth = -(width - m.left - m.right);
  const yAxis = (scale, ticks, format) => (g) => {
    g.append("g").attr("class", "gridline").attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(scale).ticks(ticks).tickSize(gridWidth).tickFormat(""));
    g.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(scale).ticks(ticks).tickFormat(format));
  };
  svg.append("g").call(yAxis(ySpeed, 5, null));
  svg.append("g").call(yAxis(yThrottle, 2, (d) => `${d}%`));

  // brake rows are labeled with the driver code instead of an axis
  svg.append("g").selectAll("text").data(series).join("text")
    .attr("class", "axis-title")
    .attr("x", m.left - 6).attr("y", (s) => brakeRow(s.entry.driver) + brakeRow.bandwidth() / 2)
    .attr("dy", "0.35em").attr("text-anchor", "end").attr("font-size", 10)
    .text((s) => s.entry.driver);

  const title = (y, text) => svg.append("text").attr("class", "axis-title").attr("x", 4).attr("y", y).text(text);
  title(PANELS.speed[0] - 8, "km/h");
  title(PANELS.throttle[0] - 6, "Throttle");
  title(PANELS.brake[0] - 4, "Brake");
}

// Series key in the top-right corner: color swatch + driver and team.
function drawKey(svg, series, m, width) {
  const key = svg.append("g").selectAll("g").data(series).join("g")
    .attr("transform", (s, i) => `translate(${width - m.right - 150},${PANELS.speed[0] + 6 + i * 16})`);
  key.append("rect").attr("width", 10).attr("height", 10).attr("rx", 3).attr("fill", (s) => s.color);
  key.append("text").attr("x", 16).attr("y", 9).attr("font-size", 11)
    .attr("fill", color["text-primary"])
    .text((s) => `${s.entry.driver} (${s.team})`);
}

// Vertical line through all panels + markers on the speed and throttle lines
// that follow the cursor. Returns the transparent overlay rect, which also
// receives the zoom gestures.
function drawCrosshair(svg, { getX, ySpeed, yThrottle, m, width, plotTop, plotBottom, series, step, maxLen }) {
  const cross = svg.append("line").attr("stroke", color["text-secondary"]).attr("stroke-width", 1)
    .attr("y1", plotTop).attr("y2", plotBottom).style("display", "none");
  const marker = (sel) => sel.attr("r", 4).attr("fill", (s) => s.color)
    .attr("stroke", color.surface).attr("stroke-width", 2).style("display", "none");
  const speedMarkers = svg.append("g").selectAll("circle").data(series).join("circle").call(marker);
  const throttleMarkers = svg.append("g").selectAll("circle").data(series).join("circle").call(marker);

  return svg.append("rect")
    .attr("x", m.left).attr("y", plotTop)
    .attr("width", width - m.left - m.right).attr("height", plotBottom - plotTop)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .on("mousemove", (event) => {
      const x = getX();
      const [mx] = d3.pointer(event);
      const dist = x.invert(mx);
      const i = Math.max(0, Math.min(maxLen - 1, Math.round(dist / step)));
      const px = x(i * step);
      cross.attr("x1", px).attr("x2", px).style("display", null);
      speedMarkers.attr("cx", px).attr("cy", (s) => ySpeed(s.entry.speed[i] ?? 0)).style("display", null);
      throttleMarkers.attr("cx", px).attr("cy", (s) => yThrottle(s.entry.throttle[i] ?? 0)).style("display", null);

      const corner = state.race.corners.find((c) => dist >= c.zone[0] && dist < c.zone[1]);
      setHoverCorner(corner ? corner.label : null);

      // faster driver at this point goes first
      const rows = [...series]
        .sort((a, b) => (b.entry.speed[i] ?? 0) - (a.entry.speed[i] ?? 0))
        .map((s) => `<div class="tt-row">${dot(s.color)}${s.entry.driver}`
          + ` ${(s.entry.speed[i] ?? 0).toFixed(0)} km/h`
          + `<span class="tt-muted">· ${s.entry.throttle[i] ?? 0}% throttle`
          + `${s.entry.brake[i] ? " · braking" : ""}</span></div>`)
        .join("");
      showTooltip(event, `<div class="tt-title">${d3.format(",")(Math.round(i * step))} m`
        + `${corner ? ` · ${corner.label} (${corner.type})` : ""}</div>${rows}`);
    })
    .on("mouseleave", () => {
      cross.style("display", "none");
      speedMarkers.style("display", "none");
      throttleMarkers.style("display", "none");
      setHoverCorner(null);
      hideTooltip();
    });
}
