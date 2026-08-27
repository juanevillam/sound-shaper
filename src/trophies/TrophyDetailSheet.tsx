import { useRef } from 'react';

import { StyleSheet, View, type ColorSchemeName } from 'react-native';

import {
  Column,
  Host,
  ModalBottomSheet,
  RNHostView,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { tierColor } from './tierColors';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy } from './types';

const ICON_SIZE = 64;

export type TrophyDetailSheetColors = {
  onSurface: string;
  onSurfaceMuted: string;
};

export type TrophyDetailSheetProps = {
  trophy: ResolvedTrophy;
  tierName: string;
  /** "Earned" prefix for the date line on an earned trophy. */
  achievedLabel: string;
  lockedLabel: string;
  formatDate: (achievedAt: number) => string;
  onClose: () => void;
  /** The app's palette — a package takes colors as props, never a theme hook. */
  colors: TrophyDetailSheetColors;
  /** The app's RESOLVED scheme, for the sheet's own Host (each app's
   *  `ThemedHost` is app code; the Host props are what it forwards). */
  colorScheme?: ColorSchemeName;
  seedColor?: string;
};

// ANDROID-ONLY: the native Compose bottom sheet for one trophy — iOS presents
// the same content as the `trophy-detail` form-sheet ROUTE, whose body is
// `TrophyDetailContent` beside this file. Lifted here 2026-08-27: Topper and
// Sound Shaper each carried a 97.6%-identical copy, differing only in comment
// wording — the exact second-app re-implementation the shared-code audit hunts.
// Content: the tier-colored glyph (or a padlock when locked) shown BARE,
// matching the list rows rather than sitting in a badge, a title, a
// `tier · status` caption, and the objective — which reads the same whether
// the trophy is earned or still locked. Gets its OWN Host: a sheet mounted
// beside other Compose content flickers its siblings. The glyph is this
// package's RN SVG, bridged back into Compose via RNHostView.
export function TrophyDetailSheet({
  trophy,
  tierName,
  achievedLabel,
  lockedLabel,
  formatDate,
  onClose,
  colors,
  colorScheme,
  seedColor,
}: TrophyDetailSheetProps) {
  const sheetRef = useRef<ModalBottomSheetRef>(null);

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
    <Host matchContents colorScheme={colorScheme} seedColor={seedColor}>
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
    </Host>
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
