import React from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  LabeledContent,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  foregroundStyle,
  padding,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';

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
 */
export const ManageAccountScreen = ({
  colors,
  info,
  sections,
  privacy,
  danger,
  children,
}: ManageAccountScreenProps) => (
  <Screen backgroundColor={colors.background} edges={['left', 'right']}>
    <Host style={styles.host}>
      <Form
        modifiers={[
          scrollContentBackground('hidden'),
          tint(colors.primary),
          padding({ top: 16 }),
        ]}
      >
        <Section title={info.title}>
          {info.rows.map(row =>
            // An editable fact (Topper's Username) opens the shared native
            // alert; everything else stays a read-only `LabeledContent`.
            //
            // Editable rows are built by hand rather than from LabeledContent:
            // they need the disclosure chevron that marks them tappable (the
            // Name / Phone / Email rows in Apple's own Apple Account screen),
            // and their label must stay `onSurface` — inside a `Button` it
            // would otherwise inherit the control tint and read blue while
            // every neighbouring label is not.
            row.editor ? (
              <UsernameEditRowIos key={row.label} editor={row.editor}>
                <HStack spacing={8}>
                  <Text modifiers={[foregroundStyle(colors.onSurface)]}>
                    {row.label}
                  </Text>
                  <Spacer />
                  <Text modifiers={[foregroundStyle(colors.onSurfaceMuted)]}>
                    {row.value}
                  </Text>
                  <Image
                    systemName="chevron.right"
                    size={13}
                    color={colors.onSurfaceMuted}
                  />
                </HStack>
              </UsernameEditRowIos>
            ) : (
              <LabeledContent key={row.label} label={row.label}>
                <Text>{row.value}</Text>
              </LabeledContent>
            ),
          )}
        </Section>

        {sections?.map((section, index) => (
          <Section
            key={section.title ?? `section-${index}`}
            title={section.title}
          >
            {section.rows.map(row => (
              <Button key={row.id} onPress={row.onPress}>
                <HStack spacing={8}>
                  <Text modifiers={[foregroundStyle(colors.onSurface)]}>
                    {row.label}
                  </Text>
                  <Spacer />
                  <Image
                    systemName="chevron.right"
                    size={13}
                    color={colors.onSurfaceMuted}
                  />
                </HStack>
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
                <HStack spacing={8}>
                  <Text modifiers={[foregroundStyle(colors.onSurface)]}>
                    {row.label}
                  </Text>
                  <Spacer />
                  <Image
                    systemName="chevron.right"
                    size={13}
                    color={colors.onSurfaceMuted}
                  />
                </HStack>
              </Button>
            ))}
          </Section>
        ) : null}

        <Section title={danger.title}>
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
      </Form>
    </Host>

    {children}
  </Screen>
);

const styles = StyleSheet.create({
  host: { flex: 1 },
});
