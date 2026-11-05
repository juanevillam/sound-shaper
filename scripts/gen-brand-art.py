#!/usr/bin/env python3
"""Generate every piece of Sound Shaper's brand art from its one mark.

    npm run brand-art          # bootstraps its own venv (shapely + pillow)

ONE generator on purpose: the iOS icon, the splash art and the web icons are
the same mark at different scales, and while they had separate pipelines they
drifted. Outputs:

    assets/AppIcon.icon/                   the iOS icon — `ios.icon` points here
    assets/images/icon.png                 root fallback
    assets/images/splash-icon{,-dark}.png  splash art, one per appearance
    web/public/favicon.svg, icons/…        the web app's icons — see build_web()

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
import json, math, os, shutil
from PIL import Image, ImageChops, ImageDraw, ImageFilter
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
    "splash": 800,  # the splash glyph's size, kept from when it had to clear
    #                 Android 12's circular splash mask
}

# Per-mark splash grids, kept from the monorepo's three-app generator; empty
# here, because the equalizer takes the standard grid.
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

    ic = GRIDS["icon"]
    sp = SPLASH_GRID_OVERRIDES.get(app, GRIDS["splash"])
    write_mark_png(os.path.join(images, "icon.png"), geom, ic, GROUND_LIGHT, GROUND_DARK)
    write_mark_png(os.path.join(images, "splash-icon.png"), geom, sp, GROUND_DARK)
    write_mark_png(os.path.join(images, "splash-icon-dark.png"), geom, sp, GROUND_LIGHT)
    return doc


# ── The web app's icons ──
#
# The web has no Icon Composer to render the ground, so the INSTALLED icon is
# the tile BrandTile draws on the Welcome screen, dark (the web is dark-only):
# the superellipse silhouette, the measured vertical shine, a contact shadow.
# These are BrandTile's constants; when it retunes, retune these with it.
SQUIRCLE_N = 4.5
TILE_GRADIENT_DARK = [
    (0, "#727272"), (0.008, "#5A5A59"), (0.016, "#414141"), (0.2, "#2C2D2D"),
    (0.5, "#222222"), (0.8, "#181817"), (0.984, "#1E1D1E"), (0.992, "#2E2E2D"),
    (1, "#3E3E3E"),
]
SHADOW = {"opacity": 0.5, "blur": 0.045, "dy": 0.05}
# The installed icon sits on macOS's own icon grid — an 824 body on 1024 —
# so it stands the size of its neighbours in the Dock instead of a full-bleed
# square looming over them.
WEB_TILE = 824


def squircle_points(size, offset=(0, 0), steps=512):
    r = size / 2
    exp = 2 / SQUIRCLE_N
    pts = []
    for i in range(steps):
        t = i / steps * 2 * math.pi
        c, s_ = math.cos(t), math.sin(t)
        pts.append((offset[0] + r + math.copysign(r * abs(c) ** exp, c),
                    offset[1] + r + math.copysign(r * abs(s_) ** exp, s_)))
    return pts


def gradient_at(f):
    for (o0, c0), (o1, c1) in zip(TILE_GRADIENT_DARK, TILE_GRADIENT_DARK[1:]):
        if f <= o1:
            k = 0 if o1 == o0 else (f - o0) / (o1 - o0)
            a, b = hex_rgb(c0), hex_rgb(c1)
            return tuple(round(x + (y - x) * k) for x, y in zip(a, b))
    return hex_rgb(TILE_GRADIENT_DARK[-1][1])


def web_tile(geom, tile):
    """The dark brand tile, `tile` wide, centred on a transparent canvas."""
    off = ((CANVAS - tile) / 2, (CANVAS - tile) / 2)
    big = CANVAS * SS
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).polygon(
        [(x * SS, y * SS) for x, y in squircle_points(tile, off)], fill=255)
    mask = mask.resize((CANVAS, CANVAS), Image.LANCZOS)

    shine = Image.new("RGB", (CANVAS, CANVAS))
    draw = ImageDraw.Draw(shine)
    for y in range(CANVAS):
        draw.line([(0, y), (CANVAS, y)],
                  fill=gradient_at(min(1, max(0, (y - off[1]) / tile))))

    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    dy = round(tile * SHADOW["dy"])
    shadow_mask = Image.new("L", (CANVAS, CANVAS), 0)
    shadow_mask.paste(mask, (0, dy))
    shadow_mask = shadow_mask.filter(
        ImageFilter.GaussianBlur(tile * SHADOW["blur"]))
    shadow.putalpha(shadow_mask.point(lambda a: round(a * SHADOW["opacity"])))

    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.alpha_composite(shadow)
    body = shine.convert("RGBA")
    body.putalpha(mask)
    out.alpha_composite(body)

    # The mark at the app icon's own proportion of its tile.
    ink = Image.new("RGBA", (CANVAS, CANVAS), hex_rgb(GROUND_LIGHT) + (255,))
    ink.putalpha(rasterise(geom, GRIDS["icon"] * tile / CANVAS))
    out.alpha_composite(ink)
    return out


def favicon_svg(geom):
    """The same tile as a vector, full canvas, for the browser tab."""
    pts = squircle_points(CANVAS, steps=256)
    path = "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z"
    stops = "".join(
        f'<stop offset="{o}" stop-color="{c}"/>' for o, c in TILE_GRADIENT_DARK)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}">\n'
        f'  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">{stops}'
        f"</linearGradient></defs>\n"
        f'  <path d="{path}" fill="url(#g)"/>\n'
        f'  <path d="{to_path_data(geom, GRIDS["icon"])}" fill="{GROUND_LIGHT}"'
        f' fill-rule="evenodd"/>\n'
        f"</svg>\n"
    )


def build_web(app, assets_dir, out_dir):
    """The web app's favicon and the icon a bookmark takes. Not a PWA (Juan,
    2026-11-04): no installed or maskable icons."""
    geom = unary_union(MARKS[app]())
    icons = os.path.join(out_dir, "icons")
    os.makedirs(icons, exist_ok=True)

    with open(os.path.join(out_dir, "favicon.svg"), "w") as f:
        f.write(favicon_svg(geom))
    print("built", os.path.relpath(out_dir, REPO_ROOT))
    print("    favicon.svg")

    # iOS masks a Home Screen icon itself: the app's own full-bleed icon.
    Image.open(os.path.join(assets_dir, "images", "icon.png")).resize(
        (180, 180), Image.LANCZOS).save(os.path.join(icons, "apple-touch-icon.png"))
    print("    icons/apple-touch-icon.png")


if __name__ == "__main__":
    for app in MARKS:
        assets = os.path.join(REPO_ROOT, "assets")
        build(app, assets)
        build_web(app, assets, os.path.join(REPO_ROOT, "web", "public"))
