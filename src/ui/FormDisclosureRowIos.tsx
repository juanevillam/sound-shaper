import React from 'react';

import {
  HStack,
  Image,
  RNHostView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { foregroundStyle, frame } from '@expo/ui/swift-ui/modifiers';

import { LIST_ROW_ONE_LINE } from './listRowText';
import { VALUE_BONE_HEIGHT, VALUE_BONE_WIDTH } from './settingsGroup';
import { SkeletonBone } from './SkeletonBone';

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
 *  - THE VALUE IS ONE LINE, on the shared term. See `listRowText`.
 */

/**
 * 13pt, matching a Body-17 row's own indicator. Exported because the rows that
 * cannot use these components — anything with leading art or a second line,
 * e.g. a trophy — still have to draw the SAME glyph.
 */
export const FORM_DISCLOSURE_GLYPH_SIZE = 13;

/**
 * A VALUE IS ONE LINE — and that is a measurement, not a preference. It is also
 * why these rows are an `HStack` and not SwiftUI's `LabeledContent`, which is
 * what they were.
 *
 * `LabeledContent` STACKS its value under the label when the two will not fit
 * on one line, and a real email address does not. That is a layout decision the
 * style makes from the value's ideal width, so it happens whatever the value's
 * own `lineLimit` says — verified on iPhone 17 / iOS 26.5 by setting the limit
 * on the value and then on the row, with the address wrapping both times.
 *
 * It has to be one line because a bone does not stack, so the loading card
 * stood a line shorter than the settled one and everything below it jumped on
 * hand-off. Band-scanned in dark, at the info card's own edges:
 *
 *   card top        172.33 → 172.33   (the anchor that was already right)
 *   Email/Username  298.00 → 275.33
 *   card bottom     403.00 → 380.33   -22.67pt, i.e. exactly one text line
 *   destinations    438.00 → 415.33   -22.67pt, everything below inherits it
 *
 * THE TERM IS THE SHARED ONE. This briefly carried its own `middle`
 * truncation — better for an address read in isolation, and the only row in
 * the portfolio that shortened text differently from its neighbours. See
 * `listRowText`.
 */

/**
 * THE VALUE'S PLACEHOLDER — the portfolio's own `SkeletonBone`, bridged back
 * into the native row.
 *
 * NOT `redacted('placeholder')`, which is the first thing this reached for and
 * the wrong answer twice over. Every other loading surface in these apps —
 * roughly twenty content-shaped bones across Home, Explore, Profile and the
 * people sheets — is built on that atom's app-wide sweep, and Blocked Users,
 * a sibling INSIDE this same account stack, sweeps. A static grey card here
 * made the account sheet the odd one out in its own family. (`SkeletonBone`
 * itself records why the sweep beats Apple's static block for a surface that
 * waits on a network, and lands back on Apple's answer under reduce-motion.)
 *
 * IT REPLACES ONLY THE VALUE, which is what makes the row's height safe: the
 * LABEL is a static string — "Name", "Email" — and has nothing to wait for, so
 * it renders immediately and the row is its settled height from the first
 * frame. Redaction, by contrast, blanked the label too and changed
 * `LabeledContent`'s stacking with it.
 */
// The box is a SHARED TERM — the Android account row stands the same bone.
// It lives in `settingsGroup` because this file's swift-ui imports keep it
// out of an Android bundle.

const ValueSlot = ({
  value,
  loading,
  colors,
}: {
  value: string;
  loading: boolean;
  colors: FormDisclosureColors;
}) =>
  loading ? (
    /**
     * THE BOX IS RESERVED IN SWIFTUI, not measured from the RN side.
     * `matchContents` makes the host "update its size in the React Native view
     * tree to match the children's" — an UPDATE, i.e. after the fact — so the
     * row lays out once without it and again once it lands, which is a shift on
     * the frame the placeholder mounts. Framing the wrapper and letting the
     * host fill it (its default) takes the measurement off the layout path
     * entirely.
     */
    <VStack
      modifiers={[
        frame({ width: VALUE_BONE_WIDTH, height: VALUE_BONE_HEIGHT }),
      ]}
    >
      <RNHostView>
        <SkeletonBone width={VALUE_BONE_WIDTH} height={VALUE_BONE_HEIGHT} />
      </RNHostView>
    </VStack>
  ) : (
    <Text
      modifiers={[foregroundStyle(colors.onSurfaceMuted), ...LIST_ROW_ONE_LINE]}
    >
      {value}
    </Text>
  );

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
  loading = false,
  colors,
}: {
  label: string;
  value: string;
  /** The fact has not arrived — see `ValueSlot`. */
  loading?: boolean;
  colors: FormDisclosureColors;
}) => (
  <HStack spacing={8}>
    <Text modifiers={[foregroundStyle(colors.onSurface)]}>{label}</Text>
    <Spacer />
    <ValueSlot value={value} loading={loading} colors={colors} />
  </HStack>
);

/** A destination: the same row, plus the chevron that says it is one. */
export const FormDisclosureRowIos = ({
  label,
  value,
  loading = false,
  colors,
}: {
  label: string;
  /**
   * The row's current setting, between the label and the chevron — Apple's
   * value-plus-disclosure cell (Settings' Language, Account's Username).
   */
  value?: string;
  /** The value has not arrived — see `ValueSlot`. */
  loading?: boolean;
  colors: FormDisclosureColors;
}) => (
  <HStack spacing={8}>
    <Text modifiers={[foregroundStyle(colors.onSurface)]}>{label}</Text>
    <Spacer />
    {value !== undefined ? (
      <ValueSlot value={value} loading={loading} colors={colors} />
    ) : null}
    {/* The chevron stays through the wait: it says the row goes somewhere,
        which is true before the value lands as much as after. */}
    <FormDisclosureIndicatorIos color={colors.onSurfaceMuted} />
  </HStack>
);
