import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { User } from 'firebase/auth';

import { t } from '../i18n';
import { useLibrary, type Sound } from '../library';
import { playSound, resetPlayer, syncLibrary, usePlayer } from '../player';
import { signOut } from '../session';
import { Artwork } from '../ui/Artwork';
import { Backdrop } from '../ui/Backdrop';
import { BrandMark } from '../ui/brand';
import { ClipsForm } from '../ui/ClipsForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { Clip } from '../clips';
import { ClipEditor, commitClipEditor } from '../ui/ClipEditor';
import { Bars, CheckGlyph, CloseGlyph, PlusGlyph } from '../ui/glyphs';
import { MiniPlayer } from '../ui/MiniPlayer';
import { NowPlaying, type Panel } from '../ui/NowPlaying';
import { ShapeForm } from '../ui/ShapePanel';
import { SidePanel } from '../ui/SidePanel';

/** The grid draws a tile at most this wide; Cloudinary serves 2x of it. */
const TILE_WIDTH = 220;

const DESK = '(min-width: 64rem)';

/**
 * A change to the desk's columns, animated as one move. Opening a sheet
 * narrows the grid, and a grid re-flowing to fewer columns jumps every tile
 * at once; a view transition morphs each tile from where it was to where it
 * lands instead. Phones and reduced motion take the change as it is.
 */
const morph = (change: () => void) => {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };

  if (
    !doc.startViewTransition ||
    !matchMedia(DESK).matches ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return change();

  doc.startViewTransition(() => flushSync(change));
};

const SoundTile = ({ sound, index }: { sound: Sound; index: number }) => {
  const isCurrent = usePlayer(s => s.loaded && s.current?.id === sound.id);
  const playing = usePlayer(s => s.playing);
  const rate = usePlayer(s => s.rate);

  return (
    <li
      style={
        {
          '--i': Math.min(index, 24),
          viewTransitionName: `tile-${sound.id}`,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        className={isCurrent ? 'tile is-current' : 'tile'}
        aria-current={isCurrent || undefined}
        onClick={() => playSound(sound)}
      >
        <span className="tile-art">
          <Artwork artUrl={sound.artUrl} name={sound.name} width={TILE_WIDTH} />
          {isCurrent && <Bars live={playing} rate={rate} />}
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
  const [confirming, setConfirming] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
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
              setConfirming(true);
            }}
          >
            {t('settings.signOut')}
          </button>
        </div>
      )}
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
    </div>
  );
}

/**
 * iOS's large title: the name stands large at the top of the list, and once
 * it has scrolled under the bar the bar takes it, small and centred, over a
 * soft blur that only appears once something is behind it.
 */
const useLargeTitle = () => {
  const top = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [edge, setEdge] = useState(false);
  const [titled, setTitled] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const away = !entry.isIntersecting;
          if (entry.target === top.current) setEdge(away);
          if (entry.target === title.current) setTitled(away);
        }
      },
      // The bar's own height: "under the bar" is where these go away.
      { rootMargin: '-56px 0px 0px 0px' },
    );

    if (top.current) observer.observe(top.current);
    if (title.current) observer.observe(title.current);
    return () => observer.disconnect();
  }, []);

  return { top, title, edge, titled };
};

/**
 * THE SIGNED-IN APP. On a desk, three columns in the order a person reads
 * them: the library, the sound that is playing, and the sheet it opened
 * (Shape or Clips). On a phone it is the app: the grid, the now-playing
 * banner, and the player and its sheets rising over it.
 */
export function Home({ user }: { user: User }) {
  const library = useLibrary(user.uid);
  const current = usePlayer(s => s.current);
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  // The clip editor, over the Clips sheet: `clip` null is a new clip.
  const [editing, setEditing] = useState<{ clip: Clip | null } | null>(null);
  const { top, title, edge, titled } = useLargeTitle();
  // The sheet keeps showing what it held while it slides away.
  const last = useRef<Panel>('shape');
  if (panel) last.current = panel;
  const shown = panel ?? last.current;

  useEffect(() => {
    if (library.state === 'ready') syncLibrary(library.sounds);
  }, [library]);

  // A sign-out from another tab ends here too: nothing keeps playing.
  useEffect(() => resetPlayer, []);

  const openPanel = (next: Panel | null) =>
    morph(() => {
      setPanel(next);
      setEditing(null);
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      if (editing) setEditing(null);
      else if (panel) openPanel(null);
      else setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const className = [
    'home',
    current ? 'has-current' : '',
    expanded ? 'is-expanded' : '',
    panel ? 'side-open' : '',
    editing ? 'is-editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <Backdrop artUrl={current?.artUrl ?? ''} />

      <main className="library">
        <header
          className={['bar', edge && 'is-edge', titled && 'is-titled']
            .filter(Boolean)
            .join(' ')}
        >
          <span />
          <span className="bar-title" aria-hidden={!titled}>
            Sound Shaper
          </span>
          <AccountMenu user={user} />
        </header>

        <div ref={top} className="scroll-top" aria-hidden="true" />
        <h1 ref={title} className="large-title">
          <BrandMark size={30} />
          <span>Sound Shaper</span>
        </h1>

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

      <div className="now-column">
        <NowPlaying
          onCollapse={() => setExpanded(false)}
          onOpen={next => openPanel(panel === next ? null : next)}
          panel={panel}
        />
      </div>

      <SidePanel
        open={panel !== null}
        title={
          editing
            ? editing.clip
              ? t('player.clips.edit')
              : t('player.clips.new')
            : shown === 'clips'
              ? t('player.clips.title')
              : t('player.shape.title')
        }
        action={
          editing ? (
            <button
              type="button"
              className="round"
              onClick={() => setEditing(null)}
            >
              <CloseGlyph />
              <span className="sr">{t('common.cancel')}</span>
            </button>
          ) : (
            shown === 'clips' && (
              <button
                type="button"
                className="round"
                onClick={() => setEditing({ clip: null })}
              >
                <PlusGlyph />
                <span className="sr">{t('player.clips.new')}</span>
              </button>
            )
          )
        }
        trailing={
          editing && (
            <button
              type="button"
              className="round is-commit"
              onClick={commitClipEditor}
            >
              <CheckGlyph />
              <span className="sr">{t('player.clips.saveClip')}</span>
            </button>
          )
        }
        onClose={() => openPanel(null)}
      >
        {editing && current ? (
          <ClipEditor
            key={editing.clip?.id ?? 'new'}
            sound={current}
            clip={editing.clip}
            onDone={() => setEditing(null)}
          />
        ) : shown === 'clips' ? (
          <ClipsForm onEdit={clip => setEditing({ clip })} />
        ) : (
          <ShapeForm />
        )}
      </SidePanel>

      <MiniPlayer onExpand={() => setExpanded(true)} />
    </div>
  );
}
