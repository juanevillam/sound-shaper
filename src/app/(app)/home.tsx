import { Pressable, StyleSheet, Text, View } from 'react-native';

import { router } from 'expo-router';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

// P0 placeholder. The real Library (uploaded songs grid + upload entry, then
// tabs + mini-player) lands in P1/P2 — see docs/sound-shaper-plan.md §6.
export default function Home() {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={styles.emoji}>🎵</Text>
      <Text style={[styles.title, { color: colors.onSurface }]}>
        {t('home.title')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.onSurfaceMuted }]}>
        {t('home.placeholder')}
      </Text>
      <Pressable
        onPress={() => router.push('/settings')}
        style={[styles.button, { backgroundColor: colors.primaryContainer }]}
      >
        <Text
          style={[styles.buttonLabel, { color: colors.onPrimaryContainer }]}
        >
          {t('app.settings')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    borderRadius: 20,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
});
