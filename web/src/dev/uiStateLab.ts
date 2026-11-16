import { create } from 'zustand';

import { STATE_LAB } from './flags';

/**
 * DEV-ONLY LAB — Web counterpart to `sound-shaper/src/dev/uiStateLab.ts`.
 * Forces a surface's UI states so they can be stepped one after another in
 * the same run. Never active in production builds.
 */
export const UI_STATE_LAB = import.meta.env.DEV && STATE_LAB;

export type HomeState = 'live' | 'skeleton' | 'error';
export type ClipsState = 'live' | 'empty';
export type AccountState = 'live' | 'skeleton' | 'deleting';
export type TrophiesState = 'live' | 'skeleton';

export type LabScreen = 'home' | 'clips' | 'account' | 'trophies';

type Labelled<T extends string> = { value: T; label: string; note: string };

export const HOME_STATES: readonly Labelled<HomeState>[] = [
  {
    value: 'live',
    label: 'Live',
    note: 'Real data — lab off for this screen.',
  },
  {
    value: 'skeleton',
    label: 'First-load skeleton',
    note: '8 tile bones in the sound grid. Row 2 must start where live does.',
  },
  {
    value: 'error',
    label: 'Library error',
    note: 'The sounds subscription failed. Centred error state with retry.',
  },
];

export const CLIPS_STATES: readonly Labelled<ClipsState>[] = [
  {
    value: 'live',
    label: 'Live',
    note: 'Real clips list for the current sound.',
  },
  {
    value: 'empty',
    label: 'No clips',
    note: 'Scissors glyph + empty state in place of Repeat and the clips card.',
  },
];

export const ACCOUNT_STATES: readonly Labelled<AccountState>[] = [
  {
    value: 'live',
    label: 'Live',
    note: 'Real data — lab off for this sheet.',
  },
  {
    value: 'skeleton',
    label: 'Skeleton',
    note: 'Labels real, Member Since redacted as a bone while the Firestore profile is in flight.',
  },
  {
    value: 'deleting',
    label: 'Deleting Account',
    note: 'Sealed with full-screen busy scrim while deletion runs; nothing must dismiss it.',
  },
];

export const TROPHIES_STATES: readonly Labelled<TrophiesState>[] = [
  {
    value: 'live',
    label: 'Live',
    note: 'Real data — lab off for this sheet.',
  },
  {
    value: 'skeleton',
    label: 'Skeleton',
    note: 'Ring, both figures, and every row are bones. Ring centre and card top match Live.',
  },
];

type LabStore = {
  home: HomeState;
  clips: ClipsState;
  account: AccountState;
  trophies: TrophiesState;
  setHome: (state: HomeState) => void;
  setClips: (state: ClipsState) => void;
  setAccount: (state: AccountState) => void;
  setTrophies: (state: TrophiesState) => void;
  resetAll: () => void;
};

export const useUiStateLab = create<LabStore>(set => ({
  home: 'live',
  clips: 'live',
  account: 'live',
  trophies: 'live',
  setHome: home => set({ home }),
  setClips: clips => set({ clips }),
  setAccount: account => set({ account }),
  setTrophies: trophies => set({ trophies }),
  resetAll: () =>
    set({
      home: 'live',
      clips: 'live',
      account: 'live',
      trophies: 'live',
    }),
}));
