import { create } from 'zustand';

import { SKELETON_ROWS } from '@/app/(app)/home';
import {
  BANNER_BOTTOM_GAP,
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
 * THREE SURFACES ON BOTH PLATFORMS, and the omissions are deliberate. The player's Clips sheet
 * has a state worth looking at (no clips) but it is reachable by hand in a
 * second, and a pinnable state that duplicates a surface's own resting state is
 * noise in the picker. The Shape sheet has no states at all — every control on
 * it is always there.
 */
export const UI_STATE_LAB = __DEV__ && STATE_LAB;

/**
 * What floats at the bottom of HOME — the player banner, not a tab bar, so the
 * dev controls cannot take the shared picker's default clearance. Its own
 * constants rather than a guessed number: the banner is a detached pill, so
 * clearing it means its bottom gap plus its height. It lives here rather than
 * in either bar because BOTH dev controls on this screen stack on it.
 *
 * THE GAP IS PER-PLATFORM and this used to take the iOS one on both, because
 * the picker was iOS-only. Android's banner floats 16 above the navigation bar
 * against iOS's 8, so the offset differs by exactly that.
 */
export const HOME_LAB_BOTTOM_OFFSET = MINI_PLAYER_HEIGHT + BANNER_BOTTOM_GAP;

/**
 * HOME — the sound grid.
 *
 * NO EMPTY STATE to pin: the Add Sound tile is the grid's first cell whether or
 * not there are sounds, so "no sounds" is simply the grid with one tile in it and
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
 * is the only way to check the blocking, and, more to the point, that the
 * surface genuinely cannot be dismissed while it stands, which is the half a
 * screenshot does not prove.
 *
 * WHAT IT PINS DIFFERS BY PLATFORM, because the blocking does: iOS's
 * `UIAlertController` cannot go busy, so the scrim and spinner live on the
 * SHEET, while Android's confirm dialog is Compose and holds its own busy
 * state. Same job, each in its own language (AGENTS.md) — so the note below
 * names the shared promise rather than either one's furniture.
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
 * THE EXPANDED PLAYER'S REACTIVE LIGHT — a VARIANT picker, not a state one,
 * and the one place in this lab where that is true.
 *
 * Juan asked for a background that answers to the music and rejected the first
 * two attempts on sight (invisible, then messy — `PlayerBloom` carries both
 * post-mortems). Rather than guess a third time, the two surviving candidates
 * are both built and switched here so they can be compared on the real screen,
 * against real music, one after the other — which is exactly what this lab is
 * for, even though what it pins is a treatment rather than a branch.
 *
 * `live` is the app as it ships: the static wash, no reactive light at all. It
 * stays the default until Juan picks, so nothing here can leak into a release
 * before that decision — and if he picks neither, `live` is already the answer.
 */
export type PlayerState = 'live' | 'artwork' | 'edges';

/**
 * WHICH SURFACE A PICKER IS SHOWING. Defined here rather than in the bar
 * because several files need it and only one can own the bar: `UiStateLabBar`
 * renders it (one cross-platform file — the `.ios` twin and its Android stub
 * this used to name are both gone), `SheetScreenIos` takes it as a prop on
 * iOS, and the two Android routes that are pushed screens rather than sheets
 * mount it themselves.
 */
export type LabScreen = 'home' | 'account' | 'trophies' | 'player';

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
    note: 'The sounds subscription failed. ContentUnavailableView, centred, with retry.',
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
    note: 'Sealed while it runs — iOS a scrim over the sheet, Android a busy dialog. Try dismissing it; nothing must work.',
  },
];

export const PLAYER_STATES: Labelled<PlayerState>[] = [
  {
    value: 'live',
    label: 'No light',
    note: 'The static wash — the app as it ships. The baseline to judge the other two against.',
  },
  {
    value: 'artwork',
    label: 'Artwork halo',
    note: "Light escaping from behind the cover. Contained; the console's ground never moves.",
  },
  {
    value: 'edges',
    label: 'Screen edges',
    note: 'The literal backlight — the cover’s colour on the screen’s rim only, centre untouched.',
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
  player: PlayerState;
  trophies: TrophiesState;
  setAccount: (state: AccountState) => void;
  setHome: (state: HomeState) => void;
  setPlayer: (state: PlayerState) => void;
  setTrophies: (state: TrophiesState) => void;
};

export const useUiStateLab = create<LabStore>(set => ({
  account: 'live',
  home: 'live',
  player: 'live',
  trophies: 'live',
  setAccount: account => set({ account }),
  setHome: home => set({ home }),
  setPlayer: player => set({ player }),
  setTrophies: trophies => set({ trophies }),
}));
