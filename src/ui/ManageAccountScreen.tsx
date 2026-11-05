import React from 'react';

import { StyleSheet } from 'react-native';

import { Button, Form, Host, Section, Text } from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  foregroundStyle,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';

import { FormDisclosureRowIos, FormValueRowIos } from './FormDisclosureRowIos';
import { Screen } from './Screen';
import { type SettingsUsernameEditor } from './SettingsAccountSection';
import { SheetFormMediaIos } from './SheetFormIos';
import { TextEditRowIos } from './TextEditRowIos';

/**
 * App-resolved colors the manage-account screen paints with.
 * `surfaceVariant` / `surfaceDialog` exist for the username dialog (the same
 * `UsernameDialog` the Settings profile row used to open); the caller already
 * passes its full palette, so widening the type costs it nothing.
 */
export type ManageAccountColors = {
  primary: string;
  onSurface: string;
  onSurfaceMuted: string;
  surfaceContainer: string;
  surfaceVariant: string;
  surfaceDialog: string;
  danger: string;
  background: string;
};

/** A read-only fact about the account (name, email, member-since). */
export type ManageAccountInfoRow = {
  label: string;
  value: string;
  /**
   * Makes this read-only fact EDITABLE. On iOS tapping the row opens the
   * native text alert (`TextEditRowIos`); on Android it opens the
   * Material text dialog (`UsernameDialog` — the same one the Settings profile
   * row used to open, before the account entry moved here).
   *
   * Topper's Username row uses it on both platforms. Apple does the same —
   * Settings → Apple Account keeps Name / Phone / Email editable one level
   * down rather than on the identity row itself, which is why dropping the
   * editor from the Settings row did not mean dropping it altogether.
   */
  editor?: SettingsUsernameEditor;
};

/**
 * A push row, e.g. Topper's blocked-users list. Label + trailing chevron on
 * both platforms — no leading icon: Apple's Settings rows carry colored tile
 * icons or none at all, and Material's own settings rows are text-first too.
 * The rows here carried Android-only icons until 2026-09-04 (Juan's call:
 * iOS dropped them, Android follows).
 */
export type ManageAccountNavRow = {
  id: string;
  label: string;
  onPress: () => void;
};

export type ManageAccountScreenProps = {
  colors: ManageAccountColors;
  /**
   * The app's RESOLVED appearance, forwarded to the `Host`s so the native
   * surfaces follow an explicit Light/Dark choice instead of the device trait.
   * `SettingsScreen` has always passed this; this screen did not, so setting
   * Appearance against the system rendered the account sheet in the system's
   * scheme while every RN surface around it obeyed the app's.
   */
  colorScheme?: 'light' | 'dark';
  /**
   * The person's photo slot, ABOVE the facts — Contacts' and the Apple
   * Account's own arrangement: a disc, and the action that edits it under it.
   * The app supplies the whole control (it owns the picker and the media);
   * the screen decides only where it stands.
   *
   * iOS-ONLY TODAY, AND THAT IS AN OPEN GAP, not a platform argument: Sound
   * Shaper added it on 2026-10-16 and the Compose twin has not been built or
   * walked on a device. Android ignores the prop until it is.
   */
  hero?: React.ReactElement;
  /**
   * The read-only facts block. Optional: an app with no real session has no
   * facts to state and shows only the actions below. expo-ui-starter was that
   * app and was deleted 2026-09-16, so NOTHING EXERCISES THE UNDEFINED BRANCH
   * TODAY — which is exactly the shape of thing this repo has deleted for
   * "having no callers" and regretted. Leave it optional.
   */
  info?: {
    title: string;
    rows: ManageAccountInfoRow[];
    /**
     * The facts have not arrived yet, so each VALUE stands a `SkeletonBone` —
     * the same sweeping placeholder every other loading surface in these apps
     * uses. BOTH platforms read it now (Android joined 2026-09-04, the same
     * shared bone at the same shared box).
     *
     * THE CALLER STILL PASSES A FULL ROW SET while this is true, so the row
     * COUNT is settled from the first frame; the labels are static strings and
     * render immediately, which is what pins each row's height. Nothing moves
     * on hand-off, and no bone is hand-built beside these rows — the real rows
     * stand themselves and only the unknown part is a bone.
     */
    loading?: boolean;
  };
  /**
   * Optional destination sections between `info` and `danger`. Untitled ones
   * render as a bare card, which is what Apple does for a group whose rows say
   * what they are (on Android the bare card asks for the headerless top gap,
   * the same term the trailing sign-out card takes).
   *
   * Topper's Trophies and Trash live here on BOTH platforms now: Settings is
   * app configuration only, and everything account-shaped sits behind the
   * account entry. Android kept them in Settings for as long as it was frozen;
   * that was the schedule wearing a Material argument's clothes.
   */
  sections?: Array<{ title?: string; rows: ManageAccountNavRow[] }>;
  /**
   * The irreversible action, always last. `onPress` opens the HOST's own
   * confirmation — the countdown dialog and the native alert are different
   * enough per app that the screen must not own that decision, it only owns
   * where the row sits and how it reads.
   */
  danger?: {
    rowLabel: string;
    /**
     * What the row will do, in one line — the card's FOOTER on both
     * platforms, outside the pressable row: iOS renders it as the `Section`
     * footer, Android as a muted legend under the card. That is where Apple
     * explains a destructive group, and it is also why there is no `title`
     * here any more: the header was a category label saying the row's own
     * words, and both platforms now leave the card headerless (the same
     * shape as the Trophies card).
     */
    rowDescription?: string;
    onPress: () => void;
    disabled?: boolean;
  };
  /**
   * Mounted beside the screen — the host's confirm dialog. On Android it MUST
   * live outside the rows' Host: a dialog mounted next to them corrupts their
   * clip shapes (the same rule SettingsScreen documents).
   */
  children?: React.ReactNode;
};

/**
 * iOS counterpart of `ManageAccountScreen` — same prop API, rendered as a
 * native inset-grouped `Form`, the same control the shared `SettingsScreen.ios`
 * uses. That matters: the alternative is hand-rolling grouped rows out of RN
 * views and a hardcoded corner radius, which is what one app had drifted into
 * and it read as an imitation of the real thing.
 *
 * `danger.rowDescription` is the danger card's FOOTER on BOTH platforms now:
 * here the `Section` footer under a bare red destructive row, and since
 * ac55af5 (2026-09-04) Android draws the same shape — legend outside the
 * pressable row, under a headerless card. The rows carry no icons on either
 * platform — Settings rows either carry colored tile icons or none at all,
 * and Android followed 2026-09-04.
 *
 * THE `Screen` TAKES NO COLOUR AND NO EDGES, and both halves of that are the
 * corrections its twin already carried:
 *
 *  - NO `backgroundColor`. This screen presents as a form SHEET (and was a
 *    pushed screen elsewhere in the portfolio), and in BOTH cases the
 *    navigator has already painted the right surface (`contentStyle` — `colors.sheet` for a
 *    sheet, `colors.background` for a push). Painting `background` here was
 *    invisible in light, where the two are the same `#F2F2F7`, and in dark it
 *    covered the sheet's `#1C1C1E` with `#000000` — so the account sheet read
 *    BLACK beside Settings, its own twin, one gesture away in the same stack.
 *    `SettingsScreen.ios` states the rule; `SheetScreenIos`
 *    (`src/components/ui`) states it again for the app's own sheets.
 *  - NO `edges`. The `Form` scrolls and insets itself natively; a `SafeAreaView`
 *    around it only insets the box the Form is already insetting inside.
 */
export const ManageAccountScreen = ({
  colorScheme,
  colors,
  hero,
  info,
  sections,
  danger,
  children,
}: ManageAccountScreenProps) => (
  <Screen>
    <Host style={styles.host} colorScheme={colorScheme}>
      {/* No top `padding` on the Form — the rule `SettingsScreen.ios` records:
          `padding` sits OUTSIDE a Form's background, so a top inset leaves a
          strip of whatever is behind it above the grouped card. In a sheet that
          strip reads as the flat sheet colour above the elevated one, and this
          file carried a 16pt one. The Form's own section spacing is the air. */}
      {/* NO Form-level `tint`. `SheetFormBodyIos` carries one because its
          forms hold menu pickers, whose VALUE Apple tints itself; this one
          holds none, so the tint reached nothing and only stood ready to
          paint the next control added here. */}
      <Form modifiers={[scrollContentBackground('hidden')]}>
        {hero ? (
          // The editor sheets' media slot — a transparent, separator-less row
          // centring the control, so the photo stands free above the cards.
          <Section>
            <SheetFormMediaIos>{hero}</SheetFormMediaIos>
          </Section>
        ) : null}
        {info ? (
          /**
           * ONLY THE VALUES WAIT. The labels — "Name", "Email" — are static
           * strings, so they render on the first frame and the card is its
           * settled height immediately; each unknown value stands the shared
           * `SkeletonBone` in its slot (see `ValueSlot`). The caller still
           * passes the settled row SET while loading, so the row COUNT is right
           * too.
           *
           * What this replaced was rows appearing one at a time as each fact
           * resolved: Member Since arriving late grew the card under the
           * reader's finger, and Username stated "Not Set" before flipping to
           * the real handle — a wrong answer rather than no answer yet.
           */
          <Section title={info.title}>
            {info.rows.map(row =>
              // An editable fact (Topper's Username) opens the shared native
              // alert and takes the disclosure chevron that marks it tappable
              // — the Name / Phone / Email rows in Apple's own Apple Account
              // screen. Everything else is the SAME ROW without the chevron,
              // which is the point of the two coming from one file: the label
              // colour, the value's colour and its one-line truncation cannot
              // drift between a fact and a destination sitting in one card.
              row.editor ? (
                <TextEditRowIos key={row.label} editor={row.editor}>
                  <FormDisclosureRowIos
                    label={row.label}
                    value={row.value}
                    loading={info.loading}
                    colors={colors}
                  />
                </TextEditRowIos>
              ) : (
                <FormValueRowIos
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  loading={info.loading}
                  colors={colors}
                />
              ),
            )}
          </Section>
        ) : null}

        {sections?.map((section, index) => (
          <Section
            key={section.title ?? `section-${index}`}
            title={section.title}
          >
            {section.rows.map(row => (
              <Button key={row.id} onPress={row.onPress}>
                <FormDisclosureRowIos label={row.label} colors={colors} />
              </Button>
            ))}
          </Section>
        ))}

        {danger ? (
          /**
           * NO HEADER, A FOOTER — Apple's shape for a destructive group.
           *
           * The header was rendering the SAME WORDS as the only row beneath it
           * ("Delete Account" over Delete Account), which is a category label
           * naming a single item. iOS reserves the space under an irreversible
           * row for what it will DO instead — Settings' own Erase All Content
           * and Reset sections both read that way — so the description
           * explains the row rather than repeating it. Android draws the same
           * shape now (headerless card, legend outside the row), which is why
           * the shared prop no longer carries a `title` at all.
           */
          <Section
            footer={
              danger.rowDescription ? (
                <Text>{danger.rowDescription}</Text>
              ) : undefined
            }
          >
            <Button
              role="destructive"
              modifiers={danger.disabled ? [disabledModifier(true)] : []}
              onPress={danger.onPress}
            >
              <Text modifiers={[foregroundStyle(colors.danger)]}>
                {danger.rowLabel}
              </Text>
            </Button>
          </Section>
        ) : null}
      </Form>
    </Host>

    {children}
  </Screen>
);

const styles = StyleSheet.create({
  host: { flex: 1 },
});
