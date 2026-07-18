import { useRef } from 'react';

import {
  Column,
  Icon,
  ModalBottomSheet,
  Row,
  Text,
  type ModalBottomSheetRef,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { iconSource } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

type PlaylistActionsSheetProps = {
  /** The playlist's name, shown as the sheet title for context. */
  playlistName: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const ICON_SIZE = 24;

/**
 * Quick actions (Edit / Delete) for a playlist, opened by long-pressing its
 * home card — the same management its detail overflow offers, without leaving
 * Home. A native `ModalBottomSheet` mounted only while open, so the cards stay
 * pure RN for smooth scrolling. Each action animates the sheet out, then runs.
 */
export function PlaylistActionsSheet({
  playlistName,
  onClose,
  onEdit,
  onDelete,
}: PlaylistActionsSheetProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  const runThenClose = async (action: () => void) => {
    await sheetRef.current?.hide();
    onClose();
    action();
  };

  return (
    <ThemedHost matchContents>
      <ModalBottomSheet
        ref={sheetRef}
        onDismissRequest={onClose}
        skipPartiallyExpanded
      >
        {/* No horizontal padding on the Column so each row's ripple spans the
            full width; the 16dp inset lives on the title + each row's content. */}
        <Column modifiers={[padding(0, 0, 0, 16), fillMaxWidth()]}>
          <Text
            color={colors.onSurfaceMuted}
            maxLines={1}
            overflow="ellipsis"
            style={{ typography: 'titleMedium' }}
            modifiers={[padding(16, 12, 16, 8)]}
          >
            {playlistName}
          </Text>

          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 16 }}
            modifiers={[
              fillMaxWidth(),
              clickable(() => runThenClose(onEdit)),
              padding(16, 12, 16, 12),
            ]}
          >
            <Icon
              source={iconSource('edit')}
              size={ICON_SIZE}
              tint={colors.onSurface}
            />
            <Text color={colors.onSurface} style={{ typography: 'bodyLarge' }}>
              {t('playlistDetail.menu.edit')}
            </Text>
          </Row>

          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 16 }}
            modifiers={[
              fillMaxWidth(),
              clickable(() => runThenClose(onDelete)),
              padding(16, 12, 16, 12),
            ]}
          >
            <Icon
              source={iconSource('delete')}
              size={ICON_SIZE}
              tint={colors.danger}
            />
            <Text color={colors.danger} style={{ typography: 'bodyLarge' }}>
              {t('playlistDetail.menu.delete')}
            </Text>
          </Row>
        </Column>
      </ModalBottomSheet>
    </ThemedHost>
  );
}
