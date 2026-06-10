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

import { iconSource, type IconName } from './icons';
import { Screen } from './Screen';
import {
  SettingsAccountSection,
  type SettingsAccountColors,
  type SettingsAccountSectionProps,
} from './SettingsAccountSection';

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

/** Account block config — same as the section's props minus the shared colors. */
export type SettingsAccountConfig = Omit<SettingsAccountSectionProps, 'colors'>;

/** A read-only label/value row, e.g. a bundled package version. */
export type SettingsInfoRow = {
  label: string;
  value: string;
  /** Optional external link the row opens when tapped, e.g. package docs. */
  url?: string;
};

/** Trailing read-only block, e.g. "About" with app/package versions. */
export type SettingsAboutConfig = {
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
  /** Label for the dismiss action in the option dialogs. */
  cancelLabel?: string;
  /** Optional read-only info rows rendered last, e.g. bundled versions. */
  about?: SettingsAboutConfig;
  colors: SettingsScreenColors;
  colorScheme?: 'light' | 'dark';
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
    colors,
    onPress,
  }: {
    title: string;
    icon?: IconName;
    selectedLabel?: string;
    colors: SettingsScreenColors;
    onPress: () => void;
  }) => (
    <ListItem
      colors={{
        containerColor: 'transparent',
        contentColor: colors.onSurface,
        supportingContentColor: colors.onSurfaceMuted,
      }}
      modifiers={[clickable(onPress)]}
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
 * value as supporting text. Rows with a `url` open it in the browser on tap
 * (the "About phone" rows that lead somewhere look identical to those that
 * don't, so no trailing affordance).
 */
const InfoRow = ({
  row,
  colors,
}: {
  row: SettingsInfoRow;
  colors: SettingsScreenColors;
}) => (
  <ListItem
    colors={{
      containerColor: 'transparent',
      contentColor: colors.onSurface,
      supportingContentColor: colors.onSurfaceMuted,
    }}
    modifiers={
      row.url ? [clickable(() => Linking.openURL(row.url!))] : undefined
    }
  >
    <ListItem.HeadlineContent>
      <Text>{row.label}</Text>
    </ListItem.HeadlineContent>
    <ListItem.SupportingContent>
      <Text
        style={{ typography: 'bodyMedium' }}
        modifiers={[padding(0, 4, 0, 0)]}
      >
        {row.value}
      </Text>
    </ListItem.SupportingContent>
  </ListItem>
);

/**
 * A preference row in the Android settings idiom (`ListPreference`): leading
 * icon, setting name, and the current value as supporting text. Tapping it
 * opens a radio-group dialog; choosing an option applies it and dismisses.
 */
const RadioPreference = ({
  section,
  cancelLabel,
  colors,
}: {
  section: SettingsRadioSection;
  cancelLabel: string;
  colors: SettingsScreenColors;
}) => {
  const [dialogVisible, setDialogVisible] = useState(false);

  const selectedLabel = section.options.find(
    option => option.value === section.selected,
  )?.label;

  const openDialog = useCallback(() => setDialogVisible(true), []);

  const handleSelect = (value: string) => {
    setDialogVisible(false);
    if (value !== section.selected) section.onSelect(value);
  };

  return (
    <>
      <PreferenceRow
        title={section.title}
        icon={section.icon}
        selectedLabel={selectedLabel}
        colors={colors}
        onPress={openDialog}
      />

      {dialogVisible && (
        <BasicAlertDialog onDismissRequest={() => setDialogVisible(false)}>
          <Surface
            tonalElevation={6}
            modifiers={[width(DIALOG_WIDTH), clip(Shapes.RoundedCorner(28))]}
          >
            <Column modifiers={[fillMaxWidth()]}>
              <Text
                color={colors.onSurface}
                style={{ typography: 'headlineSmall' }}
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
                <TextButton onClick={() => setDialogVisible(false)}>
                  <Text>{cancelLabel}</Text>
                </TextButton>
              </Row>
            </Column>
          </Surface>
        </BasicAlertDialog>
      )}
    </>
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
  colors,
  colorScheme,
}: SettingsScreenProps) => (
  <Screen backgroundColor={colors.background}>
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Host
          matchContents={{ vertical: true }}
          colorScheme={colorScheme}
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

            {sections.map(section => (
              <RadioPreference
                key={section.title}
                section={section}
                cancelLabel={cancelLabel}
                colors={colors}
              />
            ))}

            {account ? (
              <SettingsAccountSection {...account} colors={colors} />
            ) : null}

            {about ? (
              <>
                {about.title ? (
                  <Text
                    color={colors.primary}
                    style={{ typography: 'labelLarge' }}
                    modifiers={[padding(16, 16, 16, 8)]}
                  >
                    {about.title}
                  </Text>
                ) : null}
                {about.rows.map(row => (
                  <InfoRow key={row.label} row={row} colors={colors} />
                ))}
              </>
            ) : null}
          </Column>
        </Host>
      </ScrollView>
    </SafeAreaView>
  </Screen>
);
