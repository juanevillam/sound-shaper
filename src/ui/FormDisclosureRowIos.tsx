import React from 'react';

import { HStack, Image, Spacer, Text } from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  lineLimit,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers';

/**
 * THE TWO GROUPED-FORM ROWS THE PORTFOLIO HAS — a fact (label + value) and a
 * destination (the same, plus a disclosure chevron) — as ONE geometry, because
 * they sit in the same card and must agree down to the point.
 *
 * The chevron half is why this file exists. `@expo/ui`'s `Button` draws no
 * disclosure indicator of its own (SwiftUI gets one from `NavigationLink`,
 * which the wrapper does not expose — see docs/pending-upstream.md), so every
 * such row has to state the glyph itself. That statement was written out FIVE
 * times before this file — `ManageAccountScreen.ios` ×3,
 * `SettingsAccountSection.ios`, and `TrophiesScreen.ios` with its own
 * `CHEVRON_SIZE` constant — which is five chances for one row to end up a point
 * bigger or a shade brighter than the row above it.
 *
 * THREE RULES ARE BAKED IN, and each is the kind that gets lost in a copy:
 *
 *  - THE LABEL IS `onSurface`, ALWAYS. Inside a `Button` it otherwise inherits
 *    the control tint and reads blue while every neighbouring label is not. In
 *    Apple's Settings blue text means "do something"; NAVIGATION IS NEUTRAL
 *    plus a chevron, which is the whole reason these rows are not tinted
 *    actions.
 *  - THE CHEVRON RECEDES. `onSurfaceMuted` is the secondaryLabel pair, which
 *    is what a real cell chevron sits at beside a regular Body label. (The RN
 *    hand-drawn twin, `DisclosureChevron`, takes tertiaryLabel instead — it is
 *    pinned at a container's trailing margin with no label beside it, and the
 *    colour follows the position. Both are documented in that file.)
 *  - THE VALUE IS ONE LINE. See `ONE_LINE_VALUE`.
 */

/**
 * 13pt, matching a Body-17 row's own indicator. Exported because the rows that
 * cannot use these components — anything with leading art or a second line,
 * e.g. a trophy — still have to draw the SAME glyph.
 */
export const FORM_DISCLOSURE_GLYPH_SIZE = 13;

/**
 * A VALUE IS ONE LINE, TRUNCATED IN THE MIDDLE — and this is a measurement, not
 * a preference. It is also why these rows are an `HStack` and not SwiftUI's
 * `LabeledContent`, which is what they were.
 *
 * `LabeledContent` STACKS its value under the label when the two will not fit
 * on one line, and a real email address does not. That is a layout decision the
 * style makes from the value's ideal width, so it happens whatever the value's
 * own `lineLimit` says — verified on iPhone 17 / iOS 26.5 by setting the limit
 * on the value and then on the row, with the address wrapping both times.
 *
 * It has to be one line because a redacted placeholder does NOT stack, so the
 * loading card stood a line shorter than the settled one and everything below
 * it jumped on hand-off. Band-scanned in dark, at the info card's own edges:
 *
 *   card top        172.33 → 172.33   (the anchor that was already right)
 *   Email/Username  298.00 → 275.33
 *   card bottom     403.00 → 380.33   -22.67pt, i.e. exactly one text line
 *   destinations    438.00 → 415.33   -22.67pt, everything below inherits it
 *
 * One line makes both states the same shape, so the numbers agree by
 * construction rather than by a second measurement. It is what the row should
 * have been anyway: a grouped row in Contacts, Mail or Settings is one line,
 * the rule `PersonListRow` and `TrashList` already state.
 *
 * `middle`, not the `tail` those two take: these values are ADDRESSES and
 * handles, where the ending carries as much as the start — a tail ellipsis on
 * "juanesteban…@gmail.com" would eat the domain and leave the half a reader
 * already knows. Apple truncates identifiers the same way.
 */
const ONE_LINE_VALUE = [lineLimit(1), truncationMode('middle')];

export type FormDisclosureColors = {
  onSurface: string;
  onSurfaceMuted: string;
};

/** The chevron alone, for a row these components' layout doesn't fit. */
export const FormDisclosureIndicatorIos = ({ color }: { color: string }) => (
  <Image
    systemName="chevron.right"
    size={FORM_DISCLOSURE_GLYPH_SIZE}
    color={color}
  />
);

/** A fact: neutral label, muted value, no chevron — the row goes nowhere. */
export const FormValueRowIos = ({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: FormDisclosureColors;
}) => (
  <HStack spacing={8}>
    <Text modifiers={[foregroundStyle(colors.onSurface)]}>{label}</Text>
    <Spacer />
    <Text
      modifiers={[foregroundStyle(colors.onSurfaceMuted), ...ONE_LINE_VALUE]}
    >
      {value}
    </Text>
  </HStack>
);

/** A destination: the same row, plus the chevron that says it is one. */
export const FormDisclosureRowIos = ({
  label,
  value,
  colors,
}: {
  label: string;
  /**
   * The row's current setting, between the label and the chevron — Apple's
   * value-plus-disclosure cell (Settings' Language, Account's Username).
   */
  value?: string;
  colors: FormDisclosureColors;
}) => (
  <HStack spacing={8}>
    <Text modifiers={[foregroundStyle(colors.onSurface)]}>{label}</Text>
    <Spacer />
    {value ? (
      <Text
        modifiers={[foregroundStyle(colors.onSurfaceMuted), ...ONE_LINE_VALUE]}
      >
        {value}
      </Text>
    ) : null}
    <FormDisclosureIndicatorIos color={colors.onSurfaceMuted} />
  </HStack>
);
