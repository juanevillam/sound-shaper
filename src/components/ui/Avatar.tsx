import { StyleSheet, Text, View } from 'react-native';

import { Image } from 'expo-image';

import { useAppTheme } from '@/hooks/useAppTheme';

const DEFAULT_SIZE = 40;
// Short cross-dissolve so a remote photo fades in instead of popping.
const FADE_MS = 200;

type AvatarProps = {
  name: string | null;
  photoUrl: string | null;
  size?: number;
};

// Pure-RN avatar: the user's photo, or a tinted disc with their initial as the
// fallback. Bridged through RNHostView into the Compose profile header.
export function Avatar({ name, photoUrl, size = DEFAULT_SIZE }: AvatarProps) {
  const { colors } = useAppTheme();

  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?';
  const dimensions = { borderRadius: size / 2, height: size, width: size };

  if (photoUrl)
    return (
      <Image
        source={{ uri: photoUrl }}
        // The neutral disc shows under the photo while it loads, so it fades in
        // over the same tint the initials fallback uses.
        style={[
          styles.avatar,
          dimensions,
          { backgroundColor: colors.surfaceVariant },
        ]}
        contentFit="cover"
        transition={FADE_MS}
        recyclingKey={photoUrl}
        cachePolicy="memory-disk"
      />
    );

  return (
    <View
      style={[
        styles.avatar,
        dimensions,
        { backgroundColor: colors.surfaceVariant },
      ]}
    >
      <Text
        style={[styles.initial, { color: colors.onSurface }, fontFor(size)]}
      >
        {initial}
      </Text>
    </View>
  );
}

const fontFor = (size: number) => ({ fontSize: Math.round(size * 0.42) });

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontWeight: '600' },
});
