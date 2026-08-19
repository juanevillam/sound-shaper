import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * WHETHER THE CREDIT ROLL HAS ALREADY BEEN OFFERED — one boolean, and the only
 * state that feature owns anywhere.
 *
 * Everything else about the credits is DERIVED per app and needs no storage:
 * Topper unlocks on the platinum it already persists per account, the starter
 * on which showcases have been opened. Whether the roll has been WATCHED is
 * nobody's business. This flag exists solely so the one-time offer is one time —
 * a dialog that reappears on every launch after the unlock turns a reward into
 * nagging.
 *
 * APP-AGNOSTIC, so it lives here rather than being written out once per app:
 * unlike `createLayoutStore`, there is nothing per-app to parameterise, which
 * makes it the same shape as `useAuthStore` and `useThemeStore` above.
 *
 * LOCAL, never on the account, and deliberately: it records this DEVICE's
 * interruption history rather than the person's progress. Signing in on a new
 * phone with the unlock already earned re-offers the roll once, which is the
 * right outcome — that device has never shown it.
 */
type CreditsState = {
  /** The unlock dialog has been shown once on this device. */
  offered: boolean;
  markOffered: () => void;
};

export const useCreditsStore = create<CreditsState>()(
  persist(
    set => ({
      offered: false,
      markOffered: () => set({ offered: true }),
    }),
    {
      name: 'credits',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
