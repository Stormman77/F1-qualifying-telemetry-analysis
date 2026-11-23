// The controls at the top of the page: race, comparison mode and teams.

import { state } from "./state.js";

export function fillSelect(selector, options, selected) {
  d3.select(selector).selectAll("option").data(options).join("option")
    .attr("value", (d) => d[0])
    .property("selected", (d) => d[0] === selected)
    .text((d) => d[1]);
}

export function fillControls() {
  const teams = [...new Set(state.fingerprint.map((d) => d.team))].sort();
  const races = state.races.map((r) => [r.round, `${r.round}. ${r.event.replace(" Grand Prix", " GP")}`]);
  const teamOptions = teams.map((t) => [t, t]);
  fillSelect("#race-select", races, state.round);
  fillSelect("#team-a", teamOptions, state.teamA);
  fillSelect("#team-b", teamOptions, state.teamB);
  fillSelect("#team-single", teamOptions, state.team);
  updateTeamOptions();
  updateModeControls();
}

// A team cannot be compared with itself: each dropdown disables the team
// currently picked in the other one.
export function updateTeamOptions() {
  d3.selectAll("#team-a option").property("disabled", (d) => d[0] === state.teamB);
  d3.selectAll("#team-b option").property("disabled", (d) => d[0] === state.teamA);
}

// Show the two team pickers in team mode and the single picker in teammate mode.
export function updateModeControls() {
  d3.selectAll(".mode-toggle button")
    .classed("active", function () { return this.dataset.mode === state.mode; })
    .attr("aria-pressed", function () { return this.dataset.mode === state.mode; });
  d3.selectAll(".teams-only").style("display", state.mode === "teams" ? null : "none");
  d3.selectAll(".teammates-only").style("display", state.mode === "teammates" ? null : "none");
}
