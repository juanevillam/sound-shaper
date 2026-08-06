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
import { type SettingsScreenProps } from './SettingsScreen';

const styles = StyleSheet.create({
  host: { flex: 1 },
});

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

        {about ? (
          <Section title={about.title}>
            {about.rows.map(row => {
              // Valueless rows (the legal links) render as a plain label —
              // LabeledContent with empty trailing text reads as a broken row.
              const content = row.value ? (
                <LabeledContent key={row.label} label={row.label}>
                  {/* SwiftUI dims a LabeledContent's trailing text to the
                      secondary style, which reads as "disabled" next to the
                      link rows — those sit inside a `foregroundStyle`
                      wrapper, so their value stays full-strength. Match them:
                      a read-only value is not a disabled one. */}
                  <Text modifiers={[foregroundStyle(colors.onSurface)]}>
                    {row.value}
                  </Text>
                </LabeledContent>
              ) : (
                <Text key={row.label}>{row.label}</Text>
              );

              // Rows with an onPress run it on tap (wins over url, e.g. the
              // version row's easter-egg counter); rows with a url become a
              // native Link that opens the browser. foregroundStyle keeps the
              // label from picking up the control tint in both cases.
              return row.onPress ? (
                <Button
                  key={row.label}
                  onPress={row.onPress}
                  modifiers={[foregroundStyle(colors.onSurface)]}
                >
                  {content}
                </Button>
              ) : row.url ? (
                <Link
                  key={row.label}
                  destination={row.url}
                  modifiers={[foregroundStyle(colors.onSurface)]}
                >
                  {content}
                </Link>
              ) : (
                content
              );
            })}
          </Section>
        ) : null}

        {/* Policy links in a card of their own, between About and Sign Out —
            Apple's grouping. They are policy, not build info, so they don't
            belong beside version numbers (which is where Android, frozen,
            still shows them). */}
        {legal?.rows.length ? (
          <Section title={legal.title}>
            {legal.rows.map(row =>
              row.onPress ? (
                <Button
                  key={row.label}
                  onPress={row.onPress}
                  modifiers={[foregroundStyle(colors.onSurface)]}
                >
                  <Text>{row.label}</Text>
                </Button>
              ) : row.url ? (
                <Link
                  key={row.label}
                  destination={row.url}
                  modifiers={[foregroundStyle(colors.onSurface)]}
                >
                  <Text>{row.label}</Text>
                </Link>
              ) : (
                <Text key={row.label}>{row.label}</Text>
              ),
            )}
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
