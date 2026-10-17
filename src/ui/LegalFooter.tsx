import React from 'react';

import { Platform, StyleSheet, Text, type TextStyle } from 'react-native';

import { TextLink } from './TextLink';
import { spacing } from './tokens';

/**
 * THE FINE PRINT'S METRICS, AND THEY ARE PER-PLATFORM ON PURPOSE — each ladder
 * gives a different answer at this size, and the two typefaces behave
 * differently once the type gets this small.
 *
 * SF Pro carries an OPTICAL SIZE: Apple ships Text and Display cuts and
 * thickens the stems as the size drops, so a 13pt regular link stays sturdy.
 * Roboto has no optical axis — 12sp is 12sp scaled down, and its stems go
 * genuinely thin. Same nominal weight, different rendered sturdiness. Measured
 * on a Galaxy A54 as ink laid down by the link against the regular-weight prose
 * around it: 0.155 at weight 400, 0.190 at 500 (+23%), 0.203 at 600 (+31%).
 * Nearly the whole jump is at 500; 600 buys 7% more ink and reads chunky,
 * because Roboto snaps to a heavier cut rather than ramping.
 *
 * iOS therefore takes Apple's `footnote` (13/18) — the style Apple actually
 * sets consent and legal footers in, one step ABOVE the `caption1` 12/16 this
 * used to be for BOTH platforms — with the link left at regular, because
 * Apple tints fine-print links and does not embolden them.
 *
 * Android stays at Material's `bodySmall` (12/16), which is what it already
 * was and is correct for body copy, and gives the LINK weight 500. That is
 * `labelMedium`, Material's own style at 12sp, and a tappable run inside prose
 * is a label rather than body. There is no 13 on Material's scale to step to.
 */
const FOOTER = Platform.select({
  ios: {
    fontSize: 13,
    lineHeight: 18,
    linkWeight: '400' as TextStyle['fontWeight'],
  },
  default: {
    fontSize: 12,
    lineHeight: 16,
    linkWeight: '500' as TextStyle['fontWeight'],
  },
});

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
            <TextLink
              key={index}
              label={legal.privacyLabel}
              color={colors?.primary}
              weight={FOOTER.linkWeight}
              onPress={legal.onPressPrivacy}
            />
          );
        if (segment === '{terms}')
          return (
            <TextLink
              key={index}
              label={legal.termsLabel}
              color={colors?.primary}
              weight={FOOTER.linkWeight}
              onPress={legal.onPressTerms}
            />
          );

        return segment;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  // `FOOTER`'s metrics (iOS footnote 13/18, Android bodySmall 12/16 — see
  // above) on the platform system font, centered under the last auth button.
  legal: {
    fontSize: FOOTER.fontSize,
    lineHeight: FOOTER.lineHeight,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
