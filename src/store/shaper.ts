import { create } from 'zustand';

import { EQ_BANDS, audioEngine } from '@/lib/audioEngine';

// The user's sound-shaping settings — the UI's source of truth. Every setter
// also pushes the change onto the live audio graph so it's heard immediately.
// Settings are global (not per-sound), so shaping carries across the queue.

// ---------------------------------------------------------------------------
// Curated starting points. Gains are per-band dB in EQ_BANDS order
// (80 · 250 · 1k · 4k · 12k). `i18nKey` names the preset in the UI.
//
// THESE ARE LOUDNESS-MATCHED, AND THAT IS WHY THEY CUT AS WELL AS BOOST.
// The old set was boost-only — `bass` was [9, 5, 0, 0, 1] — which did two bad
// things at once. It clipped every modern master (measured: +7.56 dBFS on a
// limited master, and `treble` hit +8.24), and because a louder preset simply
// reads as a better one, comparing presets compared their volume rather than
// their tone: 3.38 LU apart, K-weighted over pink noise.
//
// Every curve here is a TILT around unity instead — the characteristic end goes
// up, the far end comes down — so it says the same thing tonally while asking
// for far less headroom. Measured with the same K-weighting, the five shaped
// presets now sit within 0.86 LU of each other, under the ~1 LU nobody can
// hear, and none of them clips.
//
// Two things NOT to re-derive when editing these:
//
//   · GAINS MUST BE WHOLE dB. The sliders step by 1 and `matchPreset` compares
//     for exact equality, so a fractional gain would be a preset the chip can
//     never show as selected.
//   · A LOW SHELF IS THE EXPENSIVE ONE. It costs its full boost in headroom and
//     buys almost no loudness back, because K-weighting discounts everything
//     under ~100 Hz. That is the whole reason `bass` is +3 and not +9 — the
//     tilt does the work, not the number.
// ---------------------------------------------------------------------------
export const EQ_PRESETS: { i18nKey: string; gains: number[] }[] = [
  { i18nKey: 'flat', gains: [0, 0, 0, 0, 0] },
  { i18nKey: 'bass', gains: [3, 2, 0, -1, -2] },
  { i18nKey: 'vocal', gains: [-4, -2, 2, 3, -2] },
  { i18nKey: 'treble', gains: [-2, -2, 0, 1, 4] },
  { i18nKey: 'warm', gains: [2, 2, -1, -3, -5] },
  { i18nKey: 'bright', gains: [-3, -2, 2, 4, 2] },
];

type ShaperState = {
  gains: number[]; // per-band, dB
  activePreset: string | null; // i18nKey while gains match a preset, else null
  /** Id of the user's saved shape currently applied, if any. */
  activeShapeId: string | null;
  setBandGain: (index: number, db: number) => void;
  applyPreset: (i18nKey: string) => void;
  /** Apply one of the user's saved shapes (its EQ curve). */
  applyShape: (shapeId: string, gains: number[]) => void;
  reset: () => void;
  isFlat: () => boolean;
};

const flat = (): number[] => EQ_BANDS.map(() => 0);
const sameGains = (a: number[], b: number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const matchPreset = (gains: number[]): string | null =>
  EQ_PRESETS.find(preset => sameGains(preset.gains, gains))?.i18nKey ?? null;

export const useShaperStore = create<ShaperState>()((set, get) => ({
  gains: flat(),
  activePreset: 'flat',
  activeShapeId: null,

  setBandGain: (index, db) => {
    const gains = get().gains.slice();
    gains[index] = db;
    // Hand-tweaking a band leaves whatever preset/shape was applied.
    set({ gains, activePreset: matchPreset(gains), activeShapeId: null });
    audioEngine.setBandGain(index, db);
  },

  applyPreset: i18nKey => {
    const preset = EQ_PRESETS.find(entry => entry.i18nKey === i18nKey);
    if (!preset) return;
    const gains = [...preset.gains];
    set({ gains, activePreset: i18nKey, activeShapeId: null });
    audioEngine.apply(gains);
  },

  applyShape: (shapeId, shapeGains) => {
    // A saved curve may predate a band change — pad/trim to today's bands.
    const gains = EQ_BANDS.map((_, index) => shapeGains[index] ?? 0);
    set({ gains, activePreset: matchPreset(gains), activeShapeId: shapeId });
    audioEngine.apply(gains);
  },

  reset: () => {
    const gains = flat();
    set({ gains, activePreset: 'flat', activeShapeId: null });
    audioEngine.apply(gains);
  },

  isFlat: () => get().gains.every(db => db === 0),
}));
