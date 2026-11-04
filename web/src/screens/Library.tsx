import { useRef, useState } from 'react';

import type { User } from 'firebase/auth';

import { audioEngine } from '@app/lib/audioEngine';
import { thumbUrl } from '@app/services/cloudinary/thumbUrl';

import { t } from '../i18n';
import { useLibrary, type Sound } from '../library';
import { signOut } from '../session';
import { asHandle } from '../shims/audio-api';
import { BrandMark } from '../ui/brand';

/** The grid draws a tile at most this wide; Cloudinary serves 2x of it. */
const TILE_WIDTH = 200;

/**
 * STEP 2 OF docs/web.md — the signed-in library: the person's own sounds, live
 * from Firestore, in their hand order, and a tap plays one through the app's
 * own engine. The real player, Shape, Clips and uploads replace the bar.
 */
export function Library({ user }: { user: User }) {
  const library = useLibrary(user.uid);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const element = useRef<HTMLAudioElement | null>(null);

  const play = async (sound: Sound) => {
    // A browser starts its audio context only from a gesture — this tap.
    await audioEngine.getContext().resume();

    if (current?.id === sound.id) {
      if (playing) audioEngine.pause();
      else audioEngine.play();
      return;
    }

    audioEngine.pause();
    element.current?.removeAttribute('src');

    const el = asHandle(new Audio());

    // Cloudinary answers CORS, and Web Audio may only read a cross-origin
    // stream the page asked for anonymously.
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.src = sound.audioUrl;
    el.addEventListener('play', () => setPlaying(true));
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener('ended', () => setPlaying(false));
    audioEngine.registerHandle(el);
    audioEngine.buildGraph(el);
    element.current = el;
    setCurrent(sound);
    audioEngine.play();
  };

  return (
    <div className="library">
      <header className="bar">
        <span className="title">
          <BrandMark size={28} />
          Sound Shaper
        </span>
        <span className="account">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              width={28}
              height={28}
              referrerPolicy="no-referrer"
            />
          )}
          <button type="button" className="quiet" onClick={() => signOut()}>
            {t('settings.signOut')}
          </button>
        </span>
      </header>

      {library.state === 'loading' && <div className="grid" aria-busy="true" />}

      {library.state === 'error' && (
        <section className="empty">
          <h2>{t('home.error.title')}</h2>
          <p>{t('home.error.subtitle')}</p>
        </section>
      )}

      {library.state === 'ready' && library.sounds.length === 0 && (
        <section className="empty">
          <h2>{t('player.empty')}</h2>
          <p>{t('player.emptyHint')}</p>
        </section>
      )}

      {library.state === 'ready' && library.sounds.length > 0 && (
        <ul className="grid">
          {library.sounds.map(sound => (
            <li key={sound.id}>
              <button
                type="button"
                className="tile"
                aria-pressed={current?.id === sound.id && playing}
                onClick={() => play(sound)}
              >
                <span className="art">
                  {sound.artUrl ? (
                    <img
                      src={thumbUrl(sound.artUrl, TILE_WIDTH)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="initial">{sound.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className="name">{sound.name}</span>
                {sound.artist && <span className="sub">{sound.artist}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && (
        <footer className="now-playing">
          <span className="now">
            <strong>{current.name}</strong>
            <span>{current.artist}</span>
          </span>
          <button type="button" onClick={() => play(current)}>
            {playing ? t('player.pause') : t('player.play')}
          </button>
        </footer>
      )}
    </div>
  );
}
