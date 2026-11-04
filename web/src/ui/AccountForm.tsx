import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { User } from 'firebase/auth';

import { MIN_NAME_LENGTH } from '@app/constants/forms';

import {
  deleteAccount,
  ReauthCancelled,
  readMemberSince,
  setOwnName,
  setOwnPhoto,
} from '../account';
import { locale, t } from '../i18n';
import { uploadFailureKey } from '../media';
import { resetPlayer } from '../player';

import { ConfirmDialog } from './ConfirmDialog';
import { ChevronRightGlyph } from './glyphs';
import { Avatar } from './SettingsForm';
import { showToast } from './Toast';

const PHOTO = 120;

const formatMemberSince = (millis: number | null) =>
  millis
    ? new Date(millis).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
      })
    : '—';

/** The app's native text alert for the Name row, in the site's dialog. */
function NameDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setValue(initial);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initial]);

  const valid = value.trim().length >= MIN_NAME_LENGTH;

  return (
    <dialog
      ref={ref}
      className="confirm"
      onClose={onClose}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <form
        method="dialog"
        onSubmit={e => {
          e.preventDefault();
          if (!valid) return;
          onSave(value.trim());
          onClose();
        }}
      >
        <h2>{t('settings.manageAccount.nameDialog.title')}</h2>
        <input
          className="dialog-field"
          value={value}
          aria-label={t('settings.manageAccount.nameDialog.fieldLabel')}
          autoComplete="name"
          onChange={e => setValue(e.target.value)}
        />
        <div className="confirm-actions">
          <button type="button" className="pill" onClick={onClose}>
            {t('settings.manageAccount.nameDialog.cancel')}
          </button>
          <button type="submit" className="pill is-primary" disabled={!valid}>
            {t('settings.manageAccount.nameDialog.confirm')}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/**
 * The app's Account sheet: the photo, Name / Email / Member Since, and
 * Delete Account behind two confirmations — the second naming exactly what
 * goes. The delete then asks who you are (the provider's own popup) before
 * anything is touched, and seals the screen while it runs.
 */
export function AccountForm({
  user,
  onChanged,
}: {
  user: User;
  /** Auth's user object changes in place; this re-renders whoever shows it. */
  onChanged: () => void;
}) {
  const [memberSince, setMemberSince] = useState<number | null | undefined>();
  const [naming, setNaming] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirm, setConfirm] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    readMemberSince().then(
      value => live && setMemberSince(value),
      () => live && setMemberSince(null),
    );
    return () => {
      live = false;
    };
  }, []);

  const changePhoto = (file: Blob | null) => {
    setPhotoBusy(true);
    setOwnPhoto(file)
      .then(onChanged, error => {
        console.warn('photo', error);
        showToast(t(uploadFailureKey(error, 'snackbar.profile-photo-failed')));
      })
      .finally(() => setPhotoBusy(false));
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      resetPlayer();
      await deleteAccount();
      // Nothing resets on success: the session listener takes the page to
      // Welcome the moment the Auth user is gone.
    } catch (error) {
      setDeleting(false);
      if (error instanceof ReauthCancelled) return;
      console.warn('deleteAccount', error);
      const code = (error as { code?: string }).code ?? '';
      showToast(
        t(
          code === 'auth/requires-recent-login'
            ? 'snackbar.delete-account-reauth'
            : 'snackbar.delete-account-failed',
        ),
      );
    }
  };

  const hasPhoto = Boolean(user.photoURL);

  return (
    <>
      <div className="art-slot">
        <button
          type="button"
          className="art-pick"
          disabled={photoBusy || deleting}
          onClick={() => picker.current?.click()}
        >
          <span className={photoBusy ? 'photo-slot is-busy' : 'photo-slot'}>
            <Avatar user={user} size={PHOTO} />
            {photoBusy && <span className="spinner" aria-hidden="true" />}
          </span>
          <span className="text-action">
            {t(
              hasPhoto
                ? 'settings.manageAccount.photo.change'
                : 'settings.manageAccount.photo.add',
            )}
          </span>
        </button>
        {hasPhoto && (
          <button
            type="button"
            className="text-action is-destructive"
            disabled={photoBusy || deleting}
            onClick={() => changePhoto(null)}
          >
            {t('settings.manageAccount.photo.remove')}
          </button>
        )}
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) changePhoto(file);
            e.target.value = '';
          }}
        />
      </div>

      <section>
        <h3 className="section-head">
          {t('settings.manageAccount.infoTitle')}
        </h3>
        <div className="card">
          <button
            type="button"
            className="cell link-row"
            disabled={deleting}
            onClick={() => setNaming(true)}
          >
            <span className="cell-name">
              {t('settings.manageAccount.name')}
            </span>
            <span className="cell-value">
              {user.displayName || t('settings.manageAccount.addName')}
            </span>
            <span className="chevron">
              <ChevronRightGlyph />
            </span>
          </button>
          <div className="cell">
            <span className="cell-name">
              {t('settings.manageAccount.email')}
            </span>
            <span className="cell-value">{user.email ?? '—'}</span>
          </div>
          <div className="cell">
            <span className="cell-name">
              {t('settings.manageAccount.memberSince')}
            </span>
            {memberSince === undefined ? (
              <span className="bone line value-bone" />
            ) : (
              <span className="cell-value">
                {formatMemberSince(memberSince)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="card">
          <button
            type="button"
            className="cell destructive-row"
            disabled={deleting}
            onClick={() => setConfirm(1)}
          >
            {t('settings.manageAccount.deleteAccount')}
          </button>
        </div>
        <p className="section-foot">
          {t('settings.manageAccount.deleteAccountHint')}
        </p>
      </section>

      <NameDialog
        open={naming}
        initial={user.displayName ?? ''}
        onSave={name =>
          setOwnName(name).then(onChanged, () =>
            showToast(t('snackbar.profile-name-failed')),
          )
        }
        onClose={() => setNaming(false)}
      />

      <ConfirmDialog
        open={confirm === 1}
        title={t('settings.manageAccount.deleteDialog.title')}
        message={t('settings.manageAccount.deleteDialog.message')}
        cancel={t('settings.manageAccount.deleteDialog.cancel')}
        confirm={t('settings.manageAccount.deleteDialog.confirm')}
        onConfirm={() => setTimeout(() => setConfirm(2))}
        onClose={() => setConfirm(c => (c === 1 ? 0 : c))}
      />
      <ConfirmDialog
        open={confirm === 2}
        title={t('settings.manageAccount.deleteDialog.confirmTitle')}
        message={t('settings.manageAccount.deleteDialog.confirmMessage')}
        cancel={t('settings.manageAccount.deleteDialog.cancel')}
        confirm={t('settings.manageAccount.deleteDialog.confirmCta')}
        onConfirm={() => void runDelete()}
        onClose={() => setConfirm(c => (c === 2 ? 0 : c))}
      />

      {/* Over the whole page, not this sheet: the sheet's own blur makes it
          the containing block for anything fixed inside it. */}
      {deleting &&
        createPortal(
          <div className="progress-overlay" role="alert" aria-busy="true">
            <span className="spinner" aria-hidden="true" />
          </div>,
          document.body,
        )}
    </>
  );
}
