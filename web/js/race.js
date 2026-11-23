// Helpers for the selected race, shared by the race-level views.
//
// Every race view compares two laps, "side A" and "side B":
//   team mode:     the faster driver of team A vs the faster driver of team B
//   teammate mode: the two drivers of one team (faster driver is side A)

import { state } from "./state.js";
import { color } from "./theme.js";

export function driverEntry(code) {
  return state.race.drivers.find((d) => d.driver === code);
}

// The two laps being compared. Each side is { entry, name, color }, where
// entry is the driver's lap and name is what legends show. A side is null
// when that lap is missing (e.g. a driver without a valid lap).
export function getSides() {
  if (state.mode === "teammates") {
    const [first, second] = state.race.drivers
      .filter((d) => d.team === state.team)
      .sort((x, y) => x.lap_time - y.lap_time);
    return {
      a: first ? { entry: first, name: first.driver, color: color["team-a"] } : null,
      b: second ? { entry: second, name: second.driver, color: color["team-b"] } : null,
    };
  }
  const side = (team, key) => {
    const entry = driverEntry(state.race.team_reps[team]);
    return entry ? { entry, name: team, color: color[key] } : null;
  };
  return { a: side(state.teamA, "team-a"), b: side(state.teamB, "team-b") };
}

// Gap between side A and side B in one corner, in seconds: negative = A faster.
export function cornerGap(corner, sides = getSides()) {
  if (!sides.a || !sides.b) return null;
  const a = corner.deltas[sides.a.entry.driver];
  const b = corner.deltas[sides.b.entry.driver];
  return a === undefined || b === undefined ? null : a - b;
}
