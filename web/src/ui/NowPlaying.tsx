import { useRef, useState } from 'react';

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
  // A phone pulls the player down by its grabber, cover or title, as the
  // app's sheet goes down under a finger. The column follows the finger
  // directly — no render per frame.
  const grab = useRef<{ y: number; t: number; id: number } | null>(null);
  const column = (e: React.PointerEvent) =>
    (e.currentTarget as HTMLElement).closest<HTMLElement>('.now-column');

  if (!current) return null;

  const at = dragging ?? position;
  const total = duration || (current.durationMs ?? 0) / 1000;
  const progress = total ? Math.min(1, at / total) : 0;

  return (
    <section
      className="now"
      aria-label={t('player.title')}
      onPointerDown={e => {
        if (
          !(e.target as HTMLElement).closest('.collapse, .now-art, .now-copy')
        )
          return;
        if (matchMedia('(min-width: 64rem)').matches) return;
        grab.current = { y: e.clientY, t: performance.now(), id: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
        const col = column(e);
        if (col) col.style.transition = 'none';
      }}
      onPointerMove={e => {
        if (grab.current?.id !== e.pointerId) return;
        const dy = e.clientY - grab.current.y;
        const col = column(e);
        if (col) col.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
      }}
      onPointerUp={e => {
        const start = grab.current;
        grab.current = null;
        if (!start) return;
        const col = column(e);
        if (col) {
          col.style.transition = '';
          col.style.transform = '';
        }
        const dy = e.clientY - start.y;
        const velocity = dy / Math.max(1, performance.now() - start.t);
        if (dy > DISMISS_PX || (dy > 24 && velocity > DISMISS_VELOCITY))
          onCollapse();
      }}
      onPointerCancel={e => {
        grab.current = null;
        const col = column(e);
        if (col) {
          col.style.transition = '';
          col.style.transform = '';
        }
      }}
    >
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
