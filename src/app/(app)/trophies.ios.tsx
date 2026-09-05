import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@portfolio/core';
import { TrophiesScreen, useTrophies } from '@portfolio/trophies';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetScreen } from '@/components/ui/SheetScreenIos';
// DEV LAB — delete with `src/dev/uiStateLab`.
import { UI_STATE_LAB, useUiStateLab } from '@/dev/uiStateLab';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTrophyContent } from '@/hooks/useTrophyContent';
import { useI18n } from '@/i18n';

/**
 * iOS trophies — the same screen the Android route renders (the list itself
 * lives in @portfolio/trophies) except a trophy's detail presents as the
 * trophy-detail form-sheet ROUTE instead of Android's in-place Compose sheet.
 *
 * IT IS A `SheetScreen`, not this app's `Screen`. The latter paints
 * `colors.background` — `#000000` in dark against the sheet's own `#1C1C1E` —
 * which would make this sheet read BLACK while the account sheet it opens from
 * does not. That is the exact defect `SheetScreenIos` exists to stop being
 * re-introduced.
 */
export default function TrophiesRoute() {
  const { colors } = useAppTheme();
  const { locale } = useI18n();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { copy, screenStrings } = useTrophyContent();
  const { trophies, earned, total, hydrated } = useTrophies(copy);

  /**
   * DEV LAB — applied to the value the route already derives, so the branch
   * that renders is the real one.
   */
  const trophiesLab = useUiStateLab(state => state.trophies);
  const lab = UI_STATE_LAB && trophiesLab !== 'live';
  const loading = lab ? trophiesLab === 'skeleton' : !hydrated;

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
    <SheetScreen screen="trophies">
      {/* The Host is SHORTENED for the home indicator rather than padded from
          inside: a native `Form` insets its own CONTENT for the safe area, not
          its frame, so nothing about the Host's box tells it the indicator is
          there. */}
      <View style={[styles.list, { paddingBottom: bottomInset }]}>
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
          onTrophyPress={trophyId =>
            router.push({ pathname: '/trophy-detail', params: { trophyId } })
          }
        />
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});
