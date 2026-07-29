import type { ImageProps } from '@expo/ui/swift-ui';
import { type IconName } from '@portfolio/mobile-ui';

import { IconButton } from '@/components/ui/IconButton';

// Android base for `BarIconButton.ios.tsx`, which is where the interesting
// version lives: iOS gets SwiftUI's real Liquid Glass container.
//
// Material has no equivalent and wants none — an app-bar icon there is a bare
// glyph whose ripple carries the affordance — so this simply falls through to
// the app's standard icon button. Nothing on Android mounts it today (the
// Material app bar uses `HeaderIconButton`), but the base file has to exist
// for the import to resolve on both platforms.
//
// The two glyph names travel together because the platforms name their icons
// differently and the iOS variant needs an SF Symbol it can attach modifiers
// to, which the shared `AppIcon` mapping does not expose.
export type BarIconButtonProps = {
  /** Material icon, used on Android. */
  name: IconName;
  /** SF Symbol, used on iOS. Typed by @expo/ui so a wrong name won't compile;
   * the import is type-only, so nothing SwiftUI reaches the Android bundle. */
  systemName: NonNullable<ImageProps['systemName']>;
  onPress: () => void;
  accessibilityLabel: string;
  tint?: string;
};

export function BarIconButton({
  name,
  onPress,
  accessibilityLabel,
  tint,
}: BarIconButtonProps) {
  return (
    <IconButton
      name={name}
      onPress={onPress}
      tint={tint}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
