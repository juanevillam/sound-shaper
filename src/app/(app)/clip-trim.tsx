import { useEffect, useRef, useState } from 'react';

import { View } from 'react-native';

import {
  HeaderGlyphButtonIos,
  HeaderGlyphGroupIos,
} from '@portfolio/mobile-ui';
import { awardTrophy } from '@portfolio/trophies';
import { router, Stack } from 'expo-router';

import { ClipTrimEditorIos } from '@/components/player/ClipTrimEditorIos';
import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { iosOnlyRoute } from '@/components/util/iosOnlyRoute';
import { TROPHY_IDS } from '@/constants/trophies';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSnackbar } from '@/hooks/useSnackbar';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { createClip } from '@/services/firebase/clips';
import { useClipsSavedStore } from '@/store/clipsSaved';
import { usePlayerStore } from '@/store/player';

// iOS-only route: the Voice Memos-style clip editor, pushed as its own
// full-height sheet over the Clips list (the trophies-over-account stacking).
// It OWNS the committed selection; the editor draws and edits it. Entry
// mirrors what in-player framing did: pause (a trim surface opens quiet —
// Photos, Voice Memos), default the selection around the playhead.
function ClipTrimScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { showSnackbar } = useSnackbar();

  const current = usePlayerStore(s => s.current);
  const [range, setRange] = useState(() => {
    const { position, duration } = usePlayerStore.getState();
    const total = Math.floor(duration);
    const startS = Math.max(0, Math.round(position - 7));
    const endS = Math.min(total || 15, startS + 15);
    return { startS, endS: Math.max(endS, startS + 1) };
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usePlayerStore.getState().pause();
  }, []);

  // The sound changed under the editor (skip from the island, deletion):
  // the selection no longer describes anything — leave.
  const soundIdRef = useRef(current?.id);
  useEffect(() => {
    if (current?.id !== soundIdRef.current) router.back();
  }, [current?.id]);

  if (!current) return <View style={{ backgroundColor: colors.sheet }} />;

  const onSave = () => {
    haptics.selection();
    setSaving(true);
    createClip({
      soundId: current.id,
      startMs: range.startS * 1000,
      endMs: range.endS * 1000,
      label: '',
    })
      .then(() => {
        // Awarded here rather than from a store — the clips cache only holds
        // sounds you have opened, so it cannot answer "have you ever saved
        // one". Same sites the in-player save used.
        awardTrophy(TROPHY_IDS.firstClip);
        useClipsSavedStore.getState().saved();
        showSnackbar(t('snackbar.clip-created'));
        router.back();
      })
      .catch(() => {
        setSaving(false);
        showSnackbar(t('snackbar.clip-save-failed'));
      });
  };

  return (
    // `SheetScreen` for the toast — the save/failure snackbars must draw over
    // this native presentation, not behind it.
    <SheetScreen>
      {/* ✕ | title | [shape ✓] — the trailing slot is ONE merged pill
          (HeaderGlyphGroupIos, home's own arrangement; Calendar carries
          three glyphs the same way). Shape moved up here from a content
          pill: the bar is where a sheet's primary actions live, and the
          content column below reads as two calm groups instead of five
          objects (Juan, 2026-08-26). The commit is a plain checkmark glyph
          here — the group's language — disabled while the save runs. */}
      <Stack.Screen
        options={{
          title: t('player.clips.new'),
          headerLeft: () => (
            <HeaderGlyphButtonIos
              systemName="xmark"
              label={t('common.cancel')}
              onPress={() => router.back()}
            />
          ),
          headerRight: () => (
            <HeaderGlyphGroupIos
              glyphs={[
                {
                  systemName: 'slider.horizontal.3',
                  label: t('player.shape.title'),
                  onPress: () => router.push('/shaper'),
                },
                {
                  systemName: 'checkmark',
                  label: t('player.clips.saveClip'),
                  onPress: onSave,
                  disabled: saving,
                  // The commit ✓ is tinted exactly as `SheetCommitGlyphIos`
                  // tints it on every editor sheet — the accent that says
                  // "this one acts" (Juan, 2026-08-26: same ✓, same blue,
                  // whichever capsule it stands in).
                  tint: colors.primary,
                },
              ]}
            />
          ),
        }}
      />
      <ClipTrimEditorIos
        range={range}
        onRangeChange={(startS, endS) => setRange({ startS, endS })}
      />
    </SheetScreen>
  );
}

export default iosOnlyRoute(ClipTrimScreen);
