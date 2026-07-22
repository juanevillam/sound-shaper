import { useRef } from 'react';

import {
  Column,
  ModalBottomSheet,
  Row,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { type Song } from '@/services/firebase/songs';

// Read-only metadata card for the playing song — artist / album / release
// year, reachable from the player's overflow menu.

type SongInfoSheetProps = {
  song: Song;
  onClose: () => void;
};

export function SongInfoSheet({ song, onClose }: SongInfoSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  const rows = [
    { label: t('player.info.artist'), value: song.artist },
    { label: t('player.info.album'), value: song.album },
    {
      label: t('player.info.year'),
      value: song.releaseYear != null ? String(song.releaseYear) : '',
    },
  ].filter(row => row.value.length > 0);

  return (
    <ThemedHost matchContents>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded
      >
        <Column
          verticalArrangement={{ spacedBy: 14 }}
          modifiers={[padding(24, 0, 24, 28), fillMaxWidth()]}
        >
          <Text
            color={colors.onSurface}
            style={{ typography: 'titleMedium' }}
            maxLines={2}
          >
            {song.name}
          </Text>

          {rows.length === 0 ? (
            <Text
              color={colors.onSurfaceMuted}
              style={{ typography: 'bodySmall' }}
            >
              {t('player.info.none')}
            </Text>
          ) : (
            rows.map(row => (
              <Row
                key={row.label}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 16 }}
                modifiers={[fillMaxWidth()]}
              >
                <Text
                  color={colors.onSurfaceMuted}
                  style={{ typography: 'bodyMedium' }}
                >
                  {row.label}
                </Text>
                <Column horizontalAlignment="end" modifiers={[weight(1)]}>
                  <Text
                    color={colors.onSurface}
                    style={{ typography: 'bodyMedium' }}
                    maxLines={2}
                  >
                    {row.value}
                  </Text>
                </Column>
              </Row>
            ))
          )}
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}
