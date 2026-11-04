import { useState } from 'react';

import type { User } from 'firebase/auth';

import type { Locale } from '@app/i18n/translations';
import { thumbUrl } from '@app/services/cloudinary/thumbUrl';
import { legalUrl } from '@app/ui/author';

import { locale, setLocale, SUPPORTED_LOCALES, t } from '../i18n';
import { resetPlayer } from '../player';
import { signOut } from '../session';

import { ConfirmDialog } from './ConfirmDialog';
import { ChevronRightGlyph } from './glyphs';

const AVATAR = 55;

/** The person's picture, or their initial on the empty-media fill. */
export function Avatar({ user, size }: { user: User; size: number }) {
  const name = user.displayName ?? '';

  return (
    <span className="avatar-disc" style={{ width: size, height: size }}>
      {user.photoURL ? (
        <img
          src={
            user.photoURL.includes('res.cloudinary.com')
              ? thumbUrl(user.photoURL, size)
              : user.photoURL
          }
          alt=""
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{name.trim().slice(0, 1)}</span>
      )}
    </span>
  );
}

/**
 * The app's Settings: the identity banner leading the form (the Apple
 * Account card — the way to Account), General, About, Legal, Sign Out.
 * Appearance is not here: the web wears the site's dark brand, with no light
 * twin to choose.
 */
export function SettingsForm({
  user,
  onAccount,
}: {
  user: User;
  onAccount: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="card">
        <button type="button" className="cell banner" onClick={onAccount}>
          <Avatar user={user} size={AVATAR} />
          <span className="banner-copy">
            <span className="banner-name">
              {user.displayName || t('settings.account.noName')}
            </span>
            <span className="banner-legend">{user.email}</span>
          </span>
          <span className="chevron">
            <ChevronRightGlyph />
          </span>
        </button>
      </div>

      <section>
        <h3 className="section-head">{t('settings.general.title')}</h3>
        <div className="card">
          <label className="cell picker">
            <span className="cell-name">{t('settings.language.label')}</span>
            <select
              value={locale}
              onChange={e => setLocale(e.target.value as Locale)}
            >
              {SUPPORTED_LOCALES.map(code => (
                <option key={code} value={code}>
                  {t(`settings.language.${code}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <h3 className="section-head">{t('settings.about.title')}</h3>
        <div className="card">
          <div className="cell">
            <span className="cell-name">{t('settings.about.appVersion')}</span>
            <span className="cell-value">{__APP_VERSION__}</span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="section-head">{t('settings.legal.title')}</h3>
        <div className="card">
          {(
            [
              ['terms-and-conditions', 'welcome.legal.terms'],
              ['privacy-policy', 'welcome.legal.privacy'],
            ] as const
          ).map(([page, label]) => (
            <a
              key={page}
              className="cell link-row"
              href={legalUrl('Sound Shaper', page, 'settings')}
              target="_blank"
              rel="noopener"
            >
              <span className="cell-name">{t(label)}</span>
              <span className="chevron">
                <ChevronRightGlyph />
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="card">
        <button
          type="button"
          className="cell destructive-row"
          onClick={() => setConfirming(true)}
        >
          {t('settings.signOut')}
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('settings.signOutDialog.title')}
        message={t('settings.signOutDialog.message')}
        cancel={t('settings.signOutDialog.cancel')}
        confirm={t('settings.signOutDialog.confirm')}
        onConfirm={() => {
          resetPlayer();
          void signOut();
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
