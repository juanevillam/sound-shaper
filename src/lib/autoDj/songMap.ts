import * as FileSystem from 'expo-file-system/legacy';
import { decodeAudioData } from 'react-native-audio-api';

import { withSoundFile } from '../soundFile';

import { ANALYSIS_SAMPLE_RATE, analyzeSamples, type SongMap } from './analysis';

// ---------------------------------------------------------------------------
// The song map's I/O: decode once, cache as JSON, keep one promise per sound.
// The same arrangement as `waveform.ts` — the cache is OS-purgeable on
// purpose, because a map rebuilds itself in a second or two and must never be
// a reason the app holds storage.
// ---------------------------------------------------------------------------

/** Bumps with `SongMap.version` or the analysis recipe. */
const CACHE_VERSION = 'v1';

const memory = new Map<string, Promise<SongMap | null>>();

const cacheDir = () => `${FileSystem.cacheDirectory}autodj/`;
const mapPath = (soundId: string) =>
  `${cacheDir()}${CACHE_VERSION}-${soundId}.json`;

export function getSongMap(
  soundId: string,
  audioUrl: string,
): Promise<SongMap | null> {
  const inFlight = memory.get(soundId);
  if (inFlight) return inFlight;
  const promise = compute(soundId, audioUrl).catch(() => null);
  promise.then(map => {
    if (!map) memory.delete(soundId);
  });
  memory.set(soundId, promise);
  return promise;
}

/** The sign-out wipe and a deleted sound — see `clearWaveforms`. */
export function clearSongMaps(): Promise<void> {
  memory.clear();
  return FileSystem.deleteAsync(cacheDir(), { idempotent: true }).catch(
    () => {},
  );
}

export function forgetSongMap(soundId: string): void {
  memory.delete(soundId);
  FileSystem.deleteAsync(mapPath(soundId), { idempotent: true }).catch(
    () => {},
  );
}

async function compute(
  soundId: string,
  audioUrl: string,
): Promise<SongMap | null> {
  await FileSystem.makeDirectoryAsync(cacheDir(), {
    intermediates: true,
  }).catch(() => {});

  const path = mapPath(soundId);
  const cached = await readCached(path);
  if (cached) return cached;

  return withSoundFile(soundId, audioUrl, cacheDir(), async mp3Path => {
    const buffer = await decodeAudioData(mp3Path, ANALYSIS_SAMPLE_RATE);
    const map = analyzeSamples(buffer.getChannelData(0), buffer.sampleRate);
    const temp = `${path}.tmp`;
    await FileSystem.writeAsStringAsync(temp, JSON.stringify(map));
    await FileSystem.deleteAsync(path, { idempotent: true });
    await FileSystem.moveAsync({ from: temp, to: path });
    return map;
  });
}

async function readCached(path: string): Promise<SongMap | null> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  try {
    const parsed = JSON.parse(
      await FileSystem.readAsStringAsync(path),
    ) as SongMap;
    if (parsed.version === 1 && Array.isArray(parsed.bars)) return parsed;
  } catch {
    // A file that does not parse is a miss, never a verdict.
  }
  await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  return null;
}
