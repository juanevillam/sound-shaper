import { useRef } from 'react';

import {
  Box,
  Column,
  ModalBottomSheet,
  Row,
  Shape,
  Surface,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  paddingAll,
  size,
} from '@expo/ui/jetpack-compose/modifiers';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useRecentEmojiStore } from '@/store/recentEmoji';

const CELL_SIZE = 48;
const CELL_SHAPE = Shape.RoundedCorner({
  cornerRadii: {
    topStart: CELL_SIZE / 2,
    topEnd: CELL_SIZE / 2,
    bottomStart: CELL_SIZE / 2,
    bottomEnd: CELL_SIZE / 2,
  },
});

// Curated set leaning on what playlists are usually about: music first, then
// moods, activities, and a few generic favorites. Exactly 49 so it lays out as
// a tidy 7×7 grid (the full system emoji keyboard is not reachable
// programmatically, so a picker grid is the native idiom).
export const EMOJIS = [
  '🎵',
  '🎶',
  '🎧',
  '🎤',
  '🎸',
  '🎹',
  '🥁',
  '🎺',
  '🎻',
  '📻',
  '💿',
  '📀',
  '🎼',
  '🎚️',
  '🎛️',
  '🔊',
  '🏋️',
  '🏃',
  '🚴',
  '🧘',
  '🎮',
  '📚',
  '✈️',
  '🚗',
  '🏖️',
  '🌃',
  '🌊',
  '☕',
  '🍺',
  '🍷',
  '💃',
  '🕺',
  '🎉',
  '🔥',
  '❤️',
  '💔',
  '😌',
  '😢',
  '😤',
  '🌧️',
  '☀️',
  '🌙',
  '⭐',
  '🌈',
  '🚀',
  '💎',
  '👑',
  '🧠',
  '💪',
];

// Fixed 7 columns (not a width-dependent FlowRow): chunk into rows of 7 so the
// grid is always 7 wide and uses the full sheet width.
const COLUMNS = 7;
const EMOJI_ROWS = Array.from(
  { length: Math.ceil(EMOJIS.length / COLUMNS) },
  (_, row) => EMOJIS.slice(row * COLUMNS, row * COLUMNS + COLUMNS),
);

type EmojiPickerSheetProps = {
  title: string;
  visible: boolean;
  onDismiss: () => void;
  onSelect: (emoji: string) => void;
};

// Native ModalBottomSheet with a 7×7 grid of tappable emoji. Kept in its own
// Host: mounting sheets/dialogs next to other Compose content in one Host
// flickers the siblings.
export function EmojiPickerSheet({
  title,
  visible,
  onDismiss,
  onSelect,
}: EmojiPickerSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const recent = useRecentEmojiStore(s => s.recent);
  const pushRecent = useRecentEmojiStore(s => s.pushRecent);

  const sheetRef = useRef<ModalBottomSheetRef>(null);

  if (!visible) return null;

  const select = async (emoji: string) => {
    haptics.selection();
    pushRecent(emoji);
    await sheetRef.current?.hide();
    onSelect(emoji);
  };

  const renderCell = (emoji: string) => (
    <Surface
      key={emoji}
      onClick={() => select(emoji)}
      color="transparent"
      shape={CELL_SHAPE}
    >
      <Box contentAlignment="center" modifiers={[size(CELL_SIZE, CELL_SIZE)]}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </Box>
    </Surface>
  );

  return (
    <ThemedHost matchContents>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onDismiss}
        skipPartiallyExpanded
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[paddingAll(16)]}
        >
          <Text style={{ typography: 'titleLarge' }}>{title}</Text>

          {/* A quick-access strip of what you last picked (newest first). */}
          {recent.length > 0 ? (
            <Column
              verticalArrangement={{ spacedBy: 4 }}
              modifiers={[fillMaxWidth()]}
            >
              <Text
                color={colors.onSurfaceMuted}
                style={{ typography: 'labelMedium' }}
              >
                {t('playlistEdit.emoji.recent')}
              </Text>
              <Row horizontalArrangement={{ spacedBy: 4 }}>
                {recent.map(renderCell)}
              </Row>
            </Column>
          ) : null}

          <Column
            verticalArrangement={{ spacedBy: 4 }}
            modifiers={[fillMaxWidth()]}
          >
            {EMOJI_ROWS.map(emojiRow => (
              <Row
                key={emojiRow[0]}
                horizontalArrangement="spaceBetween"
                modifiers={[fillMaxWidth()]}
              >
                {emojiRow.map(renderCell)}
              </Row>
            ))}
          </Column>
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}
