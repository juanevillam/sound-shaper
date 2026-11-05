import React from 'react';

import { Image } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';

import { SF_SYMBOLS, type IconName } from './icons';

export type AppIconProps = {
  name: IconName;
  size?: number;
  tint?: string | null;
  contentDescription?: string;
};

/**
 * An SF Symbol by the app's typed icon name (`icons.ts`), as a bare SwiftUI
 * `Image` meant to sit inside a parent `Host` (e.g. `SwiftUIHost`).
 */

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
