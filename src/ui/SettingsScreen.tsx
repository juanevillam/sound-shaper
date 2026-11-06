import React from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Form,
  Host,
  LabeledContent,
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
import { type SettingsSignOutProps } from './SettingsAccountSection';
import { type SettingsAccountSectionProps } from './SettingsAccountSection';
import { type SettingsAccountColors } from './SettingsAccountSection';
import {
  SettingsAccountSection,
  SettingsSignOutSection,
} from './SettingsAccountSection';

export type SettingsOption = { value: string; label: string };

/** Trailing read-only block, e.g. "About" with the app version. */
export type SettingsAboutConfig = {
  title?: string;
  rows: SettingsInfoRow[];
};

/**
 * Account block config — the identity banner's props (minus the shared
 * colors) plus what the trailing sign-out card reads.
 */
export type SettingsAccountConfig = Omit<
  SettingsAccountSectionProps,
  'colors'
> &
  SettingsSignOutProps;

/**
 * Policy links (privacy policy, terms) that stores require reachable from
 * inside the app. Passed separately from `about` because they are a different
 * KIND of row — a version number is a fact about the build, these two are links
 * that leave the app — and both platforms now give them their own card between
 * About and Sign Out.
 *
 * ANDROID USED TO APPEND THEM TO ABOUT, on the stated grounds that this was
 * "Material's grouping". Retired 2026-08-29: Android does group legal near
 * About, but as ONE "Legal information" row opening a sub-screen, not as two
 * flat links beside a version. Merged, they were also the only content rows on
 * the screen with no header, which is the thing that made the card read as a
 * mixed bag.
 */
export type SettingsLegalConfig = {
  /**
   * Section header.
   *
   * Titled because every CONTENT group on the screen is: General, Account,
   * About and these. The only headerless card is the trailing Sign Out, which
   * is an ACTION rather than a group — Apple leaves that one bare too (the
   * Apple Account sheet's own Sign Out), and so does Google. Without a header
   * here the screen read unevenly, with one content card silently different
   * from its neighbours.
   */
  title?: string;
  rows: SettingsInfoRow[];
};

/** A single-choice preference, e.g. language or theme. */
export type SettingsRadioSection = {
  title: string;
  options: SettingsOption[];
  selected: string;
  onSelect: (value: string) => void;
};

/** App-resolved colors the settings screen paints with. */
export type SettingsScreenColors = SettingsAccountColors & {
  background?: string;
  /**
   * A switch's ON state — the platform semantic green, never `primary`
   * (see the monochrome rules). The iOS variant's Dev toggle needs it told
   * explicitly: a SwiftUI `Toggle` takes the ambient accent, and our Forms
   * tint theirs `primary` for the menu-picker values.
   */
  switchOn: string;
};

/** A read-only label/value row, e.g. the app version. */
export type SettingsInfoRow = {
  label: string;
  /** Optional supporting value; omit for label-only link rows (legal pages). */
  value?: string;
  /** Optional tap handler, e.g. the legal pages. */
  onPress?: () => void;
};

export type SettingsScreenProps = {
  /**
   * Optional account block: the identity banner leading the screen and the
   * sign-out card closing it.
   */
  account?: SettingsAccountConfig;
  /** Single-choice preferences rendered as rows that open a radio dialog. */
  sections: SettingsRadioSection[];
  /** Category header rendered above the preference rows, e.g. "General". */
  sectionsTitle?: string;
  /** Optional read-only info rows rendered last, e.g. bundled versions. */
  about?: SettingsAboutConfig;
  /** Optional policy links. See `SettingsLegalConfig` for why they are not
   *  just more `about.rows`. */
  legal?: SettingsLegalConfig;
  /**
   * DEV-ONLY toggle rows rendered directly under General on BOTH platforms —
   * the iOS variant's order, matched here so the two twins read the same way
   * down. Release builds must not pass it at all — the host gates on
   * `__DEV__`. Labels arrive as plain strings: dev chrome is exempt from the
   * translation pipeline, like the state lab's own copy.
   */
  devToggles?: {
    title: string;
    rows: {
      label: string;
      value: boolean;
      onValueChange: (value: boolean) => void;
    }[];
  };
  colors: SettingsScreenColors;
  colorScheme?: 'light' | 'dark';
};

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
 * Two shapes, decided by the row rather than by which card it is in: a row
 * with `onPress` runs it on tap (the legal rows), and one without is a plain
 * fact, e.g. a version number.
 *
 * `foregroundStyle` keeps the label from picking up the control tint inside a
 * `Button` — in Apple's Settings blue means "do something", and a policy link
 * that hands off to Safari is not that.
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
  const content = row.value ? (
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

  if (row.onPress)
    return (
      <Button
        onPress={row.onPress}
        modifiers={[foregroundStyle(colors.onSurface)]}
      >
        {content}
      </Button>
    );

  return content;
};

/**
 * iOS counterpart of `SettingsScreen` — same prop API as the Android variant,
 * rendered as a native inset-grouped `Form`, the standard Apple Settings
 * layout. Each single-choice section maps to a menu `Picker` row (label on the
 * left, current value plus chevron on the right) grouped under the
 * `sectionsTitle` header; the account block LEADS the form (see below) and its
 * red destructive sign-out row closes it — the same order the Compose screen
 * draws. Rows stay icon-free — Apple Settings rows either carry
 * colored tile icons or none at all, and bare SF symbols read as neither.
 * The `Form` scrolls and insets itself natively, so the RN
 * `ScrollView`/`SafeAreaView` chrome the Android variant needs is omitted.
 * `cancelLabel` and per-section `icon` are unused here — the native menu
 * dismisses itself; this variant tints from `colors.primary`.
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

            It renders NOTHING when the caller passes no account block, and
            the sheet starts at General. That was Topper's case (its account
            entry is on its Profile tab) and the deleted expo-ui-starter's;
            this app always passes one. */}
        {account ? (
          <SettingsAccountSection
            profile={account.profile}
            profileLink={account.profileLink}
            colors={colors}
          />
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
