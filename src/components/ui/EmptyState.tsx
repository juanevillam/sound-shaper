import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';

import { Button, Column, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';

const EMOJI_SIZE = 48;

type EmptyStateProps = {
  emoji?: string;
  /**
   * iOS only — the `.ios` variant draws it as the native
   * `ContentUnavailableView`'s symbol. Declared here purely so a shared call
   * site type-checks: `tsc` resolves the base specifier and never applies
   * `.ios`. See AGENTS.md → "iOS-only components".
   */
  systemImage?: string;
  title: string;
  subtitle?: string;
  /**
   * Standard call-to-action below the text — the single affordance used for
   * "Try again" on error states and primary CTAs on empty states, so every
   * screen surfaces it identically. For bespoke content use `children`.
   */
  action?: { label: string; onPress: () => void };
  /** Extra Compose content below the text, e.g. a custom CTA Button. */
  children?: ReactNode;
};

// Centered empty/error state. The Host matches contents only vertically: a
// boolean matchContents sizes the Host to the text's intrinsic single-line
// width, which can exceed the screen — vertical-only keeps the width
// constrained so subtitles wrap.
export function EmptyState({
  emoji,
  title,
  subtitle,
  action,
  children,
}: EmptyStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.centered}>
      <ThemedHost style={styles.host} matchContents={{ vertical: true }}>
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth()]}
        >
          {emoji ? <Text style={{ fontSize: EMOJI_SIZE }}>{emoji}</Text> : null}
          <Text
            color={colors.onSurface}
            style={{ typography: 'titleLarge', textAlign: 'center' }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'bodyMedium', textAlign: 'center' }}
            >
              {subtitle}
            </Text>
          ) : null}
          {action ? (
            <Button onClick={action.onPress}>
              <Text>{action.label}</Text>
            </Button>
          ) : null}
          {children}
        </Column>
      </ThemedHost>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  host: { width: '100%' },
});
