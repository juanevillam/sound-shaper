import { View } from 'react-native';

import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { useAppTheme } from '@/core';
import { useTrophyContent } from '@/hooks/useTrophyContent';
import { TrophyDetailContent, useTrophies } from '@/trophies';

// iOS-only route: one trophy's detail as a content-hugging native form sheet
// (Android presents the Compose `TrophyDetailSheet` in place). The sheet's
// CONTENT lives in `src/trophies` (`TrophyDetailContent`), written once so it
// cannot drift — this route only resolves the
// trophy, localizes the caption, and passes the platform palette through.
function TrophyDetailSheetScreen() {
  const { trophyId } = useLocalSearchParams<{ trophyId: string }>();
  const { colors } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const { copy, trophyCaption } = useTrophyContent();
  const { trophies } = useTrophies(copy);

  const trophy = trophies.find(entry => entry.id === trophyId);

  if (!trophy) return <View style={{ backgroundColor: colors.sheet }} />;

  return (
    <TrophyDetailContent
      trophy={trophy}
      caption={trophyCaption(trophy)}
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
