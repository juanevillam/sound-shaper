import { StyleSheet } from 'react-native';

import { Image } from '@expo/ui/swift-ui';

import { SwiftUIHost } from '@/ui';

import { type TrimGlyphProps } from './TrimGlyphs';

/**
 * iOS's clip-editor glyphs — SF Symbols, hosted. The Android base file has
 * the platform-split argument.
 *
 * THE SKIP INTERVAL IS ±15 ON BOTH PLATFORMS. This used to say Android skips
 * ±10, on the grounds that ±15 is Voice Memos' number and SF ships the badge
 * for it while Material does not. That shipped for a day and was reversed
 * (Juan, 2026-09-08): one number matters more than a stock badge, so Android
 * sets the digits as type over Google's own ring geometry. Both twins draw
 * `chrome.ts`'s `SKIP_SECONDS` and the a11y copy takes it as a parameter, so
 * neither platform's label can lie about its glyph.
 *
 * Each glyph hosts itself so the shared editor stays host-free; the host
 * states its box from the given size (never `matchContents` — the layout-path
 * rule), and the caller's slot sizes around it exactly as before the split.
 */
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
