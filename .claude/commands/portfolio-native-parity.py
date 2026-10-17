#!/usr/bin/env python3
"""
The ruler for `/portfolio-native-parity`. Lives beside the command that owns it,
not in `scripts/` — that directory is build tooling, this is review tooling.

Measure a rendered screen. The parity audits run on numbers, not on eyeballing
two phones side by side — every defect found in the 2026-08-29 welcome-screen
session was a quantity (a gap in dp, a glyph's ink, a press delta, a bar's
colour), and none of them would have surfaced from "walk both and look".

    python3 .claude/commands/portfolio-native-parity.py bands   shot.png
    python3 .claude/commands/portfolio-native-parity.py ink     shot.png --box 50,820,280,1010 --accent
    python3 .claude/commands/portfolio-native-parity.py swatch  shot.png --box 200,1930,700,1970
    python3 .claude/commands/portfolio-native-parity.py press   idle.png held.png --box 60,720,700,820
    python3 .claude/commands/portfolio-native-parity.py diff    a.png b.png

Needs pillow (the repo already installs it for `npm run brand-art`).

THE TRAPS THIS ENCODES — every one of them produced a confidently wrong number
before it was written down:

* DENSITY IS NOT 3. The standing Android target reports 450dpi, so dp = px /
  2.8125. Assuming 3 makes everything read 6.25% small, and the numbers stay
  self-consistent, which is what makes it survive review. Pass --density, or
  --adb to read it off the device.
* DETECT THE BACKGROUND, DON'T ASSUME IT. A device on a dark-mode SCHEDULE can
  flip between two captures in the same run.
* SCAN THROUGH THE CENTRE, NOT THE EDGE. A column dropped a few dp inside a
  rounded container crosses the CORNER, so a 96dp tile measures 83.20.
* AN EXACT-FILL MATCH BREAKS ON A GRADIENT. Match a tolerance, not a colour.
* MEASURE THE FIRST FRAME, FROM A COLD START, WITH NO INTERACTION. A gesture is
  often the thing that HIDES a late-resolving layout, and a state reached by
  flipping a setting on a running app may be one no real launch reaches.
"""

import argparse
import subprocess
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    sys.exit("pillow missing: pip install pillow (or use .brand-venv)")

DEFAULT_DENSITY = 2.8125  # Galaxy A54, 450dpi. iOS shots are usually 3.0.


def adb_density(serial=None):
    cmd = ["adb"] + (["-s", serial] if serial else []) + ["shell", "wm", "density"]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    for line in out.splitlines():
        if "density" in line.lower():
            try:
                return int(line.split(":")[1].strip()) / 160
            except (IndexError, ValueError):
                pass
    return None


def delta(a, b):
    return max(abs(a[i] - b[i]) for i in range(3))


def detect_bg(px, w, h):
    """Corners vote. Never assume the appearance — a scheduled dark mode can
    flip the device between two captures in one run."""
    votes = Counter(px[x, y] for x, y in
                    ((8, h // 2), (w - 9, h // 2), (8, h // 3), (w - 9, h // 3)))
    return votes.most_common(1)[0][0]


def load(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    return im, im.load(), w, h


def cmd_bands(args):
    im, px, w, h = load(args.image)
    d = args.density
    bg = detect_bg(px, w, h)
    x0, x1 = args.x or (int(w * 0.05), int(w * 0.95))
    y0, y1 = args.y or (0, h)
    print(f"# {args.image}  {w}x{h}  density {d}  bg {bg}")
    runs, inrun, start = [], False, 0
    step = max(1, (x1 - x0) // 240)
    for y in range(y0, y1):
        hits = sum(1 for x in range(x0, x1, step) if delta(px[x, y], bg) > args.threshold)
        on = hits >= args.min_hits
        if on and not inrun:
            start, inrun = y, True
        elif not on and inrun:
            if (y - start) / d >= args.min_height:
                runs.append((start, y - 1))
            inrun = False
    if inrun:
        runs.append((start, y1 - 1))
    print(f"{'#':>3} {'top dp':>9} {'bot dp':>9} {'height':>8} {'gap above':>10}")
    prev = None
    for i, (a, b) in enumerate(runs):
        gap = f"{(a - prev) / d:10.2f}" if prev is not None else " " * 10
        print(f"{i:>3} {a/d:9.2f} {b/d:9.2f} {(b-a+1)/d:8.2f} {gap}")
        prev = b


def cmd_ink(args):
    im, px, w, h = load(args.image)
    d = args.density
    bg = detect_bg(px, w, h)
    bx0, by0, bx1, by1 = args.box
    pts = []
    for y in range(by0, by1):
        for x in range(bx0, bx1):
            c = px[x, y]
            if args.accent:
                if c[2] - c[0] > args.threshold:
                    pts.append((x, y))
            elif delta(c, bg) > args.threshold:
                pts.append((x, y))
    if not pts:
        print("no ink in box"); return
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    print(f"# {args.image}  bg {bg}  density {d}")
    print(f"ink  {(max(xs)-min(xs)+1)/d:.2f} x {(max(ys)-min(ys)+1)/d:.2f} dp")
    print(f"box  x {min(xs)/d:.2f}..{max(xs)/d:.2f}   y {min(ys)/d:.2f}..{max(ys)/d:.2f}")
    print(f"centre y {(min(ys)+max(ys))/2/d:.2f} dp")
    print(f"coverage {len(pts)/((bx1-bx0)*(by1-by0)):.4f}  "
          f"(a WEIGHT proxy: compare the same glyph or run across variants)")


def cmd_swatch(args):
    im, px, w, h = load(args.image)
    bx0, by0, bx1, by1 = args.box
    c = Counter(px[x, y] for y in range(by0, by1) for x in range(bx0, bx1))
    total = sum(c.values())
    print(f"# {args.image}  bg {detect_bg(px, w, h)}")
    for colour, n in c.most_common(args.top):
        print(f"  {str(colour):<20} {n:>8}  {100*n/total:5.1f}%  "
              f"#{colour[0]:02X}{colour[1]:02X}{colour[2]:02X}")


def cmd_press(args):
    _, a, w, h = load(args.idle)
    _, b, _, _ = load(args.held)
    bx0, by0, bx1, by1 = args.box or (0, 0, w, h)
    bga, bgb = detect_bg(a, w, h), detect_bg(b, w, h)
    if bga != bgb:
        print(f"!! appearance CHANGED between captures ({bga} -> {bgb}) — "
              f"the reading is meaningless. Pin the theme and recapture.")
        return
    diff = [(x, y) for y in range(by0, by1) for x in range(bx0, bx1)
            if delta(a[x, y], b[x, y]) > args.threshold]
    if not diff:
        print("NO PRESS FEEDBACK — 0 pixels changed."); return
    peak = max(diff, key=lambda p: delta(a[p[0], p[1]], b[p[0], p[1]]))
    xs, ys = [p[0] for p in diff], [p[1] for p in diff]
    d = args.density
    print(f"changed px {len(diff)}   bbox x {min(xs)/d:.1f}..{max(xs)/d:.1f} "
          f"y {min(ys)/d:.1f}..{max(ys)/d:.1f} dp")
    print(f"peak {a[peak]} -> {b[peak]}   delta {delta(a[peak], b[peak])}/255")
    print("reference: an RN text-action fade measures ~82/255 light, ~122 dark;")
    print("a Material TextButton ripple at link size measured 18-25 — present,")
    print("spec-correct and IMPERCEPTIBLE. Under ~40 needs a second opinion.")


def cmd_diff(args):
    _, a, w, h = load(args.a)
    _, b, w2, h2 = load(args.b)
    if (w, h) != (w2, h2):
        print(f"different sizes {w}x{h} vs {w2}x{h2}"); return
    n = sum(1 for y in range(0, h, 2) for x in range(0, w, 2)
            if delta(a[x, y], b[x, y]) > args.threshold)
    total = (h // 2) * (w // 2)
    print(f"{n} of {total} sampled px differ ({100*n/total:.2f}%)")
    if n == 0:
        print("IDENTICAL — if you expected a change, the bundle did not reload. "
              "Check `adb reverse`, that Metro is alive, and that it serves THIS app.")


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--density", type=float, default=None)
    p.add_argument("--adb", metavar="SERIAL", nargs="?", const="", default=None,
                   help="read density off a connected device")
    p.add_argument("--threshold", type=int, default=None)
    sub = p.add_subparsers(dest="cmd", required=True)

    def box(s):
        v = [int(n) for n in s.split(",")]
        if len(v) != 4:
            raise argparse.ArgumentTypeError("expected x0,y0,x1,y1")
        return v

    b = sub.add_parser("bands", help="vertical ink runs and the gaps between them")
    b.add_argument("image")
    b.add_argument("--x", type=lambda s: [int(n) for n in s.split(",")])
    b.add_argument("--y", type=lambda s: [int(n) for n in s.split(",")])
    b.add_argument("--min-hits", type=int, default=4)
    b.add_argument("--min-height", type=float, default=3.0)
    b.set_defaults(fn=cmd_bands, threshold_default=60)

    i = sub.add_parser("ink", help="a glyph or run's rendered extent — NOT its nominal box")
    i.add_argument("image"); i.add_argument("--box", type=box, required=True)
    i.add_argument("--accent", action="store_true", help="match tinted pixels instead of any ink")
    i.set_defaults(fn=cmd_ink, threshold_default=60)

    s = sub.add_parser("swatch", help="dominant colours in a region")
    s.add_argument("image"); s.add_argument("--box", type=box, required=True)
    s.add_argument("--top", type=int, default=4)
    s.set_defaults(fn=cmd_swatch, threshold_default=0)

    pr = sub.add_parser("press", help="is there visible press feedback, and how strong")
    pr.add_argument("idle"); pr.add_argument("held")
    pr.add_argument("--box", type=box)
    pr.set_defaults(fn=cmd_press, threshold_default=4)

    d = sub.add_parser("diff", help="did the screen change at all")
    d.add_argument("a"); d.add_argument("b")
    d.set_defaults(fn=cmd_diff, threshold_default=6)

    args = p.parse_args()
    if args.threshold is None:
        args.threshold = args.threshold_default
    if args.density is None:
        args.density = (adb_density(args.adb or None) if args.adb is not None else None) \
                       or DEFAULT_DENSITY
    args.fn(args)


if __name__ == "__main__":
    main()
