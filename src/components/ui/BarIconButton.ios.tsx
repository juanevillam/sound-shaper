import { Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  frame,
  glassEffect,
} from '@expo/ui/swift-ui/modifiers';
import { SwiftUIHost } from '@portfolio/mobile-ui';

import { type BarIconButtonProps } from '@/components/ui/BarIconButton';
import { useAppTheme } from '@/hooks/useAppTheme';

// A header action carrying REAL Liquid Glass — SwiftUI's own
// `.glassEffect(_:in:)`, not a fill that resembles it.
//
// Topper's profile and Expo Starter's home get this free: their headers are
// genuine navigation bars, so UIKit applies the material to the bar button
// itself. This app's home draws its own bar (the expanded player has to be
// able to cover it, and a native bar cannot carry both a large title and a
// button on RNS/iOS 26), so the effect has to be asked for explicitly.
//
// Order matters: `frame` sizes the button BEFORE the glass is applied, so the
// material fills a 44pt circle rather than hugging the glyph. `interactive`
// is what gives it the press response a real bar button has — the thing no
// static recreation can reproduce.
//
// Takes an SF Symbol name directly, exactly as the other two apps' header
// buttons do; the shared `AppIcon` mapping can't be used here because it
// accepts no modifiers.

const BUTTON_SIZE = 44;
const GLYPH_SIZE = 24;

export function BarIconButton({
  systemName,
  onPress,
  accessibilityLabel: label,
  tint,
}: BarIconButtonProps) {
  const { colors } = useAppTheme();

  return (
    <SwiftUIHost style={styles.host}>
      <Image
        systemName={systemName}
        size={GLYPH_SIZE}
        color={tint ?? colors.primary}
        onPress={onPress}
        modifiers={[
          frame({ height: BUTTON_SIZE, width: BUTTON_SIZE }),
          glassEffect({
            glass: { variant: 'regular', interactive: true },
            shape: 'circle',
          }),
          accessibilityLabel(label),
        ]}
      />
    </SwiftUIHost>
  );
}

const styles = { host: { height: BUTTON_SIZE, width: BUTTON_SIZE } } as const;
