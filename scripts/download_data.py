"""Download 2025 qualifying telemetry with FastF1 and save it as CSV.

For every round, this saves three files to data/raw/<year>/<round>_<event>/:
  laps.csv       each driver's fastest qualifying lap (time, sectors, team)
  telemetry.csv  car data + position for those laps (speed, throttle, brake,
                 gear, x/y, distance along the lap)
  corners.csv    corner numbers and positions from the circuit info

FastF1 needs an F1TV Access login (run `python -m fastf1 auth f1tv
--authenticate` once). Raw API responses are cached in data/cache/, so a
round is only downloaded once.

Usage:
  python scripts/download_data.py                 # all 2025 rounds
  python scripts/download_data.py --rounds 1 2 3  # only these rounds
"""

import argparse
import re
import unicodedata
from pathlib import Path

import fastf1
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "cache"
RAW_DIR = ROOT / "data" / "raw"

TELEMETRY_COLS = ["Distance", "Speed", "Throttle", "Brake", "nGear", "RPM", "DRS", "X", "Y"]


def slugify(name):
    # "São Paulo" -> "sao_paulo": drop accents before replacing other characters
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_name.lower()).strip("_")


def save_round(year, round_number, out_root, force=False):
    event = fastf1.get_event(year, round_number)
    out_dir = out_root / f"{round_number:02d}_{slugify(event['EventName'])}"
    if out_dir.exists() and not force:
        print(f"  round {round_number}: already saved, skipping ({out_dir.name})")
        return

    session = fastf1.get_session(year, round_number, "Q")
    session.load(laps=True, telemetry=True, weather=False, messages=False)

    lap_rows = []
    telemetry_parts = []
    for driver in session.laps["Driver"].unique():
        lap = session.laps.pick_drivers(driver).pick_fastest()
        # Drivers with no timed lap (crash, no-show) return an empty result.
        if lap is None or pd.isna(lap["LapTime"]):
            continue

        tel = lap.get_telemetry()[TELEMETRY_COLS].copy()
        tel.insert(0, "Driver", driver)
        telemetry_parts.append(tel)

        lap_rows.append({
            "Driver": driver,
            "Team": lap["Team"],
            "LapNumber": lap["LapNumber"],
            "LapTime": lap["LapTime"].total_seconds(),
            "Sector1": lap["Sector1Time"].total_seconds(),
            "Sector2": lap["Sector2Time"].total_seconds(),
            "Sector3": lap["Sector3Time"].total_seconds(),
            "Compound": lap["Compound"],
        })

    corners = session.get_circuit_info().corners[["Number", "Letter", "X", "Y", "Angle", "Distance"]]

    out_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(lap_rows).sort_values("LapTime").to_csv(out_dir / "laps.csv", index=False)
    pd.concat(telemetry_parts).to_csv(out_dir / "telemetry.csv", index=False)
    corners.to_csv(out_dir / "corners.csv", index=False)
    print(f"  round {round_number}: saved {len(lap_rows)} laps, {len(corners)} corners ({out_dir.name})")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--rounds", type=int, nargs="*", help="round numbers (default: all)")
    parser.add_argument("--force", action="store_true", help="re-save rounds that already exist")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE_DIR))

    schedule = fastf1.get_event_schedule(args.year, include_testing=False)
    rounds = args.rounds or schedule["RoundNumber"].tolist()
    out_root = RAW_DIR / str(args.year)

    for round_number in rounds:
        try:
            save_round(args.year, round_number, out_root, force=args.force)
        except Exception as err:  # keep going if one round fails
            print(f"  round {round_number}: FAILED ({err})")


if __name__ == "__main__":
    main()
