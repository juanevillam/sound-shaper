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
 * The PICKER is the package's, so every app steps its states with the same
 * control at the same size. This file supplies only what is this app's: which
 * group belongs to which surface, and where its value lives. Same split the
 * shared screens use — the component is shared, the adapter is the app's.
 *
 * Every surface here carries ONE group, so the picker's chip row never renders.
 */

/** Surfaces whose picker sits on a form SHEET. */
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
