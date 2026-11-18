import { useEffect, useRef, useState } from 'react';

import { formatTime } from '@app/lib/player';

import { t } from '../i18n';
import { next, previous, seek, toggle, usePlayer } from '../player';

import { Artwork } from './Artwork';
import { useClipsSummary } from './ClipsForm';
import { useShapeSummary } from './ShapePanel';
import {
  ClipGlyph,
  NextGlyph,
  PencilGlyph,
  PlayPauseGlyph,
  PreviousGlyph,
  ShapeGlyph,
} from './glyphs';

/**
 * The expanded player — the app's console (PlayerConsole.ios) and the site's
 * Songs player: the cover, the title over the subtitle, Apple's media
 * scrubber, the plain transport, and the glass bar with the Shape card. On a
 * desk it is the column beside the library; on a phone it rises over it from
 * the mini player.
 */
export type Panel = 'shape' | 'clips' | 'edit';

/** The sheets' own numbers (SidePanel): how far, or how fast, lets go. */
const DISMISS_PX = 120;
const DISMISS_VELOCITY = 0.6; // px per ms

export function NowPlaying({
  onCollapse,
  onOpen,
  panel,
  editing = false,
}: {
  onCollapse: () => void;
  onOpen: (panel: Panel) => void;
  panel: 'shape' | 'clips' | null;
  editing?: boolean;
}) {
  const current = usePlayer(s => s.current);
  const playing = usePlayer(s => s.playing);
  const position = usePlayer(s => s.position);
  const duration = usePlayer(s => s.duration);
  const summary = useShapeSummary();
  const clipsSummary = useClipsSummary();
  // While the thumb is held, the scrubber shows where it is, not the sound.
  const [dragging, setDragging] = useState<number | null>(null);
  // A phone pulls the player down from anywhere on the console (bar, cover,
  // copy, or open space; buttons join once the finger moves vertically), and
  // eats native vertical touch-scroll so iOS Chrome never triggers browser
  // pull-to-refresh when pulling down from the top.
  const sectionRef = useRef<HTMLElement>(null);
  const onCollapseRef = useRef(onCollapse);
  onCollapseRef.current = onCollapse;

  useEffect(() => {
    const col = sectionRef.current?.closest<HTMLElement>('.now-column');
    if (!col) return;

    let grab: {
      x: number;
      y: number;
      t: number;
      id: number;
      captured: boolean;
    } | null = null;

    const resetTransform = () => {
      col.style.transition = '';
      col.style.transform = '';
    };

    const onTouchMove = (e: TouchEvent) => {
      if (matchMedia('(min-width: 64rem)').matches) return;
      if ((e.target as HTMLElement | null)?.closest('.scrub input')) return;
      if (e.cancelable) e.preventDefault();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (matchMedia('(min-width: 64rem)').matches) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.scrub input')) return;
      const onInteractive = Boolean(
        target?.closest('button, a, input, select, textarea'),
      );
      grab = {
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        id: e.pointerId,
        captured: !onInteractive,
      };
      if (!onInteractive) {
        col.setPointerCapture(e.pointerId);
        col.style.transition = 'none';
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!grab || grab.id !== e.pointerId) return;
      const dx = e.clientX - grab.x;
      const dy = e.clientY - grab.y;
      if (!grab.captured) {
        if (Math.hypot(dx, dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          grab = null;
          return;
        }
        grab.captured = true;
        col.setPointerCapture(e.pointerId);
        col.style.transition = 'none';
      }
      col.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
    };

    const onPointerUp = (e: PointerEvent) => {
      const start = grab;
      grab = null;
      if (!start || !start.captured) return;
      resetTransform();
      const dy = e.clientY - start.y;
      const velocity = dy / Math.max(1, performance.now() - start.t);
      if (dy > DISMISS_PX || (dy > 24 && velocity > DISMISS_VELOCITY)) {
        onCollapseRef.current();
      }
    };

    const onPointerCancel = () => {
      grab = null;
      resetTransform();
    };

    col.addEventListener('touchmove', onTouchMove, { passive: false });
    col.addEventListener('pointerdown', onPointerDown);
    col.addEventListener('pointermove', onPointerMove);
    col.addEventListener('pointerup', onPointerUp);
    col.addEventListener('pointercancel', onPointerCancel);
    return () => {
      col.removeEventListener('touchmove', onTouchMove);
      col.removeEventListener('pointerdown', onPointerDown);
      col.removeEventListener('pointermove', onPointerMove);
      col.removeEventListener('pointerup', onPointerUp);
      col.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [Boolean(current)]);

  if (!current) return null;

  const at = dragging ?? position;
  const total = duration || (current.durationMs ?? 0) / 1000;
  const progress = total ? Math.min(1, at / total) : 0;

  return (
    <section ref={sectionRef} className="now" aria-label={t('player.title')}>
      {/* The sheets' grabber, not a chevron: it says the player is pulled
          down, and a tap on it does the same. */}
      <button type="button" className="collapse" onClick={onCollapse}>
        <span className="grabber" aria-hidden="true" />
        <span className="sr">{t('common.close')}</span>
      </button>

      <div className="now-art">
        <Artwork
          artUrl={current.artUrl}
          name={current.name}
          width={520}
          // The grid's size, almost always in the cache already.
          quickWidth={220}
          eager
        />
      </div>

      <div className="now-copy">
        <span className="now-title">{current.name}</span>
        {current.artist && <span className="now-artist">{current.artist}</span>}
      </div>

      <div className="scrub">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={at}
          aria-label={t('player.position')}
          aria-valuetext={t('player.positionValue', {
            elapsed: formatTime(at),
            total: formatTime(total),
          })}
          style={{ '--progress': progress } as React.CSSProperties}
          onChange={e => setDragging(Number(e.target.value))}
          onPointerUp={e => {
            seek(Number((e.target as HTMLInputElement).value));
            setDragging(null);
          }}
          onKeyUp={e => {
            seek(Number((e.target as HTMLInputElement).value));
            setDragging(null);
          }}
        />
        <span className="time">{formatTime(at)}</span>
        <span className="time end">
          {total ? `-${formatTime(total - at)}` : '-:--'}
        </span>
      </div>

      <div className="transport">
        <button type="button" className="glyph skip" onClick={previous}>
          <PreviousGlyph />
          <span className="sr">{t('player.previous')}</span>
        </button>
        <button type="button" className="glyph play" onClick={toggle}>
          <PlayPauseGlyph playing={playing} />
          <span className="sr">
            {playing ? t('player.pause') : t('player.play')}
          </span>
        </button>
        <button type="button" className="glyph skip" onClick={next}>
          <NextGlyph />
          <span className="sr">{t('player.next')}</span>
        </button>
      </div>

      <div className="dock">
        <button
          type="button"
          className="dock-cell"
          aria-expanded={panel === 'shape'}
          onClick={() => onOpen('shape')}
        >
          <span className="dock-icon">
            <ShapeGlyph />
          </span>
          <span className="dock-copy">
            <span className="dock-label">{t('player.shape.title')}</span>
            <span className="dock-summary">{summary}</span>
          </span>
        </button>
        <button
          type="button"
          className="dock-cell"
          aria-expanded={panel === 'clips'}
          onClick={() => onOpen('clips')}
        >
          <span className="dock-icon">
            <ClipGlyph />
          </span>
          <span className="dock-copy">
            <span className="dock-label">{t('player.clips.title')}</span>
            <span className="dock-summary">{clipsSummary}</span>
          </span>
        </button>
        {/* EDIT, the bar's third compartment: an icon and one word, hugging
            what it holds — it has no live state to summarise. */}
        <button
          type="button"
          className="dock-cell is-hug"
          aria-expanded={editing}
          aria-label={t('player.menu.edit')}
          onClick={() => onOpen('edit')}
        >
          <span className="dock-icon">
            <PencilGlyph />
          </span>
          <span className="dock-label">{t('player.menu.editShort')}</span>
        </button>
      </div>
    </section>
  );
}
