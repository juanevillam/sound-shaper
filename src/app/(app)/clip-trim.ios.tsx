import { View } from 'react-native';

import { router, Stack, useLocalSearchParams } from 'expo-router';

import { ClipTrimEditor } from '@/components/player/ClipTrimEditor';
import { useClipTrimScreen } from '@/components/player/useClipTrimScreen';
import { SheetScreen } from '@/components/ui/SheetScreenIos';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/i18n';
import { HeaderGlyphButtonIos, HeaderGlyphGroupIos } from '@/ui';

// The Voice Memos-style clip editor, pushed as its own full-height sheet over
// the Clips list (the trophies-over-account stacking). It OWNS the committed
// selection; the editor draws and edits it. Entry mirrors what in-player
// framing did: pause (a trim surface opens quiet — Photos, Voice Memos),
// default the selection around the playhead. Everything but this bar is the
// shared `useClipTrimScreen` + `ClipTrimEditor`; the Android twin wraps the
// same pair in a pushed screen with a Material header.
export default function ClipTrimScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  // The route door: search params in, router.back out — the Android sheet
  // passes the same two as props (see `useClipTrimScreen`).
  const params = useLocalSearchParams<{
    clipId?: string;
    startMs?: string;
    endMs?: string;
  }>();
  const editing =
    typeof params.clipId === 'string' && params.clipId.length > 0
      ? {
          clipId: params.clipId,
          endMs: Number(params.endMs),
          startMs: Number(params.startMs),
        }
      : null;
  const { current, editingClipId, onSave, range, saving, setRange } =
    useClipTrimScreen({ editing, onDone: () => router.back() });

  if (!current) return <View style={{ backgroundColor: colors.sheet }} />;

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
          title: t(editingClipId ? 'player.clips.edit' : 'player.clips.new'),
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
      <ClipTrimEditor
        range={range}
        onRangeChange={(startS, endS) => setRange({ startS, endS })}
      />
    </SheetScreen>
  );
}
