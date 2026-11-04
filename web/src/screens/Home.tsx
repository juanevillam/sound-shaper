import { useEffect, useRef, useState } from 'react';

import type { User } from 'firebase/auth';
import { flushSync } from 'react-dom';

import { useAutoDjDirector } from '../autoDj';
import type { Clip } from '../clips';
import { t } from '../i18n';
import { useAddTilePosition, useLibrary, type Sound } from '../library';
import { resetPlayer, syncLibrary, usePlayer } from '../player';
import { leadPosition } from '../sounds';
import { useTrophySystem } from '../trophies';
import { AccountForm } from '../ui/AccountForm';
import { Backdrop, PlayerBackdrop } from '../ui/Backdrop';
import { ClipEditor, commitClipEditor } from '../ui/ClipEditor';
import { ClipsForm } from '../ui/ClipsForm';
import { CheckGlyph, CloseGlyph, GearGlyph, ShapeGlyph } from '../ui/glyphs';
import { LibraryGrid } from '../ui/LibraryGrid';
import { MiniPlayer } from '../ui/MiniPlayer';
import { NowPlaying } from '../ui/NowPlaying';
import { SettingsForm } from '../ui/SettingsForm';
import { ShapeForm } from '../ui/ShapePanel';
import { SidePanel } from '../ui/SidePanel';
import {
  commitSoundForm,
  isMp3,
  readPicked,
  SoundForm,
  Toast,
  useSoundFormBar,
  type PickedSound,
} from '../ui/SoundForm';
import { showToast } from '../ui/Toast';
import { TrophiesForm, TrophyBanner } from '../ui/Trophies';

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

/** The editor's ✓: busy while a save uploads, dimmed while it can't save. */
const SoundCommit = ({ label }: { label: string }) => {
  const { valid, busy } = useSoundFormBar();

  return (
    <button
      type="button"
      className={busy ? 'round is-commit is-busy' : 'round is-commit'}
      disabled={!valid || busy}
      aria-busy={busy || undefined}
      onClick={commitSoundForm}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : <CheckGlyph />}
      <span className="sr">{label}</span>
    </button>
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

/**
 * iOS's large title: the name stands large at the top of the list, and once
 * it has scrolled under the bar the bar takes it, small and centred, over its
 * scroll edge. ONE trigger for both: a band with no title in it, for the
 * stretch between the first scroll and the title going under, read as a
 * half-collapsed bar (Juan, 2026-11-04).
 */
const useLargeTitle = () => {
  const title = useRef<HTMLHeadingElement>(null);
  const [titled, setTitled] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setTitled(!entry.isIntersecting),
      // The bar's own height: "under the bar" is where the title goes away.
      { rootMargin: '-56px 0px 0px 0px' },
    );

    if (title.current) observer.observe(title.current);
    return () => observer.disconnect();
  }, []);

  return { title, titled };
};

/**
 * One sheet in the stack. The app presents every one of these as a sheet
 * over what opened it — Shape over Clips, the clip editor over Clips, Account
 * over Settings, Trophies over Account — so the web keeps a stack, not a
 * single slot that swaps its body.
 */
type Entry =
  | { kind: 'settings' | 'account' | 'trophies' | 'shape' | 'clips' }
  /** The playing sound's editor, or — from a held tile — that sound's. */
  | { kind: 'edit'; sound?: Sound }
  | { kind: 'new'; picked: PickedSound }
  | { kind: 'clip'; clip: Clip | null };

type Layer = { id: number; entry: Entry; leaving: boolean };

/** A sheet's slide, so a popped one is unmounted only once it is gone. */
const LEAVE_MS = 320;

let nextLayer = 0;

/**
 * THE SIGNED-IN APP. On a desk, TWO columns — the library, and the sound
 * that is playing — and every sheet rises over the player's column the way
 * the app's sheets rise over the player, so the window never re-lays out
 * when one opens. On a phone it is the app: the grid, the now-playing
 * banner, and the player and its sheets rising over it.
 */
export function Home({ user }: { user: User }) {
  const library = useLibrary(user.uid);
  const addTilePosition = useAddTilePosition(user.uid);
  useTrophySystem(user.uid, library);
  const current = usePlayer(s => s.current);
  const [expanded, setExpanded] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  // Auth's user object changes in place; an edit bumps this to re-render.
  const [, setProfileTick] = useState(0);
  const { title, titled } = useLargeTitle();

  const live = layers.filter(layer => !layer.leaving);
  const base = live[0]?.entry.kind ?? null;

  useEffect(() => {
    if (library.state === 'ready') syncLibrary(library.sounds);
  }, [library]);

  // A sign-out from another tab ends here too: nothing keeps playing.
  useEffect(() => resetPlayer, []);

  // Auto DJ mixes whatever is open, from the Shape sheet's switch.
  useAutoDjDirector();

  const leave = (keep: (layer: Layer, index: number) => boolean) => {
    setLayers(all =>
      all.map((layer, i) =>
        layer.leaving || keep(layer, i) ? layer : { ...layer, leaving: true },
      ),
    );
    setTimeout(
      () => setLayers(all => all.filter(layer => !layer.leaving)),
      LEAVE_MS,
    );
  };

  /** Over whatever is open. */
  const push = (entry: Entry) =>
    setLayers(all => [...all, { id: nextLayer++, entry, leaving: false }]);

  /** The front sheet goes; the one under it comes forward. */
  const pop = () => {
    const front = live[live.length - 1];
    if (front) leave(layer => layer.id !== front.id);
  };

  /** Everything goes. */
  const closeAll = () => leave(() => false);

  /** A fresh stack holding one sheet — or none, if that sheet was it. */
  const openOnly = (entry: Entry) => {
    if (live.length === 1 && base === entry.kind && entry.kind !== 'new') {
      closeAll();
      return;
    }
    leave(() => false);
    push(entry);
  };

  // THE RIGHT COLUMN STANDS FOR A SOUND, and it stands up as one move. The
  // library's first snapshot primes `current` with the first sound — the
  // app's parked banner — so the column arrives on its own, after the grid
  // has drawn; taking `current` straight would snap it in. It follows
  // `current` through `morph` instead, like every other column change.
  const [stood, setStood] = useState(false);
  const hasCurrent = Boolean(current);
  useEffect(() => {
    if (hasCurrent === stood) return;
    if (live.length) setStood(hasCurrent);
    else morph(() => setStood(hasCurrent));
    // `live` only decides whether a sheet already holds the column up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurrent, stood]);

  // The grid re-flows only when the right column has to stand up for a
  // sheet; a sheet over the player is no column change at all.
  const stageThen = (change: () => void) =>
    stood || live.length ? change() : morph(change);

  const pick = (file: File) => {
    if (!isMp3(file)) {
      showToast(t('home.addSoundFormat'));
      return;
    }
    void readPicked(file).then(picked =>
      stageThen(() => openOnly({ kind: 'new', picked })),
    );
  };

  // On a desk an mp3 can simply be dropped on the window.
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      e.preventDefault();
      pick(file);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key !== 'Escape' ||
        document.querySelector(
          'dialog[open], .progress-overlay, .sub-sheet.is-open',
        )
      )
        return;
      if (live.length) pop();
      else setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // The right column stands while a sound is loaded or a sheet is up.
  const staged = stood || live.length > 0;
  const className = [
    'home',
    current ? 'has-current' : '',
    staged ? 'is-staged' : '',
    expanded ? 'is-expanded' : '',
    live.length ? 'side-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const close = (
    <button type="button" className="round" onClick={pop}>
      <CloseGlyph />
      <span className="sr">{t('common.close')}</span>
    </button>
  );
  const shapeGlyph = (
    <button
      type="button"
      className="round"
      onClick={() => push({ kind: 'shape' })}
    >
      <ShapeGlyph />
      <span className="sr">{t('player.shape.title')}</span>
    </button>
  );

  /** A sheet's bar and body, by what it holds. */
  const render = (
    entry: Entry,
  ): {
    title: string;
    action?: React.ReactNode;
    trailing?: React.ReactNode;
    body: React.ReactNode;
  } => {
    switch (entry.kind) {
      case 'settings':
        return {
          title: t('app.settings'),
          body: (
            <SettingsForm
              user={user}
              onAccount={() => push({ kind: 'account' })}
            />
          ),
        };
      case 'account':
        return {
          title: t('settings.account.sheetTitle'),
          body: (
            <AccountForm
              user={user}
              onChanged={() => setProfileTick(n => n + 1)}
              onTrophies={() => push({ kind: 'trophies' })}
            />
          ),
        };
      case 'trophies':
        return { title: t('trophies.title'), body: <TrophiesForm /> };
      case 'shape':
        return { title: t('player.shape.title'), body: <ShapeForm /> };
      case 'clips':
        // The app's Clips bar: a close leading, Shape trailing — the sound
        // stays shapeable from every clip surface.
        return {
          title: t('player.clips.title'),
          action: close,
          trailing: shapeGlyph,
          body: (
            <ClipsForm
              onEdit={clip => push({ kind: 'clip', clip })}
              onNew={() => push({ kind: 'clip', clip: null })}
            />
          ),
        };
      case 'clip':
        return {
          title: entry.clip ? t('player.clips.edit') : t('player.clips.new'),
          action: close,
          // The app's merged pill: Shape stacks over the editor, the ✓
          // commits the clip.
          trailing: (
            <span className="glass-pill">
              <button type="button" onClick={() => push({ kind: 'shape' })}>
                <ShapeGlyph />
                <span className="sr">{t('player.shape.title')}</span>
              </button>
              <button
                type="button"
                className="is-commit"
                onClick={commitClipEditor}
              >
                <CheckGlyph />
                <span className="sr">{t('player.clips.saveClip')}</span>
              </button>
            </span>
          ),
          body: current ? (
            <ClipEditor
              key={entry.clip?.id ?? 'new'}
              sound={current}
              clip={entry.clip}
              onDone={pop}
            />
          ) : null,
        };
      case 'new':
        return {
          title: t('app.soundEdit'),
          action: close,
          trailing: <SoundCommit label={t('soundEdit.save')} />,
          body: (
            <SoundForm
              draft={{
                kind: 'new',
                picked: entry.picked,
                position: leadPosition(
                  library.state === 'ready' ? library.sounds : [],
                ),
              }}
              onDone={closeAll}
            />
          ),
        };
      case 'edit': {
        const sound = entry.sound ?? current;
        return {
          title: t('app.soundEditExisting'),
          action: close,
          trailing: <SoundCommit label={t('soundEdit.saveExisting')} />,
          body: sound ? (
            <SoundForm
              key={`edit-${sound.id}`}
              draft={{ kind: 'edit', sound }}
              onDone={closeAll}
            />
          ) : null,
        };
      }
    }
  };

  return (
    <div className={className}>
      <Backdrop artUrl={current?.artUrl ?? ''} />

      <main className="library">
        <header className={titled ? 'bar is-edge is-titled' : 'bar'}>
          <span />
          <span className="bar-title" aria-hidden={!titled}>
            Sound Shaper
          </span>
          <button
            type="button"
            className="round bar-glyph"
            aria-expanded={base === 'settings'}
            onClick={() => stageThen(() => openOnly({ kind: 'settings' }))}
          >
            <GearGlyph />
            <span className="sr">{t('app.settings')}</span>
          </button>
        </header>

        <h1 ref={title} className="large-title">
          Sound Shaper
        </h1>

        {library.state === 'loading' && <SkeletonGrid />}

        {library.state === 'error' && (
          <section className="empty">
            <h2>{t('home.error.title')}</h2>
            <p>{t('home.error.subtitle')}</p>
          </section>
        )}

        {library.state === 'ready' && (
          <LibraryGrid
            sounds={library.sounds}
            addTilePosition={addTilePosition}
            onPick={pick}
            onEdit={sound => stageThen(() => openOnly({ kind: 'edit', sound }))}
          />
        )}
      </main>

      <div className="stage">
        <div className="now-column">
          <PlayerBackdrop artUrl={current?.artUrl ?? ''} />
          <NowPlaying
            onCollapse={() => setExpanded(false)}
            onOpen={next => openOnly({ kind: next })}
            panel={
              live.length === 1 &&
              (base === 'shape' || base === 'clips' || base === 'edit')
                ? base
                : null
            }
          />
        </div>

        {layers.map((layer, i) => {
          const sheet = render(layer.entry);
          const depth = live.length - 1 - live.indexOf(layer);
          return (
            <SidePanel
              key={layer.id}
              open={!layer.leaving}
              depth={layer.leaving ? 0 : depth}
              index={i}
              title={sheet.title}
              action={sheet.action}
              trailing={sheet.trailing}
              onClose={layer.leaving ? () => {} : pop}
            >
              {sheet.body}
            </SidePanel>
          );
        })}
      </div>

      <MiniPlayer onExpand={() => setExpanded(true)} />
      <Toast />
      <TrophyBanner
        onOpen={() => stageThen(() => openOnly({ kind: 'trophies' }))}
      />
    </div>
  );
}
