import { create } from 'zustand';

import { type UserProfile } from '@/services/firebase/users';

// The signed-in user's Firestore profile (`users/{uid}`) — the source of the
// claimed username. Distinct from the auth store, which mirrors Firebase Auth.
type ProfileState = {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  clear: () => void;
};

export const useProfileStore = create<ProfileState>()(set => ({
  profile: null,
  setProfile: profile => set({ profile }),
  clear: () => set({ profile: null }),
}));
