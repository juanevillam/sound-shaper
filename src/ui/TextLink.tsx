import React, { useState } from 'react';

import { StyleSheet, Text, type TextStyle } from 'react-native';

import { withAlpha } from '@/core';

import { PRESSED_OPACITY } from './SquashPressable';

/**
 * A TAPPABLE RUN OF TEXT INSIDE A SENTENCE — the welcome screen's author
 * credit and its two legal pages, on both platforms.
 *
 * TWO THINGS ARE WRONG WITH A BARE `<Text onPress>` AND ONLY THE FIRST IS
 * OBVIOUS. On iOS, UIKit draws its own highlight behind the pressed text range:
 * an opaque grey slab that traces the TEXT RUN, so a link that wraps across a
 * line break renders as two mismatched blocks sitting under the words (Juan,
 * 2026-08-29). `suppressHighlighting` takes it off. Underneath there was then
 * nothing at all — no fade, no ripple, no state — so that highlight had been
 * the only feedback these links had, and it was the wrong one.
 *
 * The replacement is the portfolio's own term rather than a new treatment:
 * inline rows and TEXT ACTIONS FADE at `PRESSED_OPACITY`. It is applied to the
 * link's COLOUR via `withAlpha` rather than as an `opacity` style, because a
 * nested `Text` does not reliably composite its own opacity layer on Android;
 * colour is the one channel that behaves identically on both. Measured on a
 * Galaxy A54 in light: #4979F6 -> #9BB4F4 held, a peak delta of 82/255.
 *
 * ANDROID'S AUTHOR CREDIT USES THIS INSTEAD OF A MATERIAL `TextButton`, which
 * is a deliberate departure from native-primitive-first and is recorded here as
 * that rule requires. What failed: a text button's ripple is Material's 10%
 * state layer, which at link size measured a peak delta of 18/255 in light and
 * 25/255 in dark — present, spec-correct, and imperceptible next to the 82
 * above. `@expo/ui` 57 exposes neither a ripple colour nor a press state
 * (`clickable` offers only `indication: boolean`), so there is no way to
 * strengthen it from JS. The button also carried
 * `ButtonDefaults.MinHeight`, which inflated the credit row and had to be
 * fought with an `offset`; that hack went with it.
 *
 * The real primitive for both cases is an inline `LinkAnnotation` span on
 * Android and a SwiftUI `Link` on iOS (which the iOS welcome screen does use,
 * for the credit — only the legal footer is shared RN). `@expo/ui` 57's
 * `TextSpanRecord` carries no press handler; see `docs/pending-upstream.md`.
 *
 * KNOWN LIMIT: the touch target is the text's own line box, not 48dp. That is
 * inherent to a link inside a sentence — padding it would push the words
 * apart — and it is what the legal links have always been.
 */
export type TextLinkProps = {
  label: string;
  /** Resting ink. The pressed state is this at `PRESSED_OPACITY`. */
  color?: string;
  onPress: () => void;
  /**
   * The link's weight, when the surrounding type is small enough that the
   * default stops carrying — `LegalFooter` is the one caller that passes it.
   * Defaults to regular, which is what the rest of this family renders.
   */
  weight?: TextStyle['fontWeight'];
};

export function TextLink({ label, color, onPress, weight }: TextLinkProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Text
      suppressHighlighting
      style={[
        styles.link,
        weight ? { fontWeight: weight } : null,
        { color: color && pressed ? withAlpha(color, PRESSED_OPACITY) : color },
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  /**
   * REGULAR by default — the tint is what says "link", and the weight is what
   * says "important". A tappable run inside prose is not more important than
   * the prose.
   *
   * It is also the weight the NATIVE half of this family renders: iOS's author
   * credit is a SwiftUI `Link` at plain `subheadline`, and a SwiftUI markdown
   * link is accent-on-regular. Apple tints links in fine print and leaves the
   * weight alone.
   *
   * `weight` overrides it where the type gets small enough that regular stops
   * carrying, which is a per-PLATFORM question rather than a per-caller one —
   * see `LegalFooter`, the only caller that passes it.
   */
  link: { fontWeight: '400' },
});
