import { memo } from 'react';

import { StyleSheet } from 'react-native';

import { HStack } from '@expo/ui/swift-ui';
import { frame, glassEffect } from '@expo/ui/swift-ui/modifiers';

import { SwiftUIHost } from '@/ui';

// The collapsed banner's fill, as SwiftUI's real Liquid Glass rather than a
// solid colour — so the library's cover art shows through the thing floating
// over it instead of being blocked by a slab.
//
// This was tried once before, on the banner as it USED to be: a full-bleed bar
// welded to the bottom of a pure-black screen. It failed for a reason that no
// longer holds — glass refracts what is behind it, and behind that bar there
// was nothing. The banner is now a detached rectangle floating over the grid,
// which is exactly the case the material is for.
//
// Purely decorative and explicitly non-interactive: the banner's own row of
// controls sits above this, and a Host that swallowed touches would eat them.
//
// iOS ONLY — `PlayerSheet` mounts it behind `BANNER_GLASS`. Material has no
// Liquid Glass and wants none: a floating surface there is defined by its
// tonal fill and its elevation, both of which the banner already has.
//
// MEMOIZED for the same reason `GlassSurfaceIos` is: adaptive glass re-picks
// its treatment when the modifier is re-sent, and the sheet re-renders far
// more often than this box changes.
type BannerGlassProps = {
  width: number;
  height: number;
  radius: number;
};

export const BannerGlassIos = memo(function BannerGlassIos({
  width,
  height,
  radius,
}: BannerGlassProps) {
  return (
    // `ignoreSafeArea`: a Host insets its SwiftUI content for the safe area by
    // default, which shifts the material off the box it is supposed to fill
    // and leaves the banner outlined twice.
    <SwiftUIHost
      style={StyleSheet.absoluteFill}
      ignoreSafeArea="all"
      pointerEvents="none"
    >
      <HStack
        modifiers={[
          // Sized BEFORE the effect, or the material hugs its (empty) content
          // instead of filling the banner — the same ordering trap the header
          // button hit.
          frame({ height, width }),
          glassEffect({
            glass: { variant: 'regular' },
            shape: 'roundedRectangle',
            cornerRadius: radius,
          }),
        ]}
      >
        {/* Deliberately empty: the frame gives the material its size, and the
            banner's own content is drawn by React Native above it. */}
        {null}
      </HStack>
    </SwiftUIHost>
  );
});
