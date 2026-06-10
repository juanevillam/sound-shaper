import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_THEME, type Theme } from '../theme/themes';

type ThemeState = {
  theme: Theme;
  hasHydrated: boolean;
  setTheme: (theme: Theme) => void;
  setHasHydrated: (value: boolean) => void;
};

/**
 * Theme preference (`light` / `dark` / `system`), persisted across launches and
 * read by `useAppTheme`. Kept separate from locale so it carries no app-specific
 * coupling — `useAppTheme` can live in `@portfolio/core` and every app shares it.
 * `hasHydrated` lets the root layout hold the splash until the value is restored,
 * avoiding a flash of the default theme.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      theme: DEFAULT_THEME,
      hasHydrated: false,
      setTheme: theme => set({ theme }),
      setHasHydrated: value => set({ hasHydrated: value }),
    }),
    {
      name: 'theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ theme: state.theme }),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
