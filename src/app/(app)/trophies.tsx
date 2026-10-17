import { useState } from 'react';

import { Platform, StyleSheet } from 'react-native';

import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/Screen';
import { withAlpha, useAppTheme } from '@/core';
// DEV LAB — these imports and the picker below go with `src/dev`.
import { UI_STATE_LAB, useUiStateLab } from '@/dev/uiStateLab';
import { UiStateLabBar } from '@/dev/UiStateLabBar';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { formatAchievedDate, useTrophyContent } from '@/hooks/useTrophyContent';
import { useI18n } from '@/i18n';
import { TrophiesScreen, TrophyDetailSheet, useTrophies } from '@/trophies';

export default function TrophiesRoute() {
  const { colors, scheme } = useAppTheme();
  const { locale } = useI18n();
  const { copy, screenStrings } = useTrophyContent();
  const { trophies, earned, total, hydrated } = useTrophies(copy);

  /**
   * DEV LAB — applied to the value the route already derives, so the branch
   * that renders is the real one. The iOS twin has read this since the lab
   * landed; this side passed no `loading` at all, so Android never stood the
   * pre-hydration placeholder and a cold open said a confident "0 of 7".
   */
  const trophiesLab = useUiStateLab(state => state.trophies);
  const lab = UI_STATE_LAB && trophiesLab !== 'live';
  const loading = lab ? trophiesLab === 'skeleton' : !hydrated;
  // The shared screen owns its scroller — hand it the M3 bar-lift.
  const { scrollProps } = useHeaderScroll();

  // Tapping a row opens its detail sheet — the objective is worth reading in
  // full, and the list truncates longer ones.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = trophies.find(trophy => trophy.id === selectedId) ?? null;

  // Completion %, locale-formatted (e.g. "43%") — shown opposite the count.
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format(
    total > 0 ? earned / total : 0,
  );

  const formatDate = (achievedAt: number) =>
    formatAchievedDate(locale, achievedAt);

  return (
    <Screen>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <TrophiesScreen
          trophies={trophies}
          earned={earned}
          total={total}
          // Before the store hydrates every trophy reads locked, so the summary
          // states a confident "0 of 7" at 0% — a wrong answer, not a pending
          // one. The package's own placeholder says so instead.
          loading={loading}
          colors={{
            background: colors.background,
            surface: colors.surfaceContainer,
            onSurface: colors.onSurface,
            onSurfaceMuted: colors.onSurfaceMuted,
            primary: colors.primary,
            track: colors.surfaceVariant,
            ripple: withAlpha(colors.onSurface, 0.1),
          }}
          strings={{ percent, ...screenStrings }}
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

      {/* DEV LAB: state picker. Delete with `src/dev`. */}
      {UI_STATE_LAB ? <UiStateLabBar screen="trophies" /> : null}

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
            // The disc behind a LOCKED glyph — the quiet empty-media step on
            // Android, distinct from the sheet's own container.
            lockedDisc: colors.surfaceVariant,
          }}
          colorScheme={scheme}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
