"""Tiny offline synth: renders original ~3-minute tracks to WAV.

Everything here is composed procedurally from seeded randomness, so the
output is original material with no third-party samples.
"""
import sys, json, wave
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
RNG = np.random.default_rng


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    a = max(a, 1); d = max(d, 1); r = max(r, 1)
    sus = max(n - a - d - r, 0)
    e = np.concatenate([
        np.linspace(0, 1, a, endpoint=False),
        np.linspace(1, s, d, endpoint=False),
        np.full(sus, s),
        np.linspace(s, 0, r),
    ])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    b, a = butter(order, fc / (SR / 2), 'low')
    return lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'high')
    return lfilter(b, a, x)


def bp(x, lo, hi):
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return lfilter(b, a, x)


def saw(f, t, ph=0.0):
    return 2 * ((f * t + ph) % 1.0) - 1


def sq(f, t, pw=0.5):
    return np.where((f * t) % 1.0 < pw, 1.0, -1.0)


def tri(f, t):
    return 2 * np.abs(saw(f, t)) - 1


# ---------- instruments: each returns a mono array for one note ----------

def pad(m, dur, bright=2200):
    rel = 1.2
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    f = mtof(m)
    x = sum(saw(f * (1 + d), t, ph) for d, ph in [(-0.006, .1), (0, .5), (0.007, .8)]) / 3
    x += 0.4 * np.sin(2 * np.pi * f / 2 * t)
    x = lp(x, bright)
    return x * env(n, 0.6, 0.5, 0.75, rel)


def keys(m, dur, bright=1.0):
    rel = 0.4
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    f = mtof(m)
    mod = np.sin(2 * np.pi * f * 2 * t) * 1.6 * bright * np.exp(-t * 3)
    x = np.sin(2 * np.pi * f * t + mod)
    x += 0.25 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 6)
    return x * env(n, 0.005, 1.2, 0.35, rel) * np.exp(-t * 0.6)


def pluck(m, dur, bright=3500):
    rel = 0.25
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    f = mtof(m)
    x = 0.6 * saw(f, t) + 0.4 * sq(f * 1.003, t, 0.3)
    # filter sweep down: blend of bright and dark
    a = lp(x, bright); b = lp(x, 600)
    k = np.exp(-t * 9)
    x = a * k + b * (1 - k)
    return x * env(n, 0.003, 0.25, 0.25, rel)


def bass(m, dur, kind='saw', fc=500):
    rel = 0.08
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    f = mtof(m)
    if kind == 'sine':
        x = np.sin(2 * np.pi * f * t) + 0.15 * np.sin(2 * np.pi * 2 * f * t)
        x = np.tanh(1.5 * x)
    else:
        x = 0.7 * saw(f, t) + 0.5 * np.sin(2 * np.pi * f / 2 * t)
        x = lp(x, fc)
    return x * env(n, 0.004, 0.15, 0.8, rel)


def lead(m, dur, kind='sq', fc=3000):
    rel = 0.25
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 3, 0, 1)
    f = mtof(m) * vib
    ph = np.cumsum(f) / SR
    if kind == 'sq':
        x = np.where(ph % 1 < 0.5, 1.0, -1.0) * 0.6 + (2 * (ph % 1) - 1) * 0.4
    elif kind == 'tri':
        x = 2 * np.abs(2 * (ph % 1) - 1) - 1
    else:
        x = np.sin(2 * np.pi * ph) + 0.3 * np.sin(4 * np.pi * ph)
    x = lp(x, fc)
    return x * env(n, 0.02, 0.2, 0.7, rel)


def kick(punch=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 30) * punch
    ph = np.cumsum(f) / SR
    x = np.sin(2 * np.pi * ph) * np.exp(-t * 7)
    click = RNG(1).standard_normal(n) * np.exp(-t * 400) * 0.3
    return np.tanh(1.8 * (x + click))


def snare(seed=2):
    n = int(0.3 * SR); t = np.arange(n) / SR
    noise = bp(RNG(seed).standard_normal(n), 1200, 8000) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return 0.8 * noise + 0.6 * tone


def clap(seed=3):
    n = int(0.35 * SR); t = np.arange(n) / SR
    base = bp(RNG(seed).standard_normal(n), 900, 5000)
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):
        k = int(off * SR)
        e[k:] += np.exp(-(t[: n - k]) * 60)
    e += 0.6 * np.exp(-t * 12)
    return base * e * 0.7


def hat(open_=False, seed=4):
    n = int((0.35 if open_ else 0.06) * SR); t = np.arange(n) / SR
    x = hp(RNG(seed).standard_normal(n), 7000)
    return x * np.exp(-t * (9 if open_ else 70))


def shaker(seed=5):
    n = int(0.09 * SR); t = np.arange(n) / SR
    x = bp(RNG(seed).standard_normal(n), 4000, 12000)
    return x * np.sin(np.pi * np.clip(t / 0.09, 0, 1)) ** 2


def rim(seed=6):
    n = int(0.08 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) + 0.5 * bp(RNG(seed).standard_normal(n), 2000, 6000)) * np.exp(-t * 60)


# ---------- mixing ----------

class Bus:
    def __init__(self, n):
        self.L = np.zeros(n); self.R = np.zeros(n)

    def add(self, x, start_s, gain=1.0, pan=0.0):
        i = int(start_s * SR)
        if i >= len(self.L):
            return
        x = x[: len(self.L) - i] * gain
        l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
        self.L[i:i + len(x)] += x * l * 1.414
        self.R[i:i + len(x)] += x * r * 1.414


def reverb(L, R, size=2.2, seed=9):
    n = int(size * SR); t = np.arange(n) / SR
    rng = RNG(seed)
    irL = rng.standard_normal(n) * np.exp(-t * 6.9 / size)
    irR = rng.standard_normal(n) * np.exp(-t * 6.9 / size)
    irL = lp(irL, 5000); irR = lp(irR, 5000)
    irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
    return fftconvolve(L, irL)[: len(L)], fftconvolve(R, irR)[: len(R)]


def delay(L, R, beat_s, fb=0.35, mix=1.0):
    d = int(beat_s * 0.75 * SR)
    oL = np.zeros_like(L); oR = np.zeros_like(R)
    g = 1.0; k = 1
    while g > 0.03 and d * k < len(L):
        g *= fb
        sh = d * k
        src_l, src_r = (R, L) if k % 2 else (L, R)
        oL[sh:] += src_l[:-sh] * g; oR[sh:] += src_r[:-sh] * g
        k += 1
    return oL * mix, oR * mix


def write_wav(path, L, R):
    x = np.stack([L, R], axis=1)
    pk = np.abs(x).max()
    print(f'raw peak {pk:.2f}')
    # set the 99.9th-percentile level to 0.8 so only rare peaks hit the soft knee
    ref = np.percentile(np.abs(x), 99.9)
    x = x / ref * 0.8
    x = np.tanh(x)
    x /= np.abs(x).max() / 0.89
    data = (x * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)
