// Sector breakdown: the broadcast-style sector times for both selected drivers,
// then each sector split into its corners to show where inside the sector the
// time was gained or lost.

import { state } from "../state.js";
import { getSides } from "../race.js";
import { setHoverCorner, focusCorner, updateHighlights } from "../highlight.js";

const SECTOR_COLORS = { purple: "fastest of anyone", green: "faster than the other driver", yellow: "slower than the other driver" };

export function renderSectorBreakdown() {
  const root = d3.select("#sectors");
  root.selectAll("*").remove();

  const sides = getSides();
  if (!sides.a || !sides.b || [sides.a, sides.b].some((s) => s.entry.sectors.some((t) => t === null))) {
    root.append("p").attr("class", "empty-note").text("Sector times are not available for this pair at this race.");
    d3.select("#sectors-legend").html("");
    return;
  }
  const a = sides.a.entry;
  const b = sides.b.entry;

  const sectors = buildSectors(sides);
  // one shared scale for every bar, so bars in different sectors are comparable
  const maxAbs = d3.max(sectors.flatMap((s) => s.rows), (r) => Math.abs(r.gap)) || 0.001;

  const columns = root.selectAll(".sector").data(sectors).join("div").attr("class", "sector");

  const head = columns.append("div").attr("class", "sector-head");
  head.append("span").attr("class", "sector-name").text((s) => `Sector ${s.index + 1}`);
  head.append("span").attr("class", "sector-range")
    .text((s) => `${d3.format(",")(s.start)}–${d3.format(",")(s.end)} m`);

  // broadcast-style tags: driver code + sector time in a purple/green/yellow chip
  const tags = columns.append("div").attr("class", "sector-tags")
    .selectAll(".sector-tag").data((s) => s.tags).join("div").attr("class", "sector-tag");
  tags.append("span").attr("class", "tag-swatch").style("background", (t) => t.teamColor);
  tags.append("span").attr("class", "tag-driver").text((t) => t.driver);
  tags.append("span").attr("class", (t) => `tag-time tag-${t.status}`).text((t) => t.time.toFixed(3));
  tags.append("span").attr("class", "tag-gap").text((t) => (t.gap > 0 ? `+${t.gap.toFixed(3)}` : ""));

  // corner-by-corner bars: where inside the sector the gap came from
  const rows = columns.append("div").attr("class", "sector-rows")
    .selectAll(".corner-row").data((s) => s.rows).join("div")
    .attr("class", (r) => `corner-row${r.label ? "" : " rest-row"}`)
    .on("mouseenter", (event, r) => r.label && setHoverCorner(r.label))
    .on("mouseleave", () => setHoverCorner(null))
    .on("click", (event, r) => r.label && focusCorner(r.label));
  rows.append("span").attr("class", "row-label")
    .attr("title", (r) => (r.label ? null : "Time gained between the corner zones: straights and the gaps between corners"))
    .text((r) => r.label || "Straights");
  const track = rows.append("span").attr("class", "row-bar");
  track.append("span").attr("class", "row-bar-fill")
    .style("left", (r) => (r.gap < 0 ? `${50 - (Math.abs(r.gap) / maxAbs) * 50}%` : "50%"))
    .style("width", (r) => `${(Math.abs(r.gap) / maxAbs) * 50}%`)
    .style("background", (r) => (r.gap < 0 ? sides.a.color : sides.b.color));
  rows.append("span").attr("class", "row-value")
    .text((r) => (Math.abs(r.gap) < 0.0005 ? "even" : `${r.gap < 0 ? a.driver : b.driver} ${Math.round(Math.abs(r.gap) * 1000)} ms`));

  d3.select("#sectors-legend").html(
    Object.entries(SECTOR_COLORS).map(([k, text]) =>
      `<span class="legend-item"><span class="legend-chip tag-${k}"></span>${text}</span>`).join("")
    + `<span class="legend-item">Bars: time gained in each corner, toward the faster driver's side`
    + ` (${a.driver} left, ${b.driver} right)</span>`);
  updateHighlights();
}

// Per sector: the two tags and one row per corner plus a "straights & rest"
// row, so the rows add up to the official sector gap.
function buildSectors(sides) {
  const race = state.race;
  const a = sides.a.entry;
  const b = sides.b.entry;
  const bounds = [0, ...race.sector_bounds, race.lap_length];
  return [0, 1, 2].map((i) => {
    const start = Math.round(bounds[i]);
    const end = Math.round(bounds[i + 1]);
    const sectorGap = a.sectors[i] - b.sectors[i];  // negative = A faster

    const corners = race.corners.filter((c) => c.apex >= bounds[i] && c.apex < bounds[i + 1]);
    const rows = corners.map((c) => ({
      label: c.label,
      gap: (c.deltas[a.driver] ?? 0) - (c.deltas[b.driver] ?? 0),
    }));
    rows.push({ label: null, gap: sectorGap - d3.sum(rows, (r) => r.gap) });

    const tag = (entry, other, teamColor) => {
      const time = entry.sectors[i];
      const best = race.best_sectors[i];
      const status = Math.abs(time - best) < 0.0005 ? "purple" : time < other.sectors[i] ? "green" : "yellow";
      return { driver: entry.driver, time, status, teamColor, gap: time - other.sectors[i] };
    };
    return {
      index: i, start, end, rows,
      tags: [tag(a, b, sides.a.color), tag(b, a, sides.b.color)],
    };
  });
}
