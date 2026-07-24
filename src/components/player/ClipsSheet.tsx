import { useRef } from 'react';

import {
  Column,
  IconButton,
  ModalBottomSheet,
  Row,
  Shape,
  Surface,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';

import { SheetBar } from '@/components/ui/SheetBar';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';

// The saved-clips manager (the Shape sheet's sibling): play or delete what
// you've framed, or jump into framing a new one — the framing itself happens
// ON the player's scrubber, where the sound is.

const CLIP_ROW_SHAPE = Shape.RoundedCorner({
  cornerRadii: {
    topStart: 12,
    topEnd: 12,
    bottomStart: 12,
    bottomEnd: 12,
  },
});

const NO_CLIPS: never[] = [];

type ClipsSheetProps = {
  /** Close the sheet and drop the trim brackets on the player's scrubber. */
  onNewClip: () => void;
  onClose: () => void;
};

export function ClipsSheet({ onNewClip, onClose }: ClipsSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  const current = usePlayerStore(s => s.current);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);

  const clips = useClipsStore(s =>
    current ? (s.bySongId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  if (!current) return null;

  const onDelete = (clipId: string) => {
    haptics.medium();
    deleteClip({ clipId, songId: current.id })
      .then(() => showSnackbar(t('snackbar.clip-deleted')))
      .catch(() => showSnackbar(t('snackbar.clip-delete-failed')));
  };

  return (
    <ThemedHost matchContents>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded
      >
        <Column
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[padding(24, 0, 24, 28), fillMaxWidth()]}
        >
          {/* The shared sheet header — same bar as every other sheet. */}
          <SheetBar
            title={t('player.clips.title')}
            saveLabel={t('player.clips.new')}
            saving={false}
            onSave={() => {
              haptics.selection();
              onNewClip();
            }}
          />

          {clips.length === 0 ? (
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'bodySmall' }}
            >
              {t('player.clips.empty')}
            </Text>
          ) : (
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[fillMaxWidth()]}
            >
              {clips.map(clip => {
                const isActive = activeClip?.clipId === clip.id;
                const range = `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

                return (
                  <Surface
                    key={clip.id}
                    onClick={() => {
                      haptics.selection();
                      playClip(clip.id, clip.startMs, clip.endMs);
                    }}
                    color="transparent"
                    shape={CLIP_ROW_SHAPE}
                    modifiers={[fillMaxWidth()]}
                  >
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                      modifiers={[fillMaxWidth(), padding(12, 4, 0, 4)]}
                    >
                      <Column
                        verticalArrangement={{ spacedBy: 1 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          color={isActive ? colors.primary : colors.onSurface}
                          style={{ typography: 'bodyLarge' }}
                          maxLines={1}
                        >
                          {range}
                        </Text>
                      </Column>
                      <IconButton onClick={() => onDelete(clip.id)}>
                        <AppIcon
                          name="delete"
                          size={20}
                          tint={colors.onSurfaceMuted}
                          contentDescription={t('player.clips.delete')}
                        />
                      </IconButton>
                    </Row>
                  </Surface>
                );
              })}
            </Column>
          )}
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}
