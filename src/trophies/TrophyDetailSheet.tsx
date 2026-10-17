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

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  composeSheetBottomPadding,
  SHEET_HERO_BADGE_SIZE,
  SHEET_HERO_GLYPH_SIZE,
  SheetDragHandle,
} from '@/ui';

import { tierColor } from './tierColors';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy } from './types';

// THE HERO IS THE iOS SHEET'S — the glyph on a soft tier-tinted disc (the
// Game Center idiom; a bare floating icon read unfinished), at the shared
// badge/glyph sizes `TrophyDetailContent` draws. The two sheets are twins:
// same disc, same alpha, same ratio — only the container differs.
const DISC_SIZE = SHEET_HERO_BADGE_SIZE;
const ICON_SIZE = SHEET_HERO_GLYPH_SIZE;
// Tint strength for the disc behind the trophy glyph — `TrophyDetailContent`'s
// own number.
const DISC_ALPHA = 0.16;

// Local alpha helper (the package has no dependency on `src/core`): the
// tier colors are plain hex, so appending a 0–255 alpha byte is exact.
const withDiscAlpha = (hex: string) =>
  `${hex}${Math.round(DISC_ALPHA * 255)
    .toString(16)
    .padStart(2, '0')}`;

export type TrophyDetailSheetColors = {
  onSurface: string;
  onSurfaceMuted: string;
  /** Disc fill behind a LOCKED glyph (unlocked tints from the tier color). */
  lockedDisc: string;
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
};

// ANDROID-ONLY: the native Compose bottom sheet for one trophy — iOS presents
// the same content as the `trophy-detail` form-sheet ROUTE, whose body is
// `TrophyDetailContent` beside this file. Lifted here 2026-08-27: Topper and
// Sound Shaper each carried a 97.6%-identical copy, differing only in comment
// wording — the exact second-app re-implementation the shared-code audit hunts.
// Content: the tier-colored glyph on its soft tinted disc (the iOS sheet's
// hero, at the same shared sizes), a title, a `tier · status` caption at
// labelMedium, and the objective — which reads the same whether
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
}: TrophyDetailSheetProps) {
  const sheetRef = useRef<ModalBottomSheetRef>(null);
  const insets = useSafeAreaInsets();

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
    <Host matchContents colorScheme={colorScheme}>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded
        showDragHandle={false}
      >
        <SheetDragHandle />
        <Column
          horizontalAlignment="center"
          // The iOS sheet's rhythm: 8 between the text lines, with the disc
          // standing an extra 8 off the title (its wrapper's own padding).
          verticalArrangement={{ spacedBy: 8 }}
          // The bottom clears the navigation bar — a Compose sheet's window
          // runs to the SCREEN's edge, not to the top of the system bar. This
          // sheet is bottom-anchored and content-sized, so its LAST LINE sits
          // wherever the padding puts it whatever the trophy: band-scanned on
          // a Galaxy A54 (Android 16, 3-button nav) at a flat 24, the caption's
          // ink came to rest 753.42dp against a bar starting at 784.00 —
          // 30.58dp, where the three sheets in Sound Shaper reserve 64.
          // See `composeSheetBottomPadding`.
          modifiers={[
            fillMaxWidth(),
            padding(24, 12, 24, composeSheetBottomPadding(insets.bottom)),
          ]}
        >
          <RNHostView matchContents>
            {/* The disc's extra 8 below rides INSIDE the host's box (RN
                padding), so the bridged measurement already contains it. */}
            <View style={styles.heroWrap}>
              <View
                style={[
                  styles.disc,
                  {
                    backgroundColor: trophy.unlocked
                      ? withDiscAlpha(tierColor(trophy.tier))
                      : colors.lockedDisc,
                  },
                ]}
              >
                <TrophyIcon
                  color={iconColor}
                  size={ICON_SIZE}
                  locked={!trophy.unlocked}
                />
              </View>
            </View>
          </RNHostView>

          <Text
            color={colors.onSurface}
            style={{ typography: 'titleLarge', textAlign: 'center' }}
          >
            {trophy.title}
          </Text>

          {/* `labelMedium` — the iOS twin's caption step (it wore labelLarge
              here, a size up from its sibling; Juan: the subtitle reads
              smaller than the title by more than one step). */}
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelMedium', textAlign: 'center' }}
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
  // The host's box is STATED — width, height, and the disc's 8 extra below —
  // exactly as the old bare-icon wrapper stated its own. Left unsized, the
  // bridged host laid the disc out at the sheet's leading edge (seen on the
  // A54): never leave `matchContents` a box to work out.
  heroWrap: {
    alignItems: 'center',
    height: DISC_SIZE + 8,
    justifyContent: 'flex-start',
    width: DISC_SIZE,
  },
  disc: {
    alignItems: 'center',
    borderRadius: DISC_SIZE / 2,
    height: DISC_SIZE,
    justifyContent: 'center',
    width: DISC_SIZE,
  },
});
