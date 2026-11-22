// Shared application state. Every view reads from here; only main.js and the
// controls change the selection fields.

export const TYPES = ["slow", "medium", "fast"];

export const state = {
  races: [],          // data/races.json: list of rounds
  fingerprint: [],    // data/fingerprint.json: team x corner type averages
  corners: [],        // data/corners.json: every corner of the season (PCA view)
  model: null,        // data/model.json: k selection, cluster centers
  race: null,         // the loaded data/race_XX.json for the selected round
  round: 1,
  teamA: "McLaren",
  teamB: "Red Bull Racing",
  hoverCorner: null,  // corner label currently hovered in any view
};
