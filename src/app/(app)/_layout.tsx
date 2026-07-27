import { Platform } from 'react-native';

import { TrophyOverlay } from '@portfolio/trophies';
import { Redirect, Stack } from 'expo-router';

import { router } from 'expo-router';

import { AudioEngine } from '@/components/player/AudioEngine';
import { PlayerSheet } from '@/components/player/PlayerSheet';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useListeningTime } from '@/hooks/useListeningTime';
import { useOwnProfileSync } from '@/hooks/useOwnProfileSync';
import { useSongsSubscription } from '@/hooks/useSongsSubscription';
import { useTrophiesSync } from '@/hooks/useTrophiesSync';
import { useTrophyContent } from '@/hooks/useTrophyContent';
import { useTrophyTriggers } from '@/hooks/useTrophyTriggers';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useAuthStore } from '@/store/auth';
import { TILE_RADIUS } from '@/styles/shape';

function AuthenticatedSubscriptions() {
  // Session-wide Firestore listeners (own profile + the flat song library).
  // Mounted once here so every screen reads from the store instead of
  // re-subscribing.
  useOwnProfileSync();
  useSongsSubscription();
  // Trophies: point the engine at this user, bank listening time, and let the
  // store-derived objectives re-evaluate on every snapshot.
  useTrophiesSync();
  useTrophyTriggers();
  useListeningTime();
  return null;
}

export default function AppLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { copy, overlayStrings } = useTrophyContent();

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
        <Stack.Screen
          name="manage-account"
          options={{ title: t('settings.manageAccount.title') }}
        />
        <Stack.Screen
          name="trophies"
          options={{ title: t('trophies.title') }}
        />
      </Stack>
      {/* The streaming <Audio> element + shaping graph (headless). */}
      <AudioEngine />
      {/* The player is not a route: banner and full player are ONE surface
          that expands in place over every screen (the YT Music interaction). */}
      <PlayerSheet />
      {/* Top-anchored unlock banner, above every screen. No sound with it: this
          app IS a player, and a jingle over what you are listening to is the
          one place a trophy must not intrude — the haptic carries it. */}
      <TrophyOverlay
        copy={copy}
        colors={{
          surface: colors.surfaceContainer,
          onSurface: colors.onSurface,
          onSurfaceMuted: colors.onSurfaceMuted,
          primary: colors.primary,
        }}
        radius={TILE_RADIUS}
        strings={overlayStrings}
        onPress={() => router.push('/trophies')}
        onShow={trophy =>
          trophy.tier === 'platinum' ? haptics.dragDrop() : haptics.medium()
        }
      />
    </>
  );
}
