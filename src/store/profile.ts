import { create } from 'zustand';

import { type UserProfile } from '@/services/firebase/users';

// The signed-in user's Firestore profile (`users/{uid}`) — the source of the
// account's creation date. Distinct from the auth store, which mirrors Firebase
// Auth.
type ProfileState = {
  profile: UserProfile | null;
  /**
   * The first snapshot has arrived — which is NOT the same question as
   * `profile !== null`, and the difference is a screen that never stops
   * loading: a signed-in account whose Firestore doc doesn't exist yet resolves
   * to `null` forever, so anything gating a placeholder on the profile alone
   * would sit redacted for good. The Account sheet reads this.
   */
  hasSettled: boolean;
  setProfile: (profile: UserProfile | null) => void;
  clear: () => void;
};

export const useProfileStore = create<ProfileState>()(set => ({
  profile: null,
  hasSettled: false,
  setProfile: profile => set({ profile, hasSettled: true }),
  // Sign-out resets BOTH: the next account starts unsettled, not settled on
  // nobody.
  clear: () => set({ profile: null, hasSettled: false }),
}));
