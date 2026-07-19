import { create } from 'zustand';

import { EQ_BANDS, audioEngine } from '@/lib/audioEngine';

// The user's sound-shaping settings — the UI's source of truth. Every setter
// also pushes the change onto the live audio graph so it's heard immediately.
// Settings are global (not per-song), so shaping carries across the queue.

type ShaperState = {
  gains: number[]; // per-band, dB
  preamp: number; // dB
  setBandGain: (index: number, db: number) => void;
  setPreamp: (db: number) => void;
  reset: () => void;
  isFlat: () => boolean;
};

const flat = (): number[] => EQ_BANDS.map(() => 0);

export const useShaperStore = create<ShaperState>()((set, get) => ({
  gains: flat(),
  preamp: 0,

  setBandGain: (index, db) => {
    const gains = get().gains.slice();
    gains[index] = db;
    set({ gains });
    audioEngine.setBandGain(index, db);
  },

  setPreamp: db => {
    set({ preamp: db });
    audioEngine.setPreamp(db);
  },

  reset: () => {
    const gains = flat();
    set({ gains, preamp: 0 });
    audioEngine.apply(gains, 0);
  },

  isFlat: () => {
    const { gains, preamp } = get();
    return preamp === 0 && gains.every(db => db === 0);
  },
}));
