import { useRef, useState } from 'react';

import {
  Button,
  Column,
  IconButton,
  ModalBottomSheet,
  OutlinedButton,
  RNHostView,
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

import { ClipTrimmer } from '@/components/player/ClipTrimmer';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatTime } from '@/lib/player';
import { createClip, deleteClip } from '@/services/firebase/clips';
import { useClipsStore } from '@/store/clips';
import { usePlayerStore } from '@/store/player';

// The clips studio — the Shape sheet's sibling: frame a new clip on the
// tertiary trimmer (drag the edges to resize, the middle to slide the whole
// clip), preview/save it, and manage the saved ones below.

const DEFAULT_CLIP_LENGTH_S = 15;

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
  onClose: () => void;
};

export function ClipsSheet({ onClose }: ClipsSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  const current = usePlayerStore(s => s.current);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);
  const storeDuration = usePlayerStore(s => s.duration);
  const position = usePlayerStore(s => s.position);

  const clips = useClipsStore(s =>
    current ? (s.bySongId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );

  const durationS = Math.floor(storeDuration);

  // Seeded once per open, centered on where the user is listening right now.
  const [clipRange, setClipRange] = useState(() => {
    const half = DEFAULT_CLIP_LENGTH_S / 2;
    const start = Math.max(0, Math.round(position - half));
    const end = Math.min(
      durationS || DEFAULT_CLIP_LENGTH_S,
      start + DEFAULT_CLIP_LENGTH_S,
    );
    return { startS: start, endS: Math.max(end, start + 1) };
  });

  if (!current) return null;

  const onPreview = () => {
    haptics.selection();
    playClip('preview', clipRange.startS * 1000, clipRange.endS * 1000);
  };

  const onSave = () => {
    haptics.selection();
    createClip({
      songId: current.id,
      startMs: clipRange.startS * 1000,
      endMs: clipRange.endS * 1000,
      label: '',
    })
      .then(() => showSnackbar(t('snackbar.clip-created')))
      .catch(() => showSnackbar(t('snackbar.clip-save-failed')));
  };

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
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
          >
            {t('player.clips.new')}
          </Text>

          <RNHostView matchContents>
            <ClipTrimmer
              durationS={durationS}
              startS={clipRange.startS}
              endS={clipRange.endS}
              onChange={(startS, endS) => setClipRange({ startS, endS })}
            />
          </RNHostView>

          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth()]}
          >
            <OutlinedButton onClick={onPreview}>
              <Text color={colors.onSurface} maxLines={1}>
                {t('player.clips.preview')}
              </Text>
            </OutlinedButton>
            <Button onClick={onSave}>
              <Text maxLines={1}>{t('player.clips.saveClip')}</Text>
            </Button>
          </Row>

          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
            modifiers={[padding(0, 10, 0, 0)]}
          >
            {t('player.clips.title')}
          </Text>

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
