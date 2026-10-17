import { useCallback, useState } from 'react';

import { useI18n } from '@/i18n';
import { signInWithGoogle } from '@/services/firebase/auth';

import { useSnackbar } from '@/ui';

type UseGoogleSignInReturn = {
  isSigningIn: boolean;
  signIn: () => Promise<void>;
};

export const useGoogleSignIn = (): UseGoogleSignInReturn => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { t } = useI18n();
  const { showSnackbar } = useSnackbar();

  const signIn = useCallback(async () => {
    setIsSigningIn(true);

    try {
      // Resolves null on user dismissal — no feedback needed for that.
      // Navigation happens via the auth listener once Firebase confirms.
      await signInWithGoogle();
    } catch {
      showSnackbar(t('snackbar.google-sign-in-failed'));
    } finally {
      setIsSigningIn(false);
    }
  }, [showSnackbar, t]);

  return { isSigningIn, signIn };
};
