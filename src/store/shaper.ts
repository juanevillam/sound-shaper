import { create } from 'zustand';

import { EQ_BANDS, audioEngine } from '@/lib/audioEngine';

// The user's sound-shaping settings — the UI's source of truth. Every setter
// also pushes the change onto the live audio graph so it's heard immediately.
// Settings are global (not per-song), so shaping carries across the queue.

// Curated starting points. Gains are per-band dB in EQ_BANDS order
// (80 · 250 · 1k · 4k · 12k). `i18nKey` names the preset in the UI.
export const EQ_PRESETS: { i18nKey: string; gains: number[] }[] = [
  { i18nKey: 'flat', gains: [0, 0, 0, 0, 0] },
  { i18nKey: 'bass', gains: [9, 5, 0, 0, 1] },
  { i18nKey: 'vocal', gains: [-2, -1, 4, 3, 0] },
  { i18nKey: 'treble', gains: [0, 0, 1, 5, 8] },
  { i18nKey: 'warm', gains: [5, 3, 0, -2, -4] },
  { i18nKey: 'bright', gains: [-3, -1, 2, 5, 7] },
];

type ShaperState = {
  gains: number[]; // per-band, dB
  preamp: number; // dB
  activePreset: string | null; // i18nKey while gains match a preset, else null
  setBandGain: (index: number, db: number) => void;
  setPreamp: (db: number) => void;
  applyPreset: (i18nKey: string) => void;
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
  preamp: 0,
  activePreset: 'flat',

  setBandGain: (index, db) => {
    const gains = get().gains.slice();
    gains[index] = db;
    set({ gains, activePreset: matchPreset(gains) });
    audioEngine.setBandGain(index, db);
  },

  setPreamp: db => {
    set({ preamp: db });
    audioEngine.setPreamp(db);
  },

  applyPreset: i18nKey => {
    const preset = EQ_PRESETS.find(entry => entry.i18nKey === i18nKey);
    if (!preset) return;
    const gains = [...preset.gains];
    set({ gains, activePreset: i18nKey });
    audioEngine.apply(gains, get().preamp);
  },

  reset: () => {
    const gains = flat();
    set({ gains, preamp: 0, activePreset: 'flat' });
    audioEngine.apply(gains, 0);
  },

  isFlat: () => {
    const { gains, preamp } = get();
    return preamp === 0 && gains.every(db => db === 0);
  },
}));
