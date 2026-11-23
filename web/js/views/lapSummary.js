// "NOR 1:15.096 vs VER 1:15.481 · NOR faster by 0.385 s" line under the dropdowns.

import { state } from "../state.js";
import { getSides } from "../race.js";
import { fmtLap } from "../utils.js";

export function renderLapSummary() {
  const { a, b } = getSides();
  const el = document.getElementById("lap-summary");
  if (!a || !b) {
    el.textContent = state.mode === "teammates"
      ? `Only one ${state.team} driver set a valid lap at this race.`
      : "One of these teams has no valid lap at this race.";
    return;
  }
  const [x, y] = [a.entry, b.entry];
  const gap = x.lap_time - y.lap_time;
  const faster = gap <= 0 ? x : y;
  el.innerHTML = `<strong>${x.driver}</strong> ${fmtLap(x.lap_time)} vs <strong>${y.driver}</strong> ${fmtLap(y.lap_time)} · `
    + `${faster.driver} faster by ${Math.abs(gap).toFixed(3)} s`;
}
