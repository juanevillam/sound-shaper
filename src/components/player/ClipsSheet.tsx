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
import { AppIcon, composeSheetBottomPadding } from '@portfolio/mobile-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Breathing room under the last row, on top of the navigation bar. */
const SHEET_BOTTOM_GAP = 28;

export type ClipsSheetProps = {
  /** Close the sheet and drop the trim brackets on the player's scrubber. */
  onNewClip: () => void;
  onClose: () => void;
};

export function ClipsSheet({ onNewClip, onClose }: ClipsSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  const current = usePlayerStore(s => s.current);
  const playClip = usePlayerStore(s => s.playClip);
  const activeClip = usePlayerStore(s => s.activeClip);

  const clips = useClipsStore(s =>
    current ? (s.bySoundId[current.id] ?? NO_CLIPS) : NO_CLIPS,
  );
  /**
   * SETTLED, because an unloaded sound and a sound with no clips look
   * identical in `clips` — see the iOS twin (`app/(app)/clips.tsx`), which
   * carries the full write-up. `settledBySoundId` was put in the store for
   * this branch and had never been read by either platform.
   *
   * WRITTEN UNVERIFIED, under the Android freeze: the feature spans both twins
   * and leaving this one asserting "no clips" while iOS waits would be exactly
   * the drift this repo hates, but nothing Android is installed or run.
   * Re-check on device when Android resumes. Android shows the plain waiting
   * line rather than iOS's spinner — a Compose bottom sheet that has just
   * animated in has no empty box to centre a control in, and this text sits
   * where the empty-state line already does.
   */
  const settled = useClipsStore(s =>
    current ? (s.settledBySoundId[current.id] ?? false) : false,
  );

  if (!current) return null;

  const onDelete = (clipId: string) => {
    haptics.medium();
    deleteClip({ clipId, soundId: current.id })
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
          // The bottom clears the navigation bar — a Compose sheet's window
          // runs to the screen edge. See `composeSheetBottomPadding`.
          modifiers={[
            padding(
              24,
              0,
              24,
              composeSheetBottomPadding(insets.bottom, SHEET_BOTTOM_GAP),
            ),
            fillMaxWidth(),
          ]}
        >
          {/* The shared sheet header — same bar as every other sheet. */}
          <SheetBar
            title={t('player.clips.title')}
            saveLabel={t('player.clips.new')}
            saving={false}
            onSave={onNewClip}
          />

          {!settled ? (
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'bodySmall' }}
            >
              {t('player.clips.loading')}
            </Text>
          ) : clips.length === 0 ? (
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
                    onClick={() => playClip(clip.id, clip.startMs, clip.endMs)}
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
