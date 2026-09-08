import { StyleSheet } from 'react-native';

import { Image } from '@expo/ui/swift-ui';
import { SwiftUIHost } from '@portfolio/mobile-ui';

import { type TrimGlyphProps } from './TrimGlyphs';

/**
 * iOS's clip-editor glyphs — SF Symbols, hosted. The Android base file has
 * the platform-split argument (skip interval included: ±15 is Voice Memos'
 * number and SF ships the badge for it; Material does not, so Android skips
 * ±10 with its own set).
 *
 * Each glyph hosts itself so the shared editor stays host-free; the host
 * states its box from the given size (never `matchContents` — the layout-path
 * rule), and the caller's slot sizes around it exactly as before the split.
 */
export const SKIP_SECONDS = 15;

const hostStyle = (size: number) => ({ height: size, width: size });

export const SkipBackGlyph = ({ color, size }: TrimGlyphProps) => (
  <SwiftUIHost
    ignoreSafeArea="all"
    pointerEvents="none"
    style={[styles.host, hostStyle(size)]}
  >
    <Image systemName="gobackward.15" size={size} color={color} />
  </SwiftUIHost>
);

export const SkipForwardGlyph = ({ color, size }: TrimGlyphProps) => (
  <SwiftUIHost
    ignoreSafeArea="all"
    pointerEvents="none"
    style={[styles.host, hostStyle(size)]}
  >
    <Image systemName="goforward.15" size={size} color={color} />
  </SwiftUIHost>
);

export const CapChevron = ({
  color,
  size,
  direction,
}: TrimGlyphProps & { direction: 'left' | 'right' }) => (
  <SwiftUIHost
    ignoreSafeArea="all"
    pointerEvents="none"
    style={[styles.host, hostStyle(size)]}
  >
    <Image
      systemName={
        direction === 'left' ? 'chevron.compact.left' : 'chevron.compact.right'
      }
      size={size}
      color={color}
    />
  </SwiftUIHost>
);

const styles = StyleSheet.create({
  host: { alignItems: 'center', justifyContent: 'center' },
});
