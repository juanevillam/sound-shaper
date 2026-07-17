import { Platform } from 'react-native';

import { Redirect, Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/auth';

export default function AppLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const { t } = useI18n();
  const { colors } = useAppTheme();

  if (!isAuthenticated) return <Redirect href="/welcome" />;

  return (
    <Stack
      screenOptions={{
        // Android: the Material tonal app bar. iOS: the bar matches the screen
        // background (no tonal band). An unset headerStyle is NOT an option —
        // RNS's opaque default paints white regardless of the dark trait on
        // iOS 26.
        headerStyle: {
          backgroundColor:
            Platform.OS === 'ios' ? colors.background : colors.surfaceContainer,
        },
        headerShadowVisible: false,
        headerTintColor: colors.onSurface,
        contentStyle: { backgroundColor: colors.background },
        animation: Platform.select({ android: 'fade_from_bottom' }),
      }}
    >
      <Stack.Screen name="home" options={{ title: t('app.title') }} />
      <Stack.Screen name="settings" options={{ title: t('app.settings') }} />
    </Stack>
  );
}
