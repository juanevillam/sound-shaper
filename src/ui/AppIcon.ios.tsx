import React from 'react';

import { Image, type ImageProps } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';

import { type AppIconProps } from './AppIcon';
import { type IconName } from './icons';

/**
 * iOS counterpart of the Android `AppIcon`. The shared icon set is Material
 * Symbols (Android vector drawables); their natural iOS equivalent is an SF
 * Symbol, so this maps each typed `IconName` to its closest SF Symbol and renders
 * a SwiftUI `Image`. Like the Android `AppIcon`, it returns a bare view meant to
 * sit inside a parent SwiftUI `Host` (e.g. `SwiftUIHost`).
 *
 * Keeps the SAME public prop API (`AppIconProps`) as the Android variant so app
 * code and the shared screens stay platform-agnostic — Android-only props
 * (`modifiers`, `contentDescription`, etc.) are translated where there's an iOS
 * analog and otherwise ignored.
 */
const SF_SYMBOLS = {
  add: 'plus',
  'content-cut': 'scissors',
  chevron: 'chevron.right',
  delete: 'trash',
  edit: 'pencil',
  // THE SOUNDING-ROW MARKER, and the SF side is not a translation of the
  // Material glyph — it is what this app's own iOS twin already draws for the
  // identical job. Sound Shaper's `clips` route marks the playing row with
  // `speaker.wave.2.fill`, so mapping the Material equalizer bars onto
  // `waveform` would have put two different marks on one feature's two
  // platforms. The name stays Material's because the icon SET is.
  'graphic-eq': 'speaker.wave.2.fill',
  image: 'photo',
  'more-vert': 'ellipsis',
  'music-note': 'music.note',
  person: 'person',
  settings: 'gearshape',
  tune: 'slider.horizontal.3',
  warning: 'exclamationmark.triangle',
} satisfies Record<IconName, NonNullable<ImageProps['systemName']>>;

export const AppIcon = ({
  name,
  size,
  tint,
  contentDescription,
}: AppIconProps) => (
  <Image
    systemName={SF_SYMBOLS[name]}
    size={size}
    color={tint ?? undefined}
    modifiers={
      contentDescription ? [accessibilityLabel(contentDescription)] : undefined
    }
  />
);
