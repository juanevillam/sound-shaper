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
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {logo({ size: glyphSize, color: tile.ink })}
    </View>
  );
};
