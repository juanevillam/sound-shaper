import React, { memo, useCallback, useState } from 'react';

import { Linking, ScrollView, StyleSheet } from 'react-native';

import {
  BasicAlertDialog,
  Column,
  Host,
  Icon,
  ListItem,
  RadioButton,
  Row,
  Surface,
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
  Shapes,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DestructiveConfirmDialog } from './DestructiveConfirmDialog';
import { iconSource, type IconName } from './icons';
import { Screen } from './Screen';
import {
  SettingsAccountSection,
  UsernameDialog,
  type SettingsAccountColors,
  type SettingsAccountSectionProps,
} from './SettingsAccountSection';
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
 * inside the app. Passed separately from `about` because the two platforms
 * group them differently — Apple gives legal its own card between About and
 * Sign Out, while ANDROID (frozen) keeps them appended to the About list,
 * which is where they shipped. Each variant does that merge itself, so an app
 * passes the rows once and neither platform's output changes shape.
 */
export type SettingsLegalConfig = {
  /**
   * Section header, iOS only — Android appends these rows to About and never
   * renders a header for them (see `aboutRows` below).
   *
   * Titled because every CONTENT group on the screen is: General, Account,
   * About and these. The only headerless card is the trailing Sign Out, which
   * is an ACTION rather than a group — Apple leaves that one bare too (the
   * Apple Account sheet's own Sign Out). Without a header here the screen read
   * unevenly, with one content card silently different from its neighbours.
   */
  title?: string;
  rows: SettingsInfoRow[];
};

/** App-resolved colors the settings screen paints with. */
export type SettingsScreenColors = SettingsAccountColors & {
  background?: string;
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
   * DEV-ONLY toggle rows rendered as their own trailing section (iOS variant
   * only today; the Android variant ignores it, and release builds must not
   * pass it at all — the host gates on `__DEV__`). Labels arrive as plain
   * strings: dev chrome is exempt from the translation pipeline, like the
   * state lab's own copy.
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

const DIALOG_WIDTH = 312;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
        supportingContentColor: colors.onSurfaceMuted,
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
 * The single-choice radio dialog a preference row opens. Hosted by the screen
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
    <BasicAlertDialog onDismissRequest={onDismiss}>
      <Surface
        tonalElevation={6}
        modifiers={[width(DIALOG_WIDTH), clip(Shapes.RoundedCorner(28))]}
      >
        <Column modifiers={[fillMaxWidth()]}>
          <Text
            color={colors.onSurface}
            style={{
              typography: 'headlineSmall',
            }}
            modifiers={[padding(24, 24, 24, 16)]}
          >
            {section.title}
          </Text>
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
                  <Text
                    color={colors.onSurface}
                    modifiers={[padding(16, 0, 0, 0)]}
                  >
                    {option.label}
                  </Text>
                </Row>
              );
            })}
          </Column>
          <Row
            horizontalArrangement="end"
            modifiers={[fillMaxWidth(), padding(24, 8, 16, 12)]}
          >
            <TextButton onClick={onDismiss}>
              <Text>{cancelLabel}</Text>
            </TextButton>
          </Row>
        </Column>
      </Surface>
    </BasicAlertDialog>
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
  colors,
  colorScheme,
  seedColor,
  scrollProps,
}: SettingsScreenProps) => {
  const [openSectionTitle, setOpenSectionTitle] = useState<string | null>(null);
  const [accountDialog, setAccountDialog] = useState<
    'username' | 'signOut' | null
  >(null);

  const aboutRows = about ? [...about.rows, ...(legal?.rows ?? [])] : [];

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
              {sectionsTitle ? (
                <Text
                  color={colors.primary}
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

              {account ? (
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
                <>
                  {about.title ? (
                    <Text
                      color={colors.primary}
                      style={{
                        typography: 'labelLarge',
                      }}
                      modifiers={[padding(16, 16, 16, 8)]}
                    >
                      {about.title}
                    </Text>
                  ) : null}
                  <Column
                    modifiers={[
                      fillMaxWidth(),
                      padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
                    ]}
                    verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
                  >
                    {/* Legal rows are appended to About here, which is exactly
                        where they rendered before they became their own prop —
                        Android is frozen, so its output must not move. iOS
                        gives them their own card instead. */}
                    {aboutRows.map((row, index) => (
                      <InfoRow
                        key={row.label}
                        row={row}
                        shape={groupRowShape(index, aboutRows.length)}
                        colors={colors}
                      />
                    ))}
                  </Column>
                </>
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
