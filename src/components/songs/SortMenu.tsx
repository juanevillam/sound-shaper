import { useState } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';

import {
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
  Text,
} from '@expo/ui/jetpack-compose';
import { AppIcon } from '@portfolio/mobile-ui';

import { ThemedHost } from '@/components/ui/ThemedHost';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { SORT_MODES, useLibraryStore, type SortMode } from '@/store/library';

// "Sort by" for the home grid — a Material overflow menu with a check on the
// active mode. The ripple Pressable sits ON TOP of the Compose trigger (whose
// own state layer is invisible on dark surfaces); the menu still anchors to
// the icon beneath it.

const BUTTON_SIZE = 48;
const MENU_ICON_SIZE = 22;

export function SortMenu() {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const [open, setOpen] = useState(false);

  const sortMode = useLibraryStore(s => s.sortMode);
  const setSortMode = useLibraryStore(s => s.setSortMode);

  // The typed t() needs literal keys, so map modes explicitly.
  const modeLabel = (mode: SortMode) => {
    switch (mode) {
      case 'oldest':
        return t('home.sort.oldest');
      case 'title':
        return t('home.sort.title');
      case 'artist':
        return t('home.sort.artist');
      case 'album':
        return t('home.sort.album');
      default:
        return t('home.sort.recent');
    }
  };

  return (
    <View style={styles.anchor}>
      <ThemedHost matchContents>
        <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
          <DropdownMenu.Trigger>
            <IconButton onClick={() => setOpen(true)}>
              <AppIcon
                name="sort"
                tint={colors.onSurface}
                contentDescription={t('home.sort.label')}
              />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Items>
            {SORT_MODES.map(mode => (
              <DropdownMenuItem
                key={mode}
                onClick={() => {
                  setOpen(false);
                  setSortMode(mode);
                }}
              >
                <DropdownMenuItem.Text>
                  <Text
                    color={
                      mode === sortMode ? colors.primary : colors.onSurface
                    }
                  >
                    {modeLabel(mode)}
                  </Text>
                </DropdownMenuItem.Text>
                {mode === sortMode ? (
                  <DropdownMenuItem.TrailingIcon>
                    <AppIcon
                      name="check"
                      size={MENU_ICON_SIZE}
                      tint={colors.primary}
                    />
                  </DropdownMenuItem.TrailingIcon>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenu.Items>
        </DropdownMenu>
      </ThemedHost>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={StyleSheet.absoluteFill}
        android_ripple={{
          borderless: true,
          // Theme-safe literal — the dynamic palette tokens reject alpha
          // suffixes.
          color:
            scheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
          radius: BUTTON_SIZE / 2,
        }}
        accessibilityRole="button"
        accessibilityLabel={t('home.sort.label')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    alignItems: 'center',
    height: BUTTON_SIZE,
    justifyContent: 'center',
    width: BUTTON_SIZE,
  },
});
