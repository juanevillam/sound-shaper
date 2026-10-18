#!/usr/bin/env python3
"""Render the App Store's creative assets: the product page header and the
search results asset, per locale.

    .brand-venv/bin/python store/creative.py   # pillow, numpy (see README)

Outputs:  store/creative/<locale>/header.png   3840 x 1646 (21:9)
          store/creative/<locale>/search.png   3840 x 2560 (3:2)

Specs are App Store Connect's (Creative assets specifications): no alpha, PNG
or JPEG. The header is the brand's dark ground with the library's own covers,
because a header sets a tone and the covers are the app's content; the search
asset shows the app itself, because search is where someone decides what the
app IS. Both reuse the screenshots' type and the demo covers, so nothing here
is anyone else's.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "demo-audio"))

import covers  # noqa: E402  (store/demo-audio/covers.py)
from generate import GROUND, INK, INK_SECONDARY, SOURCE, font, rounded_mask  # noqa: E402

OUT = ROOT / "creative"

COPY = {
    "en-US": {
        "header": "Your Music, Shaped Your Way",
        "search_title": "Your Music, Shaped Your Way",
        "search_sub": "Equalizer, speed and clips for your own MP3s.",
    },
    "es-MX": {
        "header": "Tu música, a tu manera",
        "search_title": "Tu música, a tu manera",
        "search_sub": "Ecualizador, velocidad y clips para tus propios MP3.",
    },
}

# The brand's dark ground and its light ink (docs/standards.md -> Brand).
DARK = (0x22, 0x22, 0x22)
LIGHT = (0xF5, 0xF5, 0xF5)
# The picture's corner, as the app draws it (`artworkRadius`).
ART_RADIUS = 0.15
# The phone screen's own corner, as the screenshots draw it.
SCREEN_RADIUS = 55 / 402

ORDER = ["glass-gardens", "tidal", "midnight-drive", "signal-fire", "copper-sun", "afterglow"]


def cover(slug: str, size: int) -> Image.Image:
    return covers.ART[slug]().resize((size, size), Image.LANCZOS)


def shadowed(canvas: Image.Image, img: Image.Image, xy: tuple[int, int], radius: int,
             blur: int, alpha: float, drop: int) -> None:
    w, h = img.size
    mask = rounded_mask((w, h), radius)
    pad = blur * 3
    sh = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    sh.paste(mask, (pad, pad))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(Image.new("RGB", sh.size, (0, 0, 0)), (xy[0] - pad, xy[1] - pad + drop),
                 sh.point(lambda a: int(a * alpha)))
    canvas.paste(img, xy, mask)


def centered_text(draw: ImageDraw.ImageDraw, text: str, f, cx: float, baseline: float, fill) -> None:
    draw.text((cx - f.getlength(text) / 2, baseline), text, font=f, fill=fill, anchor="ls")


def header(locale: str) -> Image.Image:
    W, H = 3840, 1646
    canvas = Image.new("RGB", (W, H), DARK)

    # A row of covers, largest at the centre, as if the library were fanned
    # out under a light. Each cover lights the ground under it in its own
    # colour, which is the app's own player backdrop idea, at rest.
    scales = [0.78, 0.89, 1.0, 1.0, 0.89, 0.78]
    base = 620
    gap = 64
    sizes = [round(base * s) for s in scales]
    total = sum(sizes) + gap * (len(sizes) - 1)
    x = (W - total) // 2
    mid_y = 1010
    glow = Image.new("RGB", (W, H), DARK)
    placed = []
    for slug, size in zip(ORDER, sizes):
        art = cover(slug, size)
        y = mid_y - size // 2
        placed.append((art, (x, y), size))
        glow.paste(art.resize((size, size)), (x, y + size // 3))
        x += size + gap
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    canvas = Image.blend(canvas, glow, 0.55)
    for art, xy, size in placed:
        shadowed(canvas, art, xy, round(size * ART_RADIUS), 40, 0.45, 28)

    draw = ImageDraw.Draw(canvas)
    # Kept to the middle ~45% of the width: the header is cropped narrower on
    # a phone than on a Mac or iPad, and a clipped headline reads as a bug
    # where a clipped outer cover reads as a row that goes on.
    f = font(128, 700)
    centered_text(draw, COPY[locale]["header"], f, W / 2, 420, LIGHT)
    return canvas


def search(locale: str) -> Image.Image:
    W, H = 3840, 2560
    canvas = Image.new("RGB", (W, H), GROUND)
    draw = ImageDraw.Draw(canvas)

    title_f = font(170, 700)
    sub_f = font(82, 400)
    centered_text(draw, COPY[locale]["search_title"], title_f, W / 2, 330, INK)
    centered_text(draw, COPY[locale]["search_sub"], sub_f, W / 2, 470, INK_SECONDARY)

    # Three real screens; the player is the centre and stands a step taller.
    # They run off the bottom edge, the way a phone held up to the camera does.
    shots = [("home.png", 0), ("player.png", -110), ("shape.png", 0)]
    screen_h = 2300
    gap = 120
    imgs = []
    for name, lift in shots:
        src = SOURCE / locale / name
        if not src.exists():
            src = SOURCE / name
        im = Image.open(src).convert("RGB")
        w = round(screen_h * im.width / im.height)
        imgs.append((im.resize((w, screen_h), Image.LANCZOS), lift))
    total = sum(i.width for i, _ in imgs) + gap * (len(imgs) - 1)
    x = (W - total) // 2
    top = 720
    for im, lift in imgs:
        shadowed(canvas, im, (x, top + lift), round(im.width * SCREEN_RADIUS), 50, 0.18, 26)
        x += im.width + gap
    return canvas


def main() -> int:
    for locale in COPY:
        out = OUT / locale
        out.mkdir(parents=True, exist_ok=True)
        for name, fn, size in (("header", header, (3840, 1646)), ("search", search, (3840, 2560))):
            img = fn(locale)
            assert img.size == size and img.mode == "RGB"
            path = out / f"{name}.png"
            img.save(path, optimize=True)
            print(path.relative_to(ROOT.parent))
    return 0


if __name__ == "__main__":
    sys.exit(main())
