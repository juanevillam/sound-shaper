import { View } from 'react-native';

import { TrophyDetailContent, useTrophies } from '@portfolio/trophies';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTrophyContent } from '@/hooks/useTrophyContent';
import { useI18n } from '@/i18n';

// iOS-only route: one trophy's detail as a content-hugging native form sheet
// (Android presents the Compose `TrophyDetailSheet` in place). The sheet's
// CONTENT lives in @portfolio/trophies (`TrophyDetailContent`) so this surface
// is pixel-identical across the portfolio — this route only resolves the
// trophy, localizes the caption, and passes the platform palette through.
function TrophyDetailSheetScreen() {
  const { trophyId } = useLocalSearchParams<{ trophyId: string }>();
  const { colors } = useAppTheme();
  const { locale } = useI18n();
  const { bottom } = useSafeAreaInsets();
  const { copy, screenStrings } = useTrophyContent();
  const { trophies } = useTrophies(copy);

  const trophy = trophies.find(entry => entry.id === trophyId);

  if (!trophy) return <View style={{ backgroundColor: colors.sheet }} />;

  const formatDate = (achievedAt: number) =>
    new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(achievedAt));

  const caption =
    trophy.unlocked && trophy.achievedAt !== null
      ? `${screenStrings.tierNames[trophy.tier]} · ${screenStrings.achievedLabel} ${formatDate(trophy.achievedAt)}`
      : `${screenStrings.tierNames[trophy.tier]} · ${screenStrings.lockedLabel}`;

  return (
    <TrophyDetailContent
      trophy={trophy}
      caption={caption}
      bottomInset={bottom}
      colors={{
        sheet: colors.sheet,
        lockedDisc: colors.surfaceContainer,
        onSurface: colors.onSurface,
        onSurfaceMuted: colors.onSurfaceMuted,
      }}
    />
  );
}

export default iosOnlyRoute(TrophyDetailSheetScreen);
