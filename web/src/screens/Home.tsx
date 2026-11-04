import { useEffect, useRef, useState } from 'react';

import type { User } from 'firebase/auth';

import { t } from '../i18n';
import { useLibrary, type Sound } from '../library';
import { playSound, resetPlayer, syncLibrary, usePlayer } from '../player';
import { signOut } from '../session';
import { Artwork } from '../ui/Artwork';
import { Backdrop } from '../ui/Backdrop';
import { BrandMark } from '../ui/brand';
import { Bars } from '../ui/glyphs';
import { MiniPlayer } from '../ui/MiniPlayer';
import { NowPlaying } from '../ui/NowPlaying';
import { ShapePanel } from '../ui/ShapePanel';

/** The grid draws a tile at most this wide; Cloudinary serves 2x of it. */
const TILE_WIDTH = 220;

const SoundTile = ({ sound, index }: { sound: Sound; index: number }) => {
  const isCurrent = usePlayer(s => s.loaded && s.current?.id === sound.id);
  const playing = usePlayer(s => s.playing);

  return (
    <li style={{ '--i': Math.min(index, 24) } as React.CSSProperties}>
      <button
        type="button"
        className={isCurrent ? 'tile is-current' : 'tile'}
        aria-current={isCurrent || undefined}
        onClick={() => playSound(sound)}
      >
        <span className="tile-art">
          <Artwork artUrl={sound.artUrl} name={sound.name} width={TILE_WIDTH} />
          {isCurrent && <Bars live={playing} />}
        </span>
        <span className="tile-name">{sound.name}</span>
        {sound.artist && <span className="tile-sub">{sound.artist}</span>}
      </button>
    </li>
  );
};

const SkeletonGrid = () => (
  <ul className="grid" aria-busy="true">
    {Array.from({ length: 8 }, (_, i) => (
      <li key={i}>
        <span className="tile is-bone">
          <span className="tile-art bone" />
          <span className="bone line" />
          <span className="bone line short" />
        </span>
      </li>
    ))}
  </ul>
);

function AccountMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const name = user.displayName ?? user.email ?? '';

  return (
    <div className="account" ref={root}>
      <button
        type="button"
        className="avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{name.slice(0, 1)}</span>
        )}
        <span className="sr">{name}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-who">
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="menu-item is-destructive"
            onClick={() => {
              setOpen(false);
              dialog.current?.showModal();
            }}
          >
            {t('settings.signOut')}
          </button>
        </div>
      )}
      <dialog ref={dialog} className="alert">
        <h2>{t('settings.signOutDialog.title')}</h2>
        <p>{t('settings.signOutDialog.message')}</p>
        <form method="dialog" className="alert-actions">
          <button value="cancel">{t('settings.signOutDialog.cancel')}</button>
          <button
            value="confirm"
            className="is-destructive"
            onClick={() => {
              resetPlayer();
              void signOut();
            }}
          >
            {t('settings.signOutDialog.confirm')}
          </button>
        </form>
      </dialog>
    </div>
  );
}

/**
 * THE SIGNED-IN APP. On a desk it is the site's full-screen Songs player made
 * into the whole window: the playing sound's column, the library as the app's
 * grid, and the Shape sheet as a column that opens beside them. On a phone it
 * is the app: the grid, the now-playing banner, and the player and the Shape
 * sheet rising over it.
 */
export function Home({ user }: { user: User }) {
  const library = useLibrary(user.uid);
  const current = usePlayer(s => s.current);
  const [expanded, setExpanded] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(false);

  useEffect(() => {
    if (library.state === 'ready') syncLibrary(library.sounds);
  }, [library]);

  // A sign-out from another tab ends here too: nothing keeps playing.
  useEffect(() => resetPlayer, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (shapeOpen) setShapeOpen(false);
      else setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shapeOpen]);

  const className = [
    'home',
    current ? 'has-current' : '',
    expanded ? 'is-expanded' : '',
    shapeOpen ? 'shape-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <Backdrop artUrl={current?.artUrl ?? ''} />

      <div className="now-column">
        <NowPlaying
          onCollapse={() => setExpanded(false)}
          onOpenShape={() => setShapeOpen(o => !o)}
          shapeOpen={shapeOpen}
        />
      </div>

      <main className="library">
        <header className="bar">
          <span className="title">
            <BrandMark size={30} />
            <span>Sound Shaper</span>
          </span>
          <AccountMenu user={user} />
        </header>

        {library.state === 'loading' && <SkeletonGrid />}

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
            {library.sounds.map((sound, i) => (
              <SoundTile key={sound.id} sound={sound} index={i} />
            ))}
          </ul>
        )}
      </main>

      <ShapePanel open={shapeOpen} onClose={() => setShapeOpen(false)} />

      <MiniPlayer onExpand={() => setExpanded(true)} />
    </div>
  );
}
