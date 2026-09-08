import { useState } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';

import { PRESSED_OPACITY } from '@portfolio/mobile-ui';
import { router, Stack } from 'expo-router';

import { ClipTrimEditor } from '@/components/player/ClipTrimEditor';
import { ShaperSheet } from '@/components/player/ShaperSheet';
import { useClipTrimScreen } from '@/components/player/useClipTrimScreen';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Text as AppText } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';

// ANDROID'S CLIP EDITOR — the same Voice Memos-anatomy surface iOS pushes as
// a sheet, here as a pushed full-screen editor: Material's full-screen-dialog
// shape (✕ leading, title, the commit as a text action trailing), which is
// the platform's own container for a focused create-or-edit task. Everything
// below the bar is the shared `useClipTrimScreen` + `ClipTrimEditor`.
//
// It replaced in-place framing on the player's scrubber (trim brackets +
// Cancel/Save row), retired 2026-09-08 when the Android console took the iOS
// arrangement — the same trade iOS made on 2026-08-26, recorded in
// `PlayerConsole.ios.tsx` and `docs/rejected-experiments.md`.
export default function ClipTrimScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { current, editingClipId, onSave, range, saving, setRange } =
    useClipTrimScreen();
  // Shape stacks over the editor exactly as it does over iOS's sheet — the
  // Compose ShaperSheet is self-contained, so this screen can host it.
  const [shaperVisible, setShaperVisible] = useState(false);

  if (!current)
    return <View style={{ backgroundColor: colors.background, flex: 1 }} />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: t(editingClipId ? 'player.clips.edit' : 'player.clips.new'),
          // ✕, not the back arrow: a full-screen dialog is dismissed, not
          // popped — Material's own distinction for a task you either commit
          // or abandon.
          headerLeft: () => (
            <HeaderIconButton
              name="close"
              onPress={() => router.back()}
              accessibilityLabel={t('common.cancel')}
            />
          ),
          headerRight: () => (
            <View style={styles.actions}>
              <HeaderIconButton
                name="tune"
                onPress={() => setShaperVisible(true)}
                accessibilityLabel={t('player.shape.title')}
              />
              {/* The commit is a TEXT action in the bar — the full-screen
                  dialog's own idiom ("Save" in the top app bar). Accent ink:
                  a text button unpainted stops reading as a button, the same
                  rule the welcome links follow. */}
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onSave}
                style={({ pressed }) => [
                  styles.save,
                  { opacity: saving ? 0.38 : pressed ? PRESSED_OPACITY : 1 },
                ]}
              >
                <AppText
                  text="player.clips.saveClip"
                  variant="labelLarge"
                  style={{ color: colors.primary }}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <ClipTrimEditor
        range={range}
        onRangeChange={(startS, endS) => setRange({ startS, endS })}
      />
      {shaperVisible && <ShaperSheet onClose={() => setShaperVisible(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  // A 48dp-tall text action, centred in the bar like the icon buttons beside
  // it; horizontal padding gives the word its Material text-button box.
  save: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
