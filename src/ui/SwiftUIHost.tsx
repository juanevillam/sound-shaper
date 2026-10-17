import { Host, type HostProps } from '@expo/ui/swift-ui';

import { useAppTheme } from '@/core';

// iOS counterpart of `ThemedHost`: the SwiftUI embed point. SwiftUI has no
// `getMaterialColors`; on iOS the app's theme resolves to core's `IOS_COLORS`
// (Apple system colors). We still forward `colorScheme` so the
// native SwiftUI views (Toggle, Slider, system chrome) render light/dark to
// match the app theme.
export function SwiftUIHost(props: HostProps) {
  const { scheme } = useAppTheme();
  return <Host colorScheme={scheme} {...props} />;
}
