import { useRef } from 'react';

import { StyleSheet, View } from 'react-native';

import {
  Column,
  ModalBottomSheet,
  RNHostView,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import {
  tierColor,
  TrophyIcon,
  type ResolvedTrophy,
} from '@portfolio/trophies';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';

const ICON_SIZE = 64;

type TrophyDetailSheetProps = {
  trophy: ResolvedTrophy;
  tierName: string;
  /** "Earned" prefix for the date line on an earned trophy. */
  achievedLabel: string;
  lockedLabel: string;
  formatDate: (achievedAt: number) => string;
  onClose: () => void;
};

// Native bottom sheet for one trophy: the tier-colored glyph (or a padlock when
// locked) shown BARE, matching the list rows rather than sitting in a badge, a
// title, a `tier · status` caption, and the objective — which reads the same
// whether the trophy is earned or still locked. Gets its OWN Host: a sheet
// mounted beside other Compose content flickers its siblings. The glyph is the
// package's RN SVG, bridged back into Compose via RNHostView.
export function TrophyDetailSheet({
  trophy,
  tierName,
  achievedLabel,
  lockedLabel,
  formatDate,
  onClose,
}: TrophyDetailSheetProps) {
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const { colors } = useAppTheme();

  // Same description whether earned or locked; only the caption's date/lock differs.
  const body = trophy.description;
  const caption =
    trophy.unlocked && trophy.achievedAt !== null
      ? `${tierName} · ${achievedLabel} ${formatDate(trophy.achievedAt)}`
      : `${tierName} · ${lockedLabel}`;

  const iconColor = trophy.unlocked
    ? tierColor(trophy.tier)
    : colors.onSurfaceMuted;

  return (
    <ThemedHost matchContents>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), padding(24, 12, 24, 24)]}
        >
          <RNHostView matchContents>
            <View style={styles.iconWrap}>
              <TrophyIcon
                color={iconColor}
                size={ICON_SIZE}
                locked={!trophy.unlocked}
              />
            </View>
          </RNHostView>

          <Text
            color={colors.onSurface}
            style={{ typography: 'titleLarge', textAlign: 'center' }}
          >
            {trophy.title}
          </Text>

          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge', textAlign: 'center' }}
          >
            {caption}
          </Text>

          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'bodyMedium', textAlign: 'center' }}
          >
            {body}
          </Text>
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    height: ICON_SIZE,
    justifyContent: 'center',
    width: ICON_SIZE,
  },
});
