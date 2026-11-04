import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { MIN_NAME_LENGTH } from '@app/constants/forms';
import {
  EMPTY_ID3,
  id3TagSize,
  parseId3,
  type Id3Tags,
} from '@app/lib/id3Parse';

import { t } from '../i18n';
import type { Sound } from '../library';
import { uploadFailureKey } from '../media';
import {
  createSound,
  deleteSound,
  updateSound,
  type CoverChoice,
} from '../sounds';

import { ActionSheet } from './ActionSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { Toast, showToast } from './Toast';

export { Toast };

/** A picked mp3 and what its tag said. */
export type PickedSound = { file: File; tags: Id3Tags };

/** The app's `readId3Tags`, off a `File`: only the tag's bytes are read. */
export const readPicked = async (file: File): Promise<PickedSound> => {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    const size = id3TagSize(head);

    return {
      file,
      tags:
        size === null
          ? EMPTY_ID3
          : parseId3(new Uint8Array(await file.slice(0, size).arrayBuffer())),
    };
  } catch {
    return { file, tags: EMPTY_ID3 };
  }
};

export const isMp3 = (file: File) =>
  file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name);

const pictureBlob = ({ base64, mime }: { base64: string; mime: string }) => {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

// Strip the extension for the name prefill when the file had no ID3 title.
const nameFromFile = (fileName: string) => fileName.replace(/\.[^.]+$/, '');

/**
 * The sheet bar's ✓ lives in `Home`, outside this form; this is how the two
 * talk — the form publishes whether it can save, the bar asks it to.
 */
let bar = { valid: false, busy: false };
let commit: (() => void) | null = null;
const listeners = new Set<() => void>();
const publish = (next: typeof bar) => {
  if (next.valid === bar.valid && next.busy === bar.busy) return;
  bar = next;
  listeners.forEach(listener => listener());
};

export const useSoundFormBar = () =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => bar,
  );

export const commitSoundForm = () => commit?.();

export type SoundDraft =
  | { kind: 'new'; picked: PickedSound; position: number }
  | { kind: 'edit'; sound: Sound };

/**
 * The app's Edit Sound sheet: the artwork slot, Title and Subtitle, and —
 * for a sound that exists — Delete Sound. A new sound uploads on save (the
 * one real network wait, so the sheet holds open behind the busy ✓); an edit
 * with no new picture closes at once, as the app's does.
 */
export function SoundForm({
  draft,
  onDone,
}: {
  draft: SoundDraft;
  onDone: () => void;
}) {
  const tags = draft.kind === 'new' ? draft.picked.tags : null;
  const [name, setName] = useState(
    draft.kind === 'edit'
      ? draft.sound.name
      : (tags?.title ?? nameFromFile(draft.picked.file.name)),
  );
  const [artist, setArtist] = useState(
    draft.kind === 'edit' ? draft.sound.artist : (tags?.artist ?? ''),
  );
  // A new sound's cover defaults to the file's own picture — a DEFAULT, not
  // a fact: removing it means it is never uploaded at all.
  const [cover, setCover] = useState<CoverChoice>(() =>
    tags?.picture
      ? { kind: 'file', file: pictureBlob(tags.picture) }
      : { kind: 'keep' },
  );
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (cover.kind !== 'file') {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(cover.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const shown =
    cover.kind === 'file'
      ? preview
      : cover.kind === 'keep' && draft.kind === 'edit'
        ? draft.sound.artUrl
        : '';
  const valid = name.trim().length >= MIN_NAME_LENGTH;

  const save = async () => {
    if (!valid || busy) return;

    const fields = { artist: artist.trim(), name: name.trim() };

    if (draft.kind === 'edit' && cover.kind !== 'file') {
      onDone();
      updateSound({ ...fields, cover, soundId: draft.sound.id }).then(
        () => showToast(t('snackbar.sound-updated')),
        () => showToast(t('snackbar.sound-save-failed')),
      );
      return;
    }

    setBusy(true);
    try {
      if (draft.kind === 'edit')
        await updateSound({ ...fields, cover, soundId: draft.sound.id });
      else
        await createSound({
          ...fields,
          audio: draft.picked.file,
          cover: cover.kind === 'file' ? cover.file : null,
          position: draft.position,
        });
      showToast(
        t(
          draft.kind === 'edit'
            ? 'snackbar.sound-updated'
            : 'snackbar.sound-created',
        ),
      );
      onDone();
    } catch (error) {
      console.warn('sound save', error);
      showToast(t(uploadFailureKey(error, 'snackbar.sound-save-failed')));
      setBusy(false);
    }
  };

  commit = () => void save();
  useEffect(() => publish({ valid, busy }));
  useEffect(
    () => () => {
      commit = null;
      publish({ valid: false, busy: false });
    },
    [],
  );

  return (
    <>
      <div className="art-slot">
        <button
          type="button"
          className="art-pick"
          disabled={busy}
          // The app's split: one answer with no artwork, two with it.
          onClick={() => (shown ? setChoosing(true) : picker.current?.click())}
        >
          <span className="art-box">
            {shown ? (
              <img src={shown} alt="" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <span className="text-action">
            {t(shown ? 'soundEdit.art.change' : 'soundEdit.art.add')}
          </span>
        </button>
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) setCover({ kind: 'file', file });
            e.target.value = '';
          }}
        />
        <ActionSheet
          open={choosing}
          cancel={t('common.cancel')}
          actions={[
            {
              label: t('soundEdit.art.change'),
              onSelect: () => picker.current?.click(),
            },
            {
              label: t('soundEdit.art.remove'),
              destructive: true,
              onSelect: () => setCover({ kind: 'clear' }),
            },
          ]}
          onClose={() => setChoosing(false)}
        />
      </div>

      {/* Each field under its own label, the grouped form's header-over-card
          shape: a side column is too narrow to hold a label and a value on
          one line. */}
      <form
        className="fields"
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          <span className="section-head">{t('soundEdit.name.label')}</span>
          <span className="card cell">
            <input
              value={name}
              placeholder={t('soundEdit.name.placeholder')}
              disabled={busy}
              autoComplete="off"
              onChange={e => setName(e.target.value)}
            />
          </span>
        </label>
        <label className="field">
          <span className="section-head">{t('soundEdit.subtitle.label')}</span>
          <span className="card cell">
            <input
              value={artist}
              placeholder={t('soundEdit.subtitle.placeholder')}
              disabled={busy}
              autoComplete="off"
              onChange={e => setArtist(e.target.value)}
            />
          </span>
        </label>
        <button type="submit" hidden />
      </form>

      {draft.kind === 'edit' && (
        <div className="card">
          <button
            type="button"
            className="cell destructive-row"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {t('soundEdit.delete')}
          </button>
        </div>
      )}

      {draft.kind === 'edit' && (
        <ConfirmDialog
          open={confirming}
          title={t('soundEdit.deleteConfirm.title')}
          message={t('soundEdit.deleteConfirm.message')}
          cancel={t('soundEdit.deleteConfirm.cancel')}
          confirm={t('soundEdit.deleteConfirm.confirm')}
          onConfirm={() => {
            onDone();
            deleteSound(draft.sound.id).then(
              () => showToast(t('snackbar.sound-deleted')),
              () => showToast(t('snackbar.sound-delete-failed')),
            );
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
