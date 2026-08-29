import React, { type ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';

/** Corner radius as a fraction of the tile, matching the app-icon silhouette. */
const RADIUS_RATIO = 0.25;

/**
 * The icon's two grounds and its ink, swapped per appearance — the iOS
 * base-icon neutrals (see AGENTS.md → Brand). The hairline keeps the tile's
 * edge readable when its ground and the screen behind it sit at nearly the
 * same value.
 */
const TILE = {
  light: { bg: '#F5F5F5', ink: '#222222', hairline: 'rgba(0, 0, 0, 0.12)' },
  dark: {
    bg: '#222222',
    ink: '#F5F5F5',
    hairline: 'rgba(255, 255, 255, 0.12)',
  },
} as const;

/**
 * M3 elevation under the tile, and the Android counterpart to the contact
 * shadow `BrandTile.ios.tsx` draws.
 *
 * The brand ground is FIXED (#F5F5F5 / #222222) while the page behind it is
 * the wallpaper-derived Material surface, so the two can land on the same
 * value with nothing between them. Measured on a Galaxy A54 (light): page
 * #F1F1F3 against the tile's #F5F5F5 — a delta of 4 — leaving the 12%
 * hairline as the only thing separating them, at one pixel wide.
 *
 * Not a port of the iOS shine: Android's own answer to "a surface that has to
 * read above its background" is elevation, so the tile takes M3 level 2. It is
 * applied in BOTH appearances because Material elevates a surface whatever the
 * scheme; in dark the ground already clears the page (#222222 on #010102) and
 * the shadow simply has little left to do.
 */
const ELEVATION = 3;

export type BrandTileProps = {
  size: number;
  glyphSize: number;
  scheme: 'light' | 'dark';
  logo: (options: { size: number; color: string }) => ReactNode;
};

/**
 * Android's app-icon tile: flat, because Android's icons *are* flat — adaptive
 * icons carry no gloss and Material draws its own containers. The iOS
 * counterpart (`BrandTile.ios.tsx`) reproduces the Home Screen's superellipse,
 * shine and contact shadow instead; the two are siblings, not clones.
 *
 * Flat is not the same as unseparated, though — see `ELEVATION`.
 */
export const BrandTile = ({
  size,
  glyphSize,
  scheme,
  logo,
}: BrandTileProps) => {
  const tile = TILE[scheme];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * RADIUS_RATIO,
        backgroundColor: tile.bg,
        borderColor: tile.hairline,
        borderWidth: StyleSheet.hairlineWidth,
        elevation: ELEVATION,
        // RN defaults Android's shadow ink to black already, but the role is
        // stated rather than inherited — `colors.shadow` is black in both
        // schemes for exactly this.
        shadowColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {logo({ size: glyphSize, color: tile.ink })}
    </View>
  );
};
