import React, { memo, useCallback, useState } from 'react';

import { Linking, ScrollView, StyleSheet } from 'react-native';

import {
  Column,
  Host,
  Icon,
  ListItem,
  RadioButton,
  Row,
  Switch,
  Text,
  TextButton,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  selectable,
  selectableGroup,
} from '@expo/ui/jetpack-compose/modifiers';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DestructiveConfirmDialog } from './DestructiveConfirmDialog';
import { iconSource, type IconName } from './icons';
import { Screen } from './Screen';
import {
  SettingsAccountSection,
  SettingsSignOutSection,
  UsernameDialog,
  type SettingsAccountColors,
  type SettingsAccountSectionProps,
} from './SettingsAccountSection';
import { SettingsDialog } from './SettingsDialog';
import {
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
} from './settingsGroup';

export type SettingsOption = { value: string; label: string };

/** A single-choice preference, e.g. language or theme. */
export type SettingsRadioSection = {
  title: string;
  /** Leading icon for the preference row. */
  icon?: IconName;
  options: SettingsOption[];
  selected: string;
  onSelect: (value: string) => void;
};

/**
 * Account block config — the section's props minus the shared colors
 * and the dialog openers the screen wires up itself.
 */
export type SettingsAccountConfig = Omit<
  SettingsAccountSectionProps,
  'colors' | 'onOpenUsernameDialog' | 'onOpenSignOutConfirm'
>;

/** A read-only label/value row, e.g. a bundled package version. */
export type SettingsInfoRow = {
  label: string;
  /** Optional supporting value; omit for label-only link rows (legal pages). */
  value?: string;
  /** Optional external link the row opens when tapped, e.g. package docs. */
  url?: string;
  /** Optional tap handler (wins over `url`), e.g. the legal pages. */
  onPress?: () => void;
};

/** Trailing read-only block, e.g. "About" with app/package versions. */
export type SettingsAboutConfig = {
  title?: string;
  rows: SettingsInfoRow[];
};

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

export type SettingsScreenProps = {
  /** Optional account block rendered last (title, profile, sign-out). */
  account?: SettingsAccountConfig;
  /** Single-choice preferences rendered as rows that open a radio dialog. */
  sections: SettingsRadioSection[];
  /** Category header rendered above the preference rows, e.g. "General". */
  sectionsTitle?: string;
  /** Label for the dismiss action in the option dialogs. Android-only — the
   *  iOS variant's menu `Picker` dismisses itself. */
  cancelLabel?: string;
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
    /**
     * Dev BUTTONS, under the switches in the same group — for a state that can
     * only be reviewed by firing it (Topper's trophy banners: the engine
     * refuses to re-award, so the only way to see one again is to replay it).
     * Same shape as a switch row, minus the value.
     */
    actions?: { label: string; onPress: () => void }[];
  };
  colors: SettingsScreenColors;
  colorScheme?: 'light' | 'dark';
  /**
   * App brand seed forwarded to the internal `<Host>` so the native Compose
   * components (radio buttons, dialogs, text buttons) theme from the brand
   * palette instead of the wallpaper-derived one. Omit to keep dynamic
   * Material colors. Android-only — the iOS variant tints from
   * `colors.primary`.
   */
  seedColor?: string;
  /**
   * Scroll handlers from the host app's app-bar hook, spread onto this
   * screen's scroller. OPTIONAL: an app that does not lift its bar on scroll
   * (or a platform with no such idiom) passes nothing and nothing changes.
   *
   * This screen owns the scroller, so the app cannot wire it from outside —
   * which is why Android's Settings bar sat permanently at the SCROLLED colour
   * while every screen with its own `ScrollView` lifted properly.
   */
  scrollProps?: object;
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  // The 16 here plus the first header's own 16 is `SCREEN_CONTENT_TOP` — the
  // pushed sheet-family's shared top. Change one and the family drifts.
  scroll: { paddingVertical: 16 },
  host: { width: '100%' },
});

/**
 * The tappable row alone, memoized so dialog open/close state changes in
 * `RadioPreference` never re-render it — re-sending props to the native
 * `Icon` makes it re-resolve its drawable async, which reads as a flicker.
 */
const PreferenceRow = memo(
  ({
    title,
    icon,
    selectedLabel,
    shape,
    colors,
    onOpen,
  }: {
    title: string;
    icon?: IconName;
    selectedLabel?: string;
    shape: ReturnType<typeof groupRowShape>;
    colors: SettingsScreenColors;
    /** Stable opener keyed by the row title, so the memo holds. */
    onOpen: (title: string) => void;
  }) => (
    <ListItem
      colors={{
        containerColor: colors.surfaceContainer,
        contentColor: colors.onSurface,
        // THE SELECTED VALUE KEEPS THE ACCENT, because here the colour IS the
        // information: this line is not supporting text about the row, it is
        // the row's current SELECTION, and it is the only thing on the screen
        // that says which language and which appearance are in effect.
        //
        // That is the monochrome rule's second bucket, not an exception to it,
        // and iOS has drawn it this way all along — the accent list names "a
        // form's menu-picker VALUE" explicitly, on the grounds that Apple's own
        // Settings tints Language and Appearance itself. The 2026-08-29 parity
        // audit compared the two rows' SHAPE (Android's value is supporting
        // text, iOS's is a trailing tinted label with a chevron), called the
        // shape difference correct, and never checked the INK against the rule
        // — so Android sat at `onSurfaceMuted` and read like disabled text.
        //
        // A read-only value does NOT get this: `InfoRow`'s version number stays
        // muted, because a build number is a fact rather than a choice.
        supportingContentColor: colors.primary,
      }}
      modifiers={[fillMaxWidth(), clip(shape), clickable(() => onOpen(title))]}
    >
      {icon ? (
        <ListItem.LeadingContent>
          <Icon
            source={iconSource(icon)}
            size={24}
            tint={colors.onSurfaceMuted}
          />
        </ListItem.LeadingContent>
      ) : null}
      <ListItem.HeadlineContent>
        <Text>{title}</Text>
      </ListItem.HeadlineContent>
      {selectedLabel ? (
        <ListItem.SupportingContent>
          <Text
            style={{ typography: 'bodyMedium' }}
            modifiers={[padding(0, 4, 0, 0)]}
          >
            {selectedLabel}
          </Text>
        </ListItem.SupportingContent>
      ) : null}
    </ListItem>
  ),
);

PreferenceRow.displayName = 'PreferenceRow';

/**
 * A read-only row in the Android "About phone" idiom: setting name with the
 * value as supporting text. Rows with an `onPress` run it on tap; rows with a
 * `url` open it in the browser (the "About phone" rows that lead somewhere
 * look identical to those that don't, so no trailing affordance).
 */
const InfoRow = ({
  row,
  shape,
  colors,
}: {
  row: SettingsInfoRow;
  shape: ReturnType<typeof groupRowShape>;
  colors: SettingsScreenColors;
}) => (
  <ListItem
    colors={{
      containerColor: colors.surfaceContainer,
      contentColor: colors.onSurface,
      supportingContentColor: colors.onSurfaceMuted,
    }}
    modifiers={[
      fillMaxWidth(),
      clip(shape),
      ...(row.onPress
        ? [clickable(row.onPress)]
        : row.url
          ? [clickable(() => Linking.openURL(row.url!))]
          : []),
    ]}
  >
    <ListItem.HeadlineContent>
      <Text>{row.label}</Text>
    </ListItem.HeadlineContent>
    {row.value ? (
      <ListItem.SupportingContent>
        <Text
          style={{ typography: 'bodyMedium' }}
          modifiers={[padding(0, 4, 0, 0)]}
        >
          {row.value}
        </Text>
      </ListItem.SupportingContent>
    ) : null}
  </ListItem>
);

/**
 * A HEADED CARD OF READ-ONLY ROWS — About, and Legal. One definition because
 * they are the same object: a `labelLarge` muted subheader over a grouped card
 * whose first and last rows take the outer corners.
 */
const InfoGroup = ({
  title,
  rows,
  colors,
}: {
  title?: string;
  rows: SettingsInfoRow[];
  colors: SettingsScreenColors;
}) =>
  rows.length ? (
    <>
      {/* Ink, not the accent — see the note on `sectionsTitle`. */}
      {title ? (
        <Text
          color={colors.onSurfaceMuted}
          style={{ typography: 'labelLarge' }}
          modifiers={[padding(16, 16, 16, 8)]}
        >
          {title}
        </Text>
      ) : null}
      <Column
        modifiers={[
          fillMaxWidth(),
          padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
        ]}
        verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
      >
        {rows.map((row, index) => (
          <InfoRow
            key={row.label}
            row={row}
            shape={groupRowShape(index, rows.length)}
            colors={colors}
          />
        ))}
      </Column>
    </>
  ) : null;

/**
 * DEV-ONLY toggle rows — the Android read of the iOS Dev section (which uses
 * a menu picker only because a `Toggle` in a hosted Form row never delivered
 * touches there; a Compose `Switch` in a `ListItem` trailing slot works, and
 * a switch is Material's own on/off row). The prop was declared here and
 * silently ignored for as long as Android was frozen — Topper's Settings
 * passed it on iOS only, so the lab could not be flipped at runtime on the
 * one platform Phase B runs on (Juan, 2026-09-04).
 */
const devRowCount = (
  devToggles: NonNullable<SettingsScreenProps['devToggles']>,
) => devToggles.rows.length + (devToggles.actions?.length ?? 0);

const DevTogglesGroup = ({
  devToggles,
  colors,
}: {
  devToggles: NonNullable<SettingsScreenProps['devToggles']>;
  colors: SettingsScreenColors;
}) => (
  <>
    {/* Ink, not the accent — see the note on `sectionsTitle`. */}
    <Text
      color={colors.onSurfaceMuted}
      style={{ typography: 'labelLarge' }}
      modifiers={[padding(16, 16, 16, 8)]}
    >
      {devToggles.title}
    </Text>
    <Column
      modifiers={[
        fillMaxWidth(),
        padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
      ]}
      verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
    >
      {/* Switches and buttons share ONE grouped card, so the corner shape is
          cut against the combined count — two groups would read as two
          settings, and this is one dev drawer. */}
      {devToggles.rows.map((row, index) => (
        <ListItem
          key={row.label}
          colors={{
            containerColor: colors.surfaceContainer,
            contentColor: colors.onSurface,
          }}
          modifiers={[
            fillMaxWidth(),
            clip(groupRowShape(index, devRowCount(devToggles))),
          ]}
        >
          <ListItem.HeadlineContent>
            <Text>{row.label}</Text>
          </ListItem.HeadlineContent>
          <ListItem.TrailingContent>
            <Switch value={row.value} onCheckedChange={row.onValueChange} />
          </ListItem.TrailingContent>
        </ListItem>
      ))}
      {(devToggles.actions ?? []).map((action, index) => (
        <ListItem
          key={action.label}
          colors={{
            containerColor: colors.surfaceContainer,
            contentColor: colors.onSurface,
          }}
          modifiers={[
            fillMaxWidth(),
            clip(
              groupRowShape(
                devToggles.rows.length + index,
                devRowCount(devToggles),
              ),
            ),
            clickable(action.onPress),
          ]}
        >
          <ListItem.HeadlineContent>
            <Text>{action.label}</Text>
          </ListItem.HeadlineContent>
        </ListItem>
      ))}
    </Column>
  </>
);

/**
 * The single-choice radio dialog a preference row opens — the shared
 * `SettingsDialog` shell around a selectable radio list. Hosted by the screen
 * in its own `<Host>` — mounting it next to the rows corrupts their modifiers
 * (clip shapes mis-assign on unmount) and flickers sibling icons.
 */
const RadioOptionsDialog = ({
  section,
  cancelLabel,
  colors,
  onDismiss,
}: {
  section: SettingsRadioSection;
  cancelLabel: string;
  colors: SettingsScreenColors;
  onDismiss: () => void;
}) => {
  const handleSelect = (value: string) => {
    onDismiss();
    if (value !== section.selected) section.onSelect(value);
  };

  return (
    <SettingsDialog
      title={section.title}
      colors={colors}
      onDismissRequest={onDismiss}
      actions={
        /* A Compose control themes itself from the NATIVE scheme, which on
           a One UI palette is the untuned accent `schemePrimary` exists to
           repair — so every text button in a dialog states its content
           colour rather than inheriting one the rest of the app no longer
           uses. Measured: inherited #4979F6 against the app's #B1C5FF. */
        <TextButton
          colors={{ contentColor: colors.primary }}
          onClick={onDismiss}
        >
          <Text>{cancelLabel}</Text>
        </TextButton>
      }
    >
      <Column modifiers={[fillMaxWidth(), selectableGroup()]}>
        {section.options.map(option => {
          const isSelected = option.value === section.selected;

          return (
            <Row
              key={option.value}
              verticalAlignment="center"
              modifiers={[
                fillMaxWidth(),
                height(48),
                selectable(
                  isSelected,
                  () => handleSelect(option.value),
                  'radioButton',
                ),
                padding(24, 0, 24, 0),
              ]}
            >
              <RadioButton selected={isSelected} />
              <Text color={colors.onSurface} modifiers={[padding(16, 0, 0, 0)]}>
                {option.label}
              </Text>
            </Row>
          );
        })}
      </Column>
    </SettingsDialog>
  );
};

/**
 * Shared settings screen in the Android (Google apps) settings idiom — a
 * category of preference rows (supporting text shows the current value, tap
 * opens a single-choice radio dialog) followed by an optional account block.
 * Every label, value, handler, and color is supplied by the host app so each
 * app reuses the same layout and interaction model while owning its own copy,
 * state, and palette.
 */
export const SettingsScreen = ({
  account,
  sections,
  sectionsTitle,
  cancelLabel = 'Cancel',
  about,
  legal,
  devToggles,
  colors,
  colorScheme,
  seedColor,
  scrollProps,
}: SettingsScreenProps) => {
  const [openSectionTitle, setOpenSectionTitle] = useState<string | null>(null);
  const [accountDialog, setAccountDialog] = useState<
    'username' | 'signOut' | null
  >(null);

  const openPreference = useCallback(
    (title: string) => setOpenSectionTitle(title),
    [],
  );
  const closePreference = useCallback(() => setOpenSectionTitle(null), []);
  const openUsernameDialog = useCallback(
    () => setAccountDialog('username'),
    [],
  );
  const openSignOutConfirm = useCallback(() => setAccountDialog('signOut'), []);
  const closeAccountDialog = useCallback(() => setAccountDialog(null), []);

  const openSection = sections.find(
    section => section.title === openSectionTitle,
  );

  /**
   * IS THE ACCOUNT BLOCK A GROUP, OR JUST THE SIGN-OUT ACTION?
   *
   * An app that passes a profile, nav rows or danger rows has a real account
   * GROUP, and it renders where it always has — between General and About.
   * An app that passes only the sign-out fields (the starter, and Topper, whose
   * identity lives on its Profile tab) has no group at all: it has one
   * destructive ACTION, and a lone action does not belong wedged between two
   * content groups under a header naming a group that isn't there.
   *
   * So that case renders LAST, headerless, after About — which is where Google
   * puts "Sign out", and independently the shape iOS already had (a trailing
   * bare card; `SettingsLegalConfig` records the same argument for why Sign Out
   * is the ONE headerless card on that side). Two platforms, one reason: a
   * header names a group, and this is not one.
   *
   * Apps WITH an identity group are deliberately untouched here. Whether their
   * account block should lead the screen the way Apple's does is a real
   * question — it is row 8 of the 2026-08-29 parity audit — but answering it
   * moves Topper's and Sound Shaper's Settings, and neither was on the device
   * for this pass.
   */
  const accountIsGroup = Boolean(
    account &&
    (account.profile || account.navRows?.length || account.dangerRows?.length),
  );

  return (
    <Screen backgroundColor={colors.background}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView {...scrollProps} contentContainerStyle={styles.scroll}>
          <Host
            matchContents={{ vertical: true }}
            colorScheme={colorScheme}
            seedColor={seedColor}
            style={styles.host}
          >
            <Column
              modifiers={[fillMaxWidth()]}
              verticalArrangement={{ spacedBy: 8 }}
            >
              {/* A GROUP HEADER IS A LABEL, SO IT TAKES THE INK.
                  It used to be `colors.primary`, which on a wallpaper-derived
                  palette rendered #4979F6 on the A54 — the same accent in both
                  appearances — for three static strings that carry no state, no
                  selection and no action. Google's own Settings does tint its
                  category headers, so this was a defensible Material reading;
                  it is not the house one. The monochrome rule crossed to
                  Android on 2026-08-29 and its first bucket is exactly this
                  case: colour a thing was given because the framework tints it
                  by default, saying nothing. `onSurfaceVariant` is what M3
                  spends on a list subheader anyway.

                  What KEEPS its colour on this screen is what means something:
                  the destructive sign-out row stays `danger`, and the radio
                  dialog's selected button stays the accent — that one IS the
                  selection. */}
              {sectionsTitle ? (
                <Text
                  color={colors.onSurfaceMuted}
                  style={{ typography: 'labelLarge' }}
                  modifiers={[padding(16, 16, 16, 8)]}
                >
                  {sectionsTitle}
                </Text>
              ) : null}

              <Column
                modifiers={[
                  fillMaxWidth(),
                  padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
                ]}
                verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
              >
                {sections.map((section, index) => (
                  <PreferenceRow
                    key={section.title}
                    title={section.title}
                    icon={section.icon}
                    selectedLabel={
                      section.options.find(
                        option => option.value === section.selected,
                      )?.label
                    }
                    shape={groupRowShape(index, sections.length)}
                    colors={colors}
                    onOpen={openPreference}
                  />
                ))}
              </Column>

              {/* Dev sits directly under General — the iOS variant's order
                  (General → Dev → About), matched so the two twins read the
                  same way down. It rendered LAST here for as long as Android
                  was frozen, which was a leftover rather than a Material
                  argument: Material has no idiom for where dev chrome goes,
                  so the shared order wins. */}
              {devToggles ? (
                <DevTogglesGroup devToggles={devToggles} colors={colors} />
              ) : null}

              {account && accountIsGroup ? (
                <SettingsAccountSection
                  {...account}
                  colors={colors}
                  onOpenUsernameDialog={
                    account.usernameEditor ? openUsernameDialog : undefined
                  }
                  onOpenSignOutConfirm={openSignOutConfirm}
                />
              ) : null}

              {about ? (
                <InfoGroup
                  title={about.title}
                  rows={about.rows}
                  colors={colors}
                />
              ) : null}

              {/* LEGAL IS ITS OWN CARD, not two more About rows.
                  It used to be appended to About, on a reason that read
                  "exactly where they rendered before they became their own
                  prop — Material's grouping keeps them there": the first half
                  is history and the second was asserted, which is the same
                  shape as the freeze clauses retired on 2026-08-29. What
                  Android actually does is put ONE "Legal information" row under
                  About phone that opens a sub-screen — not two flat links
                  sitting beside a version number. Merged, this was also the
                  only content card on the screen with no header of its own,
                  while General and About both had one (Sign Out is bare on
                  purpose: it is an action, not a group). */}
              {legal ? (
                <InfoGroup
                  title={legal.title}
                  rows={legal.rows}
                  colors={colors}
                />
              ) : null}

              {/* A lone sign-out closes the screen instead of sitting under an
                  "Account" header that names a group it isn't. See
                  `accountIsGroup` above. */}
              {account && !accountIsGroup ? (
                <SettingsSignOutSection
                  signOutLabel={account.signOutLabel}
                  signOutDialog={account.signOutDialog}
                  onSignOut={account.onSignOut}
                  colors={colors}
                  onOpenSignOutConfirm={openSignOutConfirm}
                />
              ) : null}
            </Column>
          </Host>
        </ScrollView>

        {/* Dialogs live in their own Hosts: mounting them inside the scroll
            Host corrupts the sibling rows' clip shapes on unmount and
            flickers their icons. */}
        {openSection ? (
          <Host matchContents colorScheme={colorScheme} seedColor={seedColor}>
            <RadioOptionsDialog
              section={openSection}
              cancelLabel={cancelLabel}
              colors={colors}
              onDismiss={closePreference}
            />
          </Host>
        ) : null}

        {accountDialog === 'username' && account?.usernameEditor ? (
          <Host matchContents colorScheme={colorScheme} seedColor={seedColor}>
            <UsernameDialog
              editor={account.usernameEditor}
              colors={colors}
              onDismiss={closeAccountDialog}
            />
          </Host>
        ) : null}

        {accountDialog === 'signOut' && account ? (
          <Host matchContents colorScheme={colorScheme} seedColor={seedColor}>
            <DestructiveConfirmDialog
              dialog={account.signOutDialog}
              colors={colors}
              onConfirm={() => {
                closeAccountDialog();
                account.onSignOut();
              }}
              onDismiss={closeAccountDialog}
            />
          </Host>
        ) : null}
      </SafeAreaView>
    </Screen>
  );
};
