import { useState } from 'react';

import { formatTime } from '@app/lib/player';

import { t } from '../i18n';
import { next, previous, seek, toggle, usePlayer } from '../player';

import { Artwork } from './Artwork';
import { useClipsSummary } from './ClipsForm';
import {
  ClipGlyph,
  CloseGlyph,
  NextGlyph,
  PencilGlyph,
  PlayPauseGlyph,
  PreviousGlyph,
  ShapeGlyph,
} from './glyphs';
import { useShapeSummary } from './ShapePanel';

/**
 * The expanded player — the app's console (PlayerConsole.ios) and the site's
 * Songs player: the cover, the title over the subtitle, Apple's media
 * scrubber, the plain transport, and the glass bar with the Shape card. On a
 * desk it is the column beside the library; on a phone it rises over it from
 * the mini player.
 */
export type Panel = 'shape' | 'clips' | 'edit';

function NowScrubber({
  fallbackDurationMs,
  active,
}: {
  fallbackDurationMs: number | null;
  active: boolean;
}) {
  const position = usePlayer(s => (active ? s.position : 0));
  const duration = usePlayer(s => s.duration);
  // While the thumb is held, the scrubber shows where it is, not the sound.
  const [dragging, setDragging] = useState<number | null>(null);

  const at = dragging ?? position;
  const total = duration || (fallbackDurationMs ?? 0) / 1000;
  const progress = total ? Math.min(1, at / total) : 0;

  return (
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
  );
}

export function NowPlaying({
  onCollapse,
  onOpen,
  panel,
  editing = false,
  active = true,
}: {
  onCollapse: () => void;
  onOpen: (panel: Panel) => void;
  panel: 'shape' | 'clips' | null;
  editing?: boolean;
  active?: boolean;
}) {
  const current = usePlayer(s => s.current);
  const playing = usePlayer(s => s.playing);
  const summary = useShapeSummary();
  const clipsSummary = useClipsSummary(active);

  if (!current) return null;

  return (
    <>
      <div className="stage-bar">
        <button
          type="button"
          className="round stage-close-mobile"
          onClick={onCollapse}
        >
          <CloseGlyph />
          <span className="sr">{t('common.close')}</span>
        </button>
      </div>

      <section className="now" aria-label={t('player.title')}>
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
          <span className="now-artist">{current.artist}</span>
        </div>

        <NowScrubber fallbackDurationMs={current.durationMs} active={active} />

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
    </>
  );
}
