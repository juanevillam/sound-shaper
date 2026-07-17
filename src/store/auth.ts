import { create } from 'zustand';

// Auth state mirrors Firebase. The native SDK persists the session itself, so
// nothing is stored here — `hasResolved` flips once the first
// `onAuthStateChanged` callback fires and gates the splash screen.
export type AuthUser = {
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  uid: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasResolved: boolean;
  // Set when Firebase drops the session without a manual sign-out; the welcome
  // screen consumes it to show a "session expired" snackbar (the auth listener
  // mounts above the snackbar provider, so it can't show one).
  sessionExpired: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: (options?: { sessionExpired?: boolean }) => void;
  consumeSessionExpired: () => boolean;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  hasResolved: false,
  sessionExpired: false,
  setUser: user => set({ user, isAuthenticated: true, hasResolved: true }),
  clearUser: options =>
    set({
      user: null,
      isAuthenticated: false,
      hasResolved: true,
      sessionExpired: options?.sessionExpired ?? false,
    }),
  consumeSessionExpired: () => {
    const expired = get().sessionExpired;

    if (expired) set({ sessionExpired: false });

    return expired;
  },
}));
