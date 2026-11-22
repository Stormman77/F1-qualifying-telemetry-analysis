"""Turn the raw qualifying telemetry into corner types and team fingerprints.

Pipeline (one season):
  1. Resample every lap onto a common distance grid (one point every STEP m),
     so two drivers can be compared at the same spot on track.
  2. Cut a zone around each corner and measure it on the field-median lap:
     entry speed, minimum speed, exit speed and brake-to-apex distance.
  3. Cluster all corners of the season into slow / medium / fast types with
     K-means (scripts/clustering.py).
  4. For each team's faster driver, measure the time gained or lost in each
     corner zone against the median team, then average it per corner type.

Writes CSVs to data/processed/ and JSON for the website to web/data/.

Usage:
  python scripts/analyze.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from clustering import kmeans, pca_2d, silhouette_score, standardize

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "2025"
PROCESSED_DIR = ROOT / "data" / "processed"
WEB_DATA_DIR = ROOT / "web" / "data"

STEP = 5.0             # meters between resampled points
ZONE_BEFORE = 150.0    # corner zone starts this far before the corner marker
ZONE_AFTER = 100.0     # ...and ends this far after it
ENTRY_LOOKBACK = 400.0 # how far back to look for the speed before braking
K = 3                  # number of corner types
TYPE_NAMES = ["slow", "medium", "fast"]
# Entry speed is kept as a descriptive column but not clustered on: it mostly
# measures the straight before the corner, and including it split slow
# corners into "after a long straight" vs "after a short one" (silhouette
# 0.35 with it, 0.44 without).
FEATURES = ["entry_speed", "min_speed", "exit_speed", "brake_distance"]
CLUSTER_FEATURES = ["min_speed", "exit_speed", "brake_distance"]


# ---------------------------------------------------------------- loading

def load_round(round_dir):
    laps = pd.read_csv(round_dir / "laps.csv")
    tel = pd.read_csv(round_dir / "telemetry.csv")

    # Drop laps whose telemetry is missing (e.g. 2025 Miami RUS: every sample
    # is 0). A valid lap covers at least half the median lap distance.
    lap_dist = tel.groupby("Driver")["Distance"].max()
    broken = lap_dist[lap_dist < 0.5 * lap_dist.median()].index.tolist()
    if broken:
        print(f"  {round_dir.name}: dropping laps with missing telemetry: {broken}")
        tel = tel[~tel["Driver"].isin(broken)]
        laps = laps[~laps["Driver"].isin(broken)].reset_index(drop=True)

    corners = pd.read_csv(round_dir / "corners.csv").sort_values("Distance").reset_index(drop=True)
    corners["Label"] = "T" + corners["Number"].astype(str) + corners["Letter"].fillna("").astype(str)
    return laps, tel, corners


# ------------------------------------------------------------- resampling

def resample_laps(tel, lap_length):
    """Interpolate every driver's lap onto the same distance grid.

    Each lap's distance is first scaled to the reference lap length, because
    integrated distance differs by a few meters between drivers (different
    lines, sensor noise). Returns the grid and a dict of arrays per driver.
    """
    grid = np.arange(0, lap_length, STEP)
    laps = {}
    for driver, d in tel.groupby("Driver"):
        d = d.sort_values("Distance").drop_duplicates("Distance")
        dist = d["Distance"].to_numpy() * lap_length / d["Distance"].max()
        speed = np.interp(grid, dist, d["Speed"].to_numpy())
        laps[driver] = {
            "speed": speed,
            "throttle": np.interp(grid, dist, d["Throttle"].to_numpy()),
            "brake": np.interp(grid, dist, d["Brake"].astype(float).to_numpy()) > 0.5,
            "gear": np.rint(np.interp(grid, dist, d["nGear"].to_numpy())).astype(int),
            "x": np.interp(grid, dist, d["X"].to_numpy()),
            "y": np.interp(grid, dist, d["Y"].to_numpy()),
            # time to cover each STEP at that speed (km/h -> m/s)
            "dt": STEP / np.maximum(speed / 3.6, 1.0),
        }
    return grid, laps


# --------------------------------------------------------- corner features

def corner_zones(corners, lap_length):
    """Zone [start, end) in meters for each corner, never overlapping a neighbor."""
    d = corners["Distance"].to_numpy()
    prev_mid = np.concatenate([[0.0], (d[:-1] + d[1:]) / 2])
    next_mid = np.concatenate([(d[:-1] + d[1:]) / 2, [lap_length]])
    start = np.maximum(d - ZONE_BEFORE, prev_mid)
    end = np.minimum(d + ZONE_AFTER, next_mid)
    return np.column_stack([start, end])


def brake_to_apex(brake, apex_idx, lookback_idx):
    """Meters from the start of the braking that leads into the apex.

    Returns 0 for corners taken without braking (flat-out kinks).
    """
    window = brake[lookback_idx:apex_idx + 1]
    if not window.any():
        return 0.0
    last = lookback_idx + np.flatnonzero(window)[-1]
    # braking that ended long before the apex belongs to an earlier corner
    if (apex_idx - last) * STEP > 100:
        return 0.0
    onset = last
    while onset > lookback_idx and brake[onset - 1]:
        onset -= 1
    return (apex_idx - onset) * STEP


def corner_features(median_speed, median_brake, zones):
    rows = []
    for start, end in zones:
        i0, i1 = int(start // STEP), int(end // STEP)
        apex = i0 + int(np.argmin(median_speed[i0:i1]))
        lookback = max(0, int((start - ENTRY_LOOKBACK) // STEP))
        rows.append({
            "entry_speed": median_speed[lookback:apex + 1].max(),
            "min_speed": median_speed[apex],
            "exit_speed": median_speed[i1 - 1],
            "brake_distance": brake_to_apex(median_brake, apex, lookback),
            "apex_distance": apex * STEP,
        })
    return pd.DataFrame(rows)


# ------------------------------------------------------------ team deltas

def team_representatives(laps):
    """Each team's faster driver in this session (laps.csv is sorted by time)."""
    return laps.drop_duplicates("Team")[["Team", "Driver", "LapTime"]].reset_index(drop=True)


def zone_time_deltas(resampled, reps, zones):
    """Seconds each team gains (<0) or loses (>0) per corner zone vs the median team."""
    times = np.array([
        [resampled[drv]["dt"][int(s // STEP):int(e // STEP)].sum() for s, e in zones]
        for drv in reps["Driver"]
    ])
    return times - np.median(times, axis=0)


# --------------------------------------------------------------- pipeline

def main():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)

    corner_rows, delta_rows, race_payloads, races = [], [], {}, []

    for round_dir in sorted(p for p in RAW_DIR.iterdir() if p.is_dir()):
        round_number = int(round_dir.name[:2])
        event = round_dir.name[3:].replace("_", " ").title()
        laps, tel, corners = load_round(round_dir)

        lap_length = float(tel.groupby("Driver")["Distance"].max().median())
        grid, resampled = resample_laps(tel, lap_length)
        zones = corner_zones(corners, lap_length)

        # field-median lap: a "typical" car's speed at every point of the track
        median_speed = np.median([r["speed"] for r in resampled.values()], axis=0)
        median_brake = np.mean([r["brake"] for r in resampled.values()], axis=0) > 0.5

        feats = corner_features(median_speed, median_brake, zones)
        feats.insert(0, "corner", corners["Label"])
        feats.insert(0, "event", event)
        feats.insert(0, "round", round_number)
        feats["x"], feats["y"] = corners["X"].to_numpy(), corners["Y"].to_numpy()
        feats["zone_start"], feats["zone_end"] = zones[:, 0], zones[:, 1]
        corner_rows.append(feats)

        reps = team_representatives(laps)
        deltas = zone_time_deltas(resampled, reps, zones)
        for t, row in reps.iterrows():
            for c, label in enumerate(corners["Label"]):
                delta_rows.append({"round": round_number, "corner": label, "team": row["Team"],
                                   "driver": row["Driver"], "delta_s": deltas[t, c]})

        pole = laps.iloc[0]["Driver"]
        race_payloads[round_number] = {
            "round": round_number,
            "event": event,
            "lap_length": round(lap_length, 1),
            "step": STEP * 2,  # traces are sent at half resolution to keep files small
            "outline": [[round(x), round(y)] for x, y in
                        zip(resampled[pole]["x"][::4], resampled[pole]["y"][::4])],
            "teams": [
                {"team": row["Team"], "driver": row["Driver"], "lap_time": row["LapTime"],
                 "speed": np.round(resampled[row["Driver"]]["speed"][::2], 1).tolist()}
                for _, row in reps.iterrows()
            ],
        }
        races.append({"round": round_number, "event": event, "pole": pole})
        print(f"round {round_number:2d} {event:<28} {len(corners):2d} corners, lap {lap_length:6.0f} m")

    corners_df = pd.concat(corner_rows, ignore_index=True)
    deltas_df = pd.DataFrame(delta_rows)

    # ---- clustering all corners of the season
    X, mean, std = standardize(corners_df[CLUSTER_FEATURES].to_numpy())
    model_selection = []
    for k in range(2, 7):
        labels_k, _, inertia_k = kmeans(X, k)
        model_selection.append({"k": k, "inertia": round(float(inertia_k), 2),
                                "silhouette": round(float(silhouette_score(X, labels_k)), 3)})
    labels, centers, _ = kmeans(X, K)

    # name clusters by their average minimum speed: lowest = "slow"
    order = np.argsort(centers[:, CLUSTER_FEATURES.index("min_speed")])
    rename = {int(c): TYPE_NAMES[rank] for rank, c in enumerate(order)}
    corners_df["type"] = [rename[int(l)] for l in labels]

    coords, explained, components = pca_2d(X)
    corners_df["pc1"], corners_df["pc2"] = coords[:, 0], coords[:, 1]

    deltas_df = deltas_df.merge(corners_df[["round", "corner", "type"]], on=["round", "corner"])
    fingerprint = (deltas_df.groupby(["team", "type"])["delta_s"]
                   .agg(["mean", "count"]).reset_index())

    # ---- CSV outputs (for the report and repository)
    corners_df.to_csv(PROCESSED_DIR / "corners_2025.csv", index=False)
    deltas_df.to_csv(PROCESSED_DIR / "team_corner_deltas_2025.csv", index=False)
    fingerprint.to_csv(PROCESSED_DIR / "team_fingerprint_2025.csv", index=False)

    # ---- JSON outputs (for the website)
    type_lookup = corners_df.set_index(["round", "corner"])["type"].to_dict()
    for rnd, payload in race_payloads.items():
        cdf = corners_df[corners_df["round"] == rnd]
        ddf = deltas_df[deltas_df["round"] == rnd]
        payload["corners"] = [
            {"label": r.corner, "x": round(r.x), "y": round(r.y), "type": type_lookup[(rnd, r.corner)],
             "zone": [round(r.zone_start), round(r.zone_end)], "apex": round(r.apex_distance),
             "min_speed": round(r.min_speed), "deltas": {
                 d.team: round(d.delta_s, 3) for d in ddf[ddf["corner"] == r.corner].itertuples()}}
            for r in cdf.itertuples()
        ]
        write_json(WEB_DATA_DIR / f"race_{rnd:02d}.json", payload)

    write_json(WEB_DATA_DIR / "races.json", races)
    write_json(WEB_DATA_DIR / "corners.json", [
        {"round": int(r["round"]), "event": r["event"], "corner": r["corner"], "type": r["type"],
         "pc1": round(r["pc1"], 3), "pc2": round(r["pc2"], 3),
         **{f: round(float(r[f]), 1) for f in FEATURES}}
        for _, r in corners_df.iterrows()
    ])
    write_json(WEB_DATA_DIR / "fingerprint.json", [
        {"team": r["team"], "type": r["type"], "mean_delta": round(r["mean"], 4), "corners": int(r["count"])}
        for _, r in fingerprint.iterrows()
    ])
    write_json(WEB_DATA_DIR / "model.json", {
        "features": CLUSTER_FEATURES,
        "k": K,
        "model_selection": model_selection,
        "pca_explained_variance": [round(float(v), 3) for v in explained],
        "pca_loadings": {f: [round(float(components[0, i]), 3), round(float(components[1, i]), 3)]
                         for i, f in enumerate(CLUSTER_FEATURES)},
        "cluster_centers": {rename[int(c)]: {f: round(float(centers[c, i] * std[i] + mean[i]), 1)
                                             for i, f in enumerate(CLUSTER_FEATURES)} for c in range(K)},
        "cluster_sizes": corners_df["type"].value_counts().to_dict(),
    })

    print(f"\n{len(corners_df)} corners clustered into {K} types:")
    print(corners_df.groupby("type")[FEATURES].mean().round(1).to_string())
    print("\nmodel selection:", model_selection)


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
