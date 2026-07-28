import { useState } from 'react';

import { Pressable, StyleSheet } from 'react-native';

import {
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
} from '@expo/ui/jetpack-compose';
import { Text } from '@expo/ui/jetpack-compose';
import {
  AppIcon,
  ICON_PRESS_OPACITY,
  ICON_PRESS_SCALE,
  usePressSquash,
} from '@portfolio/mobile-ui';
import Animated from 'react-native-reanimated';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { ROW_MIN_HEIGHT } from '@/styles/metrics';

import { type PlayerMenuButtonProps } from './chrome';

const MENU_ICON_SIZE = 24;

// Song overflow: metadata + the same edit/delete sheet the library's
// long-press opens. The press target sits ON TOP of the Compose trigger (whose
// own state layer is invisible on this surface); the DropdownMenu still
// anchors to the icon underneath it. Feedback is the app's squash — same as
// every other icon button (`components/ui/IconButton`), rather than a ripple
// this one control would own alone.
export function PlayerMenuButton({ onInfo, onEdit }: PlayerMenuButtonProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const squash = usePressSquash({
    scale: ICON_PRESS_SCALE,
    opacity: ICON_PRESS_OPACITY,
  });

  return (
    <Animated.View style={[styles.button, squash.style]}>
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
        onPressIn={squash.onPressIn}
        onPressOut={squash.onPressOut}
        hitSlop={8}
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={t('player.menu.label')}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: ROW_MIN_HEIGHT,
    justifyContent: 'center',
    width: ROW_MIN_HEIGHT,
  },
});
