import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type QueryDocumentSnapshot,
  type Timestamp,
} from '@react-native-firebase/firestore';

import { removeMirroredSound, seedMirror } from '@/lib/offlineAudio';
import { forgetWaveform } from '@/lib/waveform';
import { uploadSoundArt, uploadSoundAudio } from '@/services/cloudinary/upload';
import { requireUid } from '@/services/firebase/auth';
import { deleteClipsOfSound } from '@/services/firebase/clips';
import {
  SOUNDS_SUBCOLLECTION,
  USERS_COLLECTION,
} from '@/services/firebase/collections';
import {
  recordError,
  reported,
  reportedOnError,
} from '@/services/firebase/crashlytics';
import {
  destroySoundArt,
  destroySoundAudio,
} from '@/services/firebase/functions';
import { useOfflineStore } from '@/store/offline';

export type Sound = {
  album: string;
  artist: string;
  // Cover art from the file's ID3 tag, uploaded to Cloudinary. Empty when the
  // file carried none (SoundArt then shows the music glyph). `artPublicId` is
  // what `destroySoundArt` names when the cover is replaced or the sound is
  // deleted — the signed delete this comment used to call a known gap, live
  // since 2026-09-12 (`media-worker/`).
  artPublicId: string;
  artUrl: string;
  audioPublicId: string;
  audioUrl: string;
  createdAt: number | null;
  /**
   * WRITTEN AT UPLOAD, CORRECTED BY PLAYBACK. A sound's duration never
   * changes, and Cloudinary measures it while taking the upload, so
   * `createSound` writes it inside the document's first write (no decode on
   * the phone, no extra write). The engine still reports its own figure on
   * the first play and `bankSoundDuration` re-banks it when the two differ
   * by more than a second — seed, then override. A sound uploaded before
   * this, or one Cloudinary returned no duration for, is `null` until that
   * first play, and the scrubber's total reads `-:--` for that one load;
   * every load after seeds from here, so skipping between known sounds never
   * flashes a placeholder at all (Juan, 2026-08-27).
   */
  durationMs: number | null;
  id: string;
  name: string;
  /**
   * WHERE THIS SOUND SITS IN THE GRID — a fractional index, so dragging one
   * tile writes one document. `null` on anything written before the feature
   * existed; `byGridOrder` sorts those last rather than dropping them, and
   * `backfillSoundPositions` gives them a real value on first sight. The whole
   * argument, including why this is a float, is in `lib/gridOrder.ts`.
   */
  position: number | null;
  releaseYear: number | null;
  updatedAt: number | null;
};

/**
 * ALBUM AND RELEASE YEAR ARE OPTIONAL, AND iOS NO LONGER SENDS THEM.
 *
 * The app does not handle either any more (Juan, 2026-08-21): the editor holds
 * a title and a subtitle and nothing else, and the read-only info sheet those
 * two fed is gone on iOS. They stay on the WRITE as optional rather than being
 * deleted outright for two reasons — existing documents carry values, and
 * `updateSound` writing `undefined` would leave them alone rather than clearing
 * them, which is what "not handled" should mean; and Android's editor still
 * passes both. Delete them here when Android's twin catches up — reachable now
 * that Android is verifiable on the standing device.
 */
type CreateSoundParams = {
  album?: string;
  artist: string;
  /**
   * A cover PICKED from the photo library, already uploaded. Wins over `art`:
   * the person choosing a picture outranks whatever the file happened to
   * carry.
   */
  cover?: { publicId: string; url: string } | null;
  /** ID3-embedded cover art bytes, when the file had them. */
  art: { base64: string; mime: string } | null;
  /** Local uri of the picked .mp3 (document-picker cache copy). */
  localAudioUri: string;
  name: string;
  /**
   * Where the new sound lands in the grid — the END of the current order, so
   * an upload never displaces an arrangement somebody made by hand. Computed
   * by the caller, which is the side that already holds the whole library.
   */
  position: number;
  releaseYear?: number | null;
};

type UpdateSoundParams = {
  album?: string;
  artist: string;
  name: string;
  releaseYear?: number | null;
  soundId: string;
  /**
   * A NEWLY PICKED cover, already uploaded — or `null` to CLEAR the artwork.
   * Omit to leave the existing one alone.
   *
   * Artwork is OPTIONAL (this library takes any MP3, and a ringtone or a voice
   * memo carries none), so a person who has one must be able to take it back
   * off; `null` is that channel. `SoundArt` already draws an art-less sound
   * everywhere it renders, so a cleared cover needs nothing downstream.
   *
   * The old Cloudinary asset is DESTROYED when a cover is replaced or cleared
   * (`updateSound`, through the media Worker — best-effort, since 2026-09-12).
   * Until the Worker was deployed it orphaned, the same gap deleting a sound
   * had.
   */
  cover?: { publicId: string; url: string } | null;
};

type SubscribeToSoundsParams = {
  onError: (error: Error) => void;
  /**
   * `fromCache` says the snapshot was answered from the LOCAL DISK CACHE
   * rather than the server, and anything that REWRITES data has to respect it.
   *
   * The order repair learned this the expensive way: launched on the second
   * device, it saw the cached library — stale, still carrying the damage the
   * other phone had already fixed — decided it needed repairing, and wrote its
   * whole order back over the newer one. Measured live: a drag made on the A54
   * was undone the moment the iOS client cold-started.
   *
   * Reading from cache is right and fast. WRITING a whole-collection
   * correction from one is a guess about a past state.
   */
  onNext: (sounds: Sound[], meta: { fromCache: boolean }) => void;
};

const soundsCollection = () =>
  collection(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SOUNDS_SUBCOLLECTION,
  );

const soundDoc = (soundId: string) =>
  doc(
    getFirestore(),
    USERS_COLLECTION,
    requireUid(),
    SOUNDS_SUBCOLLECTION,
    soundId,
  );

/**
 * Destroy a sound's Cloudinary assets — best-effort, and AFTER the Firestore
 * write that stops naming them. The caller reads the public ids first (the
 * document is the only thing that knows them), writes, then destroys.
 *
 * THE ORDER IS WRITE-THEN-DESTROY, as `ownProfile.setOwnPhoto` does it, and
 * the reason is offline. The write queues locally and lands later; the Worker
 * call simply fails. Destroying first meant a delete or a cover change made
 * with no signal either destroyed media under a document that kept pointing
 * at it, or — on a write that then failed — left a live document naming a
 * dead asset. An orphaned asset is a cost; a document pointing at a dead
 * asset is a defect.
 *
 * Each failure is swallowed on its own so one dead call cannot strand the
 * other asset, and neither can fail the delete the person actually asked for:
 * an orphan is the pre-worker status quo, an aborted delete is a new defect.
 */
const destroySoundMedia = async ({
  artPublicId,
  audioPublicId,
}: {
  artPublicId: string;
  audioPublicId: string;
}): Promise<void> => {
  if (audioPublicId)
    try {
      await destroySoundAudio(audioPublicId);
    } catch (error) {
      recordError(error, 'sounds.destroySoundAudio');
    }

  if (artPublicId)
    try {
      await destroySoundArt(artPublicId);
    } catch (error) {
      recordError(error, 'sounds.destroySoundArt');
    }
};

const soundToModel = (snapshot: QueryDocumentSnapshot): Sound => {
  const data = snapshot.data();
  const createdAt = data.createdAt as Timestamp | undefined;
  const updatedAt = data.updatedAt as Timestamp | undefined;
  const releaseYear = data.releaseYear;

  return {
    album: (data.album as string) ?? '',
    artist: (data.artist as string) ?? '',
    artPublicId: (data.artPublicId as string) ?? '',
    artUrl: (data.artUrl as string) ?? '',
    audioPublicId: (data.audioPublicId as string) ?? '',
    audioUrl: (data.audioUrl as string) ?? '',
    createdAt: createdAt ? createdAt.toMillis() : null,
    durationMs:
      typeof data.durationMs === 'number' && data.durationMs > 0
        ? data.durationMs
        : null,
    id: snapshot.id,
    name: (data.name as string) ?? '',
    position:
      typeof data.position === 'number' && Number.isFinite(data.position)
        ? data.position
        : null,
    releaseYear: typeof releaseYear === 'number' ? releaseYear : null,
    updatedAt: updatedAt ? updatedAt.toMillis() : null,
  };
};

/**
 * Bank a sound's duration the first time the engine reports it — a one-time,
 * fire-and-forget metadata write (see `Sound.durationMs`). No `updatedAt`
 * bump: nothing a person edited changed.
 *
 * "ONE-TIME" RESTS ON `syncLibrary`. The caller decides whether to write by
 * reading `usePlayerStore`'s own copy of the document, and that copy used to
 * be frozen at play time — so it never learned this write had landed, and
 * skipping away and back re-banked the same value on every load. The player
 * takes each snapshot now; see `store/player.ts`.
 */
export const bankSoundDuration = (
  soundId: string,
  durationMs: number,
): Promise<void> =>
  updateDoc(soundDoc(soundId), { durationMs }).catch(
    reportedOnError('sounds.bankDuration', () => {}),
  );

/**
 * The whole personal library, newest upload first.
 *
 * DELIBERATELY UNBOUNDED, and the reason is the word "personal". This is the
 * app's ONE session-long listener; it has to be live, because an upload has to
 * land on the grid without a refresh. Capping it would hide someone's own
 * sounds from their own library — a silent truncation of the only content the
 * app holds — so the fix for a huge library is PAGING (a cursor plus a "load
 * more" the grid drives), not a `limit()` bolted on here.
 *
 * The cost is bounded in practice by Firestore's disk cache, which is on by
 * default and which nothing in this app disables: a cold start replays the
 * library from disk and resumes the listener from its token, so only sounds
 * that actually CHANGED are billed after the first run. Revisit if a library
 * ever passes a few hundred sounds; nothing here is near that.
 */
export const subscribeToSounds = ({
  onError,
  onNext,
}: SubscribeToSoundsParams): (() => void) => {
  const soundsQuery = query(soundsCollection(), orderBy('createdAt', 'desc'));

  return onSnapshot(soundsQuery, {
    error: reportedOnError('sounds.subscribeToSounds', onError),
    next: snapshot =>
      onNext(snapshot.docs.map(soundToModel), {
        fromCache: snapshot.metadata.fromCache,
      }),
  });
};

/**
 * Create a sound: upload the audio to Cloudinary (the one big network wait — the
 * editor holds its Save spinner on it) plus any embedded art, then write the
 * sound doc.
 */
export const createSound = reported(
  'sounds.createSound',
  async ({
    album,
    artist,
    art,
    cover: pickedCover,
    localAudioUri,
    name,
    position,
    releaseYear,
  }: CreateSoundParams): Promise<string> => {
    const audio = await uploadSoundAudio(localAudioUri);
    // A picked cover is already uploaded; only fall back to the file's own tag
    // when the person did not choose one.
    const cover =
      pickedCover ?? (art ? await uploadSoundArt(art.base64, art.mime) : null);

    const docRef = await addDoc(soundsCollection(), {
      ...(album === undefined ? {} : { album }),
      artist,
      artPublicId: cover?.publicId ?? '',
      artUrl: cover?.url ?? '',
      audioPublicId: audio.publicId,
      audioUrl: audio.url,
      createdAt: serverTimestamp(),
      ...(audio.durationMs === null ? {} : { durationMs: audio.durationMs }),
      name,
      position,
      ...(releaseYear === undefined ? {} : { releaseYear }),
      updatedAt: serverTimestamp(),
    });

    // THE PHONE ALREADY HOLDS THIS FILE — it is what was just uploaded — so
    // the offline mirror takes it from here rather than downloading it back.
    // Best-effort: a failed seed leaves the sound to the mirror's normal path.
    void seedMirror(docRef.id, localAudioUri).then(uri => {
      if (uri) useOfflineStore.getState().setLocal(docRef.id, uri);
    });

    return docRef.id;
  },
);

/**
 * Update a sound's metadata (the audio file itself never changes).
 *
 * REPLACING OR CLEARING THE COVER DESTROYS THE OLD ONE — after the write,
 * never before it (see `destroySoundMedia`). It used to strand it, the same accepted gap deleting a sound had, and the same worker
 * closes both. Only `cover !== undefined` means the artwork is being touched,
 * so a plain rename still costs no extra read.
 */
export const updateSound = reported(
  'sounds.updateSound',
  async ({
    album,
    artist,
    cover,
    name,
    releaseYear,
    soundId,
  }: UpdateSoundParams): Promise<void> => {
    const ref = soundDoc(soundId);

    // Read the cover being replaced BEFORE the write, destroy it AFTER — see
    // `destroySoundMedia` for why the order matters.
    const previous =
      cover === undefined
        ? ''
        : (((await getDoc(ref)).data()?.artPublicId as string) ?? '');

    await updateDoc(ref, {
      ...(album === undefined ? {} : { album }),
      artist,
      name,
      ...(releaseYear === undefined ? {} : { releaseYear }),
      updatedAt: serverTimestamp(),
      ...(cover === undefined
        ? {}
        : cover
          ? { artPublicId: cover.publicId, artUrl: cover.url }
          : { artPublicId: '', artUrl: '' }),
    });

    if (previous && previous !== cover?.publicId)
      try {
        await destroySoundArt(previous);
      } catch (error) {
        recordError(error, 'updateSound.destroySoundArt');
      }
  },
);

/**
 * Move ONE sound to a new grid position — ONE document write, which is the
 * whole point of the fractional index (`lib/gridOrder.ts`).
 *
 * NO `updatedAt` BUMP. That field means "the person edited this sound", and
 * `syncLibrary` compares it to decide whether the player is holding a stale
 * copy; dragging a tile changes neither the sound nor anything the player
 * shows, so stamping it would re-render the console on every drop.
 */
export const moveSound = reported(
  'sounds.moveSound',
  async ({
    position,
    soundId,
  }: {
    position: number;
    soundId: string;
  }): Promise<void> => {
    await updateDoc(soundDoc(soundId), { position });
  },
);

/**
 * Give the whole library positions, in the order it is being displayed.
 *
 * REWRITES EVERY DOCUMENT, INCLUDING ONES THAT ALREADY HAVE A POSITION, and
 * that is the fix rather than an inefficiency. The first version skipped the
 * positioned ones and still took each new value from the index in the whole
 * array, so a second run over a partly-filled library handed out numbers that
 * were already taken — measured on the real library as two sounds sharing 6.
 * Assigning the complete order is the only form of this that is idempotent and
 * collision-free, and it is what makes a damaged order heal on the next launch
 * (`needsPositionRepair`).
 *
 * It is one of two paths here that writes many documents, so it carries the
 * whole-order-last-wins behaviour `lib/gridOrder.ts` describes. Both are rare
 * by construction: this one runs once per library, ever.
 */
export const backfillSoundPositions = reported(
  'sounds.backfillSoundPositions',
  async (ordered: Array<{ id: string }>): Promise<void> => {
    if (ordered.length === 0) return;

    const db = getFirestore();
    const batch = writeBatch(db);

    ordered.forEach((sound, index) => {
      batch.update(soundDoc(sound.id), { position: index });
    });

    await batch.commit();
  },
);

/**
 * Re-space the whole order after float64 runs out of room between two
 * neighbours — see `renormalized`, which is where the concurrency trade is
 * written down. Rare by construction: it takes ~50 drops into one gap.
 */
export const renormalizeSoundPositions = reported(
  'sounds.renormalizeSoundPositions',
  async (ordered: Array<{ id: string; position: number }>): Promise<void> => {
    const db = getFirestore();
    const batch = writeBatch(db);

    ordered.forEach(({ id, position }) => {
      batch.update(soundDoc(id), { position });
    });

    await batch.commit();
  },
);

/**
 * Remove a sound — ITS CLIPS FIRST, then the document, then its media.
 *
 * The order is not a preference. Firestore does not delete a subcollection
 * with its parent, so removing the sound doc alone left `clips` standing under
 * a document that was gone, and beyond the reach of the account-deletion sweep
 * (which finds clips by walking the sounds that still exist). `clips.ts` owns
 * that path and carries the full write-up in `deleteClipsOfSound`.
 *
 * THE CLOUDINARY ASSETS GO TOO, which they did not until 2026-09-12: this
 * deleted the document and left the audio and the artwork standing forever,
 * with nothing left that could ever name them again. `media-worker/`
 * is the signed call this app's docblocks used to say it deliberately didn't
 * have. Best-effort — an orphan is the old status quo, a delete that refuses
 * to finish is a new defect.
 *
 * The LOCAL waveform cache is not a gap, though, and used to be: the decoded
 * buckets outlived the document they describe, with nothing left that could
 * ever ask for them again. `forgetWaveform` drops the JSON and the session's
 * in-memory promise. It is fire-and-forget and deliberately NOT awaited — a
 * cache file is not worth failing a delete over.
 */
export const deleteSound = reported(
  'sounds.deleteSound',
  async (soundId: string): Promise<void> => {
    const ref = soundDoc(soundId);
    const snapshot = await getDoc(ref);
    const data = snapshot.data();
    // Captured before the write, destroyed after it — see `destroySoundMedia`.
    const media = {
      artPublicId: (data?.artPublicId as string) ?? '',
      audioPublicId: (data?.audioPublicId as string) ?? '',
    };

    await deleteClipsOfSound(soundId);
    await deleteDoc(ref);
    forgetWaveform(soundId);
    // The mirrored mp3 is the same case as the buckets: a local copy of a
    // document that no longer exists, under an id that can never recur.
    removeMirroredSound(soundId);

    await destroySoundMedia(media);
  },
);
