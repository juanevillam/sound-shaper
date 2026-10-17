#!/usr/bin/env python3
"""Generate every piece of Sound Shaper's brand art from its one mark.

    npm run brand-art          # bootstraps its own venv (shapely + pillow)

ONE generator on purpose: the iOS icon, the splash art and the Android adaptive
icon are the same mark at three different scales, and while they had separate
pipelines they drifted. Outputs:

    assets/AppIcon.icon/                   the iOS icon — `ios.icon` points here
    assets/images/icon.png                 Android / root fallback
    assets/images/splash-icon{,-dark}.png  splash art, one per appearance
    assets/images/android-icon-*.png       adaptive foreground/monochrome/background
    store-icons/play-512.png               Play Console listing icon

Colours come from GROUND_LIGHT / GROUND_DARK below — but the same two values are
ALSO hard-coded in `app.json` and in `src/ui/BrandTile.tsx`. To change one,
follow **"Changing a brand colour"** in `docs/standards.md`; this file alone is
not enough.

Two things here are load-bearing and easy to undo by accident:

* **Stroke-to-path.** Icon Composer's material renders a layer from its path
  geometry FILLED — it ignores `fill="none"`, so a stroked mark comes out as
  solid blobs. The marks are outlined here (shapely buffer, round caps/joins) so
  the fill region *is* the stroke ring.
* **bbox-centring, not grid-centring.** Topper's crown is vertically asymmetric,
  so grid-centring floats it ~2% high. See `placement()`.

The App Store needs no marketing-icon file — Xcode generates the 1024 from the
`.icon` document. Preview any document without building:

    "/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool" \
      assets/AppIcon.icon --export-image --output-file /tmp/out.png \
      --platform iOS --rendition Dark --width 512 --height 512 --scale 1
"""
import json, os, shutil
from PIL import Image, ImageChops, ImageDraw
from shapely.geometry import LineString, LinearRing
from shapely.ops import unary_union

GRID = 48
CANVAS = 1024
STROKE = 3.25
HALF = STROKE / 2
RES = 64  # arc smoothness
SS = 4  # rasteriser supersampling
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# How wide the 48-unit grid is drawn, per surface. Each number is load-bearing:
GRIDS = {
    "icon": 914,  # the app icon / .icon document
    "splash": 800,  # small enough that the mark clears Android 12's circular
    #                 splash mask (centre 66%) — verified below, keep it
    "adaptive": 651,  # inside Android's adaptive-icon safe zone
}

# A mark whose corners reach further from centre than the others' needs a
# smaller splash grid to clear Android 12's circle — Booker's open book is 30
# units wide with square outer corners. Measured with the check below: 800
# clipped 1.69% of the ink, 760 still 0.10%, 750 clears. Keyed per mark, so the
# others keep their size; empty here, because the equalizer clears the
# standard grid.
SPLASH_GRID_OVERRIDES = {}

# THE brand palette. Two neutrals, swapped per appearance. Changing either of
# these changes only what this script generates — the same values are ALSO
# hard-coded in app.json and BrandTile (and juanevillam.com's favicon, in the
# site's own repo), so follow the runbook in docs/standards.md ("Changing a
# brand colour") or the surfaces will disagree.
GROUND_LIGHT = "#F5F5F5"  # light-appearance ground; mark is GROUND_DARK on it
GROUND_DARK = "#222222"  # dark-appearance ground; mark is GROUND_LIGHT on it


# `rounded_rect` and `stroke_ring` stood here for the starter's bento mark —
# the portfolio's only CLOSED shapes — and went with it (2026-09-16). Both marks
# left are open polylines. Restore them from git if a third mark ever needs one.
def stroke_line(coords):
    """Outline of an open path — round caps and joins."""
    return LineString(coords).buffer(HALF, resolution=RES, cap_style=1, join_style=1)


def quad(p0, c, p1, n=RES):
    """Points along a quadratic Bezier — the mark's one curve."""
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1])
            for t in (i / n for i in range(n + 1))]


MARKS = {
    "sound-shaper": lambda: [
        stroke_line([(x, 24 - h / 2), (x, 24 + h / 2)])
        for x, h in [(10, 15), (17, 25), (24, 16), (31, 32), (38, 20)]
    ],
}


def placement(geom, grid, canvas=CANVAS):
    """Scale for `grid`, then centre the mark's BOUNDING BOX on the canvas.

    Bounding box, not the 48-unit grid: Topper's crown is vertically asymmetric
    (its box centres on y=22.75, not 24), so grid-centring floats it ~2% high.
    Every shipped asset bbox-centres, and `BrandMark.tsx` matches it with
    `viewBox="0 -1.25 48 48"` — keep all three in agreement.
    """
    scale = grid / GRID
    x0, y0, x1, y1 = geom.bounds
    return scale, (
        canvas / 2 - (x0 + x1) / 2 * scale,
        canvas / 2 - (y0 + y1) / 2 * scale,
    )


def rings(geom):
    polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    for poly in polys:
        yield poly.exterior, poly.interiors


def to_path_data(geom, grid):
    """shapely polygon(s) -> SVG path data on the canvas."""
    scale, (dx, dy) = placement(geom, grid)
    parts = []
    for ext, holes in rings(geom):
        for ring in [ext, *holes]:
            pts = [
                f"{x * scale + dx:.2f},{y * scale + dy:.2f}" for x, y in ring.coords
            ]
            parts.append(f"M{pts[0]}L{'L'.join(pts[1:])}Z")
    return "".join(parts)


def rasterise(geom, grid):
    """Alpha mask of the mark, antialiased by supersampling.

    EACH POLYGON IS DRAWN ON ITS OWN MASK AND THE MASKS ARE MAXED. Drawn into
    one mask, a polygon's holes are painted back to 0 — and a shape that sits
    INSIDE another's hole (Booker's title lines inside its cover) was erased
    whenever it happened to be drawn first. The vector path never had this:
    `fill-rule="evenodd"` counts it in.
    """
    scale, (dx, dy) = placement(geom, grid)
    size = (CANVAS * SS, CANVAS * SS)
    mask = Image.new("L", size, 0)
    for ext, holes in rings(geom):
        part = Image.new("L", size, 0)
        draw = ImageDraw.Draw(part)
        draw.polygon([((x * scale + dx) * SS, (y * scale + dy) * SS)
                      for x, y in ext.coords], fill=255)
        for hole in holes:
            draw.polygon([((x * scale + dx) * SS, (y * scale + dy) * SS)
                          for x, y in hole.coords], fill=0)
        mask = ImageChops.lighter(mask, part)
    return mask.resize((CANVAS, CANVAS), Image.LANCZOS)


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def srgb(h):
    """Icon Composer encodes colour as `srgb:r,g,b,a` in 0-1 — never as hex."""
    r, g, b = (c / 255 for c in hex_rgb(h))
    return f"srgb:{r:.3f},{g:.3f},{b:.3f},1.0"


def write_mark_png(path, geom, grid, ink, ground=None):
    """Mark on a transparent canvas, or composited onto a solid ground."""
    alpha = rasterise(geom, grid)
    layer = Image.new("RGBA", (CANVAS, CANVAS), hex_rgb(ink) + (255,))
    layer.putalpha(alpha)
    if ground:
        out = Image.new("RGBA", (CANVAS, CANVAS), hex_rgb(ground) + (255,))
        out.alpha_composite(layer)
        out.convert("RGB").save(path)
    else:
        layer.save(path)
    print("   ", os.path.basename(path))


def android_splash_clearance(geom, grid):
    """Fraction of the splash mark falling outside Android 12's centre-66% circle."""
    alpha = rasterise(geom, grid)
    px = alpha.load()
    r = CANVAS * 0.66 / 2
    ink = outside = 0
    for y in range(CANVAS):
        for x in range(CANVAS):
            if px[x, y] > 127:
                ink += 1
                if (x - CANVAS / 2) ** 2 + (y - CANVAS / 2) ** 2 > r * r:
                    outside += 1
    return outside / max(1, ink)


def svg(geom, color):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" '
        f'height="{CANVAS}" viewBox="0 0 {CANVAS} {CANVAS}">\n'
        f'  <path d="{to_path_data(geom, GRIDS["icon"])}" fill="{color}"'
        f' fill-rule="evenodd"/>\n'
        f"</svg>\n"
    )


def icon_json():
    return {
        # Apple's own derivation: hand it one ground colour and it produces the
        # light gradient AND the matching dark one, plus tinted and clear.
        "fill": {"automatic-gradient": srgb(GROUND_LIGHT)},
        "groups": [
            {
                # Translucency OFF: the glass material renders each shape at
                # its own translucency, so a multi-shape mark comes out in
                # mismatched greys and loses its flat brand colour. Specular
                # stays ON — that is the background shine.
                "translucency": {"enabled": False, "value": 0},
                "layers": [
                    # Both layers start VISIBLE and each hides itself where it
                    # doesn't belong: a base-hidden layer cannot be un-hidden
                    # by a specialization.
                    {
                        "image-name": "mark-dark.svg",
                        "name": "Mark (dark appearance)",
                        "hidden-specializations": [
                            {"appearance": "light", "value": True},
                        ],
                    },
                    {
                        "image-name": "mark-light.svg",
                        "name": "Mark (light appearance)",
                        "hidden-specializations": [
                            {"appearance": "dark", "value": True},
                            {"appearance": "tinted", "value": True},
                        ],
                    },
                ],
            }
        ],
        "supported-platforms": {"circles": ["watchOS"], "squares": "shared"},
    }


PLAY_ICON_SIZE = 512  # Google Play hi-res listing icon: exactly 512x512, full-bleed


def build(app, out_dir):
    geom = unary_union(MARKS[app]())
    images = os.path.join(out_dir, "images")
    os.makedirs(images, exist_ok=True)
    doc = os.path.join(out_dir, "AppIcon.icon")
    shutil.rmtree(doc, ignore_errors=True)
    os.makedirs(os.path.join(doc, "Assets"))
    with open(os.path.join(doc, "Assets", "mark-light.svg"), "w") as f:
        f.write(svg(geom, GROUND_DARK))
    with open(os.path.join(doc, "Assets", "mark-dark.svg"), "w") as f:
        f.write(svg(geom, GROUND_LIGHT))
    with open(os.path.join(doc, "icon.json"), "w") as f:
        json.dump(icon_json(), f, indent=2)
        f.write("\n")
    print("built", doc)

    ic, ad = GRIDS["icon"], GRIDS["adaptive"]
    sp = SPLASH_GRID_OVERRIDES.get(app, GRIDS["splash"])
    write_mark_png(os.path.join(images, "icon.png"), geom, ic, GROUND_LIGHT, GROUND_DARK)
    write_mark_png(os.path.join(images, "splash-icon.png"), geom, sp, GROUND_DARK)
    write_mark_png(os.path.join(images, "splash-icon-dark.png"), geom, sp, GROUND_LIGHT)
    for name in ("android-icon-foreground.png", "android-icon-monochrome.png"):
        write_mark_png(os.path.join(images, name), geom, ad, GROUND_LIGHT)
    Image.new("RGB", (CANVAS, CANVAS), hex_rgb(GROUND_DARK)).save(
        os.path.join(images, "android-icon-background.png"))
    print("    android-icon-background.png")

    # Play Console takes one flat square and applies its own masking — the
    # adaptive layers are not accepted there. Same art as icon.png, its size.
    store = os.path.join(REPO_ROOT, "store-icons")
    os.makedirs(store, exist_ok=True)
    play = os.path.join(store, "play-512.png")
    Image.open(os.path.join(images, "icon.png")).resize(
        (PLAY_ICON_SIZE, PLAY_ICON_SIZE), Image.LANCZOS).save(play)
    print("   ", os.path.relpath(play, REPO_ROOT))

    outside = android_splash_clearance(geom, sp)
    flag = "ok" if outside == 0 else "CLIPS — shrink its splash grid"
    print(f"    splash outside Android 12 circle: {outside:.2%} ({flag})")
    return doc


if __name__ == "__main__":
    for app in MARKS:
        build(app, os.path.join(REPO_ROOT, "assets"))
