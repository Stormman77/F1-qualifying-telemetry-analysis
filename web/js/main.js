// Where Is a Lap Won? — entry point.
// Loads the data produced by scripts/analyze.py, wires up the controls and
// renders every view. Each view lives in its own module under views/.

import { state } from "./state.js";
import { readColors, applyTeamColors } from "./theme.js";
import { loadJson } from "./utils.js";
import { fillControls, updateTeamOptions } from "./controls.js";
import { renderLapSummary } from "./views/lapSummary.js";
import { renderTrackMap } from "./views/trackMap.js";
import { renderSpeedTrace } from "./views/speedTrace.js";
import { renderHeatmap } from "./views/heatmap.js";
import { renderPca } from "./views/pcaScatter.js";
import { renderModel } from "./views/modelSelection.js";

// views that depend on the selected race and teams
function renderRaceViews() {
  renderLapSummary();
  renderTrackMap();
  renderSpeedTrace();
}

function renderAll() {
  renderRaceViews();
  renderHeatmap();
  renderPca();
  renderModel();
}

async function loadRace(round) {
  state.round = round;
  state.race = await loadJson(`data/race_${String(round).padStart(2, "0")}.json`);
  renderAll();
}

function onTeamsChanged() {
  updateTeamOptions();
  applyTeamColors();
  renderRaceViews();
  renderHeatmap();
}

async function init() {
  readColors();
  const [races, fingerprint, corners, model] = await Promise.all([
    loadJson("data/races.json"),
    loadJson("data/fingerprint.json"),
    loadJson("data/corners.json"),
    loadJson("data/model.json"),
  ]);
  Object.assign(state, { races, fingerprint, corners, model });

  fillControls();
  applyTeamColors();
  d3.select("#race-select").on("change", (e) => loadRace(+e.target.value));
  d3.select("#team-a").on("change", (e) => { state.teamA = e.target.value; onTeamsChanged(); });
  d3.select("#team-b").on("change", (e) => { state.teamB = e.target.value; onTeamsChanged(); });

  // redraw when the system switches light/dark, or the window is resized
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyTeamColors();
    renderAll();
  });
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 150);
  });

  await loadRace(state.round);
}

init();
