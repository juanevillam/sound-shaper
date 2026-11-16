import { useDevSettingsStore } from './devSettings';
import {
  ACCOUNT_STATES,
  CLIPS_STATES,
  HOME_STATES,
  TROPHIES_STATES,
  UI_STATE_LAB,
  useUiStateLab,
  type AccountState,
  type ClipsState,
  type HomeState,
  type LabScreen,
  type TrophiesState,
} from './uiStateLab';
import { StateLab, type StateLabGroup } from '../ui/StateLab';

export function UiStateLabBar({
  screens,
  bottomOffset = 0,
}: {
  screens: readonly LabScreen[];
  bottomOffset?: number;
}) {
  const barVisible = useDevSettingsStore(s => s.stateLabBar);

  const home = useUiStateLab(s => s.home);
  const clips = useUiStateLab(s => s.clips);
  const account = useUiStateLab(s => s.account);
  const trophies = useUiStateLab(s => s.trophies);

  const setHome = useUiStateLab(s => s.setHome);
  const setClips = useUiStateLab(s => s.setClips);
  const setAccount = useUiStateLab(s => s.setAccount);
  const setTrophies = useUiStateLab(s => s.setTrophies);

  if (!UI_STATE_LAB || !barVisible || screens.length === 0) return null;

  const allGroups: Record<LabScreen, StateLabGroup> = {
    home: {
      key: 'home',
      label: 'Home',
      onChange: v => setHome(v as HomeState),
      states: HOME_STATES,
      value: home,
    },
    clips: {
      key: 'clips',
      label: 'Clips',
      onChange: v => setClips(v as ClipsState),
      states: CLIPS_STATES,
      value: clips,
    },
    account: {
      key: 'account',
      label: 'Account',
      onChange: v => setAccount(v as AccountState),
      states: ACCOUNT_STATES,
      value: account,
    },
    trophies: {
      key: 'trophies',
      label: 'Trophies',
      onChange: v => setTrophies(v as TrophiesState),
      states: TROPHIES_STATES,
      value: trophies,
    },
  };

  return (
    <StateLab
      groups={screens.map(s => allGroups[s])}
      bottomOffset={bottomOffset}
    />
  );
}
