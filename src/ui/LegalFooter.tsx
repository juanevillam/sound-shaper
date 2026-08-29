import React, { useState } from 'react';

import { StyleSheet, Text } from 'react-native';

import { withAlpha } from '@portfolio/core';

import { PRESSED_OPACITY } from './SquashPressable';
import { spacing } from './tokens';

export type WelcomeLegal = {
  /** Disclaimer sentence carrying `{privacy}` and `{terms}` placeholders,
   *  replaced by the tappable page labels (keeps the copy translatable
   *  without the shared screen owning any strings). */
  text: string;
  privacyLabel: string;
  termsLabel: string;
  onPressPrivacy: () => void;
  onPressTerms: () => void;
};

type LegalFooterProps = {
  legal: WelcomeLegal;
  colors?: { onSurfaceMuted?: string; primary?: string };
};

/**
 * One legal page's link, with the press feedback an inline text action is
 * supposed to have.
 *
 * TWO THINGS ARE WRONG WITH A BARE `<Text onPress>` AND ONLY THE FIRST IS
 * OBVIOUS. On iOS, UIKit draws its own highlight behind a pressed text range —
 * an opaque grey block that traces the TEXT RUN, so a link that wraps across a
 * line break renders as two mismatched slabs sitting under the words, which is
 * what Juan reported (2026-08-29). `suppressHighlighting` takes it off. On
 * BOTH platforms there was then nothing left: no fade, no ripple, no state at
 * all — so the highlight was the only feedback, and it was the wrong one.
 *
 * The replacement is the portfolio's own term rather than a new treatment:
 * inline rows and TEXT ACTIONS FADE at `PRESSED_OPACITY`, which is what the
 * snackbar's action and every inline row already do. It is applied to the
 * link's COLOUR via `withAlpha` rather than as an `opacity` style, because a
 * nested `Text` does not reliably composite its own opacity layer on Android —
 * the colour is the one channel that behaves identically on both.
 */
function LegalLink({
  label,
  color,
  onPress,
}: {
  label: string;
  color?: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Text
      suppressHighlighting
      style={[
        styles.link,
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

/**
 * The auth disclaimer under the welcome screen's sign-in buttons — muted
 * footnote copy with the two legal pages as inline tinted links. Pure RN so
 * both platform variants render the identical footer (nested-text links are
 * painful in Compose/SwiftUI bridges but native to RN Text).
 */
export function LegalFooter({ legal, colors }: LegalFooterProps) {
  const segments = legal.text.split(/(\{privacy\}|\{terms\})/);

  return (
    <Text style={[styles.legal, { color: colors?.onSurfaceMuted }]}>
      {segments.map((segment, index) => {
        if (segment === '{privacy}')
          return (
            <LegalLink
              key={index}
              label={legal.privacyLabel}
              color={colors?.primary}
              onPress={legal.onPressPrivacy}
            />
          );
        if (segment === '{terms}')
          return (
            <LegalLink
              key={index}
              label={legal.termsLabel}
              color={colors?.primary}
              onPress={legal.onPressTerms}
            />
          );

        return segment;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Footnote metrics (12/16) on the platform system font, centered under the
  // last auth button.
  legal: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  link: { fontWeight: '600' },
});
