import { Redirect, Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuthStore } from '@/store/auth';

export default function WelcomeLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const { colors } = useAppTheme();

  if (isAuthenticated) return <Redirect href="/home" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
