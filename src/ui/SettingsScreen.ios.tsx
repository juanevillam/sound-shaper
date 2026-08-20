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
 * `sectionsTitle` header; the account block maps to a trailing titled section
 * with a red destructive sign-out row, mirroring the Android "General" /
 * "Account" grouping. Rows stay icon-free — Apple Settings rows either carry
 * colored tile icons or none at all, and bare SF symbols read as neither.
 * The `Form` scrolls and insets itself natively, so the RN
 * `ScrollView`/`SafeAreaView` chrome the Android variant needs is omitted.
 * `cancelLabel` and per-section `icon` are unused here — the native menu
 * dismisses itself. `seedColor` is likewise Android-only (Compose theming);
 * this variant tints from `colors.primary`.
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

        {account ? (
          <SettingsAccountSection {...account} colors={colors} />
        ) : null}

        {/* DEV-ONLY — the host passes this under `__DEV__` alone, so a release
            build never renders the section.

            MENU-PICKER ROWS (On / Off), not switches, after both switch forms
            failed the tap test on 57:
              @expo/ui `Toggle`      ignores TAPS outright (knob drag works —
                                     the library bug from the expo-ui-starter
                                     verification; re-check per bump);
              RN `Switch` in a       renders (a real UISwitch) but the Form
              `LabeledContent` row   row never delivers touches to the hosted
                                     view — verified on the simulator.
            The menu picker is the one control this Form has already PROVEN
            tappable (Language / Appearance), and it keeps the section in the
            sheet's own idiom. */}
        {devToggles ? (
          <Section title={devToggles.title}>
            {devToggles.rows.map(row => (
              <Picker
                key={row.label}
                label={row.label}
                selection={row.value ? 'on' : 'off'}
                onSelectionChange={value => row.onValueChange(value === 'on')}
                modifiers={[pickerStyle('menu')]}
              >
                <Text modifiers={[tag('on')]}>On</Text>
                <Text modifiers={[tag('off')]}>Off</Text>
              </Picker>
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
            belong beside version numbers (which is where Android, frozen,
            still shows them). */}
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
