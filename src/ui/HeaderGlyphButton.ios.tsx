import { Image, type ImageProps } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import { useAppTheme } from '@portfolio/core';

import { SwiftUIHost } from './SwiftUIHost';

/**
 * A single SF Symbol bar-button item, shared by every portfolio app's iOS
 * navigation bars. `Image` exposes `onPress` directly, so no `Button` wrapper
 * is needed.
 *
 * It lives here rather than per app because the two apps had already drifted:
 * the starter's glyphs were label-coloured at 24/20pt while Topper's were
 * accent-tinted at 22pt. The geometry and the colour rule are the shared part;
 * each app keeps a thin named adapter (`HeaderSettingsButton`,
 * `HeaderCloseButton`) that supplies its own route and its own translation.
 *
 * LABEL-COLOURED, never accent-tinted — and this reversed on iOS 26. The older
 * rule claimed Apple tints every interactive bar element; both Photos' select
 * and Files' overflow were re-measured on iOS 26.5 and are WHITE (band-scanning
 * either nav bar returns ZERO blue pixels and thousands of white ones). The
 * Liquid Glass capsule is now what marks a bar item tappable, so the glyph goes
 * back to the content colour and the accent is reserved for SELECTION —
 * Photos' active tab is the only blue thing on screen.
 *
 * Android is the opposite by design — Material app-bar icons are onSurface and
 * the ripple carries the affordance, which lands in the same place for a
 * different reason.
 */

/** Standard bar glyph: sized against the 17pt inline title beside it. */
export const HEADER_GLYPH_SIZE = 24;

/**
 * A sheet's dismiss glyph is the one bar item NOT sized against a title —
 * Apple draws it noticeably larger than an inline title's cap height so it
 * stays an easy target inside the fixed 43.3pt capsule.
 */
export const HEADER_CLOSE_GLYPH_SIZE = 20;

export type HeaderGlyphButtonProps = {
  /**
   * SF Symbol name, e.g. `gearshape` / `xmark` / `plus`. Typed off `Image`'s
   * own symbol union so a misspelling fails at compile time rather than
   * rendering an empty bar slot.
   */
  systemName: NonNullable<ImageProps['systemName']>;
  /** Already-translated accessibility label (the package has no translator). */
  label: string;
  onPress: () => void;
  size?: number;
};

export function HeaderGlyphButtonIos({
  systemName,
  label,
  onPress,
  size = HEADER_GLYPH_SIZE,
}: HeaderGlyphButtonProps) {
  const { colors } = useAppTheme();

  return (
    <SwiftUIHost matchContents>
      <Image
        systemName={systemName}
        size={size}
        color={colors.onSurface}
        onPress={onPress}
        modifiers={[accessibilityLabel(label)]}
      />
    </SwiftUIHost>
  );
}
