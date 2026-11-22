// The race and team dropdowns at the top of the page.

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
  fillSelect("#race-select", races, state.round);
  fillSelect("#team-a", teams.map((t) => [t, t]), state.teamA);
  fillSelect("#team-b", teams.map((t) => [t, t]), state.teamB);
  updateTeamOptions();
}

// A team cannot be compared with itself: each dropdown disables the team
// currently picked in the other one.
export function updateTeamOptions() {
  d3.selectAll("#team-a option").property("disabled", (d) => d[0] === state.teamB);
  d3.selectAll("#team-b option").property("disabled", (d) => d[0] === state.teamA);
}
