import { create } from 'zustand';

import { EQ_BANDS, audioEngine } from '@/lib/audioEngine';

// The user's sound-shaping settings — the UI's source of truth. Every setter
// also pushes the change onto the live audio graph so it's heard immediately.
// Settings are global (not per-sound), so shaping carries across the queue.
//
// NOTHING HERE IS PERSISTED, and SAVED SHAPES ARE GONE (2026-08-22). A shape
// was a named config — the curve plus rate and keep-pitch — stored at
// `users/{uid}/shapes` and applied from the Shape sheet; creating and deleting
// them was pulled to make that sheet one thing (presets, EQ, speed, pitch) and
// to stop maintaining a feature nobody had asked for yet. The Firestore
// documents of anyone who saved one are LEFT ALONE — the rules and the
// delete-account sweep still name the subcollection, so old data still gets
// cleaned up on account deletion; nothing reads it. If it comes back after a
// release, the shape of it is in git.

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
  /**
   * Next Room — the sound heard through a wall. It lives HERE rather than in
   * the player store, beside `rate` and `keepPitch`, because it is shaping: it
   * is applied by `audioEngine`, it is what the Shape summary reports, and it
   * is user-scoped in exactly the way the curve is (see `reset`). The two in
   * the player store are there because the TRANSPORT reads them — a rate is
   * published to the system now-playing session, and a wall is not.
   */
  nextRoom: boolean;
  /**
   * Echo — the repeats. It is INDEPENDENT of `nextRoom`
   * rather than exclusive with it (Juan's call, 2026-09-17): the two act on
   * different axes, a wall on frequency and repeats on time, and a party down a
   * hallway genuinely has both. A switch that silently turns another one off is
   * a rule you can only learn by watching it happen.
   */
  echo: boolean;
  setBandGain: (index: number, db: number) => void;
  applyPreset: (i18nKey: string) => void;
  setNextRoom: (on: boolean) => void;
  setEcho: (on: boolean) => void;
  /** Back to flat — sign-out and account wipe. See `reset` below. */
  reset: () => void;
};

const flat = (): number[] => EQ_BANDS.map(() => 0);
const sameGains = (a: number[], b: number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const matchPreset = (gains: number[]): string | null =>
  EQ_PRESETS.find(preset => sameGains(preset.gains, gains))?.i18nKey ?? null;

export const useShaperStore = create<ShaperState>()((set, get) => ({
  gains: flat(),
  activePreset: 'flat',
  nextRoom: false,
  echo: false,

  setBandGain: (index, db) => {
    const gains = get().gains.slice();
    gains[index] = db;
    // Hand-tweaking a band leaves whatever preset was applied.
    set({ gains, activePreset: matchPreset(gains) });
    audioEngine.setBandGain(index, db);
  },

  setNextRoom: on => {
    set({ nextRoom: on });
    audioEngine.setNextRoom(on);
  },

  setEcho: on => {
    set({ echo: on });
    audioEngine.setEcho(on);
  },

  applyPreset: i18nKey => {
    const preset = EQ_PRESETS.find(entry => entry.i18nKey === i18nKey);
    if (!preset) return;
    const gains = [...preset.gains];
    set({ gains, activePreset: i18nKey });
    audioEngine.apply(gains);
  },

  /**
   * THE CURVE IS USER-SCOPED, AND FORGETTING THAT HANDED SOMEONE ELSE'S
   * TROPHY OUT.
   *
   * Nothing here is persisted, so this survives only until the process dies —
   * but a sign-out and sign-in inside one session is exactly the window that
   * matters. `useTrophyTriggers` awards `first-shape` on
   * `rate !== 1 || gains.some(gain => gain !== 0)`, and the two halves of that
   * test were cleaned up differently: `rate` lives in the player store, which
   * the auth listener already reset, while `gains` lives here and was reset by
   * nobody. So account A dragged a band or picked a preset, signed out, and
   * account B was awarded First Shape off A's activity the moment its trophies
   * hydrated. Same class as the two persisted counters in 0f5260d and Topper's
   * recent searches — a device-local cache is not a device-local FACT.
   *
   * `audioEngine.apply` rather than a bare `set`, because the engine keeps its
   * OWN copy of the curve (`settings.gains`, module scope, so a freshly built
   * graph inherits the current shaping) and that copy is just as user-scoped.
   * It is safe with no graph standing: `apply` writes the module settings
   * before `pushSettings` returns early.
   *
   * IT WAS DELETED FOR HAVING NO CALLERS six hours before the sibling resets
   * were added (1bd1895, then 0f5260d) — the two passes crossed, and "uncalled"
   * turned out to mean "missing a call site" rather than "dead".
   */
  reset: () => {
    const gains = flat();
    set({ gains, activePreset: 'flat', nextRoom: false, echo: false });
    // `nextRoom` is passed EXPLICITLY, because `apply` leaves it alone when
    // omitted (a preset must not walk you out of the room). Reset is the one
    // caller that means both — it is the same user-scoping argument the curve
    // makes below, and the engine holds its own copy of this too.
    audioEngine.apply(gains, false, false);
  },
}));
