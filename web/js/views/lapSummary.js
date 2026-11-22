// "NOR 1:15.096 vs VER 1:15.481 · NOR faster by 0.385 s" line under the dropdowns.

import { state } from "../state.js";
import { teamEntry } from "../race.js";
import { fmtLap } from "../utils.js";

export function renderLapSummary() {
  const a = teamEntry(state.teamA);
  const b = teamEntry(state.teamB);
  const el = document.getElementById("lap-summary");
  if (!a || !b) {
    el.textContent = "One of these teams has no valid lap at this race.";
    return;
  }
  const gap = a.lap_time - b.lap_time;
  const faster = gap <= 0 ? a : b;
  el.innerHTML = `<strong>${a.driver}</strong> ${fmtLap(a.lap_time)} vs <strong>${b.driver}</strong> ${fmtLap(b.lap_time)} · `
    + `${faster.driver} faster by ${Math.abs(gap).toFixed(3)} s`;
}
