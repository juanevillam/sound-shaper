export type UseAppleSignInReturn = {
  isSigningIn: boolean;
  signIn: () => Promise<void>;
};

// Non-iOS stub — the welcome screen only offers Apple sign-in on iOS, so this
// never runs; it exists so the import resolves on every platform.
export const useAppleSignIn = (): UseAppleSignInReturn => ({
  isSigningIn: false,
  signIn: async () => {},
});
