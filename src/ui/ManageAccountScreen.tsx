import React, { useState } from 'react';

import { ScrollView, StyleSheet } from 'react-native';

import {
  Column,
  Host,
  Icon,
  ListItem,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { SafeAreaView } from 'react-native-safe-area-context';

import { iconSource } from './icons';
import { Screen } from './Screen';
import {
  UsernameDialog,
  type SettingsUsernameEditor,
} from './SettingsAccountSection';
import {
  GROUP_HEADERLESS_TOP_GAP,
  GROUP_ROW_GAP,
  GROUP_SIDE_PADDING,
  groupRowShape,
} from './settingsGroup';

/**
 * App-resolved colors the manage-account screen paints with.
 * `surfaceVariant` / `surfaceDialog` exist for the username dialog (the same
 * `UsernameDialog` the Settings profile row used to open); every app already
 * passes its full palette, so widening the type costs no caller anything.
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
   * native username alert (`UsernameEditRowIos`); on Android it opens the
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
   * App brand seed forwarded to the Compose `Host`s so the native components
   * (the username dialog's field and buttons) theme from the same palette
   * `SettingsScreen` uses. Android-only, exactly as there.
   */
  seedColor?: string;
  /**
   * The read-only facts block. Optional: an app with no real session (the
   * starter) has no facts to state and shows only the actions below.
   */
  info?: {
    title: string;
    rows: ManageAccountInfoRow[];
    /**
     * iOS only. The facts have not arrived yet, so each VALUE stands a
     * `SkeletonBone` — the same sweeping placeholder every other loading
     * surface in these apps uses.
     *
     * THE CALLER STILL PASSES A FULL ROW SET while this is true, so the row
     * COUNT is settled from the first frame; the labels are static strings and
     * render immediately, which is what pins each row's height. Nothing moves
     * on hand-off, and no bone is hand-built beside these rows — the real rows
     * stand themselves and only the unknown part is a bone.
     *
     * Android does not read it — a pushed screen whose facts come from the
     * auth object it was navigated with has nothing to wait for.
     */
    loading?: boolean;
  };
  /**
   * Optional destination sections between `info` and `privacy`. Untitled ones
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
  colorScheme,
  seedColor,
  info,
  sections,
  privacy,
  danger,
  children,
}: ManageAccountScreenProps) => {
  const [usernameDialogVisible, setUsernameDialogVisible] = useState(false);

  // At most one row is editable (the username), so the dialog binds to the
  // first editor it finds rather than tracking which row was tapped.
  const editor = info?.rows.find(row => row.editor)?.editor;

  const rowColors = {
    containerColor: colors.surfaceContainer,
    contentColor: colors.onSurface,
    supportingContentColor: colors.onSurfaceMuted,
  };

  // Ink, not the accent — a group header is a label. These were
  // `colors.primary` for as long as this screen was frozen; the monochrome
  // rule crossed to Android on 2026-08-29 and its first bucket is exactly a
  // header tinted because the framework's own apps tint theirs. The full
  // argument is on `sectionsTitle` in `SettingsScreen`, whose headers made
  // the same move.
  // The same padding for EVERY header, first included — SettingsScreen's own
  // shape. The first header used to drop its top 16, which is what stood
  // "Account Information" visibly higher than Settings' "General" one push
  // away: the scroller's 16 plus the header's 16 is the shared 32.
  const sectionHeader = (title: string) => (
    <Text
      color={colors.onSurfaceMuted}
      style={{ typography: 'labelLarge' }}
      modifiers={[padding(16, 16, 16, 8)]}
    >
      {title}
    </Text>
  );

  /**
   * One grouped card of push rows — the destination `sections` and `privacy`
   * are the same object, so they render through the same term. A HEADERLESS
   * card asks for the headerless top gap, exactly as the trailing sign-out
   * card does on the Settings screen: without it the bare card lands hard
   * against the group above and reads as more rows of it.
   */
  const navGroup = (rows: ManageAccountNavRow[], headerless = false) => (
    <Column
      modifiers={[
        fillMaxWidth(),
        padding(
          GROUP_SIDE_PADDING,
          headerless ? GROUP_HEADERLESS_TOP_GAP : 0,
          GROUP_SIDE_PADDING,
          0,
        ),
      ]}
      verticalArrangement={{ spacedBy: GROUP_ROW_GAP }}
    >
      {rows.map((row, index) => (
        <ListItem
          key={row.id}
          colors={rowColors}
          modifiers={[
            fillMaxWidth(),
            clip(groupRowShape(index, rows.length)),
            clickable(row.onPress),
          ]}
        >
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
  );

  return (
    <Screen backgroundColor={colors.background} edges={['left', 'right']}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* The SCROLLER IS SettingsScreen's, verbatim — an RN ScrollView over a
            vertically-matched Host, with the same paddingVertical 16. It was
            missing entirely: the Host stood unscrollable, the content taller
            than the screen was simply clipped, and the Delete Account card
            ended under the OS navigation bar with no way to bring it up. The
            bottom 16 is also what stands the last card off the gesture strip,
            exactly as Settings' Sign Out card is. */}
        <ScrollView contentContainerStyle={styles.scroll}>
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
              {/* `info` / `danger` are optional on the shared type only so the
                  iOS Account sheet can omit them in a session-less app. Every
                  ANDROID caller passes both. */}
              {info ? (
                <>
                  {sectionHeader(info.title)}
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
                          // The editable fact (the username) opens its dialog
                          // from the row itself, the same tap the Settings
                          // profile row used to carry.
                          ...(row.editor
                            ? [clickable(() => setUsernameDialogVisible(true))]
                            : []),
                        ]}
                      >
                        {/* The VALUE sits trailing on the SAME line — the iOS
                          twin's `LabeledContent` shape (label left, fact
                          right), taken here too so a fact is one row tall
                          and the Delete Account card comes up without a
                          scroll. Label and value share the HEADLINE slot as
                          one Row, with the value taking `weight(1)`: that is
                          what CONSTRAINS it, so a long value (the email)
                          truncates with an ellipsis instead of winning the
                          width fight — put in the trailing slot it measured
                          at its full desired width and wrapped the LABEL
                          onto two lines. The editable fact keeps the
                          disclosure chevron in the trailing slot, the
                          statement `FormDisclosureRowIos` makes; a plain
                          fact stays chevron-free. */}
                        <ListItem.HeadlineContent>
                          <Row
                            verticalAlignment="center"
                            horizontalArrangement={{ spacedBy: 16 }}
                            modifiers={[fillMaxWidth()]}
                          >
                            <Text color={colors.onSurface}>{row.label}</Text>
                            <Text
                              color={colors.onSurfaceMuted}
                              style={{ textAlign: 'end' }}
                              maxLines={1}
                              overflow="ellipsis"
                              modifiers={[weight(1)]}
                            >
                              {row.value}
                            </Text>
                          </Row>
                        </ListItem.HeadlineContent>
                        {row.editor ? (
                          <ListItem.TrailingContent>
                            <Icon
                              source={iconSource('chevron')}
                              size={24}
                              tint={colors.onSurfaceMuted}
                            />
                          </ListItem.TrailingContent>
                        ) : null}
                      </ListItem>
                    ))}
                  </Column>
                </>
              ) : null}

              {sections?.map((section, index) => (
                <React.Fragment key={section.title ?? index}>
                  {section.title ? sectionHeader(section.title) : null}
                  {navGroup(section.rows, !section.title)}
                </React.Fragment>
              ))}

              {privacy ? (
                <>
                  {sectionHeader(privacy.title)}
                  {navGroup(privacy.rows)}
                </>
              ) : null}

              {/* NO HEADER, A FOOTER — Apple's shape for a destructive group,
                  taken by Android too (Juan, 2026-09-04). The header was a
                  category label saying the row's own words ("Delete Account"
                  over Delete Account); the space under an irreversible row
                  belongs to what it will DO. So the card is headerless like
                  the Trophies card above — it asks for the same headerless
                  top gap — and `rowDescription` renders OUTSIDE the pressable
                  row, as the card's legend, exactly where the iOS `Section`
                  footer puts it. */}
              {danger ? (
                <>
                  <Column
                    modifiers={[
                      fillMaxWidth(),
                      padding(
                        GROUP_SIDE_PADDING,
                        GROUP_HEADERLESS_TOP_GAP,
                        GROUP_SIDE_PADDING,
                        0,
                      ),
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
                      {/* No leading glyph and no chevron — a destructive row is
                        a bare red label on both platforms (Apple's own shape;
                        Android followed 2026-09-04). */}
                      <ListItem.HeadlineContent>
                        <Text color={colors.danger}>{danger.rowLabel}</Text>
                      </ListItem.HeadlineContent>
                    </ListItem>
                  </Column>
                  {danger.rowDescription ? (
                    /* The footer's ink lines up with the ROW'S OWN text (the
                       card inset plus the ListItem's 16dp padding), which is
                       iOS's rule for a section footer — it explains the row,
                       so it stands under the row's words rather than under
                       the card's edge. `bodySmall` — a LEGEND, a step below
                       the rows it explains, the same drop the iOS footnote
                       footer takes from its rows (`bodyMedium` rendered as
                       one more label; Juan called it). The parent Column's
                       spacedBy 8 is the card-to-footer gap. */
                    <Text
                      color={colors.onSurfaceMuted}
                      style={{ typography: 'bodySmall' }}
                      modifiers={[
                        padding(
                          GROUP_SIDE_PADDING + 16,
                          0,
                          GROUP_SIDE_PADDING + 16,
                          0,
                        ),
                      ]}
                    >
                      {danger.rowDescription}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </Column>
          </Host>
        </ScrollView>
      </SafeAreaView>

      {/* Own Host — a dialog mounted inside the rows' Host corrupts their
          clip shapes on unmount (the same rule SettingsScreen documents). */}
      {usernameDialogVisible && editor ? (
        <Host matchContents colorScheme={colorScheme} seedColor={seedColor}>
          <UsernameDialog
            editor={editor}
            colors={colors}
            onDismiss={() => setUsernameDialogVisible(false)}
          />
        </Host>
      ) : null}

      {children}
    </Screen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { paddingVertical: 16 },
  host: { width: '100%' },
});
