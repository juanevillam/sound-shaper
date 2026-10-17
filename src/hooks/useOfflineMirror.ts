import { useEffect } from 'react';

import { Dimensions } from 'react-native';

import { Image } from 'expo-image';
import { NetworkStateType, useNetworkState } from 'expo-network';

import { soundGridCell } from '@/components/sounds/SoundTile';
import {
  listMirrored,
  mirrorSound,
  offlineAudioPath,
  pruneMirror,
  setMirrorAllowed,
} from '@/lib/offlineAudio';
import { thumbUrl } from '@/services/cloudinary/thumbUrl';
import { useOfflineStore } from '@/store/offline';
import { useSoundsStore } from '@/store/sounds';

/**
 * KEEP THE PHONE'S COPY OF THE LIBRARY IN STEP WITH THE LIBRARY.
 *
 * Mounted once beside the other session-wide subscriptions. Every snapshot —
 * a new upload, a sound deleted on another device, a cold start off Firestore's
 * cache — runs one pass: scan what is on disk, tell the store, drop what the
 * library no longer holds, and fetch what is missing. `mirrorSound` dedupes and
 * queues, so a pass that overlaps the one before it costs a directory read.
 *
 * A FAILED FETCH IS NOT AN ERROR STATE, and there is deliberately nothing in
 * the UI about it: a sound that has not been mirrored yet still plays, by
 * streaming, exactly as the whole app did before this existed. Offline is the
 * case where that fails, and the next pass — the next snapshot, or the next
 * launch — retries.
 *
 * THE ARTWORK RIDES ALONG, at the one size the grid asks Cloudinary for.
 * `expo-image`'s disk cache already holds whatever has been drawn, so this
 * only covers the covers nobody has scrolled to lately; it writes into that
 * same cache rather than a mirror of our own, because a missing cover is
 * cosmetic (the tile falls back to its initial) and does not deserve storage
 * we have to manage. Fire-and-forget, after the audio, which is the half a
 * trip actually needs. It goes to the DISK cache only: a mirror pass touches
 * every cover in the library, and `memory-disk` decoded all of them into
 * memory at every launch — evicting the covers the grid is actually showing.
 *
 * WI-FI ONLY (Juan, 2026-10-17): the gate is `setMirrorAllowed`, fed from the
 * network state here; the line itself lives in `offlineAudio`.
 *
 * NEVER PRUNE FROM THE CACHE. A cold start's first snapshot can come off
 * Firestore's disk cache, and an incomplete cache answer would delete
 * mirrored files exactly when there is no network to fetch them back — the
 * same rule home's position repair follows. Downloads still run; the prune
 * waits for a server snapshot.
 */
/**
 * Covers already asked for this session, by the exact url the grid requests.
 * Every snapshot (a rename, a reorder, a banked duration) runs a pass, and
 * without this each pass re-asked `expo-image` for every cover it had just
 * cached — a disk lookup per sound per snapshot, for nothing. A cover's url
 * changes when the cover does, so a new one is still fetched. Cleared on
 * sign-out with the rest of the mirror's session state.
 */
const prefetchedArt = new Set<string>();

export const forgetPrefetchedArt = (): void => prefetchedArt.clear();

export const useOfflineMirror = (): void => {
  const sounds = useSoundsStore(s => s.sounds);
  const hasSettled = useSoundsStore(s => s.hasSettled);
  const fromCache = useSoundsStore(s => s.fromCache);
  const network = useNetworkState();
  const onWifi =
    network.type === NetworkStateType.WIFI ||
    network.type === NetworkStateType.ETHERNET;

  useEffect(() => {
    setMirrorAllowed(onWifi);
  }, [onWifi]);

  useEffect(() => {
    if (!hasSettled) return;

    let cancelled = false;

    void (async () => {
      const wanted = sounds.filter(sound => sound.audioUrl);
      const ids = new Set(wanted.map(sound => sound.id));

      const mirrored = await listMirrored();
      if (cancelled) return;

      useOfflineStore
        .getState()
        .setAll(
          Object.fromEntries(
            mirrored
              .filter(soundId => ids.has(soundId))
              .map(soundId => [soundId, offlineAudioPath(soundId)]),
          ),
        );

      if (!fromCache) {
        await pruneMirror(ids);
        if (cancelled) return;
      }

      const present = new Set(mirrored);
      const artWidth = soundGridCell(Dimensions.get('window').width);

      for (const sound of wanted) {
        if (cancelled) return;

        // QUEUED, NOT AWAITED: the whole pass lands in `offlineAudio`'s line
        // at once, so a sound being streamed can be moved to its front. A
        // file that lands after this pass was cancelled is still a real file.
        if (!present.has(sound.id)) {
          void mirrorSound(sound.id, sound.audioUrl).then(uri => {
            if (uri) useOfflineStore.getState().setLocal(sound.id, uri);
          });
        }

        if (sound.artUrl) {
          const artUri = thumbUrl(sound.artUrl, artWidth);
          if (!prefetchedArt.has(artUri)) {
            prefetchedArt.add(artUri);
            void Image.prefetch(artUri, 'disk').catch(() => {
              // Not banked: the next pass tries again.
              prefetchedArt.delete(artUri);
            });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fromCache, hasSettled, sounds]);
};
