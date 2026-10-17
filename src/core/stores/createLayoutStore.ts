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
 * Builds the persisted locale store: device-locale default, AsyncStorage
 * persistence under the `layout` key, and a `hasHydrated` splash gate, over the
 * `SUPPORTED_LOCALES` and fallback the caller passes (`src/store/layout.ts`).
 * Theme preference lives in `useThemeStore`.
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
