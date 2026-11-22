import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch

A, B, GRID, INK = "#d62728", "#1f77b4", "#bbbbbb", "#222222"
GAIN, LOSS = "#7b3fbf", "#f28e2b"

with plt.xkcd(scale=0.6, length=120, randomness=2):
    fig = plt.figure(figsize=(12, 8), dpi=150)
    fig.patch.set_facecolor("white")
    page = fig.add_axes([0, 0, 1, 1])
    page.set_xlim(0, 120)
    page.set_ylim(0, 80)
    page.axis("off")

    def box(x, y, w, h, title):
        page.add_patch(Rectangle((x, y), w, h, fill=False, lw=1.6, ec=INK))
        page.text(x + 1.2, y + h - 2.6, title, fontsize=12, weight="bold")

    # header and controls
    page.text(2, 76.5, "Where Is a Lap Won?  (wireframe)", fontsize=17, weight="bold")
    for x, label in [(2, "Race: Monza 2025  v"), (34, "Team A: Ferrari  v"), (64, "vs  Team B: McLaren  v")]:
        page.add_patch(Rectangle((x, 69.5), 28, 4.5, fill=False, lw=1.3, ec=INK))
        page.text(x + 1.2, 70.8, label, fontsize=10)
    page.add_patch(Rectangle((96, 70.2), 2.4, 2.4, color=A))
    page.text(99, 70.6, "Team A faster", fontsize=9)
    page.add_patch(Rectangle((96, 67.2), 2.4, 2.4, color=B))
    page.text(99, 67.6, "Team B faster", fontsize=9)

    box(2, 30, 62, 36, "1. Track map: corners colored by faster team")
    box(67, 30, 51, 36, "2. Heatmap: time gained by corner type")
    box(2, 2, 116, 25, "3. Speed trace: speed vs lap distance")

    # track map
    t = np.linspace(0, 2 * np.pi, 400)
    tx = 33 + 22 * np.cos(t) + 4 * np.cos(3 * t)
    ty = 46 + 12 * np.sin(t) + 3 * np.sin(2 * t)
    page.plot(tx, ty, color=INK, lw=3)
    corners = [20, 70, 120, 170, 230, 290, 350]
    for i, k in enumerate(corners, 1):
        c = A if i in (1, 3, 4, 6) else B
        page.scatter(tx[k], ty[k], s=170, color=c, zorder=3, edgecolors=INK)
        page.text(tx[k] + 1.2, ty[k] + 1.2, f"T{i}", fontsize=9)
    page.text(4, 31.2, "tooltip on hover: corner #, min speed, gap (s)", fontsize=8.5, style="italic")

    # heatmap
    teams = ["Ferrari", "McLaren", "Mercedes", "Red Bull", "Williams"]
    kinds = ["Slow", "Medium", "Fast"]
    rng = np.random.default_rng(3)
    vals = rng.uniform(-1, 1, (len(teams), len(kinds)))
    x0, y0, cw, ch = 80, 34, 11, 4.2
    for r, team in enumerate(teams):
        page.text(x0 - 12, y0 + (len(teams) - 1 - r) * ch + 1.6, team, fontsize=9)
        for c in range(len(kinds)):
            v = vals[r, c]
            col = GAIN if v > 0 else LOSS
            page.add_patch(Rectangle((x0 + c * cw, y0 + (len(teams) - 1 - r) * ch), cw, ch,
                                     color=col, alpha=0.25 + 0.6 * abs(v), ec="white"))
    for c, k in enumerate(kinds):
        page.text(x0 + c * cw + 2.5, y0 + len(teams) * ch + 0.6, k, fontsize=9)
    page.text(x0 + 2, 31.2, "x: corner type (K-means clusters)", fontsize=8.5, style="italic")
    page.add_patch(Rectangle((68.5, 58.5), 2, 2, color=GAIN))
    page.text(71, 58.8, "gains time vs field", fontsize=8.5)
    page.add_patch(Rectangle((92, 58.5), 2, 2, color=LOSS))
    page.text(94.5, 58.8, "loses time", fontsize=8.5)

    # speed trace
    d = np.linspace(0, 1, 300)
    base = 300 - 170 * np.exp(-((d[:, None] - np.array([.1, .25, .4, .55, .7, .85])) ** 2) / 0.0012).sum(1)
    sx = 10 + d * 104
    page.plot(sx, 5 + (base - 120) / 190 * 16, color=A, lw=2)
    page.plot(sx, 5 + (base - 125 + 6 * np.sin(d * 20)) / 190 * 16, color=B, lw=2)
    page.plot([8, 8], [4, 23], color=INK, lw=1)
    page.plot([8, 116], [4, 4], color=INK, lw=1)
    page.text(3, 13, "Speed\n(km/h)", fontsize=9)
    page.text(100, 2.5, "Distance (m)", fontsize=9)
    page.axvspan(10 + .4 * 104 - 3, 10 + .4 * 104 + 3, ymin=4 / 80, ymax=23 / 80, color="#ffd54f", alpha=0.5)

    # linked-view note
    page.add_artist(FancyArrowPatch((tx[120] + 2, ty[120] - 2), (10 + .4 * 104, 22),
                                    arrowstyle="->", mutation_scale=15, lw=1.4, color="#e69500"))
    page.text(48, 28.3, "linked: hover a corner -> highlighted in all 3 views", fontsize=9.5, color="#b36b00")

    fig.savefig("wireframe.png", facecolor="white")
    print("saved")
