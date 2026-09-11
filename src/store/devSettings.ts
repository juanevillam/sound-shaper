import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STATE_LAB } from '@/dev/flags';
import { useUiStateLab } from '@/dev/uiStateLab';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DEV-ONLY RUNTIME SWITCHES — the Settings sheet's Dev section writes here.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `dev/flags.ts` is still the DEFAULT, but the live value is this store's,
 * because the point of the lab is to step states against the real screen — and
 * "the real screen" includes looking at it the way a person without the lab
 * would. Toggling that by editing source and reloading threw away the very
 * state you were looking at. Same store Topper carries, for the same reason.
 *
 * PERSISTED, so the choice survives relaunches, and `__DEV__`-gated at every
 * consumer exactly as the flag is — a release build never reads it.
 */
type DevSettingsState = {
  /** Show the state-lab picker on the instrumented surfaces. */
  stateLabBar: boolean;
  setStateLabBar: (on: boolean) => void;
};

export const useDevSettingsStore = create<DevSettingsState>()(
  persist(
    set => ({
      stateLabBar: STATE_LAB,
      setStateLabBar: stateLabBar => {
        set({ stateLabBar });
        /**
         * HIDING THE BAR RELEASES EVERY PIN. The toggle exists to see the UI
         * as a final user would, and a user has no pinned skeleton — a hidden
         * bar with a live pin would show a frozen state with the one control
         * that explains it removed.
         */
        if (!stateLabBar)
          useUiStateLab.setState({
            account: 'live',
            home: 'live',
            player: 'live',
            trophies: 'live',
          });
      },
    }),
    {
      name: 'dev-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
