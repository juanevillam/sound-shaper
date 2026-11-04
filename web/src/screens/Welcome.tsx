import { useState } from 'react';

import {
  AUTHOR_CREDIT_PREFIX,
  AUTHOR_NAME,
  authorUrl,
  legalUrl,
} from '@app/ui/author';

import { t } from '../i18n';
import { signInWithGoogle } from '../session';
import { BrandTile } from '../ui/brand';
import { ClipIcon, GoogleG, LibraryIcon, ShapeIcon } from '../ui/icons';

const APP_NAME = 'Sound Shaper';

const FEATURES = [
  { key: 'library', Icon: LibraryIcon },
  { key: 'shape', Icon: ShapeIcon },
  { key: 'clip', Icon: ClipIcon },
] as const;

/**
 * The app's Welcome screen (src/app/(welcome)/welcome.tsx) in the web's own
 * language: the tile, the name and its byline, the same three features in
 * the same words, one sign-in button and the legal line it carries. Apple is
 * not offered yet — on the web it needs a Services ID in Grostify's Apple
 * Developer account (docs/web.md).
 */
export function Welcome() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.warn('signInWithGoogle', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  // "By continuing, you agree to Sound Shaper's {privacy} and {terms}."
  const [before, rest] = t('welcome.legal.text').split('{privacy}');
  const [between, after] = (rest ?? '').split('{terms}');

  return (
    <main className="welcome">
      <section className="welcome-hero">
        <BrandTile size={88} />
        <h1>{APP_NAME}</h1>
        <p className="byline">
          {AUTHOR_CREDIT_PREFIX}{' '}
          <a
            href={authorUrl(APP_NAME).replace('welcome_screen', 'web_welcome')}
          >
            {AUTHOR_NAME}
          </a>
        </p>
        <ul className="features">
          {FEATURES.map(({ key, Icon }) => (
            <li key={key}>
              <span className="feature-icon">
                <Icon />
              </span>
              <span>
                <strong>{t(`welcome.features.${key}.title`)}</strong>
                <span>{t(`welcome.features.${key}.subtitle`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="welcome-actions">
        <button
          type="button"
          className="google"
          disabled={busy}
          onClick={signIn}
        >
          <GoogleG />
          {busy
            ? t('welcome.button.google.loadingLabel')
            : t('welcome.button.google.label')}
        </button>
        {failed && (
          <p className="error" role="alert">
            {t('errors.message')}
          </p>
        )}
        <p className="legal">
          {before}
          <a href={legalUrl(APP_NAME, 'privacy-policy', 'web_welcome')}>
            {t('welcome.legal.privacy')}
          </a>
          {between}
          <a href={legalUrl(APP_NAME, 'terms-and-conditions', 'web_welcome')}>
            {t('welcome.legal.terms')}
          </a>
          {after}
        </p>
      </footer>
    </main>
  );
}
