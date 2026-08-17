import React from 'react';

import { StyleSheet } from 'react-native';

import { Button, Form, Host, Section, Text } from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  foregroundStyle,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { FormDisclosureRowIos, FormValueRowIos } from './FormDisclosureRowIos';
import { type ManageAccountScreenProps } from './ManageAccountScreen';
import { Screen } from './Screen';
import { UsernameEditRowIos } from './UsernameEditRow';

/**
 * iOS counterpart of `ManageAccountScreen` — same prop API, rendered as a
 * native inset-grouped `Form`, the same control the shared `SettingsScreen.ios`
 * uses. That matters: the alternative is hand-rolling grouped rows out of RN
 * views and a hardcoded corner radius, which is what one app had drifted into
 * and it read as an imitation of the real thing.
 *
 * `danger.rowDescription` and the row icons are Android-only: an Apple
 * destructive row is a bare red label, and Settings rows either carry colored
 * tile icons or none at all.
 *
 * THE `Screen` TAKES NO COLOUR AND NO EDGES, and both halves of that are the
 * corrections its twin already carried:
 *
 *  - NO `backgroundColor`. This screen presents as a form SHEET in Topper and
 *    as a pushed screen in Sound Shaper, and in BOTH cases the navigator has
 *    already painted the right surface (`contentStyle` — `colors.sheet` for a
 *    sheet, `colors.background` for a push). Painting `background` here was
 *    invisible in light, where the two are the same `#F2F2F7`, and in dark it
 *    covered the sheet's `#1C1C1E` with `#000000` — so the account sheet read
 *    BLACK beside Settings, its own twin, one gesture away in the same stack.
 *    `SettingsScreen.ios` states the rule; `SheetScreenIos` in Topper states
 *    it again for the app's own sheets.
 *  - NO `edges`. The `Form` scrolls and insets itself natively; a `SafeAreaView`
 *    around it only insets the box the Form is already insetting inside.
 */
export const ManageAccountScreen = ({
  colorScheme,
  colors,
  info,
  sections,
  privacy,
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
      <Form
        modifiers={[scrollContentBackground('hidden'), tint(colors.primary)]}
      >
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
                <UsernameEditRowIos key={row.label} editor={row.editor}>
                  <FormDisclosureRowIos
                    label={row.label}
                    value={row.value}
                    loading={info.loading}
                    colors={colors}
                  />
                </UsernameEditRowIos>
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

        {privacy ? (
          <Section title={privacy.title}>
            {/* Disclosure rows (neutral label + chevron), not tinted actions:
                in Apple's Settings blue text means "do something", while
                navigation stays neutral. */}
            {privacy.rows.map(row => (
              <Button key={row.id} onPress={row.onPress}>
                <FormDisclosureRowIos label={row.label} colors={colors} />
              </Button>
            ))}
          </Section>
        ) : null}

        {danger ? (
          /**
           * NO HEADER, A FOOTER — Apple's shape for a destructive group, and
           * the reason `danger.title` goes unread on this platform.
           *
           * The header was rendering the SAME WORDS as the only row beneath it
           * ("Delete Account" over Delete Account), which is a category label
           * naming a single item. iOS reserves the space under an irreversible
           * row for what it will DO instead — Settings' own Erase All Content
           * and Reset sections both read that way — so the supporting line the
           * Android row carries inline moves here, where it explains the row
           * rather than repeating it. `title` stays on the shared prop because
           * Android, frozen, still draws it as a header.
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
