import React, { type ReactNode, useMemo } from 'react';

import { View } from 'react-native';

import Svg, {
  Defs,
  FeGaussianBlur,
  Filter,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

/**
 * ONE BRAND TILE, BOTH PLATFORMS.
 *
 * The mark on its ground is the app's ICON, and an icon is a brand object
 * rather than a platform control — the one in-app exception the brand rules
 * carve out. So it is drawn the same way everywhere, and the file has no
 * `.ios` twin.
 *
 * IT USED TO. Android had a flat rounded rect with a hairline, on the stated
 * grounds that "Android's icons ARE flat" and that a soft treatment could not
 * be rendered there anyway, because `react-native-svg`'s `FeGaussianBlur`
 * no-ops on Android. **That second half stopped being true and nobody
 * re-checked it.** Rendered verbatim on a Galaxy A54 against
 * `react-native-svg` 15.15.4 (2026-08-29): the squircle, the shine and the
 * blurred contact shadow all draw correctly. Measured falloff below the tile
 * in light — 198 at the edge easing back to the page's 241 over ~24px, which
 * is a real gaussian rather than a hard edge. Dark is correspondingly subtle,
 * a black shadow having little to say on a near-black page, exactly as on iOS.
 *
 * The Android tile also carried an `elevation` for separation. It is gone: the
 * SVG shadow is the separation now, and it follows the SQUIRCLE, where
 * `elevation` traces the view's rounded-RECT outline.
 *
 * WHAT FOLLOWS IS APPLE'S RENDERING, AND IT IS A HAND-MADE COPY THAT DOES NOT
 * UPDATE ITSELF. When iOS changes its icon material, re-measure with `ictool`
 * and retune these constants.
 *
 * iOS shapes an app icon with a **superellipse**, not a rounded rectangle —
 * `borderRadius` gives circular corners that visibly disagree with every icon
 * beside it. Fitting `|x|ⁿ + |y|ⁿ = 1` against the alpha mask of a real iOS 26
 * icon (rendered by Xcode's own `ictool` from an empty Icon Composer document)
 * lands on **n = 4.5**, sub-pixel accurate — 4.0 and 5.0 are both 2× worse.
 */
const SQUIRCLE_N = 4.5;
/** Perimeter samples. The path is built once per size and cached. */
const SQUIRCLE_STEPS = 256;

const squirclePath = (size: number) => {
  const r = size / 2;
  const exp = 2 / SQUIRCLE_N;
  const points: string[] = [];

  for (let i = 0; i <= SQUIRCLE_STEPS; i += 1) {
    const t = (i / SQUIRCLE_STEPS) * 2 * Math.PI;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = r + Math.sign(cos) * r * Math.abs(cos) ** exp;
    const y = r + Math.sign(sin) * r * Math.abs(sin) ** exp;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return `M${points.join('L')}Z`;
};

/**
 * The vertical falloff iOS paints across an icon: a bright lip at the very top
 * edge, a long darkening body, and a second softer lip at the bottom — what
 * reads as the icon's "shine". Every stop is **measured**, not invented: we fed
 * our own ground colour to Icon Composer's `automatic-gradient` (the same
 * derivation Apple's own icons use) via `ictool`, then sampled the render
 * column by column. Offsets are fractions of the tile's height.
 */
const TILE_GRADIENT = {
  light: [
    ['0', '#FFFFFF'],
    ['0.008', '#FFFFFF'],
    ['0.016', '#FDFDFD'],
    ['0.2', '#F5F5F6'],
    ['0.5', '#EFEFEE'],
    ['0.8', '#E2E2E1'],
    ['0.984', '#E4E4E5'],
    ['0.992', '#EEEEEE'],
    ['1', '#F9F9F9'],
  ],
  dark: [
    ['0', '#727272'],
    ['0.008', '#5A5A59'],
    ['0.016', '#414141'],
    ['0.2', '#2C2D2D'],
    ['0.5', '#222222'],
    ['0.8', '#181817'],
    ['0.984', '#1E1D1E'],
    ['0.992', '#2E2E2D'],
    ['1', '#3E3E3E'],
  ],
} as const;

/** Mark ink — the icon's own foreground, flat (the mark never gets the shine). */
const TILE_INK = { light: '#222222', dark: '#F5F5F5' } as const;

/**
 * The contact shadow under the tile. On the Home Screen this is what separates
 * an icon from the wallpaper; in-app it is the whole reason a `#F5F5F5` tile
 * doesn't dissolve into a `#F2F2F7` screen. Drawn in SVG rather than with the
 * view's `shadow*` props because those trace the view's rectangular bounds, not
 * the squircle.
 */
const SHADOW = {
  light: { opacity: 0.18, blur: 0.035, dy: 0.045 },
  dark: { opacity: 0.5, blur: 0.045, dy: 0.05 },
} as const;

/** Room around the tile for the shadow to fall into, as a fraction of size. */
const SHADOW_PAD = 0.18;

export type BrandTileProps = {
  size: number;
  glyphSize: number;
  scheme: 'light' | 'dark';
  logo: (options: { size: number; color: string }) => ReactNode;
};

/**
 * The app's own icon, rendered in-app the way iOS renders it on the Home
 * Screen: superellipse silhouette, the measured vertical shine, and a contact
 * shadow. The mark itself stays flat — Icon Composer's material would fill our
 * stroked glyphs into solid blobs, which is the opposite of the brand.
 *
 * Shared by both platforms; see the top of this file for why the Android
 * variant was retired rather than kept flat.
 */
export const BrandTile = ({
  size,
  glyphSize,
  scheme,
  logo,
}: BrandTileProps) => {
  const pad = Math.round(size * SHADOW_PAD);
  const canvas = size + pad * 2;
  const path = useMemo(() => squirclePath(size), [size]);
  const shadow = SHADOW[scheme];

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={canvas}
        height={canvas}
        style={{ position: 'absolute', left: -pad, top: -pad }}
      >
        <Defs>
          <LinearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
            {TILE_GRADIENT[scheme].map(([offset, color]) => (
              <Stop key={offset} offset={offset} stopColor={color} />
            ))}
          </LinearGradient>
          <Filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation={size * shadow.blur} />
          </Filter>
        </Defs>
        <Path
          d={path}
          fill="#000000"
          opacity={shadow.opacity}
          filter="url(#shadow)"
          translate={[pad, pad + size * shadow.dy]}
        />
        <Path d={path} fill="url(#tile)" translate={[pad, pad]} />
      </Svg>
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {logo({ size: glyphSize, color: TILE_INK[scheme] })}
      </View>
    </View>
  );
};
