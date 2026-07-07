import { Host, type HostProps } from '@expo/ui/swift-ui';

import { useAppTheme } from '@portfolio/core';

// iOS counterpart of `ThemedHost`: the SwiftUI embed point for every iOS
// showcase demo. SwiftUI has no `getMaterialColors`; on iOS the app's theme
// resolves to core's `IOS_COLORS` (Apple system colors) — see
// docs/expo-ui-customizations.md. We still forward `colorScheme` so the
// native SwiftUI views (Toggle, Slider, system chrome) render light/dark to
// match the app theme.
export function SwiftUIHost(props: HostProps) {
  const { scheme } = useAppTheme();
  return <Host colorScheme={scheme} {...props} />;
}
