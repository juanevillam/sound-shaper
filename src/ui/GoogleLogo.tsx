import React from 'react';

import Svg, { Path } from 'react-native-svg';

/**
 * Google's THREE published "Sign in with Google" button variants, transcribed
 * verbatim from https://developers.google.com/identity/branding-guidelines —
 * the one sanctioned exception to the no-color-literals rule, because Google
 * mandates these exact values and they must NOT follow the app theme. Strokes
 * are 1px, drawn inside (verified on-device: the light button's edge measures
 * #747775 at exactly 1pt).
 *
 * This table is only the SPEC. Which variant a scheme shows is each platform's
 * own decision, made in its button:
 *
 *   iOS      light → `light`   dark → `dark`
 *            BESIDE APPLE'S BUTTON it flips to the pair's pole instead —
 *            light → `dark`, dark → `light` — see `authButtonIos`.
 *   Android  light → `light`   dark → `dark`
 *            Each mode takes the matching row, so the button sits IN the UI
 *            rather than glowing on top of it. Android held the `neutral`
 *            light-gray slab in dark until 2026-09-08, when Juan asked for
 *            the iOS mapping: on a dark welcome screen the slab was the
 *            brightest thing on it.
 */
export const GOOGLE_BUTTON_VARIANTS = {
  light: { fill: '#FFFFFF', stroke: '#747775', label: '#1F1F1F' },
  dark: { fill: '#131314', stroke: '#8E918F', label: '#E3E3E3' },
  neutral: { fill: '#F2F2F2', stroke: undefined, label: '#1F1F1F' },
} as const;

export const GOOGLE_DISABLED_OPACITY = 0.38;

/** Standard multicolor "G" — may never be recolored or stretched. */
const G_PATHS = [
  {
    fill: '#4285F4',
    d: 'M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z',
  },
  {
    fill: '#34A853',
    d: 'M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z',
  },
  {
    fill: '#FBBC05',
    d: 'M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z',
  },
  {
    fill: '#EA4335',
    d: 'M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z',
  },
] as const;

export const GoogleGLogo = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    {G_PATHS.map(path => (
      <Path key={path.fill} d={path.d} fill={path.fill} />
    ))}
  </Svg>
);
