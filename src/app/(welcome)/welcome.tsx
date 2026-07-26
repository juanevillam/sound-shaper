import { useEffect } from 'react';

import { Platform } from 'react-native';

import { legalUrl, WelcomeScreen, type AuthAction } from '@portfolio/mobile-ui';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { BrandMark } from '@/components/ui/BrandMark';
import { useAppleSignIn } from '@/hooks/useAppleSignIn';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/auth';

const APP_NAME = Constants.expoConfig?.name ?? '';

export default function Welcome() {
  const { t } = useI18n();
  const { colors, scheme, seedColor } = useAppTheme();
  const { isSigningIn, signIn } = useGoogleSignIn();
  const { isSigningIn: isAppleSigningIn, signIn: signInWithApple } =
    useAppleSignIn();
  const { showSnackbar } = useSnackbar();
  const consumeSessionExpired = useAuthStore(s => s.consumeSessionExpired);

  // The auth listener mounts above the snackbar provider, so it can only flag
  // an expired session; the message surfaces here, post-redirect.
  useEffect(() => {
    if (consumeSessionExpired()) showSnackbar(t('snackbar.session-expired'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const googleAction: AuthAction = {
    provider: 'google',
    label: t('welcome.button.google.label'),
    loadingLabel: t('welcome.button.google.loadingLabel'),
    isLoading: isSigningIn,
    onPress: signIn,
  };

  // App Store policy: offering Google sign-in requires offering Sign in with
  // Apple too, at equal or greater prominence — so Apple leads on iOS.
  const authActions: [AuthAction] | [AuthAction, AuthAction] =
    Platform.OS === 'ios'
      ? [
          {
            provider: 'apple',
            label: t('welcome.button.apple.label'),
            loadingLabel: t('welcome.button.apple.loadingLabel'),
            isLoading: isAppleSigningIn,
            onPress: signInWithApple,
          },
          googleAction,
        ]
      : [googleAction];

  return (
    <WelcomeScreen
      appName={APP_NAME}
      logo={({ size, color }) => <BrandMark size={size} color={color} />}
      features={[
        {
          emoji: '🎵',
          systemImage: 'music.note.list',
          title: t('welcome.features.library.title'),
          subtitle: t('welcome.features.library.subtitle'),
        },
        {
          emoji: '🎛️',
          systemImage: 'slider.horizontal.3',
          title: t('welcome.features.shape.title'),
          subtitle: t('welcome.features.shape.subtitle'),
        },
        {
          emoji: '✂️',
          systemImage: 'scissors',
          title: t('welcome.features.clip.title'),
          subtitle: t('welcome.features.clip.subtitle'),
        },
      ]}
      authActions={authActions}
      colorScheme={scheme}
      seedColor={seedColor}
      // Sign-in doubles as sign-up (no separate register), so consent to the
      // legal pages rides on the auth buttons. In-app browser sheet
      // (SFSafariViewController / Custom Tabs) so reading a policy never leaves
      // the sign-in flow.
      legal={{
        text: t('welcome.legal.text'),
        privacyLabel: t('welcome.legal.privacy'),
        termsLabel: t('welcome.legal.terms'),
        onPressPrivacy: () =>
          WebBrowser.openBrowserAsync(legalUrl(APP_NAME, 'privacy-policy')),
        onPressTerms: () =>
          WebBrowser.openBrowserAsync(
            legalUrl(APP_NAME, 'terms-and-conditions'),
          ),
      }}
      colors={{
        background: colors.background,
        onSurface: colors.onSurface,
        onSurfaceMuted: colors.onSurfaceMuted,
        primary: colors.primary,
        primaryContainer: colors.primaryContainer,
        onPrimaryContainer: colors.onPrimaryContainer,
      }}
    />
  );
}
