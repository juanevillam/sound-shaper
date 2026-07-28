import { useState } from 'react';

import { Pressable, StyleSheet } from 'react-native';

import {
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
} from '@expo/ui/jetpack-compose';
import { Text } from '@expo/ui/jetpack-compose';
import { AppIcon } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

import { type PlayerMenuButtonProps } from './chrome';

const MENU_ICON_SIZE = 24;

// Song overflow: metadata + the same edit/delete sheet the library's
// long-press opens. The ripple Pressable sits ON TOP of the Compose trigger
// (whose own state layer is invisible on this surface); the DropdownMenu still
// anchors to the icon underneath it.
export function PlayerMenuButton({ onInfo, onEdit }: PlayerMenuButtonProps) {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const ripple = {
    borderless: true,
    color: scheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
    radius: 26,
  };

  return (
    <>
      <ThemedHost matchContents>
        <DropdownMenu
          expanded={menuOpen}
          onDismissRequest={() => setMenuOpen(false)}
        >
          <DropdownMenu.Trigger>
            <IconButton onClick={() => setMenuOpen(true)}>
              <AppIcon
                name="more-vert"
                tint={colors.onSurface}
                contentDescription={t('player.menu.label')}
              />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false);
                onInfo();
              }}
            >
              <DropdownMenuItem.Text>
                <Text color={colors.onSurface}>{t('player.menu.info')}</Text>
              </DropdownMenuItem.Text>
              <DropdownMenuItem.LeadingIcon>
                <AppIcon
                  name="info"
                  size={MENU_ICON_SIZE}
                  tint={colors.onSurface}
                />
              </DropdownMenuItem.LeadingIcon>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            >
              <DropdownMenuItem.Text>
                <Text color={colors.onSurface}>{t('player.menu.edit')}</Text>
              </DropdownMenuItem.Text>
              <DropdownMenuItem.LeadingIcon>
                <AppIcon
                  name="edit"
                  size={MENU_ICON_SIZE}
                  tint={colors.onSurface}
                />
              </DropdownMenuItem.LeadingIcon>
            </DropdownMenuItem>
          </DropdownMenu.Items>
        </DropdownMenu>
      </ThemedHost>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={8}
        style={StyleSheet.absoluteFill}
        android_ripple={ripple}
        accessibilityRole="button"
        accessibilityLabel={t('player.menu.label')}
      />
    </>
  );
}
