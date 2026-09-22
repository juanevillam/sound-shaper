import React from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Form,
  Host,
  LabeledContent,
  Link,
  Picker,
  Section,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  foregroundStyle,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { Screen } from './Screen';
import {
  SettingsAccountSection,
  SettingsSignOutSection,
} from './SettingsAccountSection';
import {
  type SettingsInfoRow,
  type SettingsScreenProps,
} from './SettingsScreen';

const styles = StyleSheet.create({
  host: { flex: 1 },
});

/**
 * ONE ROW RENDERER FOR BOTH READ-ONLY CARDS — About and Legal.
 *
 * They were two nearly identical inline blocks, and the "nearly" was already
 * costing: About handled a trailing value and Legal did not, so a legal row
 * that ever grew one would have silently dropped it. One definition also means
 * the chevron rule below is stated once.
 *
 * Three shapes, decided by the row rather than by which card it is in:
 *
 *  - `onPress` runs on tap and WINS over `url` (that precedence was written for
 *    a version-row easter egg, removed in 2026-07 when the legal pages took the
 *    slot, and the legal rows use it now);
 *  - `url` becomes a native `Link` that hands off to the browser;
 *  - neither is a plain fact, e.g. a version number.
 *
 * `foregroundStyle` keeps the label from picking up the control tint inside a
 * `Button` or a `Link` — in Apple's Settings blue means "do something", and a
 * policy link that hands off to Safari is not that.
 */
const InfoRow = ({
  row,
  colors,
}: {
  row: SettingsInfoRow;
  colors: SettingsScreenProps['colors'];
}) => {
  // Valueless rows (the legal links) render as a plain label — LabeledContent
  // with empty trailing text reads as a broken row.
  const label = row.value ? (
    <LabeledContent label={row.label}>
      {/* SwiftUI dims a LabeledContent's trailing text to the secondary style,
          which reads as "disabled" next to the link rows — those sit inside a
          `foregroundStyle` wrapper, so their value stays full-strength. Match
          them: a read-only value is not a disabled one. */}
      <Text modifiers={[foregroundStyle(colors.onSurface)]}>{row.value}</Text>
    </LabeledContent>
  ) : (
    <Text>{row.label}</Text>
  );

  const content = label;

  if (row.onPress)
    return (
      <Button
        onPress={row.onPress}
        modifiers={[foregroundStyle(colors.onSurface)]}
      >
        {content}
      </Button>
    );

  if (row.url)
    return (
      <Link
        destination={row.url}
        modifiers={[foregroundStyle(colors.onSurface)]}
      >
        {content}
      </Link>
    );

  return content;
};

/**
 * iOS counterpart of `SettingsScreen` — same prop API as the Android variant,
 * rendered as a native inset-grouped `Form`, the standard Apple Settings
 * layout. Each single-choice section maps to a menu `Picker` row (label on the
 * left, current value plus chevron on the right) grouped under the
 * `sectionsTitle` header; the account block LEADS the form (see below) and its
 * red destructive sign-out row closes it, where Android renders one "Account"
 * group under "General". Rows stay icon-free — Apple Settings rows either carry
 * colored tile icons or none at all, and bare SF symbols read as neither.
 * The `Form` scrolls and insets itself natively, so the RN
 * `ScrollView`/`SafeAreaView` chrome the Android variant needs is omitted.
 * `cancelLabel` and per-section `icon` are unused here — the native menu
 * dismisses itself. `seedColor` is likewise Android-only (Compose theming);
 * this variant tints from `colors.primary`. `scrollProps` is Android-only
 * too, deliberately: it exists to drive the M3 on-scroll app bar, and iOS
 * never paints `headerStyle` — doing so would opt the bar out of the Liquid
 * Glass scroll-edge effect (the same rule Sound Shaper's adapter records).
 */
export const SettingsScreen = ({
  account,
  sections,
  sectionsTitle,
  about,
  legal,
  devToggles,
  colors,
  colorScheme,
}: SettingsScreenProps) => (
  <Screen>
    <Host style={styles.host} colorScheme={colorScheme}>
      {/* No top `padding` on the Form: `padding` sits OUTSIDE its background,
          so any top inset leaves a strip of whatever is behind the Form above
          its grouped background — a visible seam, most obvious in a sheet
          where the strip reads as the flat sheet colour above the elevated
          one. The Form's own section spacing is the breathing room. */}
      <Form modifiers={[tint(colors.primary)]}>
        {/* THE ACCOUNT BLOCK LEADS THE SHEET — Apple puts the person first.
            Settings opens on the Apple Account banner above every other group,
            and the App Store's Apple Account sheet does the same; nothing of
            Apple's puts an identity card below a preferences group.

            It renders NOTHING for an app that passes only the sign-out fields
            — Topper, whose account entry is on its Profile tab — so for those
            this is the same sheet it always was, starting at General.
            (expo-ui-starter was the other such caller, and it had no account
            surface AT ALL; it was deleted 2026-09-16. Topper still exercises
            this branch, so it is not dead.) */}
        {account ? (
          <SettingsAccountSection {...account} colors={colors} />
        ) : null}

        <Section title={sectionsTitle}>
          {sections.map(section => (
            <Picker
              key={section.title}
              label={section.title}
              selection={section.selected}
              onSelectionChange={value => section.onSelect(String(value))}
              modifiers={[pickerStyle('menu')]}
            >
              {section.options.map(option => (
                <Text key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </Text>
              ))}
            </Picker>
          ))}
        </Section>

        {/* DEV-ONLY — the host passes this under `__DEV__` alone, so a release
            build never renders the section.

            A REAL SWITCH, matching the Android twin (Juan, 2026-09-05 — the
            menu picker it replaced was a written-down workaround for 57's
            Toggle tap-dead bug, from the expo-ui-starter SIMULATOR
            verification). TAP VERIFIED WORKING on Juan's real iPhone the
            same day — so that bug is a simulator artefact, fixed upstream,
            or both; if a future bump regresses it, the workaround to revert
            to was menu `Picker` rows (On / Off).

            `switchOn`, not the Form's `primary` tint: green-means-on is a
            platform semantic (the monochrome rules' own carve-out), and a
            SwiftUI Toggle has to be told because it inherits the ambient
            accent. */}
        {devToggles ? (
          <Section title={devToggles.title}>
            {devToggles.rows.map(row => (
              <Toggle
                key={row.label}
                label={row.label}
                isOn={row.value}
                onIsOnChange={row.onValueChange}
                modifiers={[tint(colors.switchOn)]}
              />
            ))}
          </Section>
        ) : null}

        {about ? (
          <Section title={about.title}>
            {about.rows.map(row => (
              <InfoRow key={row.label} row={row} colors={colors} />
            ))}
          </Section>
        ) : null}

        {/* Policy links in a card of their own, between About and Sign Out —
            Apple's grouping. They are policy, not build info, so they don't
            belong beside version numbers. (Android agreed on 2026-08-29 —
            its twin gives `legal` its own headed group too; the "Material
            groups legal with About" argument is retired in its file.) */}
        {legal?.rows.length ? (
          <Section title={legal.title}>
            {legal.rows.map(row => (
              <InfoRow key={row.label} row={row} colors={colors} />
            ))}
          </Section>
        ) : null}

        {account ? (
          <SettingsSignOutSection
            signOutLabel={account.signOutLabel}
            signOutDialog={account.signOutDialog}
            onSignOut={account.onSignOut}
          />
        ) : null}
      </Form>
    </Host>
  </Screen>
);
