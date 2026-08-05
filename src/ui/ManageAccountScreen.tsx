import React from 'react';

import { StyleSheet } from 'react-native';

import { Column, Host, Icon, ListItem, Text } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { SafeAreaView } from 'react-native-safe-area-context';

import { iconSource, type IconName } from './icons';
import { Screen } from './Screen';
import { type SettingsUsernameEditor } from './SettingsAccountSection';
import {
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
} from './settingsGroup';

/** App-resolved colors the manage-account screen paints with. */
export type ManageAccountColors = {
  primary: string;
  onSurface: string;
  onSurfaceMuted: string;
  surfaceContainer: string;
  danger: string;
  background: string;
};

/** A read-only fact about the account (name, email, member-since). */
export type ManageAccountInfoRow = {
  label: string;
  value: string;
  /**
   * iOS only. Makes this read-only fact EDITABLE: tapping the row opens the
   * native username alert (`UsernameEditRowIos`).
   *
   * Topper's Username row uses it. Apple does the same — Settings → Apple
   * Account keeps Name / Phone / Email editable one level down rather than on
   * the identity row itself, which is why dropping the editor from the Settings
   * row did not mean dropping it altogether. Android edits the handle from its
   * own profile header and passes nothing here.
   */
  editor?: SettingsUsernameEditor;
};

/** A push row, e.g. Topper's blocked-users list. */
export type ManageAccountNavRow = {
  id: string;
  label: string;
  icon: IconName;
  onPress: () => void;
};

export type ManageAccountScreenProps = {
  colors: ManageAccountColors;
  /** The read-only facts block. */
  info: { title: string; rows: ManageAccountInfoRow[] };
  /**
   * Optional destination sections between `info` and `privacy`. Untitled ones
   * render as a bare card, which is what Apple does for a group whose rows say
   * what they are.
   *
   * Topper's Trophies and Trash live here on iOS: the Settings sheet's identity
   * row is a single destination (Apple's Apple Account pattern), so everything
   * account-shaped sits behind it rather than as loose rows in Settings.
   * Android, frozen, keeps them in Settings and passes nothing here.
   */
  sections?: Array<{ title?: string; rows: ManageAccountNavRow[] }>;
  /**
   * Optional middle section (Topper: Privacy → Blocked users). OMIT IT
   * ENTIRELY in an app with no social module — the section header must not
   * render with nothing under it.
   */
  privacy?: { title: string; rows: ManageAccountNavRow[] };
  /**
   * The irreversible action, always last. `onPress` opens the HOST's own
   * confirmation — the countdown dialog and the native alert are different
   * enough per app that the screen must not own that decision, it only owns
   * where the row sits and how it reads.
   */
  danger: {
    title: string;
    rowLabel: string;
    /** Supporting line under the row (Android only; iOS rows stay single-line). */
    rowDescription?: string;
    icon: IconName;
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
 * Account management, pushed from Settings: the read-only facts of the account
 * with the delete-account flow at the bottom. Exists partly to keep that
 * delete entry OFF the main settings surface — the platform idiom
 * (WhatsApp/Google) buries irreversible account actions one level deeper so
 * nobody gets CTA'd into them next to everyday rows like Log out.
 *
 * Shared by every portfolio app and configured by props, exactly like
 * `SettingsScreen`: an app with no social module simply omits `privacy`.
 * Before this was lifted, each app had written its own — and they had already
 * drifted onto different layouts AND different delete flows.
 */
export const ManageAccountScreen = ({
  colors,
  info,
  privacy,
  danger,
  children,
}: ManageAccountScreenProps) => {
  const rowColors = {
    containerColor: colors.surfaceContainer,
    contentColor: colors.onSurface,
    supportingContentColor: colors.onSurfaceMuted,
  };

  const sectionHeader = (title: string, first = false) => (
    <Text
      color={colors.primary}
      style={{ typography: 'labelLarge' }}
      modifiers={[padding(16, first ? 0 : 16, 16, 8)]}
    >
      {title}
    </Text>
  );

  return (
    <Screen backgroundColor={colors.background} edges={['left', 'right']}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <Host matchContents={{ vertical: true }} style={styles.host}>
          <Column
            modifiers={[fillMaxWidth(), padding(0, 16, 0, 0)]}
            verticalArrangement={{ spacedBy: 8 }}
          >
            {sectionHeader(info.title, true)}
            <Column
              modifiers={[
                fillMaxWidth(),
                padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
              ]}
              verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
            >
              {info.rows.map((row, index) => (
                <ListItem
                  key={row.label}
                  colors={rowColors}
                  modifiers={[
                    fillMaxWidth(),
                    clip(groupRowShape(index, info.rows.length)),
                  ]}
                >
                  <ListItem.HeadlineContent>
                    <Text color={colors.onSurface}>{row.label}</Text>
                  </ListItem.HeadlineContent>
                  <ListItem.SupportingContent>
                    <Text color={colors.onSurfaceMuted}>{row.value}</Text>
                  </ListItem.SupportingContent>
                </ListItem>
              ))}
            </Column>

            {privacy ? (
              <>
                {sectionHeader(privacy.title)}
                <Column
                  modifiers={[
                    fillMaxWidth(),
                    padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
                  ]}
                  verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
                >
                  {privacy.rows.map((row, index) => (
                    <ListItem
                      key={row.id}
                      colors={rowColors}
                      modifiers={[
                        fillMaxWidth(),
                        clip(groupRowShape(index, privacy.rows.length)),
                        clickable(row.onPress),
                      ]}
                    >
                      <ListItem.LeadingContent>
                        <Icon
                          source={iconSource(row.icon)}
                          size={24}
                          tint={colors.onSurface}
                        />
                      </ListItem.LeadingContent>
                      <ListItem.HeadlineContent>
                        <Text color={colors.onSurface}>{row.label}</Text>
                      </ListItem.HeadlineContent>
                      <ListItem.TrailingContent>
                        <Icon
                          source={iconSource('chevron')}
                          size={24}
                          tint={colors.onSurfaceMuted}
                        />
                      </ListItem.TrailingContent>
                    </ListItem>
                  ))}
                </Column>
              </>
            ) : null}

            {sectionHeader(danger.title)}
            <Column
              modifiers={[
                fillMaxWidth(),
                padding(GROUP_SIDE_PADDING, 0, GROUP_SIDE_PADDING, 0),
              ]}
            >
              <ListItem
                colors={{ ...rowColors, contentColor: colors.danger }}
                modifiers={[
                  fillMaxWidth(),
                  clip(groupRowShape(0, 1)),
                  ...(danger.disabled ? [] : [clickable(danger.onPress)]),
                ]}
              >
                <ListItem.LeadingContent>
                  <Icon
                    source={iconSource(danger.icon)}
                    size={24}
                    tint={colors.danger}
                  />
                </ListItem.LeadingContent>
                <ListItem.HeadlineContent>
                  <Text color={colors.danger}>{danger.rowLabel}</Text>
                </ListItem.HeadlineContent>
                {danger.rowDescription ? (
                  <ListItem.SupportingContent>
                    <Text color={colors.onSurfaceMuted}>
                      {danger.rowDescription}
                    </Text>
                  </ListItem.SupportingContent>
                ) : null}
              </ListItem>
            </Column>
          </Column>
        </Host>
      </SafeAreaView>

      {children}
    </Screen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  host: { width: '100%' },
});
