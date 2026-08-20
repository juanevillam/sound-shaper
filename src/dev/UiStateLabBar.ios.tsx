import { StateLab, type StateLabGroup } from '@portfolio/mobile-ui';

import {
  ACCOUNT_STATES,
  HOME_STATES,
  TROPHIES_STATES,
  useUiStateLab,
  type AccountState,
  type HomeState,
  type LabScreen,
  type TrophiesState,
} from '@/dev/uiStateLab';
import { useAppTheme } from '@/hooks/useAppTheme';

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

/**
 * What floats at the bottom of HOME — the player banner, not a tab bar, so the
 * picker cannot take the package's default clearance. Its own constants rather
 * than a guessed number: the banner is a detached pill, so clearing it means
 * its bottom gap plus its height.
 */
const HOME_BOTTOM_OFFSET = 68 + 12;

export function UiStateLabBar({ screen }: { screen: LabScreen }) {
  const { colors } = useAppTheme();

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

  return (
    <StateLab
      colors={colors}
      groups={[groups[screen]]}
      bottomOffset={SHEET_SCREENS.has(screen) ? 0 : HOME_BOTTOM_OFFSET}
    />
  );
}
