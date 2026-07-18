import { Platform } from 'react-native';

import { Redirect, Stack } from 'expo-router';

import { PlayerSheet } from '@/components/player/PlayerSheet';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useEnsureDefaultPlaylist } from '@/hooks/useEnsureDefaultPlaylist';
import { useOwnProfileSync } from '@/hooks/useOwnProfileSync';
import { usePlaylistsSubscription } from '@/hooks/usePlaylistsSubscription';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/auth';

function AuthenticatedSubscriptions() {
  // Session-wide Firestore listeners (own profile + your playlists). Mounted
  // once here so every screen reads from the store instead of re-subscribing.
  useOwnProfileSync();
  usePlaylistsSubscription();
  // First session ever: create the default "My library" playlist.
  useEnsureDefaultPlaylist();
  return null;
}

export default function AppLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const { t } = useI18n();
  const { colors } = useAppTheme();

  if (!isAuthenticated) return <Redirect href="/welcome" />;

  return (
    <>
      <AuthenticatedSubscriptions />
      <Stack
        screenOptions={{
          // Android: the Material tonal app bar. iOS: the bar matches the
          // screen background — an unset headerStyle is NOT an option (RNS's
          // opaque default paints white regardless of the dark trait).
          headerStyle: {
            backgroundColor:
              Platform.OS === 'ios'
                ? colors.background
                : colors.surfaceContainer,
          },
          headerShadowVisible: false,
          headerTintColor: colors.onSurface,
          contentStyle: { backgroundColor: colors.background },
          // ONE transition for every Android push: the fast Material
          // fade-through. iOS keeps its platform default.
          animation: Platform.select({ android: 'fade_from_bottom' }),
        }}
      >
        {/* Home is the single root — a personal app has no tabs. Its title +
            settings gear are set by the screen itself. */}
        <Stack.Screen name="home" options={{ title: t('app.title') }} />
        <Stack.Screen name="settings" options={{ title: t('app.settings') }} />
        {/* Empty title from the start — the identity lives in the screen's
            hero, and the default title would flash during the art morph. */}
        <Stack.Screen name="playlist-detail" options={{ title: '' }} />
        <Stack.Screen
          name="manage-account"
          options={{ title: t('settings.manageAccount.title') }}
        />
      </Stack>
      {/* The player is not a route: banner and full player are ONE surface
          that expands in place over every screen (the YT Music interaction). */}
      <PlayerSheet />
    </>
  );
}
