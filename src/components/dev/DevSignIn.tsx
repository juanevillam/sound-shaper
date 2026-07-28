import { useState } from 'react';

import { Pressable, StyleSheet, Text } from 'react-native';

import { getAuth, signInWithCustomToken } from '@react-native-firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';

const TOKEN = process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN;

/**
 * Dev-only shortcut past the Google / Apple buttons: signs in with a custom
 * token minted by `scripts/dev-token.mjs`, so the simulator can reach the real
 * account without a Google session on the device. Renders nothing in release
 * builds, or when no token has been minted.
 */
export const DevSignIn = () => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();

  if (!__DEV__ || !TOKEN) return null;

  const signIn = async () => {
    setIsSigningIn(true);

    try {
      // Navigation happens via the auth listener, same as the real providers.
      await signInWithCustomToken(getAuth(), TOKEN);
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : 'Dev sign-in failed',
      );
      setIsSigningIn(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isSigningIn}
      onPress={signIn}
      style={[
        styles.pill,
        {
          backgroundColor: colors.secondaryContainer,
          opacity: isSigningIn ? 0.6 : 1,
          top: insets.top + 8,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.onSecondaryContainer }]}>
        {isSigningIn ? 'signing in…' : 'dev sign-in'}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    right: 16,
  },
});
