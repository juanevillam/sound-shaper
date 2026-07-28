import type { ReactNode } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { PILL_RADIUS } from '@/styles/shape';

const EMOJI_SIZE = 48;
const PRESSED_OPACITY = 0.7;

type EmptyStateProps = {
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Standard call-to-action below the text (see the Android variant). */
  action?: { label: string; onPress: () => void };
  /** Extra RN content below the text (the Android variant takes Compose). */
  children?: ReactNode;
};

// iOS counterpart of `EmptyState` — same prop shape, pure RN: centered emoji +
// title + subtitle, with the CTA as a tinted capsule button (the iOS
// `borderedProminent` read) instead of a Material filled button. No Host at
// all, so nothing here can mis-measure the way a matchContents Compose Host
// does on the Android side.
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
      {emoji ? <Text doNotTranslate text={emoji} style={styles.emoji} /> : null}
      <Text
        doNotTranslate
        text={title}
        variant="titleLarge"
        style={styles.title}
      />
      {subtitle ? (
        <Text
          doNotTranslate
          muted
          text={subtitle}
          variant="bodyMedium"
          style={styles.subtitle}
        />
      ) : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? PRESSED_OPACITY : 1,
            },
          ]}
        >
          <Text
            doNotTranslate
            text={action.label}
            variant="labelLarge"
            style={{ color: colors.onPrimary }}
          />
        </Pressable>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cta: {
    borderRadius: PILL_RADIUS,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  emoji: { fontSize: EMOJI_SIZE, lineHeight: EMOJI_SIZE + 8 },
  subtitle: { textAlign: 'center' },
  title: { textAlign: 'center' },
});
