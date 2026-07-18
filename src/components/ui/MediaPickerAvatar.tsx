import { StyleSheet, Text, View } from 'react-native';

import { ArtImage } from '@/components/ui/ArtImage';
import { SquashPressable } from '@/components/ui/SquashPressable';
import { useI18n } from '@/i18n';

const AVATAR_SIZE = 72;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
const EMOJI_FONT_SIZE = 32;
const PLUS_FONT_SIZE = 28;

type MediaPickerAvatarProps = {
  onPress: () => void;
  /** Disc background for the emoji / empty-placeholder state. */
  surfaceColor: string;
  /** Color of the "+" placeholder glyph. */
  contentColor: string;
  /** Emoji glyph to show (a playlist's emoji). Ignored when imageUrl is set. */
  emoji?: string;
  /** Image to show (a song's cover art — local or remote). Wins over emoji. */
  imageUrl?: string;
  /** No-op the press, e.g. while an upload is in flight. */
  disabled?: boolean;
};

const noop = () => {};

/**
 * Circular media picker shared by both editors — the emoji in
 * EditPlaylistSheet and the cover-art preview in EditSongSheet — so the two
 * read AND press identically. Pure RN on purpose (Compose exposes no press
 * state); embedded into the Compose sheets with `<RNHostView matchContents>`.
 */
export function MediaPickerAvatar({
  onPress,
  surfaceColor,
  contentColor,
  emoji,
  imageUrl,
  disabled = false,
}: MediaPickerAvatarProps) {
  const { t } = useI18n();

  return (
    // Full-width row so the avatar centers RN-side: the host uses
    // matchContents={{ vertical: true }} (a fill-width child collapses under
    // boolean matchContents), so it fills the width and this row centers the
    // 72×72 disc within it.
    <View style={styles.center}>
      <SquashPressable
        onPress={disabled ? noop : onPress}
        // Image/emoji only — needs an explicit screen-reader label.
        accessibilityLabel={t('common.pickMedia')}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: imageUrl ? 'transparent' : surfaceColor },
          ]}
        >
          {imageUrl ? (
            <ArtImage uri={imageUrl} style={styles.image} />
          ) : emoji ? (
            <Text style={styles.emoji}>{emoji}</Text>
          ) : (
            <Text style={[styles.plus, { color: contentColor }]}>＋</Text>
          )}
        </View>
      </SquashPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', width: '100%' },
  avatar: {
    alignItems: 'center',
    borderRadius: AVATAR_RADIUS,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
    width: AVATAR_SIZE,
  },
  image: { height: '100%', width: '100%' },
  emoji: { fontSize: EMOJI_FONT_SIZE },
  plus: { fontSize: PLUS_FONT_SIZE },
});
