import {
  Button,
  Column,
  IconButton,
  OutlinedButton,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';
import { AppIcon } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

import { CLIP_ACTIONS_HEIGHT, type ClipActionsRowProps } from './chrome';

// While framing a clip, this row takes the cards' place: cancel, the mode
// label, then Preview and Save.
export function ClipActionsRow({
  onCancel,
  onPreview,
  onSave,
  editing,
}: ClipActionsRowProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <ThemedHost style={styles.host}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth()]}
      >
        <IconButton onClick={onCancel}>
          <AppIcon
            name="close"
            size={22}
            tint={colors.onSurfaceMuted}
            contentDescription={t('common.cancel')}
          />
        </IconButton>
        <Column modifiers={[weight(1)]}>
          <Text
            color={colors.onSurfaceMuted}
            style={{ typography: 'labelLarge' }}
          >
            {t(editing ? 'player.clips.edit' : 'player.clips.new')}
          </Text>
        </Column>
        <OutlinedButton onClick={onPreview}>
          <Text color={colors.onSurface} maxLines={1}>
            {t('player.clips.preview')}
          </Text>
        </OutlinedButton>
        <Button onClick={onSave}>
          <Text maxLines={1}>{t('player.clips.saveClip')}</Text>
        </Button>
      </Row>
    </ThemedHost>
  );
}

const styles = {
  host: { height: CLIP_ACTIONS_HEIGHT, width: '100%' },
} as const;
