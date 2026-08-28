import { useState } from 'react';

import { Platform, StyleSheet } from 'react-native';

import { withAlpha } from '@portfolio/core';
import {
  TrophiesScreen,
  TrophyDetailSheet,
  useTrophies,
} from '@portfolio/trophies';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useTrophyContent } from '@/hooks/useTrophyContent';
import { useI18n } from '@/i18n';

export default function TrophiesRoute() {
  const { colors, scheme, seedColor } = useAppTheme();
  const { t, locale } = useI18n();
  const { copy, screenStrings } = useTrophyContent();
  const { trophies, earned, total } = useTrophies(copy);
  // The shared screen owns its scroller — hand it the M3 bar-lift.
  const { scrollProps } = useHeaderScroll();

  // Tapping a row opens its detail sheet — the objective is worth reading in
  // full, and the list truncates longer ones.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = trophies.find(trophy => trophy.id === selectedId) ?? null;

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
          scrollProps={scrollProps}
          onTrophyPress={trophyId =>
            // iOS presents the detail as a native form-sheet ROUTE; Android
            // mounts the Compose sheet in place.
            Platform.OS === 'ios'
              ? router.push({
                  pathname: '/trophy-detail',
                  params: { trophyId },
                })
              : setSelectedId(trophyId)
          }
        />
      </SafeAreaView>

      {selected ? (
        <TrophyDetailSheet
          trophy={selected}
          tierName={screenStrings.tierNames[selected.tier]}
          achievedLabel={screenStrings.achievedLabel}
          lockedLabel={screenStrings.lockedLabel}
          formatDate={formatDate}
          onClose={() => setSelectedId(null)}
          // The package takes the palette and the Host theming as props — the
          // app's ThemedHost is app code (see the lifted sheet's header).
          colors={{
            onSurface: colors.onSurface,
            onSurfaceMuted: colors.onSurfaceMuted,
          }}
          colorScheme={scheme}
          seedColor={seedColor}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
