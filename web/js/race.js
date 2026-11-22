// Helpers for the selected race, shared by the race-level views.

import { state } from "./state.js";

// The lap (driver, lap time, speed trace) representing a team at this race.
export function teamEntry(team) {
  return state.race.teams.find((t) => t.team === team);
}

// Gap between team A and team B in one corner: negative = A faster.
export function cornerGap(corner) {
  const a = corner.deltas[state.teamA];
  const b = corner.deltas[state.teamB];
  return a === undefined || b === undefined ? null : a - b;
}
