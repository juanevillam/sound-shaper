import * as FileSystem from 'expo-file-system/legacy';

import { offlineAudioPath } from './offlineAudio';

/**
 * Run `use` with a local path to a sound's mp3 — the decoders' one way in
 * (the clip editor's waveform, the Auto DJ's song map).
 *
 * THE OFFLINE MIRROR ALREADY HAS THE FILE, USUALLY — every sound in the
 * library is on the phone (`lib/offlineAudio.ts`), so a decode reads that
 * copy instead of pulling the mp3 down a second time. It also makes both
 * features work with no signal, which a download never could.
 *
 * The borrowed file is NOT OURS TO DELETE, which is what the two paths
 * separate: only a file this function fetched into `scratchDir` is removed
 * afterwards.
 */
export async function withSoundFile<T>(
  soundId: string,
  audioUrl: string,
  scratchDir: string,
  use: (path: string) => Promise<T>,
): Promise<T> {
  const mirrored = offlineAudioPath(soundId);
  const mirroredInfo = await FileSystem.getInfoAsync(mirrored);
  const borrowed = mirroredInfo.exists && (mirroredInfo.size ?? 0) > 0;
  const path = borrowed ? mirrored : `${scratchDir}${soundId}.mp3`;
  try {
    if (!borrowed) await FileSystem.downloadAsync(audioUrl, path);
    return await use(path);
  } finally {
    if (!borrowed)
      FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}
