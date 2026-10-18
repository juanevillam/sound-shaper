"""Original abstract cover art, one per track, drawn procedurally."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1400
Y, X = np.mgrid[0:S, 0:S] / S


def lerp(a, b, t):
    a, b = np.array(a, float), np.array(b, float)
    return a + (b - a) * t[..., None]


def grad(stops, t):
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,))
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        m = (t >= p0) & (t <= p1)
        out[m] = lerp(c0, c1, (t[m] - p0) / (p1 - p0))
    return out


def grain(img, amt=7, seed=0):
    a = np.asarray(img).astype(float)
    a += np.random.default_rng(seed).normal(0, amt, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def blur_rgba(layer, radius):
    """Premultiplied blur, so transparent black never bleeds into an edge."""
    a = np.asarray(layer).astype(float) / 255
    rgb, al = a[..., :3] * a[..., 3:], a[..., 3:]
    f = lambda c: np.asarray(Image.fromarray((c * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))).astype(float) / 255
    rgb_b = np.stack([f(rgb[..., i]) for i in range(3)], -1)
    al_b = f(al[..., 0])[..., None]
    out = np.concatenate([rgb_b / np.maximum(al_b, 1e-4), al_b], -1)
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8), 'RGBA')


def glow(img, layer, radius):
    blurred = blur_rgba(layer, radius)
    return Image.alpha_composite(img.convert('RGBA'), blurred)


def midnight_drive():
    sky = grad([(0, (18, 8, 48)), (0.45, (88, 24, 110)), (0.62, (230, 90, 120)), (0.62, (20, 6, 40)), (1, (6, 2, 18))], Y)
    img = to_img(sky).convert('RGBA')
    sun = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(sun)
    cx, cy, r = S / 2, S * 0.47, S * 0.24
    for i in range(int(r * 2)):
        yy = cy - r + i
        if yy > S * 0.62: break
        t = i / (2 * r)
        w = np.sqrt(max(r * r - (yy - cy) ** 2, 0))
        gap = (t > 0.5) and int((yy - cy) / 9) % 3 == 0
        if not gap:
            col = tuple(int(v) for v in lerp((255, 214, 90), (255, 70, 140), np.array(t)))
            d.line([(cx - w, yy), (cx + w, yy)], fill=col + (255,))
    img = glow(img, sun, 40); img.alpha_composite(sun)
    g = ImageDraw.Draw(img)
    hz = S * 0.62
    for k in range(1, 16):
        yy = hz + (S - hz) * (k / 15) ** 2.2
        g.line([(0, yy), (S, yy)], fill=(255, 80, 200, 150), width=3)
    for k in range(-14, 15):
        g.line([(S / 2 + k * 30, hz), (S / 2 + k * 260, S)], fill=(255, 80, 200, 130), width=3)
    return grain(img.convert('RGB'), 6, 1)


def tidal():
    base = grad([(0, (8, 40, 64)), (1, (2, 14, 28))], Y)
    img = to_img(base).convert('RGBA')
    for i in range(9):
        layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
        y0 = S * (0.25 + i * 0.075)
        xs = np.linspace(0, S, 200)
        ys = y0 + 40 * np.sin(xs / S * 2 * np.pi * (1.2 + i * 0.15) + i) + 18 * np.sin(xs / S * 9 + i * 2)
        pts = list(zip(xs, ys)) + [(S, S), (0, S)]
        c = lerp((40, 200, 210), (10, 60, 120), np.array(i / 8))
        d.polygon(pts, fill=tuple(int(v) for v in c) + (120,))
        img.alpha_composite(layer)
    return grain(img.convert('RGB').filter(ImageFilter.GaussianBlur(1.5)), 7, 2)


def signal_fire():
    r = np.hypot(X - 0.5, Y - 0.56)
    a = grad([(0, (255, 236, 180)), (0.08, (255, 150, 40)), (0.25, (200, 40, 20)), (0.55, (50, 6, 10)), (1, (10, 2, 4))], r * 1.6)
    img = to_img(a).convert('RGBA')
    rings = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(rings)
    for k in range(1, 9):
        rr = S * 0.06 * k ** 1.15
        d.ellipse([S / 2 - rr, S * 0.56 - rr, S / 2 + rr, S * 0.56 + rr], outline=(255, 190, 120, int(170 / k ** 0.5)), width=4)
    img = glow(img, rings, 12); img.alpha_composite(rings)
    return grain(img.convert('RGB'), 8, 3)


def glass_gardens():
    a = grad([(0, (226, 240, 236)), (1, (196, 214, 236))], (X + Y) / 2)
    img = to_img(a).convert('RGBA')
    rng = np.random.default_rng(4)
    pal = [(120, 200, 170), (250, 170, 180), (150, 170, 240), (250, 220, 140), (110, 180, 220)]
    for i in range(22):
        layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
        x, y = rng.uniform(0, S, 2); r = rng.uniform(80, 330)
        c = pal[i % len(pal)]
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (int(rng.uniform(60, 120)),))
        layer = blur_rgba(layer, rng.uniform(2, 30))
        img.alpha_composite(layer)
    return grain(img.convert('RGB'), 5, 4)


def copper_sun():
    a = grad([(0, (246, 196, 140)), (0.55, (222, 118, 70)), (1, (120, 44, 30))], Y)
    img = to_img(a).convert('RGBA')
    d = ImageDraw.Draw(img)
    cx, cy, r = S * 0.62, S * 0.36, S * 0.17
    sun = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(sun).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 238, 200, 255))
    img = glow(img, sun, 50); img.alpha_composite(sun)
    for i, (y0, amp, col) in enumerate([(0.62, 60, (176, 72, 44)), (0.72, 50, (140, 50, 34)), (0.83, 45, (96, 32, 26))]):
        xs = np.linspace(0, S, 200)
        ys = S * y0 + amp * np.sin(xs / S * np.pi * (1.3 + i * 0.4) + i * 1.7)
        ImageDraw.Draw(img).polygon(list(zip(xs, ys)) + [(S, S), (0, S)], fill=col + (255,))
    return grain(img.convert('RGB'), 9, 5)


def afterglow():
    a = grad([(0, (40, 20, 70)), (0.5, (190, 80, 140)), (0.75, (250, 160, 130)), (1, (255, 214, 170))], Y * 0.9 + 0.1 * np.sin(X * 3))
    img = to_img(a).convert('RGBA')
    blobs = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(blobs)
    d.ellipse([S * 0.05, S * 0.55, S * 0.75, S * 1.2], fill=(255, 120, 170, 140))
    d.ellipse([S * 0.45, S * 0.35, S * 1.1, S * 0.95], fill=(120, 80, 220, 120))
    blobs = blur_rgba(blobs, 120)
    img.alpha_composite(blobs)
    sun = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(sun)
    cx, cy, r = S * 0.5, S * 0.7, S * 0.2
    sd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 226, 190, 255))
    sd.rectangle([0, cy, S, S], fill=(0, 0, 0, 0))
    img = glow(img, sun, 60); img.alpha_composite(sun)
    sea = grad([(0, (120, 50, 120)), (1, (30, 12, 50))], (Y - 0.7) / 0.3)
    sea_img = to_img(sea).convert('RGBA'); m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rectangle([0, int(cy), S, S], fill=255)
    img.paste(sea_img, (0, 0), m)
    d = ImageDraw.Draw(img)
    for k in range(10):
        yy = cy + 12 + k * 26 + k * k * 1.5
        w = r * (1 - k / 11) * 1.1
        d.line([(cx - w, yy), (cx + w, yy)], fill=(255, 200, 170, int(200 * (1 - k / 10))), width=max(2, 8 - k // 2))
    return grain(img.convert('RGB'), 8, 6)


ART = {'midnight-drive': midnight_drive, 'tidal': tidal, 'signal-fire': signal_fire,
       'glass-gardens': glass_gardens, 'copper-sun': copper_sun, 'afterglow': afterglow}

if __name__ == '__main__':
    for k, f in ART.items():
        f().save(f'out/{k}.jpg', quality=92)
    sheet = Image.new('RGB', (3 * 466, 2 * 466))
    for i, k in enumerate(ART):
        sheet.paste(Image.open(f'out/{k}.jpg').resize((466, 466)), ((i % 3) * 466, (i // 3) * 466))
    sheet.save('out/contact.jpg')
