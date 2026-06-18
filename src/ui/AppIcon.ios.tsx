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
  'arrow-downward': 'arrow.down',
  'arrow-upward': 'arrow.up',
  check: 'checkmark',
  chevron: 'chevron.right',
  close: 'xmark',
  'dark-mode': 'circle.lefthalf.filled',
  delete: 'trash',
  // iOS reorder affordance is the three-line grabber, not the six-dot grid.
  'drag-indicator': 'line.3.horizontal',
  edit: 'pencil',
  favorite: 'heart',
  'favorite-filled': 'heart.fill',
  flight: 'airplane',
  groups: 'person.2',
  home: 'house',
  'home-filled': 'house.fill',
  info: 'info.circle',
  language: 'globe',
  lock: 'lock',
  logout: 'rectangle.portrait.and.arrow.right',
  'more-vert': 'ellipsis',
  notifications: 'bell',
  'notifications-filled': 'bell.fill',
  palette: 'paintpalette',
  person: 'person',
  'person-add': 'person.badge.plus',
  'person-filled': 'person.fill',
  public: 'globe',
  // SF Symbols has no rocket glyph at the deployment target; sparkles is the
  // conventional "new and shiny" stand-in.
  'rocket-launch': 'sparkles',
  search: 'magnifyingglass',
  send: 'paperplane',
  settings: 'gearshape',
  'settings-filled': 'gearshape.fill',
  share: 'square.and.arrow.up',
  star: 'star',
  'star-filled': 'star.fill',
  trophy: 'trophy',
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
