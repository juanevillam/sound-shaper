import { Tabs } from 'expo-router/js-tabs';

import { AppTabBar } from '@/components/ui/AppTabBar';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

// The three top-level destinations live behind a Material 3 bottom navigation
// bar (AppTabBar). expo-router owns the tab state + per-tab navigation/scroll
// preservation; the bar itself is a themed @expo/ui NavigationBar. Detail
// screens (playlist-detail, settings) are NOT tabs — they push over the bar
// from the parent (app) stack.
export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { t } = useI18n();

  return (
    <Tabs
      tabBar={props => <AppTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceContainer },
        headerShadowVisible: false,
        headerTintColor: colors.onSurface,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {/* Branded home title — your playlists live here. */}
      <Tabs.Screen name="home" options={{ headerTitle: t('app.title') }} />
      {/* Explore ships later (social discovery); the tab holds its place so
          the bar reads like Topper's from day one. */}
      <Tabs.Screen
        name="explore"
        options={{ headerTitle: t('explore.title') }}
      />
      {/* Profile tab is always your own profile. */}
      <Tabs.Screen
        name="profile"
        options={{ headerTitle: t('profile.ownTitle') }}
      />
    </Tabs>
  );
}
