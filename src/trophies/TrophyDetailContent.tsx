import { StyleSheet, Text, View } from 'react-native';

import {
  SHEET_HERO_GLYPH_SIZE,
  SHEET_HERO_SIZE,
  TEXT_VARIANTS,
} from '@portfolio/mobile-ui';

import { tierColor } from './tierColors';
import { TrophyIcon } from './TrophyIcon';
import { type ResolvedTrophy } from './types';

// One trophy's detail — the CONTENT of the iOS form-sheet route, shared by
// every app so the surface is pixel-identical across the portfolio (it drifted
// once: Sound Shaper re-implemented it without the disc). The glyph sits on a
// soft tier-tinted disc — the Game Center idiom; a bare floating icon read
// unfinished on the elevated sheet. Colors ride in as props like the package's
// other screens, so each app's platform palette applies.

// THE SHARED HERO BOX — see `sheetHero`. This disc was 88 against the
// verified-badge sheet's 64, on an otherwise identical layout.
const DISC_SIZE = SHEET_HERO_SIZE;
const ICON_SIZE = SHEET_HERO_GLYPH_SIZE;
// Tint strength for the disc behind the trophy glyph.
const DISC_ALPHA = 0.16;

// Local alpha helper (the package has no dependency on @portfolio/core): the
// tier colors are plain hex, so appending a 0–255 alpha byte is exact.
const withDiscAlpha = (hex: string) =>
  `${hex}${Math.round(DISC_ALPHA * 255)
    .toString(16)
    .padStart(2, '0')}`;

export type TrophyDetailContentColors = {
  /** Elevated sheet background (the form-sheet surface). */
  sheet: string;
  /** Disc fill behind a LOCKED glyph (unlocked tints from the tier color). */
  lockedDisc: string;
  onSurface: string;
  onSurfaceMuted: string;
};

export type TrophyDetailContentProps = {
  trophy: ResolvedTrophy;
  /** "{Tier} · Earned {date}" or "{Tier} · Locked" — the app localizes it. */
  caption: string;
  colors: TrophyDetailContentColors;
  /** Bottom safe-area inset (the sheet hugs content, so the app passes it). */
  bottomInset: number;
};

export function TrophyDetailContent({
  trophy,
  caption,
  colors,
  bottomInset,
}: TrophyDetailContentProps) {
  const iconColor = trophy.unlocked
    ? tierColor(trophy.tier)
    : colors.onSurfaceMuted;

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.sheet,
          paddingBottom: Math.max(bottomInset, 32),
        },
      ]}
    >
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
          size={ICON_SIZE}
          color={iconColor}
          locked={!trophy.unlocked}
        />
      </View>
      <Text style={[styles.title, { color: colors.onSurface }]}>
        {trophy.title}
      </Text>
      <Text style={[styles.caption, { color: colors.onSurfaceMuted }]}>
        {caption}
      </Text>
      <Text style={[styles.body, { color: colors.onSurfaceMuted }]}>
        {trophy.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  disc: {
    alignItems: 'center',
    borderRadius: DISC_SIZE / 2,
    height: DISC_SIZE,
    justifyContent: 'center',
    marginBottom: 8,
    width: DISC_SIZE,
  },
  // THE SHARED SCALE, not three hand-written pairs. `TEXT_VARIANTS` is
  // exported from `@portfolio/mobile-ui` for exactly this — "so package-level
  // components still render on the exact same steps as every app screen" — and
  // this file was writing the numbers out instead, which is how it came to
  // render ANDROID's body size on iOS: 14/20 against the 15/20 its sibling
  // sheet (`creator-info`, the verified-badge explainer) gets from
  // `bodyMedium`. Same layout, same padding, same hero rhythm, one step of type
  // apart.
  title: { ...TEXT_VARIANTS.titleLarge, textAlign: 'center' },
  caption: { ...TEXT_VARIANTS.labelMedium, textAlign: 'center' },
  body: { ...TEXT_VARIANTS.bodyMedium, textAlign: 'center' },
});
