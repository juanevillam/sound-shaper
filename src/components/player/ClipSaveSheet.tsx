import { useRef, useState } from 'react';

import {
  Column,
  ModalBottomSheet,
  OutlinedTextField,
  Text,
  useNativeState,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { SheetBar } from '@/components/ui/SheetBar';
import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { formatTime } from '@/lib/player';
import { createClip } from '@/services/firebase/clips';

type ClipSaveSheetProps = {
  songId: string;
  /** The captured range (ms), already validated by the marking flow. */
  startMs: number;
  endMs: number;
  onClose: () => void;
};

// The last step of marking a clip: the captured range (read-only — re-mark to
// change it) plus an optional label. Same sheet idiom as every editor.
export function ClipSaveSheet({
  songId,
  startMs,
  endMs,
  onClose,
}: ClipSaveSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const sheetRef = useRef<ModalBottomSheetRef>(null);
  // One-shot guard against a double Save / keyboard-done race.
  const savingRef = useRef(false);
  const labelState = useNativeState('');
  const [label, setLabel] = useState('');

  const save = async () => {
    if (savingRef.current) return;

    savingRef.current = true;

    // Latency-compensated write: close now, one trailing snackbar confirms.
    createClip({
      endMs,
      label: label.trim(),
      songId,
      startMs,
    })
      .then(() => showSnackbar(t('snackbar.clip-created')))
      .catch(() => showSnackbar(t('snackbar.clip-save-failed')));

    await sheetRef.current?.hide();
    onClose();
  };

  return (
    <ThemedHost matchContents>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          // No top padding: the sheet's native drag handle supplies the gap.
          modifiers={[padding(16, 0, 16, 16), fillMaxWidth()]}
        >
          <SheetBar
            title={t('player.clips.sheetTitle')}
            saveLabel={t('player.clips.save')}
            saving={false}
            onSave={save}
          />

          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'bodyMedium' }}
          >
            {`${formatTime(startMs / 1000)} – ${formatTime(endMs / 1000)}`}
          </Text>

          <OutlinedTextField
            value={labelState}
            onValueChange={setLabel}
            singleLine
            keyboardOptions={{
              capitalization: 'sentences',
              imeAction: 'done',
            }}
            keyboardActions={{ onDone: save }}
            modifiers={[fillMaxWidth()]}
          >
            <OutlinedTextField.Label>
              <Text>{t('player.clips.labelField')}</Text>
            </OutlinedTextField.Label>
            <OutlinedTextField.Placeholder>
              <Text>{t('player.clips.labelPlaceholder')}</Text>
            </OutlinedTextField.Placeholder>
          </OutlinedTextField>
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}
