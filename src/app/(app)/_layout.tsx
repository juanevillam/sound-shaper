import { Platform } from 'react-native';

import { TrophyOverlay } from '@portfolio/trophies';
import { Redirect, Stack } from 'expo-router';

import { router } from 'expo-router';

import { AudioEngine } from '@/components/player/AudioEngine';
import { HeaderCloseButton } from '@/components/ui/HeaderCloseButton';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useIosSheetPresented } from '@/hooks/useIosSheetPresented';
import { useListeningTime } from '@/hooks/useListeningTime';
import { useOwnProfileSync } from '@/hooks/useOwnProfileSync';
import { useSongsSubscription } from '@/hooks/useSongsSubscription';
import { useTrophiesSync } from '@/hooks/useTrophiesSync';
import { useTrophyContent } from '@/hooks/useTrophyContent';
import { useTrophyTriggers } from '@/hooks/useTrophyTriggers';
import { type TranslationKey, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { IOS_FORM_SHEETS, IOS_SHEET_SCREENS } from '@/lib/sheetRoutes';
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
  const iosSheetPresented = useIosSheetPresented();

  // Shared chrome for the iOS-only native form sheets below (only the detents
  // vary per sheet). Sheets sit on the ELEVATED sheet color — the stack-wide
  // background contentStyle would show as a dead footer under fitToContents.
  const sheetOptions = (
    sheetAllowedDetents: 'fitToContents' | number[],
    titled = false,
  ) => ({
    presentation: 'formSheet' as const,
    contentStyle: { backgroundColor: colors.sheet },
    sheetAllowedDetents,
    sheetGrabberVisible: true,
    // A `titled` sheet gets real UIKit chrome: an INLINE title plus a close
    // glyph in place of a grabber-only dismiss.
    //
    // Inline, never `headerLargeTitle`. Apple sizes a sheet's title as if it
    // were already collapsed — the App Store's Apple Account sheet does it, and
    // so do sheets with far less content than fills them, so it is a standard
    // rather than a reaction to length.
    //
    // `headerTransparent` stays true so scrolling content DISSOLVES under the
    // bar instead of cutting off at it — the same reason the stack-wide bars
    // below are clear.
    ...(titled
      ? {
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTransparent: true,
          headerRight: () => <HeaderCloseButton />,
        }
      : { headerShown: false }),
  });

  if (!isAuthenticated) return <Redirect href="/welcome" />;

  return (
    <>
      <AuthenticatedSubscriptions />
      <Stack
        screenOptions={{
          // Android: the Material tonal app bar.
          //
          // iOS 26: leave the bar's background to UIKit. A TRANSPARENT bar lets
          // content scroll underneath, which is what arms the system
          // scroll-edge effect — the bar is clear over the top of the content
          // and materialises (Liquid Glass) once anything is behind it.
          // Painting `headerStyle.backgroundColor` opts out of all of that, and
          // is what made every pushed screen's bar read as a flat band. An
          // UNSET headerStyle is still not an option on the Android side.
          ...(Platform.OS === 'ios'
            ? {
                headerTransparent: true,
                headerTitleStyle: { color: colors.onSurface },
                headerLargeTitleStyle: { color: colors.onSurface },
              }
            : {
                headerStyle: { backgroundColor: colors.surfaceContainer },
              }),
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
        {/* Settings and everything it drills into. On iOS these are STACKED
            SHEETS (Settings and Account open from the home bar; Trophies
            presents over Account and dismisses back to it) — the
            portfolio-wide placement, matching Topper and expo-ui-starter, with
            the children stacked rather than pushed because RNScreens gives a
            screen pushed on a `formSheet` root no back button at all. The
            reasoning lives in `IOS_SHEET_SCREENS`. On Android these stay
            ordinary pushed screens with their Material app bars — the `title`
            below is what that platform uses. */}
        {IOS_SHEET_SCREENS.map(({ name, detents, titleKey }) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{
              title: t(titleKey as TranslationKey),
              ...(Platform.OS === 'ios' ? sheetOptions(detents, true) : {}),
            }}
          />
        ))}
        {/* iOS-only native form sheets (Android presents these surfaces as
            Compose ModalBottomSheets mounted in-place; nothing navigates to
            these routes there). The route list + detents live in
            IOS_FORM_SHEETS, shared with useIosSheetPresented. */}
        {IOS_FORM_SHEETS.map(({ name, detents }) => (
          <Stack.Screen
            key={name}
            name={name}
            options={sheetOptions(detents)}
          />
        ))}
      </Stack>
      {/* The streaming <Audio> element + shaping graph (headless). Playback
          is deliberately NOT tied to the player UI: the UI is mounted by the
          Home screen (see its comment), this keeps playing regardless. */}
      <AudioEngine />
      {/* Top-anchored unlock banner, above every screen. No sound with it: this
          app IS a player, and a jingle over what you are listening to is the
          one place a trophy must not intrude — the haptic carries it. */}
      <TrophyOverlay
        copy={copy}
        // A native form sheet covers the RN root — hold banners until it goes.
        suspended={iosSheetPresented}
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
