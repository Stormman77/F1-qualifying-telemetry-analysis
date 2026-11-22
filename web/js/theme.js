// Colors. Chart colors live in style.css as CSS variables; this module reads
// them into `color` so D3 code can use them, and sets the two team colors.

import { state } from "./state.js";

// 2025 team colors
export const TEAM_COLORS = {
  "Mercedes": "#00D7B6",
  "Red Bull Racing": "#4781D7",
  "Ferrari": "#ED1131",
  "McLaren": "#F47600",
  "Alpine": "#00A1E8",
  "Racing Bulls": "#6C98FF",
  "Aston Martin": "#229971",
  "Williams": "#1868DB",
  "Kick Sauber": "#01C00E",
  "Haas F1 Team": "#9C9FA2",
};

// Several teams share similar blues/greens. When the two selected colors are
// too close to tell apart, team B switches to a neutral color instead.
const MIN_COLOR_DISTANCE = 25;

export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const color = {};

export function readColors() {
  for (const k of ["team-a", "team-b", "faster", "neutral", "slower", "track", "text-primary",
                   "text-secondary", "type-slow", "type-medium", "type-fast", "surface"]) {
    color[k] = css(`--${k}`);
  }
}

function colorDistance(a, b) {
  const x = d3.lab(a), y = d3.lab(b);
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}

// Team colors are set as CSS variables, so the dropdown swatches, map dots,
// speed trace and heatmap markers all read the same values.
export function applyTeamColors() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const a = TEAM_COLORS[state.teamA];
  let b = TEAM_COLORS[state.teamB];
  if (colorDistance(a, b) < MIN_COLOR_DISTANCE) b = dark ? "#e6e5e0" : "#52514e";
  document.documentElement.style.setProperty("--team-a", a);
  document.documentElement.style.setProperty("--team-b", b);
  readColors();
}
