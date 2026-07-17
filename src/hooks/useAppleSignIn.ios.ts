import { useCallback, useState } from 'react';

import { useI18n } from '@/i18n';
import { signInWithApple } from '@/services/firebase/appleAuth';

import { type UseAppleSignInReturn } from './useAppleSignIn';
import { useSnackbar } from './useSnackbar';

export const useAppleSignIn = (): UseAppleSignInReturn => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { t } = useI18n();
  const { showSnackbar } = useSnackbar();

  const signIn = useCallback(async () => {
    setIsSigningIn(true);

    try {
      // Resolves null on user dismissal — no feedback needed for that.
      // Navigation happens via the auth listener once Firebase confirms.
      await signInWithApple();
    } catch {
      showSnackbar(t('snackbar.apple-sign-in-failed'));
    } finally {
      setIsSigningIn(false);
    }
  }, [showSnackbar, t]);

  return { isSigningIn, signIn };
};
