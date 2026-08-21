import { create } from 'zustand';

import { SKELETON_ROWS } from '@/app/(app)/home';
import {
  BANNER_BOTTOM_GAP_IOS,
  MINI_PLAYER_HEIGHT,
} from '@/components/player/bannerMetrics';
import { STATE_LAB } from '@/dev/flags';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DEV-ONLY LAB — the state picker's data. The PICKER itself is the package's
 *  (`StateLab` in `@portfolio/mobile-ui`), shared with Topper.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Forces a surface's UI states so they can be SEEN and pixel-measured rather
 * than reasoned about — and, more to the point, stepped one after another in
 * the same run, which is how nearly every layout-shift defect in this repo has
 * been found.
 *
 * Each screen applies its forced state to the values it ALREADY derives, so
 * what renders is the real branch and not a mock of it. `live` disables the lab
 * for that surface.
 *
 * THREE SURFACES, and the omissions are deliberate. The player's Shape and
 * Clips sheets have states worth looking at (no saved shapes, no clips) but
 * every one of them is reachable by hand in a second, and a pinnable state that
 * duplicates a surface's own resting state is noise in the picker.
 */
export const UI_STATE_LAB = __DEV__ && STATE_LAB;

/**
 * What floats at the bottom of HOME — the player banner, not a tab bar, so the
 * dev controls cannot take the shared picker's default clearance. Its own
 * constants rather than a guessed number: the banner is a detached pill, so
 * clearing it means its bottom gap plus its height. It lives here rather than
 * in either bar because BOTH dev controls on this screen stack on it.
 */
export const HOME_LAB_BOTTOM_OFFSET =
  MINI_PLAYER_HEIGHT + BANNER_BOTTOM_GAP_IOS;

/**
 * HOME — the song grid.
 *
 * NO EMPTY STATE to pin: the Add Sound tile is the grid's first cell whether or
 * not there are songs, so "no songs" is simply the grid with one tile in it and
 * needs no branch.
 */
export type HomeState = 'live' | 'skeleton' | 'error';

/**
 * THE ACCOUNT SHEET (`manage-account`).
 *
 * THREE STATES, not four. Its facts come from stores that are already live by
 * the time the sheet can be opened, so there is no error branch and no empty
 * one — a signed-out person cannot reach it at all. What it DOES have is the
 * window where the Firestore profile has not landed and Member Since stands a
 * bone, which is the one thing worth stepping: the card must be its settled
 * height before the value fills in.
 *
 * `deleting` is here because it is the ONE state on this sheet that cannot be
 * reached by hand — seeing it for real means deleting the account. Pinning it
 * is the only way to check the blocking overlay, and, more to the point, that
 * the sheet genuinely cannot be dismissed while it stands, which is the half a
 * screenshot does not prove.
 */
export type AccountState = 'live' | 'skeleton' | 'deleting';

/**
 * TROPHIES. Two states: the list is local and cannot fail or be empty (the
 * config always has rows), so the only branch is the pre-hydration one — where
 * every trophy would otherwise render LOCKED at "0 of 7". That is the state to
 * look at, since it is the one a cold open actually shows.
 */
export type TrophiesState = 'live' | 'skeleton';

/**
 * WHICH SURFACE A PICKER IS SHOWING. Defined here rather than in the bar
 * because three files need it and only one can own the bar: `UiStateLabBar.ios`
 * renders it, its Android stub types against it (the checker never applies the
 * `.ios` suffix), and `SheetScreenIos` takes it as a prop.
 */
export type LabScreen = 'home' | 'account' | 'trophies';

type Labelled<T> = { value: T; label: string; note: string };

export const HOME_STATES: Labelled<HomeState>[] = [
  {
    value: 'live',
    label: 'Live',
    note: 'Real data — lab off for this screen.',
  },
  {
    value: 'skeleton',
    label: 'First-load skeleton',
    /**
     * COUNTED, NOT RESTATED. This note said "three tile bones", then "two full
     * rows", then "three full rows" inside one sitting, and was stale at every
     * step — prose about a number rots the moment the number moves. It reads
     * `SKELETON_ROWS` now, so the two cannot disagree.
     */
    note: `${SKELETON_ROWS} full rows, the last running off the bottom. Row 2 must start where live does — band-scan both.`,
  },
  {
    value: 'error',
    label: 'Library error',
    note: 'The songs subscription failed. ContentUnavailableView, centred, with retry.',
  },
];

export const ACCOUNT_STATES: Labelled<AccountState>[] = [
  {
    value: 'live',
    label: 'Live',
    note: 'Real data — lab off for this sheet.',
  },
  {
    value: 'skeleton',
    label: 'Skeleton',
    note: 'Labels real, values redacted. All three rows must stand, at the settled height — Member Since arrives late.',
  },
  {
    value: 'deleting',
    label: 'Deleting Account',
    note: 'Sheet sealed: scrim + spinner, no ✕ and no swipe. Try dismissing it — nothing must work.',
  },
];

export const TROPHIES_STATES: Labelled<TrophiesState>[] = [
  {
    value: 'live',
    label: 'Live',
    note: 'Real data — lab off for this sheet.',
  },
  {
    value: 'skeleton',
    label: 'Skeleton',
    note: 'Ring, both figures and every row are bones. Ring centre and card top must match Live exactly.',
  },
];

type LabStore = {
  account: AccountState;
  home: HomeState;
  trophies: TrophiesState;
  setAccount: (state: AccountState) => void;
  setHome: (state: HomeState) => void;
  setTrophies: (state: TrophiesState) => void;
};

export const useUiStateLab = create<LabStore>(set => ({
  account: 'live',
  home: 'live',
  trophies: 'live',
  setAccount: account => set({ account }),
  setHome: home => set({ home }),
  setTrophies: trophies => set({ trophies }),
}));
