import { ActionSheetIOS } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { useI18n } from '@/i18n';

import { type PlayerMenuButtonProps } from './chrome';

// iOS counterpart of `PlayerMenuButton`. A Compose DropdownMenu anchors a
// popup to the trigger; iOS's answer to an overflow "…" is the action sheet,
// so this opens the system one — right idiom, and no Host to anchor or
// mis-measure. Cancel is always last, per HIG.
export function PlayerMenuButton({ onInfo, onEdit }: PlayerMenuButtonProps) {
  const { t } = useI18n();

  const openMenu = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t('player.menu.info'),
          t('player.menu.edit'),
          t('common.cancel'),
        ],
        cancelButtonIndex: 2,
      },
      index => {
        if (index === 0) onInfo();
        if (index === 1) onEdit();
      },
    );

  return (
    <IconButton
      name="more-vert"
      onPress={openMenu}
      accessibilityLabel={t('player.menu.label')}
    />
  );
}
