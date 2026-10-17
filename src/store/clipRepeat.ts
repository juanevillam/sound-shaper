import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isRepeatMode, type RepeatMode } from '@/lib/clipQueue';

// The Clips sheet's Repeat setting — what plays when a clip runs out (see
// `lib/clipQueue.ts` for the four modes, and the player store's `onPosition`
// for where it is acted on).
//
// PERSISTED ON THE DEVICE, like any player preference a person sets once and
// expects to find again — Music keeps its repeat mode across launches. It is
// written only when the person picks a value, so the per-tick rule for
// persisted stores (`useListeningStore`) has nothing to say here.
//
// RESET ON SIGN-OUT, with the other device-local stores in `useAuthListener`:
// it is one account's choice about that account's clips.
type ClipRepeatState = {
  mode: RepeatMode;
  setMode: (mode: RepeatMode) => void;
  reset: () => void;
};

export const useClipRepeatStore = create<ClipRepeatState>()(
  persist(
    set => ({
      mode: 'off',
      setMode: mode => set({ mode }),
      reset: () => set({ mode: 'off' }),
    }),
    {
      name: 'clip-repeat',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ mode: state.mode }),
      // A stored value from a build with other modes must not reach the
      // player as something it cannot act on.
      merge: (persisted, current) => {
        const mode = (persisted as { mode?: unknown } | undefined)?.mode;
        return { ...current, mode: isRepeatMode(mode) ? mode : 'off' };
      },
    },
  ),
);
