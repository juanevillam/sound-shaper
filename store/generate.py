#!/usr/bin/env python3
"""Render Sound Shaper's App Store screenshots from the app's own screenshots.

    npm run store-screenshots      # bootstraps the brand-art venv (pillow)

Inputs:   store/copy.json          headline + subhead per screen, per locale
          store/source/*.png       real app screenshots (store/source/<locale>/
                                   overrides a file for that locale)
Outputs:  store/screenshots/<locale>/NN-<name>.png at 1206 x 2622, the
          size App Store Connect's iPhone slot ("iPhone with Dynamic Island,
          medium display" — 6.1"/6.3") takes since 2026. It refused 1320 x
          2868 there. The layout is drawn at 1320 x 2868 and scaled down once.

The composition is the one Apple's own App Store listings use: a short bold
headline in SF Pro over a calm, flat ground, an optional one-line subhead, and
the app's real screen below it. There is NO device frame on purpose. Apple's
marketing guidelines forbid illustrating its products, so a frame can only be
Apple's official bezel, and that bezel's licence was declined (2026-10-16).
The screen is shown with the display's own rounded corners instead.

Colours are the brand neutrals (docs/standards.md -> Brand): #222222 ink on
#F5F5F5. Nothing here is hand-placed per screen; every screen shares one grid,
so the app's screen sits at the same place as you swipe through the listing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source"
OUT = ROOT / "screenshots"
LOCALES = ("en-US", "es-MX")

# The canvas is laid out at the 6.9" size and scaled to OUT_SIZE on save.
W, H = 1320, 2868
OUT_SIZE = (1206, 2622)

GROUND = (0xF5, 0xF5, 0xF5)
INK = (0x22, 0x22, 0x22)
# Secondary copy: the ink at ~62%, the way Apple greys a subhead under a
# headline. Neutral, no hue, like the two brand greys.
INK_SECONDARY = (0x6B, 0x6B, 0x6B)

# SF Pro ships with macOS as one variable font. Rendering it into an image is
# not redistributing it; the font file never leaves this machine.
SF = "/System/Library/Fonts/SFNS.ttf"

TITLE_SIZE = 120
TITLE_LEADING = 1.08
SUBTITLE_SIZE = 50
SUBTITLE_LEADING = 1.28
TEXT_MAX_W = 1080
TITLE_SUBTITLE_GAP = 34

# The screen's box. It is fixed rather than fitted under the copy, so a
# one-line headline and a two-line one put the screen in the same place.
SHOT_TOP = 660
SHOT_BOTTOM_MARGIN = 120
# iPhone's display corner is ~55pt on a 402pt-wide screen.
CORNER_RATIO = 55 / 402


def font(size: int, weight: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(SF, size)
    # Axes: Width, Optical Size, GRAD, Weight. Display optical size for the
    # headline, text optical size for the subhead, as Apple's type ramp does.
    opsz = 96 if size >= 60 else 28
    f.set_variation_by_axes([100, opsz, 400, weight])
    return f


def lines_of(text: str, f: ImageFont.FreeTypeFont, where: str) -> list[str]:
    """Break only where the copy says to. A headline is set, not flowed: an
    automatic wrap strands one word on its own line, which Apple never ships,
    so a line too wide for the canvas is an error to fix in copy.json."""
    lines = text.split("\n")
    for line in lines:
        if f.getlength(line) > TEXT_MAX_W:
            raise SystemExit(f"{where}: {line!r} is wider than {TEXT_MAX_W}px; shorten it or break it")
    return lines


def draw_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    f: ImageFont.FreeTypeFont,
    top: float,
    leading: float,
    fill: tuple[int, int, int],
) -> float:
    """Centre each line on the canvas; return the y below the last line."""
    step = f.size * leading
    ascent, _ = f.getmetrics()
    for i, line in enumerate(lines):
        x = (W - f.getlength(line)) / 2
        # Anchor on the baseline so the leading is exact, not glyph-dependent.
        draw.text((x, top + i * step + ascent), line, font=f, fill=fill, anchor="ls")
    return top + len(lines) * step


def text_block_height(n_title: int, n_sub: int) -> float:
    h = n_title * TITLE_SIZE * TITLE_LEADING
    if n_sub:
        h += TITLE_SUBTITLE_GAP + n_sub * SUBTITLE_SIZE * SUBTITLE_LEADING
    return h


def rounded_mask(size: tuple[int, int], radius: int, scale: int = 4) -> Image.Image:
    """An antialiased rounded-rect mask, drawn large and scaled down."""
    big = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, big.width - 1, big.height - 1), radius * scale, fill=255
    )
    return big.resize(size, Image.LANCZOS)


def place_screen(canvas: Image.Image, shot: Image.Image) -> None:
    box_h = H - SHOT_TOP - SHOT_BOTTOM_MARGIN
    aspect = shot.width / shot.height
    h = box_h
    w = round(h * aspect)
    shot = shot.convert("RGB").resize((w, h), Image.LANCZOS)
    x = (W - w) // 2
    y = SHOT_TOP
    radius = round(w * CORNER_RATIO)
    mask = rounded_mask((w, h), radius)

    # A soft, low shadow: enough to lift a dark screen off a light ground,
    # never a drop shadow you notice as one.
    pad = 120
    shadow = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    shadow.paste(mask, (pad, pad))
    shadow = shadow.filter(ImageFilter.GaussianBlur(44))
    shade = Image.new("RGB", shadow.size, (0, 0, 0))
    canvas.paste(shade, (x - pad, y - pad + 24), shadow.point(lambda a: a * 0.16))

    canvas.paste(shot, (x, y), mask)


def render(screen: dict, locale: str, index: int) -> Path:
    copy = screen[locale]
    src = SOURCE / locale / screen["source"]
    if not src.exists():
        src = SOURCE / screen["source"]
    shot = Image.open(src)

    canvas = Image.new("RGB", (W, H), GROUND)
    draw = ImageDraw.Draw(canvas)

    title_f = font(TITLE_SIZE, 700)
    sub_f = font(SUBTITLE_SIZE, 400)
    where = f"{locale} {screen['source']}"
    title = lines_of(copy["title"], title_f, where)
    sub = lines_of(copy["subtitle"], sub_f, where) if copy.get("subtitle") else []

    # The copy is centred in the band above the screen.
    block = text_block_height(len(title), len(sub))
    top = (SHOT_TOP - block) / 2 + 10
    y = draw_lines(draw, title, title_f, top, TITLE_LEADING, INK)
    if sub:
        draw_lines(draw, sub, sub_f, y + TITLE_SUBTITLE_GAP, SUBTITLE_LEADING, INK_SECONDARY)

    place_screen(canvas, shot)

    name = Path(screen["source"]).stem
    out = OUT / locale / f"{index:02d}-{name}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    # 1320 x 2868 and 1206 x 2622 differ in aspect by 0.06%: scale to the
    # height and trim the one spare column, which is flat ground.
    scaled = canvas.resize((round(OUT_SIZE[1] * W / H), OUT_SIZE[1]), Image.LANCZOS)
    left = (scaled.width - OUT_SIZE[0]) // 2
    scaled.crop((left, 0, left + OUT_SIZE[0], OUT_SIZE[1])).save(out, optimize=True)
    return out


def main() -> int:
    screens = json.loads((ROOT / "copy.json").read_text())["screens"]
    for locale in LOCALES:
        for stale in (OUT / locale).glob("*.png"):
            stale.unlink()
        for i, screen in enumerate(screens, start=1):
            out = render(screen, locale, i)
            with Image.open(out) as im:
                assert im.size == OUT_SIZE, f"{out} is {im.size}"
            print(out.relative_to(ROOT.parent))
    return 0


if __name__ == "__main__":
    sys.exit(main())
