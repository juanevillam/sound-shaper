import sys, math
import numpy as np
from synth import *

SCALES = {
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'major': [0, 2, 4, 5, 7, 9, 11],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'mixo': [0, 2, 4, 5, 7, 9, 10],
}


def degree(root, scale, d):
    o, i = divmod(d, 7)
    return root + 12 * o + SCALES[scale][i]


def chord(root, scale, d, seventh=True):
    tones = [degree(root, scale, d + k) for k in (0, 2, 4)]
    if seventh:
        tones.append(degree(root, scale, d + 6))
    return tones


def render(spec, out):
    bpm = spec['bpm']; beat = 60 / bpm; bar = 4 * beat
    root, scale = spec['root'], spec['scale']
    prog = spec['prog']
    sections = spec['sections']
    nbars = sum(b for _, b, _ in sections)
    total = nbars * bar + 4
    n = int(total * SR)
    rng = RNG(spec['seed'])
    swing = spec.get('swing', 0.0)

    buses = {k: Bus(n) for k in ('drums', 'bass', 'pad', 'keys', 'arp', 'lead')}
    kick_times = []

    def sw(pos16):  # position in 16ths -> seconds offset with swing on odd 16ths
        base = pos16 * beat / 4
        if pos16 % 2 == 1:
            base += swing * beat / 4
        return base

    # melody motif: list of (16th pos, len16, scale step offset) over 2 bars
    def make_motif(r):
        notes = []; pos = 0
        steps = [0, 2, 4, 5, 4, 2, 1, 7, 6, 4]
        while pos < 32:
            ln = r.choice([2, 2, 4, 4, 6, 8, 3])
            if r.random() < 0.22:
                pos += ln; continue
            notes.append((pos, min(ln, 32 - pos), int(r.choice(steps))))
            pos += ln
        return notes

    motifA, motifB = make_motif(rng), make_motif(rng)

    bar_i = 0
    for sname, sbars, parts in sections:
        for sb in range(sbars):
            t0 = bar_i * bar
            d = prog[bar_i % len(prog)]
            ch = chord(root, scale, d)
            sect_pos = sb / max(sbars - 1, 1)
            # ---- pad
            if 'pad' in parts:
                for m in ch:
                    buses['pad'].add(pad(m + 12, bar, spec.get('padfc', 2000)), t0, 0.16, pan=rng.uniform(-.5, .5))
            # ---- keys
            if 'keys' in parts:
                hits = spec.get('keyhits', [0, 6, 10])
                for h in hits:
                    for j, m in enumerate(ch):
                        buses['keys'].add(keys(m + 12, beat * 1.5), t0 + sw(h), 0.13, pan=-0.3 + 0.2 * j)
            # ---- arp
            if 'arp' in parts:
                tones = ch + [c + 12 for c in ch]
                order = tones + tones[::-1][1:-1]
                fc = 1500 + 3500 * (sect_pos if sname == 'intro' else 1)
                step = spec.get('arpstep', 1)
                for k in range(0, 16, step):
                    m = order[(bar_i * 16 + k) // step % len(order)] + 12
                    buses['arp'].add(pluck(m, beat / 4 * step, fc), t0 + sw(k), 0.12, pan=0.5 * math.sin(k))
            # ---- bass
            if 'bass' in parts:
                bm = ch[0] - 12
                style = spec['bassstyle']
                if style == 'eighths':
                    pat = [(k * 2, 2, 0) for k in range(8)]
                elif style == 'offbeat':
                    pat = [(k * 4 + 2, 2, 0) for k in range(4)]
                elif style == 'dembow':
                    pat = [(0, 3, 0), (3, 3, 0), (6, 2, 7), (8, 3, 0), (11, 3, 0), (14, 2, 7)]
                elif style == 'lofi':
                    pat = [(0, 6, 0), (7, 3, 0), (10, 4, 7), (14, 2, 10)]
                else:
                    pat = [(0, 16, 0)]
                for p, ln, iv in pat:
                    buses['bass'].add(bass(bm + iv, ln * beat / 4 * 0.9, spec.get('basskind', 'saw'), spec.get('bassfc', 500)), t0 + sw(p), 0.42)
            # ---- lead
            if 'lead' in parts:
                motif = motifA if (bar_i // 2) % 4 != 2 else motifB
                half = bar_i % 2
                for p, ln, st in motif:
                    if p // 16 != half:
                        continue
                    base_deg = d + st
                    m = degree(root, scale, base_deg) + 12 + spec.get('leadoct', 12)
                    buses['lead'].add(lead(m, ln * beat / 4 * 0.95, spec.get('leadkind', 'sq'), spec.get('leadfc', 3000)), t0 + sw(p - 16 * half), 0.15, pan=0.1)
            # ---- drums
            if 'drums' in parts or 'hats' in parts:
                ds = spec['drums']
                full = 'drums' in parts
                fill = sb == sbars - 1 and full
                for k in range(16):
                    t = t0 + sw(k)
                    if ds == 'four':
                        if full and k % 4 == 0: buses['drums'].add(kick(), t, 0.9); kick_times.append(t)
                        if full and k in (4, 12): buses['drums'].add(clap(), t, 0.5)
                        if k % 4 == 2: buses['drums'].add(hat(True), t, 0.18, 0.2)
                        buses['drums'].add(hat(), t, 0.10 if k % 2 else 0.06, -0.2)
                    elif ds == 'synthwave':
                        if full and k in (0, 8, 10): buses['drums'].add(kick(), t, 0.9); kick_times.append(t)
                        if full and k in (4, 12): buses['drums'].add(snare(), t, 0.6)
                        if k % 2 == 0: buses['drums'].add(hat(), t, 0.10, 0.25)
                    elif ds == 'lofi':
                        if full and k in (0, 7, 10): buses['drums'].add(kick(0.6), t, 0.75); kick_times.append(t)
                        if full and k in (4, 12): buses['drums'].add(snare(7), t, 0.4)
                        if k % 2 == 0: buses['drums'].add(hat(seed=11), t, 0.07 if k % 4 else 0.11, 0.2)
                        if full and k == 14 and bar_i % 2: buses['drums'].add(rim(), t, 0.25, -0.4)
                    elif ds == 'dembow':
                        if full and k % 4 == 0: buses['drums'].add(kick(), t, 0.85); kick_times.append(t)
                        if full and k in (3, 6, 11, 14): buses['drums'].add(snare(8), t, 0.42)
                        if k % 2 == 0: buses['drums'].add(shaker(), t, 0.10, 0.3)
                        if full and k in (3, 11): buses['drums'].add(rim(), t, 0.18, -0.3)
                    elif ds == 'sparse':
                        if full and k in (0, 10): buses['drums'].add(kick(0.5), t, 0.6); kick_times.append(t)
                        if full and k == 8: buses['drums'].add(rim(), t, 0.2, 0.3)
                        if k % 4 == 2: buses['drums'].add(shaker(), t, 0.06, -0.3)
                    if fill and k >= 12 and ds in ('four', 'synthwave'):
                        buses['drums'].add(snare(9 + k), t + beat / 8, 0.25)
            bar_i += 1

    # sidechain duck
    duck = np.ones(n)
    if spec.get('sidechain'):
        dn = int(0.22 * SR); shape = 1 - spec['sidechain'] * (1 - np.linspace(0, 1, dn) ** 0.6)
        for kt in kick_times:
            i = int(kt * SR); j = min(i + dn, n)
            duck[i:j] = np.minimum(duck[i:j], shape[: j - i])

    L = np.zeros(n); R = np.zeros(n)
    gains = spec.get('gains', {})
    send = {'pad': 0.5, 'keys': 0.35, 'arp': 0.3, 'lead': 0.35, 'drums': 0.08, 'bass': 0.0}
    revL = np.zeros(n); revR = np.zeros(n)
    for k, b in buses.items():
        g = gains.get(k, 1.0)
        dk = duck if k in ('pad', 'bass', 'arp', 'keys') else 1.0
        bl, br = b.L * g * dk, b.R * g * dk
        L += bl; R += br
        revL += bl * send[k]; revR += br * send[k]
        if k in ('lead', 'arp') and spec.get('delay'):
            dl, dr = delay(bl, br, beat, 0.4, spec['delay'])
            L += dl; R += dr
    rl, rr = reverb(revL, revR, spec.get('verb', 2.4), spec['seed'])
    L += rl * 0.9; R += rr * 0.9
    # gentle master tone: highpass rumble
    L = hp(L, 28); R = hp(R, 28)
    # fades
    fi = int(1.0 * SR); fo = int(6 * SR)
    L[:fi] *= np.linspace(0, 1, fi); R[:fi] *= np.linspace(0, 1, fi)
    end = int((nbars * bar + 3.5) * SR)
    L = L[:end]; R = R[:end]
    L[-fo:] *= np.linspace(1, 0, fo) ** 1.5; R[-fo:] *= np.linspace(1, 0, fo) ** 1.5
    write_wav(out, L, R)
    return len(L) / SR


SONGS = {
    'midnight-drive': dict(seed=11, bpm=100, root=45, scale='minor', prog=[0, 5, 2, 6],
        drums='synthwave', bassstyle='eighths', basskind='saw', bassfc=700, sidechain=0.5,
        leadkind='sq', leadfc=2600, delay=0.5, padfc=2400, verb=2.8,
        sections=[('intro', 8, {'pad', 'arp'}), ('verse', 16, {'pad', 'arp', 'bass', 'drums'}),
                  ('chorus', 16, {'pad', 'arp', 'bass', 'drums', 'lead'}), ('break', 8, {'pad', 'lead'}),
                  ('chorus', 16, {'pad', 'arp', 'bass', 'drums', 'lead'}), ('outro', 8, {'pad', 'arp', 'hats'})]),
    'tidal': dict(seed=22, bpm=80, root=50, scale='dorian', prog=[1, 4, 0, 3], swing=0.33,
        drums='lofi', bassstyle='lofi', basskind='sine', keyhits=[0, 3, 10], leadkind='sine', leadfc=2200, leadoct=0,
        padfc=1400, verb=2.0, gains={'keys': 1.4},
        sections=[('intro', 4, {'keys', 'pad'}), ('verse', 16, {'keys', 'bass', 'drums'}),
                  ('chorus', 16, {'keys', 'bass', 'drums', 'lead', 'pad'}), ('break', 4, {'keys', 'pad', 'hats'}),
                  ('chorus', 16, {'keys', 'bass', 'drums', 'lead'}), ('outro', 4, {'keys', 'pad'})]),
    'signal-fire': dict(seed=33, bpm=122, root=48, scale='minor', prog=[0, 0, 5, 3], drums='four',
        bassstyle='offbeat', basskind='saw', bassfc=900, sidechain=0.7, keyhits=[2, 6, 10, 14],
        leadkind='saw', leadfc=3500, delay=0.4, padfc=3000,
        sections=[('intro', 16, {'hats', 'arp'}), ('verse', 16, {'drums', 'bass', 'keys'}),
                  ('chorus', 16, {'drums', 'bass', 'keys', 'lead', 'pad'}), ('break', 8, {'pad', 'arp'}),
                  ('chorus', 24, {'drums', 'bass', 'keys', 'lead', 'arp'}), ('outro', 8, {'drums', 'hats'})]),
    'glass-gardens': dict(seed=44, bpm=90, root=52, scale='major', prog=[0, 4, 5, 3], arpstep=2,
        drums='sparse', bassstyle='roots', basskind='sine', leadkind='tri', leadfc=4000, delay=0.6,
        padfc=2600, verb=3.5, gains={'arp': 1.3},
        sections=[('intro', 8, {'pad', 'arp'}), ('verse', 16, {'pad', 'arp', 'bass', 'drums'}),
                  ('chorus', 16, {'pad', 'arp', 'bass', 'drums', 'lead'}), ('break', 8, {'pad'}),
                  ('chorus', 12, {'pad', 'arp', 'bass', 'drums', 'lead'}), ('outro', 8, {'pad', 'arp'})]),
    'copper-sun': dict(seed=55, bpm=94, root=53, scale='minor', prog=[0, 5, 6, 4], drums='dembow',
        bassstyle='dembow', basskind='sine', keyhits=[0, 3, 6, 8, 11, 14], leadkind='sine', leadfc=3000,
        delay=0.35, padfc=1800,
        sections=[('intro', 8, {'keys', 'hats'}), ('verse', 16, {'keys', 'bass', 'drums'}),
                  ('chorus', 16, {'keys', 'bass', 'drums', 'lead', 'pad'}), ('break', 8, {'pad', 'lead'}),
                  ('chorus', 16, {'keys', 'bass', 'drums', 'lead'}), ('outro', 4, {'keys'})]),
    'afterglow': dict(seed=66, bpm=86, root=49, scale='mixo', prog=[0, 6, 3, 0], swing=0.2,
        drums='lofi', bassstyle='lofi', basskind='saw', bassfc=420, keyhits=[0, 7, 12], leadkind='tri',
        leadfc=2400, delay=0.5, padfc=1600, verb=3.0,
        sections=[('intro', 8, {'pad', 'keys'}), ('verse', 16, {'pad', 'keys', 'bass', 'drums'}),
                  ('chorus', 16, {'pad', 'keys', 'bass', 'drums', 'lead'}), ('break', 8, {'pad', 'arp'}),
                  ('chorus', 12, {'pad', 'keys', 'bass', 'drums', 'lead', 'arp'}), ('outro', 4, {'pad'})]),
}

if __name__ == '__main__':
    for name in sys.argv[1:] or SONGS:
        secs = render(SONGS[name], f'out/{name}.wav')
        print(name, f'{int(secs // 60)}:{int(secs % 60):02d}')
