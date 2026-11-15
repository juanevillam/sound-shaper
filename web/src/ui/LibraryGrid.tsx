import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';

import { positionForMove, renormalized } from '@app/lib/gridOrder';
import { DRAG_ACTIVE_SCALE } from '@app/ui/dragMetrics';

import { t } from '../i18n';
import type { Sound } from '../library';
import { playSound, usePlayer } from '../player';
import { moveSound, renormalizeOrder, setAddTilePosition } from '../sounds';

import { Artwork } from './Artwork';
import { Bars, PlusGlyph } from './glyphs';
import { showToast } from './Toast';

/** The grid draws a tile at most this wide; Cloudinary serves 2x of it. */
const TILE_WIDTH = 220;

/** The add tile's key in the order — the app's `ADD_TILE_KEY`. */
const ADD_KEY = '__add__';

/** How long a press is held before the tile lifts: the app's long press. */
const HOLD_MS = 400;

/** How far a press may wander before it is a scroll, not a hold. */
const SLOP_PX = 8;

/** Within this of the scroller's edge, a dragged tile scrolls the grid. */
const EDGE_PX = 72;

type Cell =
  | { key: string; kind: 'sound'; sound: Sound; position: number | null }
  | { key: string; kind: 'add'; position: number | null };

/**
 * The app's `toGridCells`: the sounds in their order, with the add tile
 * placed by its own position — first while nobody has moved it.
 */
const toCells = (sounds: Sound[], addTilePosition: number | null): Cell[] => {
  const cells: Cell[] = sounds.map(sound => ({
    key: sound.id,
    kind: 'sound',
    sound,
    position: sound.position,
  }));
  const add: Cell = { key: ADD_KEY, kind: 'add', position: addTilePosition };

  if (addTilePosition === null) return [add, ...cells];

  const slot = cells.findIndex(
    cell => cell.position !== null && cell.position > addTilePosition,
  );

  return slot === -1
    ? [...cells, add]
    : [...cells.slice(0, slot), add, ...cells.slice(slot)];
};

const SoundTile = ({ sound }: { sound: Sound }) => {
  const isCurrent = usePlayer(s => s.loaded && s.current?.id === sound.id);
  const playing = usePlayer(s => s.playing);
  const rate = usePlayer(s => s.rate);

  return (
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
  );
};

/**
 * The app's add tile: the empty-media box with a plus, "Add Sound" under it
 * and the one rule the picker enforces.
 */
const AddTile = ({ onPick }: { onPick: (file: File) => void }) => {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
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
    </>
  );
};

/** What scrolls the grid: the desk's library column, else the page. */
const scrollerOf = (el: HTMLElement): HTMLElement => {
  const library = el.closest<HTMLElement>('.library');
  if (library && library.scrollHeight > library.clientHeight + 1)
    return library;
  return document.scrollingElement as HTMLElement;
};

type Drag = {
  key: string;
  pointerId: number;
  /** Where the press went down, and where it is now (client px). */
  x0: number;
  y0: number;
  x: number;
  y: number;
  /** The press inside the tile, so the tile stays under the same spot. */
  grabX: number;
  grabY: number;
  width: number;
  height: number;
  timer: ReturnType<typeof setTimeout> | null;
  lifted: boolean;
  /** The order when it lifted, to tell a move from a hold. */
  from: number;
  scroller: HTMLElement | null;
  frame: number;
};

/**
 * THE LIBRARY, IN THE PERSON'S OWN HAND ORDER — the app's sortable grid.
 * Hold a tile and move it anywhere, across columns as well as rows; the add
 * tile is a cell in that order too. Hold and RELEASE without moving opens the
 * sound's editor, as the app's does (iOS's own Home Screen split: hold and
 * release is the menu, hold and move rearranges).
 *
 * A move writes ONE document (`lib/gridOrder.ts`'s fractional index), so two
 * devices dragging at once merge instead of interleaving.
 */
export function LibraryGrid({
  sounds,
  addTilePosition,
  onPick,
  onEdit,
}: {
  sounds: Sound[];
  addTilePosition: number | null;
  onPick: (file: File) => void;
  onEdit: (sound: Sound) => void;
}) {
  const cells = useMemo(
    () => toCells(sounds, addTilePosition),
    [sounds, addTilePosition],
  );
  const byKey = useMemo(
    () => new Map(cells.map(cell => [cell.key, cell])),
    [cells],
  );

  /** The order while a tile is held, and until the snapshot agrees. */
  const [order, setOrder] = useState<string[] | null>(null);
  const orderRef = useRef<string[] | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const keys = order ?? cells.map(cell => cell.key);

  const list = useRef<HTMLUListElement>(null);
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  const slots = useRef(new Map<string, { left: number; top: number }>());
  const anims = useRef(new Map<string, Animation>());

  useEffect(() => {
    if (entered) return;
    const id = setTimeout(() => setEntered(true), 750);
    return () => clearTimeout(id);
  }, [entered]);

  // Once the snapshot carries the order the drop wrote, it is the truth again.
  const live = cells.map(cell => cell.key).join('|');
  useEffect(() => {
    if (order && !lifted && order.join('|') === live) {
      orderRef.current = null;
      setOrder(null);
    }
  }, [live, order, lifted]);

  const items = () => [...(list.current?.children ?? [])] as HTMLLIElement[];

  const snapshotSlots = () => {
    slots.current.clear();
    for (const li of items()) {
      const key = li.dataset.key;
      if (key) {
        slots.current.set(key, { left: li.offsetLeft, top: li.offsetTop });
      }
    }
  };

  /** Keep the held tile under the pointer, wherever its slot now is. */
  const follow = () => {
    const d = drag.current;
    const host = list.current;
    if (!d?.lifted || !host) return;
    const li = items().find(el => el.dataset.key === d.key);
    if (!li) return;
    const running = anims.current.get(d.key);
    if (running) {
      running.cancel();
      anims.current.delete(d.key);
    }
    const hostRect = host.getBoundingClientRect();
    const slotLeft = hostRect.left + li.offsetLeft;
    const slotTop = hostRect.top + li.offsetTop;
    const dx = d.x - d.grabX - slotLeft;
    const dy = d.y - d.grabY - slotTop;
    const scale = matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : DRAG_ACTIVE_SCALE;
    li.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
  };

  /**
   * Hit-test by untransformed layout slot index (`offsetLeft`/`offsetTop`),
   * never `getBoundingClientRect()` (which moves with in-flight FLIP
   * animations and causes rapid back-and-forth oscillation).
   */
  const retarget = () => {
    const d = drag.current;
    const host = list.current;
    if (!d?.lifted || !host) return;
    const hostRect = host.getBoundingClientRect();
    const listItems = items();
    const to = listItems.findIndex(el => {
      const w = el.offsetWidth;
      const h = Math.max(el.offsetHeight, d.height);
      const ix = w * 0.12;
      const iy = h * 0.12;
      const left = hostRect.left + el.offsetLeft + ix;
      const right = hostRect.left + el.offsetLeft + w - ix;
      const top = hostRect.top + el.offsetTop + iy;
      const bottom = hostRect.top + el.offsetTop + h - iy;
      return d.x >= left && d.x <= right && d.y >= top && d.y <= bottom;
    });
    if (to === -1) return;
    const current = orderRef.current ?? keys;
    const from = current.indexOf(d.key);
    if (from === -1 || from === to) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, d.key);
    orderRef.current = next;
    flushSync(() => {
      setOrder(next);
    });
  };

  // Every tile that changed slot glides from where it was (interruptible FLIP);
  // the held one is placed under the pointer instead.
  useLayoutEffect(() => {
    const host = list.current;
    if (!host) return;
    if (!drag.current?.lifted) {
      snapshotSlots();
      return;
    }
    const hostRect = host.getBoundingClientRect();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const li of items()) {
      const key = li.dataset.key ?? '';
      const now = { left: li.offsetLeft, top: li.offsetTop };
      const was = slots.current.get(key);
      slots.current.set(key, now);
      if (!was || key === drag.current.key || reduce) continue;
      let dx = was.left - now.left;
      let dy = was.top - now.top;
      if (!dx && !dy) continue;

      const prevAnim = anims.current.get(key);
      if (prevAnim && prevAnim.playState === 'running') {
        const r = li.getBoundingClientRect();
        const tx = r.left - hostRect.left - now.left;
        const ty = r.top - hostRect.top - now.top;
        dx = was.left - now.left + tx;
        dy = was.top - now.top + ty;
        prevAnim.cancel();
      }
      if (!dx && !dy) continue;

      const anim = li.animate(
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0)` },
          { transform: 'none' },
        ],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
      anim.onfinish = () => {
        if (anims.current.get(key) === anim) anims.current.delete(key);
      };
      anims.current.set(key, anim);
    }
    follow();
  });

  const autoScroll = () => {
    const d = drag.current;
    if (!d?.lifted || !d.scroller) return;
    const scroller = d.scroller;
    const page = scroller === document.scrollingElement;
    const top = page ? 0 : scroller.getBoundingClientRect().top;
    const bottom = page
      ? window.innerHeight
      : scroller.getBoundingClientRect().bottom;
    const step =
      d.y < top + EDGE_PX
        ? -Math.ceil(((top + EDGE_PX - d.y) / EDGE_PX) * 14)
        : d.y > bottom - EDGE_PX
          ? Math.ceil(((d.y - (bottom - EDGE_PX)) / EDGE_PX) * 14)
          : 0;
    if (step) {
      scroller.scrollTop += step;
      retarget();
      follow();
    }
    d.frame = requestAnimationFrame(autoScroll);
  };

  const end = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.timer) clearTimeout(d.timer);
    cancelAnimationFrame(d.frame);
    if (!d.lifted) return;

    swallowClick.current = true;
    const li = items().find(el => el.dataset.key === d.key);
    // Settle into the slot from wherever the pointer left it, staying above
    // neighbours until it lands.
    if (li) {
      const from = li.style.transform;
      li.style.transform = '';
      if (from) {
        li.style.zIndex = '5';
        const anim = li.animate([{ transform: from }, { transform: 'none' }], {
          duration: 220,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        });
        anim.onfinish = () => {
          li.style.zIndex = '';
          if (anims.current.get(d.key) === anim) anims.current.delete(d.key);
        };
        anims.current.set(d.key, anim);
      }
    }
    setLifted(null);

    const final = orderRef.current ?? order ?? keys;
    const to = final.indexOf(d.key);
    if (!commit || to === d.from) {
      orderRef.current = null;
      setOrder(null);
      // A hold that never moved is the editor's door, as in the app.
      const cell = byKey.get(d.key);
      if (commit && cell?.kind === 'sound') onEdit(cell.sound);
      return;
    }

    void persist(final, to, d.key);
  };

  const persist = async (final: string[], to: number, key: string) => {
    const data = final.map(k => ({
      id: k,
      position: byKey.get(k)?.position ?? null,
    }));
    try {
      const position = positionForMove(data, to);
      if (position === null) {
        // Float64 ran out of room between the two neighbours: re-space all.
        await renormalizeOrder(renormalized(data), ADD_KEY);
      } else if (key === ADD_KEY) await setAddTilePosition(position);
      else await moveSound(key, position);
    } catch (error) {
      console.warn('reorder', error);
      showToast(t('snackbar.reorder-failed'));
      orderRef.current = null;
      setOrder(null);
    }
  };

  // The press is followed on the window, so it survives leaving the tile.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.lifted) {
        if (Math.hypot(d.x - d.x0, d.y - d.y0) > SLOP_PX) end(false);
        return;
      }
      e.preventDefault();
      retarget();
      follow();
    };
    const up = (e: PointerEvent) => {
      if (drag.current?.pointerId === e.pointerId) end(true);
    };
    const cancel = (e: PointerEvent) => {
      if (drag.current?.pointerId === e.pointerId) end(false);
    };
    // A lifted tile owns the finger: the page must not scroll under it.
    const touch = (e: TouchEvent) => {
      if (drag.current?.lifted) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.current?.lifted) {
        e.stopPropagation();
        end(false);
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', touch, { passive: false });
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', touch);
      window.removeEventListener('keydown', key, true);
    };
  });

  const press = (e: React.PointerEvent<HTMLLIElement>, key: string) => {
    if (e.button !== 0 || drag.current) return;
    const li = e.currentTarget;
    const r = li.getBoundingClientRect();
    const d: Drag = {
      key,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      grabX: e.clientX - r.left,
      grabY: e.clientY - r.top,
      width: r.width,
      height: r.height,
      timer: null,
      lifted: false,
      from: keys.indexOf(key),
      scroller: null,
      frame: 0,
    };
    d.timer = setTimeout(() => {
      d.timer = null;
      snapshotSlots();
      d.lifted = true;
      d.scroller = scrollerOf(li);
      navigator.vibrate?.(10);
      const initial = [...keys];
      orderRef.current = initial;
      flushSync(() => {
        setOrder(initial);
        setLifted(key);
      });
      follow();
      d.frame = requestAnimationFrame(autoScroll);
    }, HOLD_MS);
    drag.current = d;
  };

  const tile = (cell: Cell): ReactNode =>
    cell.kind === 'add' ? (
      <AddTile onPick={onPick} />
    ) : (
      <SoundTile sound={cell.sound} />
    );

  const gridClass = [
    'grid',
    entered ? 'is-entered' : '',
    lifted ? 'is-sorting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ul
      ref={list}
      className={gridClass}
      onClickCapture={e => {
        // The release that ends a drag or a hold is not a tap on the tile.
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={e => {
        if (drag.current) e.preventDefault();
      }}
    >
      {keys.map((key, i) => {
        const cell = byKey.get(key);
        if (!cell) return null;
        return (
          <li
            key={key}
            data-key={key}
            className={lifted === key ? 'is-lifted' : undefined}
            style={
              {
                '--i': Math.min(i, 24),
                viewTransitionName:
                  key === ADD_KEY ? 'tile-add' : `tile-${key}`,
              } as React.CSSProperties
            }
            onPointerDown={e => press(e, key)}
          >
            {tile(cell)}
          </li>
        );
      })}
    </ul>
  );
}
