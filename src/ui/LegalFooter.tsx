import React from 'react';

import { StyleSheet, Text } from 'react-native';

import { TextLink } from './TextLink';
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
              onPress={legal.onPressPrivacy}
            />
          );
        if (segment === '{terms}')
          return (
            <TextLink
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
});
