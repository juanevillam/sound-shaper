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
import {
  CheckGlyph,
  CloseGlyph,
  GearGlyph,
  PlusGlyph,
  ShapeGlyph,
} from '../ui/glyphs';
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
const useLargeTitle = (active: boolean) => {
  const title = useRef<HTMLHeadingElement>(null);
  const [titled, setTitled] = useState(false);

  useEffect(() => {
    if (!active || !title.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTitled(!entry.isIntersecting),
      // The bar's own height: "under the bar" is where the title goes away.
      { rootMargin: '-56px 0px 0px 0px' },
    );

    observer.observe(title.current);
    return () => observer.disconnect();
  }, [active]);

  return { title, titled };
};

/**
 * Two independent sheet stacks:
 * - `ToolEntry` belongs to the desk's THIRD column (`tools`): Shape and Clips
 *   are worked WITH the player, so on a desk they open beside it, and whatever
 *   stacks over Clips (the clip editor, or Shape opened from Clips / the clip
 *   editor) stacks inside that third column.
 * - `ModalEntry` opens in a global centered sheet rising from the bottom over
 *   all columns (`modals`), so opening Settings (Account / Trophies) or
 *   Edit / New Sound never collapses or closes the third column.
 */
type ToolEntry =
  | { kind: 'shape' | 'clips' }
  | { kind: 'clip'; clip: Clip | null };

type ModalEntry =
  | { kind: 'settings' | 'account' | 'trophies' }
  /** The playing sound's editor, or — from a held tile — that sound's. */
  | { kind: 'edit'; sound?: Sound }
  | { kind: 'new'; picked: PickedSound };

type Entry = ToolEntry | ModalEntry;

type Layer<T extends Entry> = {
  id: number;
  entry: T;
  leaving: boolean;
  slot?: number;
  switching?: boolean;
};

/** A sheet's slide, so a popped one is unmounted only once it is gone. */
const LEAVE_MS = 320;

let nextLayer = 0;

/**
 * THE SIGNED-IN APP. On a desk, the library, the sound that is playing, and a
 * third column while Shape or Clips is open; modal sheets (Settings, Account,
 * Trophies, Edit / New Sound) rise globally from the bottom in the center over
 * all columns without closing any of them. On a phone it is the app: the grid,
 * the now-playing banner, and the player and its sheets rising over it.
 */
export function Home({ user }: { user: User }) {
  const library = useLibrary(user.uid);
  const addTilePosition = useAddTilePosition(user.uid);
  useTrophySystem(user.uid, library);
  const current = usePlayer(s => s.current);
  const playing = usePlayer(s => s.playing);
  const rate = usePlayer(s => s.rate);
  const [expanded, setExpanded] = useState(false);
  const [toolLayers, setToolLayers] = useState<Layer<ToolEntry>[]>([]);
  const [modalLayers, setModalLayers] = useState<Layer<ModalEntry>[]>([]);
  // Auth's user object changes in place; an edit bumps this to re-render.
  const [, setProfileTick] = useState(0);
  const [coldLoad, setColdLoad] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (library.state !== 'loading') return;
    const id = setTimeout(() => setColdLoad(true), 220);
    return () => clearTimeout(id);
  }, [library.state]);

  const readyOrCold = library.state !== 'loading' || coldLoad;
  const { title, titled } = useLargeTitle(readyOrCold);

  const liveTools = toolLayers.filter(layer => !layer.leaving);
  const toolBase = liveTools[0]?.entry.kind ?? null;
  const liveModals = modalLayers.filter(layer => !layer.leaving);
  const modalBase = liveModals[0]?.entry.kind ?? null;

  useEffect(() => {
    if (library.state === 'ready') syncLibrary(library.sounds);
  }, [library]);

  // A sign-out from another tab ends here too: nothing keeps playing.
  useEffect(() => resetPlayer, []);

  // Auto DJ mixes whatever is open, from the Shape sheet's switch.
  useAutoDjDirector();

  const leaveIn = <T extends Entry>(
    setStack: React.Dispatch<React.SetStateAction<Layer<T>[]>>,
    keep: (layer: Layer<T>, index: number) => boolean,
  ) => {
    setStack(all => {
      const liveBefore = all.filter(l => !l.leaving);
      return all.map((layer, i) =>
        layer.leaving || keep(layer, i)
          ? layer
          : {
              ...layer,
              leaving: true,
              slot: liveBefore.indexOf(layer),
            },
      );
    });
    setTimeout(
      () => setStack(all => all.filter(layer => !layer.leaving)),
      LEAVE_MS,
    );
  };

  const pushTool = (entry: ToolEntry, switching = false) =>
    setToolLayers(all => [
      ...all,
      { id: nextLayer++, entry, leaving: false, switching },
    ]);

  const popTool = () => {
    const front = liveTools[liveTools.length - 1];
    if (front) leaveIn(setToolLayers, layer => layer.id !== front.id);
  };

  const closeTools = () => leaveIn(setToolLayers, () => false);

  const openTool = (kind: 'shape' | 'clips') => {
    if (liveTools.length === 1 && toolBase === kind) {
      closeTools();
      return;
    }
    const wasOpen = liveTools.length > 0;
    if (wasOpen) closeTools();
    pushTool({ kind }, wasOpen);
  };

  const pushModal = (entry: ModalEntry) =>
    setModalLayers(all => [...all, { id: nextLayer++, entry, leaving: false }]);

  const popModal = () => {
    const front = liveModals[liveModals.length - 1];
    if (front) leaveIn(setModalLayers, layer => layer.id !== front.id);
  };

  const closeModals = () => leaveIn(setModalLayers, () => false);

  const openModal = (entry: ModalEntry) => {
    if (
      liveModals.length === 1 &&
      modalBase === entry.kind &&
      entry.kind !== 'new'
    ) {
      const prev = liveModals[0].entry;
      const sameTarget =
        entry.kind !== 'edit' ||
        prev.kind !== 'edit' ||
        (entry.sound?.id ?? current?.id) === (prev.sound?.id ?? current?.id);
      if (sameTarget) {
        closeModals();
        return;
      }
    }
    closeModals();
    pushModal(entry);
  };

  // On initial hydration, stand the second column synchronously with the
  // library so the grid never renders wide and shrinks mid-entrance; reserve
  // `morph` for 0 -> 1 and 1 -> 0 changes during the session.
  const activeCurrent =
    current ?? (library.state === 'ready' ? (library.sounds[0] ?? null) : null);
  const hasCurrent = Boolean(activeCurrent);
  const [stood, setStood] = useState(false);
  const isStaged = hydrated.current ? stood : hasCurrent;

  useEffect(() => {
    if (library.state === 'loading') return;
    if (!hydrated.current) {
      hydrated.current = true;
      setStood(hasCurrent);
      return;
    }
    if (hasCurrent === stood) return;
    morph(() => setStood(hasCurrent));
  }, [library.state, hasCurrent, stood]);

  // THE THIRD COLUMN stands up and lies down through `morph` too, a beat
  // after the stack that needs it — the same lag as the player's column.
  const tooled = liveTools.length > 0 && hasCurrent;
  const [toolsShown, setToolsShown] = useState(false);
  useEffect(() => {
    if (tooled !== toolsShown) morph(() => setToolsShown(tooled));
  }, [tooled, toolsShown]);

  const pick = (file: File) => {
    if (!isMp3(file)) {
      showToast(t('home.addSoundFormat'));
      return;
    }
    void readPicked(file).then(picked => openModal({ kind: 'new', picked }));
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
      if (liveModals.length) popModal();
      else if (liveTools.length) popTool();
      else setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!readyOrCold) return null;

  const className = [
    'home',
    activeCurrent ? 'has-current' : '',
    isStaged ? 'is-staged' : '',
    expanded ? 'is-expanded' : '',
    toolsShown ? 'is-tooled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  /** A sheet's bar and body, by what it holds. */
  const render = (
    entry: Entry,
    onClose: () => void,
  ): {
    title: string;
    action?: React.ReactNode;
    trailing?: React.ReactNode;
    body: React.ReactNode;
  } => {
    const close = (
      <button type="button" className="round" onClick={onClose}>
        <CloseGlyph />
        <span className="sr">{t('common.close')}</span>
      </button>
    );

    switch (entry.kind) {
      case 'settings':
        return {
          title: t('app.settings'),
          body: (
            <SettingsForm
              user={user}
              onAccount={() => pushModal({ kind: 'account' })}
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
              onTrophies={() => pushModal({ kind: 'trophies' })}
            />
          ),
        };
      case 'trophies':
        return { title: t('trophies.title'), body: <TrophiesForm /> };
      case 'shape':
        return { title: t('player.shape.title'), body: <ShapeForm /> };
      case 'clips':
        // The app's Clips bar: close on the left, and on the right one capsule
        // holding Shape and + (HeaderGlyphGroupIos).
        return {
          title: t('player.clips.title'),
          action: close,
          trailing: (
            <span className="glass-pill">
              <button type="button" onClick={() => pushTool({ kind: 'shape' })}>
                <ShapeGlyph />
                <span className="sr">{t('player.shape.title')}</span>
              </button>
              <button
                type="button"
                onClick={() => pushTool({ kind: 'clip', clip: null })}
              >
                <PlusGlyph />
                <span className="sr">{t('player.clips.new')}</span>
              </button>
            </span>
          ),
          body: <ClipsForm onEdit={clip => pushTool({ kind: 'clip', clip })} />,
        };
      case 'clip':
        return {
          title: entry.clip ? t('player.clips.edit') : t('player.clips.new'),
          action: close,
          // One capsule holding Shape and ✓ — the app's HeaderGlyphGroupIos.
          trailing: (
            <span className="glass-pill">
              <button type="button" onClick={() => pushTool({ kind: 'shape' })}>
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
              onDone={popTool}
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
              onDone={closeModals}
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
              onDone={closeModals}
            />
          ) : null,
        };
      }
    }
  };

  /** Renders a stack of layers, each knowing how many stand over it. */
  const renderStack = <T extends Entry>(
    group: Layer<T>[],
    onPop: () => void,
  ) => {
    const front = group.filter(layer => !layer.leaving);
    return group.map((layer, i) => {
      const handleClose = layer.leaving ? () => {} : onPop;
      const sheet = render(layer.entry, handleClose);
      const liveIndex = front.indexOf(layer);
      const depth = front.length - 1 - liveIndex;
      const index = liveIndex >= 0 ? liveIndex : (layer.slot ?? i);
      return (
        <SidePanel
          key={layer.id}
          open={!layer.leaving}
          switching={Boolean(layer.switching)}
          depth={layer.leaving ? 0 : depth}
          index={index}
          title={sheet.title}
          action={sheet.action}
          trailing={sheet.trailing}
          onClose={handleClose}
        >
          {sheet.body}
        </SidePanel>
      );
    });
  };

  const editingCurrent =
    liveModals.length === 1 &&
    liveModals[0].entry.kind === 'edit' &&
    (!liveModals[0].entry.sound ||
      liveModals[0].entry.sound.id === current?.id);

  return (
    <div className={className}>
      <Backdrop artUrl={activeCurrent?.artUrl ?? ''} />

      <main className="library">
        <header className={titled ? 'bar is-edge is-titled' : 'bar'}>
          <span />
          <span className="bar-title" aria-hidden={!titled}>
            Sound Shaper
          </span>
          <button
            type="button"
            className="round bar-glyph"
            aria-expanded={modalBase === 'settings'}
            onClick={() => openModal({ kind: 'settings' })}
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
          />
        )}
      </main>

      <div className="stage">
        <div className="now-column">
          <PlayerBackdrop
            artUrl={current?.artUrl ?? ''}
            flowing={playing}
            rate={rate}
          />
          <NowPlaying
            onCollapse={() => setExpanded(false)}
            onOpen={next =>
              next === 'edit' ? openModal({ kind: 'edit' }) : openTool(next)
            }
            panel={
              toolBase === 'shape' || toolBase === 'clips' ? toolBase : null
            }
            editing={editingCurrent}
          />
        </div>
      </div>

      <div className="tools">{renderStack(toolLayers, popTool)}</div>

      <div className="modals">
        <div
          className={liveModals.length ? 'modal-scrim is-open' : 'modal-scrim'}
          aria-hidden="true"
          onClick={closeModals}
        />
        {renderStack(modalLayers, popModal)}
      </div>

      <MiniPlayer onExpand={() => setExpanded(true)} />
      <Toast />
      <TrophyBanner onOpen={() => openModal({ kind: 'trophies' })} />
    </div>
  );
}
