import { useEffect, useRef, useState } from 'react';

import type { User } from 'firebase/auth';
import { flushSync } from 'react-dom';

import { useAutoDjDirector } from '../autoDj';
import type { Clip } from '../clips';
import { t } from '../i18n';
import { useLibrary, type Sound } from '../library';
import { playSound, resetPlayer, syncLibrary, usePlayer } from '../player';
import { leadPosition } from '../sounds';
import { useTrophySystem } from '../trophies';
import { AccountForm } from '../ui/AccountForm';
import { Artwork } from '../ui/Artwork';
import { Backdrop, PlayerBackdrop } from '../ui/Backdrop';
import { ClipEditor, commitClipEditor } from '../ui/ClipEditor';
import { ClipsForm } from '../ui/ClipsForm';
import {
  Bars,
  CheckGlyph,
  ChevronLeftGlyph,
  CloseGlyph,
  GearGlyph,
  PlusGlyph,
  ShapeGlyph,
} from '../ui/glyphs';
import { MiniPlayer } from '../ui/MiniPlayer';
import { NowPlaying, type Panel } from '../ui/NowPlaying';
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

/** The grid draws a tile at most this wide; Cloudinary serves 2x of it. */
const TILE_WIDTH = 220;

const DESK = '(min-width: 64rem)';

/** What the side column holds: a player sheet, or Settings and what is behind it. */
type HomePanel = Panel | 'settings' | 'account' | 'trophies';

const isAccountPanel = (
  panel: HomePanel | null,
): panel is 'settings' | 'account' | 'trophies' =>
  panel === 'settings' || panel === 'account' || panel === 'trophies';

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

/**
 * The app's add tile: the empty-media box with a plus, "Add Sound" under it
 * and the one rule the picker enforces. First in the grid, so a new sound —
 * which lands at the front — appears right beside it.
 */
const AddTile = ({ onPick }: { onPick: (file: File) => void }) => {
  const input = useRef<HTMLInputElement>(null);

  return (
    <li style={{ viewTransitionName: 'tile-add' } as React.CSSProperties}>
      <button
        type="button"
        className="tile is-add"
        onClick={() => input.current?.click()}
      >
        <span className="tile-art">
          <span className="artwork is-empty" aria-hidden="true">
            <PlusGlyph />
          </span>
        </span>
        <span className="tile-name">{t('home.addSound')}</span>
        <span className="tile-sub">{t('home.addSoundFormat')}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".mp3,audio/mpeg"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
    </li>
  );
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
 * THE SIGNED-IN APP. On a desk, three columns in the order a person reads
 * them: the library, the sound that is playing, and the sheet it opened
 * (Shape or Clips). On a phone it is the app: the grid, the now-playing
 * banner, and the player and its sheets rising over it.
 */
export function Home({ user }: { user: User }) {
  const library = useLibrary(user.uid);
  useTrophySystem(user.uid, library);
  const current = usePlayer(s => s.current);
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<HomePanel | null>(null);
  // Auth's user object changes in place; an edit bumps this to re-render.
  const [, setProfileTick] = useState(0);
  // The clip editor, over the Clips sheet: `clip` null is a new clip.
  const [editing, setEditing] = useState<{ clip: Clip | null } | null>(null);
  // A picked mp3 waiting in the New Sound sheet.
  const [composing, setComposing] = useState<PickedSound | null>(null);
  // Every opening of a sheet is a fresh form: the sheet keeps its content
  // while it slides away, so a form keyed on its sound alone would come back
  // holding the last opening's typing — or a save's busy state.
  const [opening, setOpening] = useState(0);
  const { title, titled } = useLargeTitle();
  // Shape, stacked over the clip editor — the app's merged Shape + ✓ pill.
  const [shapeOver, setShapeOver] = useState(false);
  // The sheet keeps showing what it held while it slides away.
  type Sheet = HomePanel | 'new';
  const sheet: Sheet | null = composing ? 'new' : panel;
  const last = useRef<Sheet>('shape');
  if (sheet) last.current = sheet;
  const shown = sheet ?? last.current;
  // The draft the New Sound sheet holds — kept while it slides away.
  const lastComposing = useRef<PickedSound | null>(null);
  if (composing) lastComposing.current = composing;

  useEffect(() => {
    if (library.state === 'ready') syncLibrary(library.sounds);
  }, [library]);

  // Shape is stacked over a clip being edited, and goes with it.
  useEffect(() => {
    if (!editing) setShapeOver(false);
  }, [editing]);

  // A sign-out from another tab ends here too: nothing keeps playing.
  useEffect(() => resetPlayer, []);

  // Auto DJ mixes whatever is open, from the Shape sheet's switch.
  useAutoDjDirector();

  const openPanel = (next: HomePanel | null) =>
    morph(() => {
      setPanel(next);
      if (next) setOpening(n => n + 1);
      setEditing(null);
      setShapeOver(false);
      setComposing(null);
    });

  const pick = (file: File) => {
    if (!isMp3(file)) {
      showToast(t('home.addSoundFormat'));
      return;
    }
    void readPicked(file).then(picked =>
      morph(() => {
        setEditing(null);
        setComposing(picked);
        setOpening(n => n + 1);
      }),
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
        document.querySelector('dialog[open], .progress-overlay')
      )
        return;
      if (shapeOver) setShapeOver(false);
      else if (editing) setEditing(null);
      else if (sheet) openPanel(null);
      else setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const className = [
    'home',
    current ? 'has-current' : '',
    expanded ? 'is-expanded' : '',
    sheet ? 'side-open' : '',
    editing ? 'is-editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
            aria-expanded={isAccountPanel(panel)}
            onClick={() => openPanel(isAccountPanel(panel) ? null : 'settings')}
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
          <ul className="grid">
            <AddTile onPick={pick} />
            {library.sounds.map((sound, i) => (
              <SoundTile key={sound.id} sound={sound} index={i + 1} />
            ))}
          </ul>
        )}
      </main>

      <div className="now-column">
        <PlayerBackdrop artUrl={current?.artUrl ?? ''} />
        <NowPlaying
          onCollapse={() => setExpanded(false)}
          onOpen={next => openPanel(panel === next ? null : next)}
          panel={isAccountPanel(panel) ? null : panel}
        />
      </div>

      <SidePanel
        open={sheet !== null}
        title={
          shown === 'settings'
            ? t('app.settings')
            : shown === 'account'
              ? t('settings.account.sheetTitle')
              : shown === 'trophies'
                ? t('trophies.title')
                : shown === 'new'
                  ? t('app.soundEdit')
                  : shown === 'edit'
                    ? t('app.soundEditExisting')
                    : editing && shapeOver
                      ? t('player.shape.title')
                      : editing
                        ? editing.clip
                          ? t('player.clips.edit')
                          : t('player.clips.new')
                        : shown === 'clips'
                          ? t('player.clips.title')
                          : t('player.shape.title')
        }
        action={
          shown === 'account' || shown === 'trophies' ? (
            <button
              type="button"
              className="round"
              onClick={() =>
                openPanel(shown === 'trophies' ? 'account' : 'settings')
              }
            >
              <ChevronLeftGlyph />
              <span className="sr">{t('common.back')}</span>
            </button>
          ) : shown === 'new' || shown === 'edit' ? (
            <button
              type="button"
              className="round"
              onClick={() => openPanel(null)}
            >
              <CloseGlyph />
              <span className="sr">{t('common.cancel')}</span>
            </button>
          ) : editing && shapeOver ? (
            <button
              type="button"
              className="round"
              onClick={() => setShapeOver(false)}
            >
              <ChevronLeftGlyph />
              <span className="sr">{t('common.back')}</span>
            </button>
          ) : editing ? (
            <button
              type="button"
              className="round"
              onClick={() => setEditing(null)}
            >
              <CloseGlyph />
              <span className="sr">{t('common.cancel')}</span>
            </button>
          ) : null
        }
        trailing={
          shown === 'new' || shown === 'edit' ? (
            <SoundCommit
              label={t(
                shown === 'new' ? 'soundEdit.save' : 'soundEdit.saveExisting',
              )}
            />
          ) : editing && shapeOver ? (
            // Back is the way out of a stacked sheet; a close beside it
            // would end the clip too.
            <span />
          ) : (
            editing && (
              // The app's merged pill: Shape stacks over the editor, the ✓
              // commits the clip.
              <span className="glass-pill">
                <button type="button" onClick={() => setShapeOver(true)}>
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
            )
          )
        }
        onClose={() => openPanel(null)}
      >
        {shown === 'settings' ? (
          <SettingsForm user={user} onAccount={() => openPanel('account')} />
        ) : shown === 'account' ? (
          <AccountForm
            key={`account-${opening}`}
            user={user}
            onChanged={() => setProfileTick(n => n + 1)}
            onTrophies={() => openPanel('trophies')}
          />
        ) : shown === 'trophies' ? (
          <TrophiesForm key={`trophies-${opening}`} />
        ) : shown === 'new' && lastComposing.current ? (
          <SoundForm
            key={`new-${opening}`}
            draft={{
              kind: 'new',
              picked: lastComposing.current,
              position: leadPosition(
                library.state === 'ready' ? library.sounds : [],
              ),
            }}
            onDone={() => openPanel(null)}
          />
        ) : shown === 'edit' && current ? (
          <SoundForm
            key={`edit-${current.id}-${opening}`}
            draft={{ kind: 'edit', sound: current }}
            onDone={() => openPanel(null)}
          />
        ) : editing && current ? (
          <>
            {/* Kept mounted under Shape, so the range survives the trip. */}
            <div className="stacked" hidden={shapeOver}>
              <ClipEditor
                key={editing.clip?.id ?? 'new'}
                sound={current}
                clip={editing.clip}
                onDone={() => setEditing(null)}
              />
            </div>
            {shapeOver && <ShapeForm />}
          </>
        ) : shown === 'clips' ? (
          <ClipsForm
            onEdit={clip => setEditing({ clip })}
            onNew={() => setEditing({ clip: null })}
          />
        ) : (
          <ShapeForm />
        )}
      </SidePanel>

      <MiniPlayer onExpand={() => setExpanded(true)} />
      <Toast />
      <TrophyBanner onOpen={() => openPanel('trophies')} />
    </div>
  );
}
