import { StyleSheet } from 'react-native';

import { withAlpha } from '@portfolio/core';
import { TrophiesScreen, useTrophies } from '@portfolio/trophies';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTrophyContent } from '@/hooks/useTrophyContent';
import { useI18n } from '@/i18n';

export default function TrophiesRoute() {
  const { colors } = useAppTheme();
  const { t, locale } = useI18n();
  const { copy, screenStrings } = useTrophyContent();
  const { trophies, earned, total } = useTrophies(copy);

  // `t` doesn't interpolate, so fill the count placeholders by hand (the same
  // idiom the account/meta strings use).
  const progress = t('trophies.progress')
    .replace('{earned}', String(earned))
    .replace('{total}', String(total));

  // Completion %, locale-formatted (e.g. "43%") — shown opposite the count.
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format(
    total > 0 ? earned / total : 0,
  );

  const formatDate = (achievedAt: number) =>
    new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(achievedAt));

  return (
    <Screen>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <TrophiesScreen
          trophies={trophies}
          earned={earned}
          total={total}
          colors={{
            background: colors.background,
            surface: colors.surfaceContainer,
            onSurface: colors.onSurface,
            onSurfaceMuted: colors.onSurfaceMuted,
            primary: colors.primary,
            track: colors.surfaceVariant,
            ripple: withAlpha(colors.onSurface, 0.1),
          }}
          strings={{ progress, percent, ...screenStrings }}
          formatDate={formatDate}
        />
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
