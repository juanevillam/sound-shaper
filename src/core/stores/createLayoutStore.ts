import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type LayoutState<L extends string> = {
  locale: L;
  hasHydrated: boolean;
  setLocale: (locale: L) => void;
  setHasHydrated: (value: boolean) => void;
};

/**
 * Builds the app's persisted locale store. The wiring (device-locale default,
 * AsyncStorage persistence under the `layout` key, `hasHydrated` splash gate)
 * is identical across apps; only the locale union differs, so each app passes
 * its own `SUPPORTED_LOCALES` and fallback. Theme preference is app-agnostic
 * and lives in `useThemeStore`.
 */
export function createLayoutStore<L extends string>(
  supportedLocales: readonly L[],
  fallbackLocale: L,
) {
  function resolveDeviceLocale(): L {
    const device = getLocales()[0]?.languageCode;

    return supportedLocales.includes(device as L)
      ? (device as L)
      : fallbackLocale;
  }

  return create<LayoutState<L>>()(
    persist(
      set => ({
        locale: resolveDeviceLocale(),
        hasHydrated: false,
        setLocale: locale => set({ locale }),
        setHasHydrated: value => set({ hasHydrated: value }),
      }),
      {
        name: 'layout',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: state => ({ locale: state.locale }),
        onRehydrateStorage: () => state => {
          state?.setHasHydrated(true);
        },
      },
    ),
  );
}
