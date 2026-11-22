// Small helpers shared by several modules.

// Revalidate data files on every load so a re-run of analyze.py shows up immediately.
export const loadJson = (url) => d3.json(url, { cache: "no-cache" });

// A hidden or not-yet-laid-out container reports width 0; fall back to a sane minimum.
export const chartWidth = (container) => Math.max(320, container.node().clientWidth);

// 75.096 -> "1:15.096"
export const fmtLap = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;

// -0.046 -> "−46 ms"
export const fmtMs = (s) => `${s > 0 ? "+" : s < 0 ? "−" : ""}${Math.abs(s * 1000).toFixed(0)} ms`;

// Colored circle used in legends and tooltips.
export const dot = (c) => `<span class="legend-dot" style="background:${c}"></span>`;
