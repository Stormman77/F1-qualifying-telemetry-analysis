// About page: fills the data summary, corner-type table and findings from the
// same JSON files the explorer uses, so the numbers always match the analysis.

import { TYPES } from "./state.js";
import { loadJson } from "./utils.js";

const fmt = (ms) => `${Math.abs(ms * 1000).toFixed(0)} ms`;

async function init() {
  const [races, corners, fingerprint, model] = await Promise.all([
    loadJson("data/races.json"),
    loadJson("data/corners.json"),
    loadJson("data/fingerprint.json"),
    loadJson("data/model.json"),
  ]);

  renderStats(races, corners, fingerprint);
  renderTypes(model);
  renderFindings(fingerprint);
}

function renderStats(races, corners, fingerprint) {
  const stats = [
    [races.length, "races"],
    [d3.sum(races, (r) => r.laps), "qualifying laps"],
    [corners.length, "corners"],
    [new Set(fingerprint.map((d) => d.team)).size, "teams"],
  ];
  d3.select("#data-stats").selectAll("div").data(stats).join("div")
    .attr("class", "stat")
    .html(([value, label]) => `<span class="stat-value">${value}</span><span class="stat-label">${label}</span>`);
}

function renderTypes(model) {
  const c = model.cluster_centers;
  const describe = {
    slow: "hairpins and tight chicanes",
    medium: "most braking corners",
    fast: "flat-out kinks and sweepers",
  };
  d3.select("#types-table").html(
    `<tr><th>Type</th><th>Corners</th><th>Min speed</th><th>Exit speed</th><th>Braking</th><th>Typically</th></tr>`
    + TYPES.map((t) => `<tr><td>${t}</td><td>${model.cluster_sizes[t]}</td>`
      + `<td>${c[t].min_speed} km/h</td><td>${c[t].exit_speed} km/h</td>`
      + `<td>${c[t].brake_distance} m${t === "fast" ? " (flat out)" : ""}</td>`
      + `<td class="text-cell">${describe[t]}</td></tr>`).join(""));

  const chosen = model.model_selection.find((d) => d.k === model.k);
  const best = model.model_selection.reduce((a, b) => (b.silhouette > a.silhouette ? b : a));
  d3.select("#k-note").text(
    `k = ${model.k} has a silhouette score of ${chosen.silhouette.toFixed(2)}. k = ${best.k} scores higher `
    + `(${best.silhouette.toFixed(2)}) but only separates braking corners from flat-out ones; `
    + `k = ${model.k} is the best split that also separates slow from medium corners.`);
}

function renderFindings(fingerprint) {
  const overall = d3.rollups(fingerprint, (rows) => d3.mean(rows, (r) => r.mean_delta), (d) => d.team)
    .sort((a, b) => a[1] - b[1]);
  const bestPerType = TYPES.map((t) => {
    const rows = fingerprint.filter((d) => d.type === t).sort((a, b) => a.mean_delta - b.mean_delta);
    return { type: t, first: rows[0], second: rows[1] };
  });

  const items = [
    `<strong>${overall[0][0]}</strong> was the fastest team overall, gaining ${fmt(overall[0][1])} per corner on
      average against the median team; <strong>${overall[overall.length - 1][0]}</strong> lost the most
      (${fmt(overall[overall.length - 1][1])} per corner).`,
    ...bestPerType.map(({ type, first, second }) =>
      `In <strong>${type} corners</strong>, ${first.team} gained the most (${fmt(first.mean_delta)} per corner),
      ahead of ${second.team} (${fmt(second.mean_delta)}).`),
    `The top two teams win in different places: Red Bull matched McLaren in slow corners, but McLaren's
      advantage came from medium and fast corners, where mid-corner speed and exit matter most.`,
  ];
  d3.select("#findings-list").selectAll("li").data(items).join("li").html((d) => d);
}

init();
