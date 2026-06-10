import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AuthState = {
  isAuthenticated: boolean;
  hasHydrated: boolean;
  signIn: () => void;
  signOut: () => void;
  setHasHydrated: (value: boolean) => void;
};

/**
 * Generic authentication flag, persisted across launches. Apps wire `signIn` /
 * `signOut` to their real auth provider; the starter flips a boolean. `hasHydrated`
 * lets the root layout hold the splash until the persisted value is restored.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      isAuthenticated: false,
      hasHydrated: false,
      signIn: () => set({ isAuthenticated: true }),
      signOut: () => set({ isAuthenticated: false }),
      setHasHydrated: value => set({ hasHydrated: value }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
