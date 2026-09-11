import { StateLab, type StateLabGroup } from '@portfolio/mobile-ui';

import {
  ACCOUNT_STATES,
  HOME_STATES,
  HOME_LAB_BOTTOM_OFFSET,
  TROPHIES_STATES,
  useUiStateLab,
  type AccountState,
  type HomeState,
  type LabScreen,
  type TrophiesState,
} from '@/dev/uiStateLab';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDevSettingsStore } from '@/store/devSettings';

/**
 * DEV-ONLY — Sound Shaper's adapter over the shared `StateLab`.
 *
 * CROSS-PLATFORM, and it used to be `.ios.tsx` beside an Android stub that
 * returned `null` on the reasoning that the lab was "an iOS-only experiment".
 * That was stale: `StateLab` has a cross-platform base in
 * `@portfolio/mobile-ui` and Topper's own adapter went cross-platform when its
 * Android pass needed it. Nothing in here was ever iOS-specific — the picker is
 * plain RN and the groups below are branch names both platforms' screens share.
 *
 * What the stub actually cost was the Android craft audit: Home's `skeleton`
 * and `error` could not be pinned on the device the whole Phase-B workstream
 * runs on, using the tool the root AGENTS.md names as THE way to judge UI
 * states. Chasing them by hand is exactly what the lab exists to stop.
 *
 * The PICKER is the package's, so every app steps its states with the same
 * control at the same size. This file supplies only what is this app's: which
 * group belongs to which surface, and where its value lives. Same split the
 * shared screens use — the component is shared, the adapter is the app's.
 *
 * Every surface here carries ONE group, so the picker's chip row never renders.
 *
 * ALL THREE SURFACES REACH BOTH PLATFORMS. Android used to reach only `home`,
 * because the other two mount their picker from `SheetScreenIos` — they are
 * form sheets on iOS and ordinary pushed screens here — and neither pushed
 * screen rendered one. That was never this file's decision; it was two call
 * sites.
 *
 * WHAT THE MISSING PICKER WAS HIDING is the reason it is worth writing down:
 * neither Android route passed `loading` AT ALL, so trophies opened cold on a
 * confident "0 of 7" and Member Since printed an em dash while the profile was
 * still in flight — two real placeholder states the shared screens have
 * supported on both platforms since 2026-09-04. Nobody saw them because the
 * one tool for stepping a surface's states could not be opened on the device
 * this workstream runs on. A picker that reaches one platform is how a
 * one-platform defect stays invisible.
 */

/**
 * Surfaces whose picker sits on a form SHEET, which has no bottom chrome to
 * clear — as opposed to Home, where the now-playing banner floats over the
 * grid.
 *
 * A PUSHED ANDROID SCREEN WANTS THE SAME 0, so this set covers both platforms;
 * the split that does matter is Home's, and it is in `HOME_LAB_BOTTOM_OFFSET`.
 * Note that Topper's adapter zeroes the offset for ANDROID OUTRIGHT and this
 * one must not: its bottom chrome is a navigator tab bar, which the safe-area
 * inset already covers, while this app's banner is an RN view inside the
 * screen that no inset knows about.
 */
const SHEET_SCREENS = new Set<LabScreen>(['account', 'trophies']);

export function UiStateLabBar({ screen }: { screen: LabScreen }) {
  const { colors } = useAppTheme();
  /**
   * The Settings sheet's Dev section can hide the picker, to see the UI as a
   * person without the lab would. Toggling it off also resets every pinned
   * state to live (see `devSettings`), so hiding never strands a pin behind an
   * invisible control.
   */
  const barVisible = useDevSettingsStore(s => s.stateLabBar);

  const account = useUiStateLab(s => s.account);
  const home = useUiStateLab(s => s.home);
  const trophies = useUiStateLab(s => s.trophies);
  const setAccount = useUiStateLab(s => s.setAccount);
  const setHome = useUiStateLab(s => s.setHome);
  const setTrophies = useUiStateLab(s => s.setTrophies);

  const groups: Record<LabScreen, StateLabGroup> = {
    account: {
      key: 'account',
      label: 'Account',
      onChange: value => setAccount(value as AccountState),
      states: ACCOUNT_STATES,
      value: account,
    },
    home: {
      key: 'home',
      label: 'Home',
      onChange: value => setHome(value as HomeState),
      states: HOME_STATES,
      value: home,
    },
    trophies: {
      key: 'trophies',
      label: 'Trophies',
      onChange: value => setTrophies(value as TrophiesState),
      states: TROPHIES_STATES,
      value: trophies,
    },
  };

  if (!barVisible) return null;

  return (
    <StateLab
      colors={colors}
      groups={[groups[screen]]}
      bottomOffset={SHEET_SCREENS.has(screen) ? 0 : HOME_LAB_BOTTOM_OFFSET}
    />
  );
}
