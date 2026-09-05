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
  // The account entry's glyph — the same symbol Topper's iOS Profile bar
  // states directly through HeaderGlyphGroupIos.
  'account-circle': 'person.crop.circle',
  add: 'plus',
  apps: 'square.grid.3x3',
  // iOS back is the chevron, not Material's arrow.
  'arrow-back': 'chevron.left',
  'arrow-downward': 'arrow.down',
  'arrow-upward': 'arrow.up',
  block: 'nosign',
  check: 'checkmark',
  'content-cut': 'scissors',
  chevron: 'chevron.right',
  'chevron-down': 'chevron.down',
  close: 'xmark',
  'dark-mode': 'circle.lefthalf.filled',
  delete: 'trash',
  'delete-forever': 'trash.slash',
  devices: 'laptopcomputer.and.iphone',
  'manage-accounts': 'person.crop.circle.badge.checkmark',
  // iOS reorder affordance is the three-line grabber, not the six-dot grid.
  'drag-indicator': 'line.3.horizontal',
  edit: 'pencil',
  extension: 'puzzlepiece.extension',
  favorite: 'heart',
  'favorite-filled': 'heart.fill',
  flag: 'flag',
  flight: 'airplane',
  // THE SOUNDING-ROW MARKER, and the SF side is not a translation of the
  // Material glyph — it is what this app's own iOS twin already draws for the
  // identical job. Sound Shaper's `clips` route marks the playing row with
  // `speaker.wave.2.fill`, so mapping the Material equalizer bars onto
  // `waveform` would have put two different marks on one feature's two
  // platforms. The name stays Material's because the icon SET is.
  'graphic-eq': 'speaker.wave.2.fill',
  groups: 'person.2',
  help: 'questionmark.circle',
  home: 'house',
  'home-filled': 'house.fill',
  image: 'photo',
  info: 'info.circle',
  language: 'globe',
  lock: 'lock',
  logout: 'rectangle.portrait.and.arrow.right',
  'more-vert': 'ellipsis',
  'music-note': 'music.note',
  notifications: 'bell',
  'notifications-filled': 'bell.fill',
  palette: 'paintpalette',
  pause: 'pause.fill',
  person: 'person',
  'person-add': 'person.badge.plus',
  'person-filled': 'person.fill',
  'play-arrow': 'play.fill',
  public: 'globe',
  report: 'exclamationmark.octagon',
  // SF Symbols has no rocket glyph at the deployment target; sparkles is the
  // conventional "new and shiny" stand-in.
  'rocket-launch': 'sparkles',
  search: 'magnifyingglass',
  send: 'paperplane',
  'sentiment-dissatisfied': 'face.dashed',
  settings: 'gearshape',
  'settings-filled': 'gearshape.fill',
  share: 'square.and.arrow.up',
  'skip-next': 'forward.end.fill',
  'skip-previous': 'backward.end.fill',
  sort: 'arrow.up.arrow.down',
  star: 'star',
  'star-filled': 'star.fill',
  trophy: 'trophy',
  tune: 'slider.horizontal.3',
  warning: 'exclamationmark.triangle',
  'visibility-off': 'eye.slash',
  widgets: 'square.grid.2x2',
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
