import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { formatTime } from '@app/lib/player';

import type { Clip } from '../clips';
import { noteClipSaved } from '../trophies';
import { t } from '../i18n';
import type { Sound } from '../library';
import { cue, pause, playClip, scrubTo, usePlayer } from '../player';
import { levelAt, useWaveform, type Waveform } from '../waveform';

import { PlayPauseGlyph } from './glyphs';

/**
 * THE CLIP EDITOR — the app's ClipTrimEditor (Voice Memos' trim anatomy,
 * producing a clip) on the web: a ZOOMED waveform panning under a fixed
 * centred playhead at 100px a second, the ruler panning with it, the
 * selection as a wash between two draggable edge lines; a full-track
 * OVERVIEW carrying the selection frame; the large timecode; ±15 and play.
 * The scale never changes — the waveform moves, the coordinates stand still.
 */

// The app's constants, at the web's px for its pt.
const PPS = 100;
const WAVE_HEIGHT = 200;
const RULER_HEIGHT = 28;
const BAND_BOTTOM_PAD = 10;
const WAVE_INK_RATIO = 0.78;
const WAVE_BAR_ALPHA = 0.6;
const BAR_PITCH = 4.5;
const BAR_WIDTH = 2;
const TRACK_EDGE_PAD = 40;
const EDGE_TOUCH = 22;
const OVERVIEW_HEIGHT = 56;
const OVERVIEW_BAR_PITCH = 2.5;
const OVERVIEW_BAR_WIDTH = 1.5;
const CAP_WIDTH = 14;
const MIN_GAP_S = 1;
const SKIP_S = 15;
const BONE_LEVEL = 0.18;

// Selection is the one accent on the surface — it marks a SELECTION, which
// is what the accent is kept for; the playhead is the instrument, in red.
const INK = '245 245 245';
const ACCENT = '10 132 255';
const PLAYHEAD = '#ff453a';
const PANEL = 'rgb(255 255 255 / 0.075)';
const MUTED = 'rgb(235 235 245 / 0.6)';

/** A canvas sized to its box at the device's pixel ratio. */
const useCanvas = (height: number) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const context = () => {
    const canvas = ref.current;
    if (!canvas || !width) return null;
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== width * ratio) {
      canvas.width = width * ratio;
      canvas.height = height * ratio;
    }
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx?.clearRect(0, 0, width, height);
    return ctx;
  };

  return { ref, width, context };
};

type Drag =
  | { kind: 'scrub'; x0: number; base: number; head: number }
  | { kind: 'start' | 'end' }
  | { kind: 'seek'; head: number };

export function ClipEditor({
  sound,
  clip,
  onDone,
}: {
  sound: Sound;
  clip: Clip | null;
  onDone: () => void;
}) {
  const wave = useWaveform(sound.id, sound.audioUrl);
  const position = usePlayer(s => s.position);
  const playing = usePlayer(s => s.playing);
  const engineDuration = usePlayer(s => s.duration);
  const duration = Math.max(
    1,
    engineDuration || (sound.durationMs ?? 0) / 1000,
  );

  // Entry pauses and frames the playhead −7 … +8, as the app's editor does;
  // a clip being edited opens on its own range with the playhead at its start.
  const [range, setRange] = useState<[number, number]>(() =>
    clip
      ? [clip.startMs / 1000, clip.endMs / 1000]
      : [Math.max(0, position - 7), Math.min(duration, position + 8)],
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const [start, end] = range;

  useEffect(() => {
    cue(sound);
    pause();
    if (clip) scrubTo(clip.startMs / 1000);
    // Once, on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const head =
    drag && (drag.kind === 'scrub' || drag.kind === 'seek')
      ? drag.head
      : position;

  const play = () => {
    if (playing) return pause();
    const inside = head >= start && head < end - 0.25;
    void playClip(
      sound.id,
      { id: 'trim', startMs: start * 1000, endMs: end * 1000 },
      { from: inside ? head : undefined, once: true },
    );
  };

  const skip = (by: number) =>
    scrubTo(Math.min(Math.max(head + by, 0), duration));

  const setEdge = (edge: 'start' | 'end', seconds: number) =>
    setRange(([s, e]) =>
      edge === 'start'
        ? [Math.min(Math.max(seconds, 0), e - MIN_GAP_S), e]
        : [s, Math.max(Math.min(seconds, duration), s + MIN_GAP_S)],
    );

  return (
    <div className="editor">
      <Band
        waveform={wave.state === 'ready' ? wave.waveform : null}
        failed={wave.state === 'failed'}
        duration={duration}
        head={head}
        start={start}
        end={end}
        drag={drag}
        setDrag={setDrag}
        setEdge={setEdge}
      />

      <div className="editor-overview">
        <Overview
          waveform={wave.state === 'ready' ? wave.waveform : null}
          duration={duration}
          head={head}
          start={start}
          end={end}
          setDrag={setDrag}
          setEdge={setEdge}
        />
        <div className="editor-caption">
          <span>{formatTime(start)}</span>
          <span>{formatTime(end - start)}</span>
          <span>{formatTime(end)}</span>
        </div>
      </div>

      {/* The handles, for a keyboard and a screen reader. */}
      <input
        className="sr"
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={start}
        aria-label={t('player.clips.startHandle')}
        aria-valuetext={formatTime(start)}
        onChange={e => setEdge('start', Number(e.target.value))}
      />
      <input
        className="sr"
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={end}
        aria-label={t('player.clips.endHandle')}
        aria-valuetext={formatTime(end)}
        onChange={e => setEdge('end', Number(e.target.value))}
      />

      <div className="editor-timecode" aria-live="off">
        {formatTime(head)}
      </div>

      <div className="transport">
        <button
          type="button"
          className="glyph skip15"
          onClick={() => skip(-SKIP_S)}
        >
          <SkipGlyph back />
          <span className="sr">
            {t('player.clips.skipBack', { s: String(SKIP_S) })}
          </span>
        </button>
        <button type="button" className="glyph play" onClick={play}>
          <PlayPauseGlyph playing={playing} />
          <span className="sr">
            {playing ? t('player.pause') : t('player.play')}
          </span>
        </button>
        <button
          type="button"
          className="glyph skip15"
          onClick={() => skip(SKIP_S)}
        >
          <SkipGlyph />
          <span className="sr">
            {t('player.clips.skipForward', { s: String(SKIP_S) })}
          </span>
        </button>
      </div>

      <EditorCommit
        range={range}
        clip={clip}
        soundId={sound.id}
        onDone={onDone}
      />
    </div>
  );
}

// The commit lives in the sheet's bar; this hands Home what it needs.
let commit: (() => void) | null = null;
export const commitClipEditor = () => commit?.();

const EditorCommit = ({
  range,
  clip,
  soundId,
  onDone,
}: {
  range: [number, number];
  clip: Clip | null;
  soundId: string;
  onDone: () => void;
}) => {
  useEffect(() => {
    commit = async () => {
      const { createClip, updateClip } = await import('../clips');
      const value = { startMs: range[0] * 1000, endMs: range[1] * 1000 };
      if (clip) void updateClip(soundId, clip.id, value);
      else {
        void createClip(soundId, value);
        // Re-framing moves the range and nothing else; only a new clip
        // counts toward Clipper and Splicer.
        noteClipSaved();
      }
      pause();
      onDone();
    };
    return () => {
      commit = null;
    };
  });
  return null;
};

function Band({
  waveform,
  failed,
  duration,
  head,
  start,
  end,
  drag,
  setDrag,
  setEdge,
}: {
  waveform: Waveform | null;
  failed: boolean;
  duration: number;
  head: number;
  start: number;
  end: number;
  drag: Drag | null;
  setDrag: (drag: Drag | null) => void;
  setEdge: (edge: 'start' | 'end', seconds: number) => void;
}) {
  const height = WAVE_HEIGHT + RULER_HEIGHT + BAND_BOTTOM_PAD;
  const { ref, width, context } = useCanvas(height);

  useLayoutEffect(() => {
    const ctx = context();
    if (!ctx) return;
    const mid = width / 2;
    const x = (s: number) => mid + (s - head) * PPS;

    // The track's panel, overhanging its ends so the first bar breathes.
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(
      x(0) - TRACK_EDGE_PAD,
      0,
      duration * PPS + TRACK_EDGE_PAD * 2,
      height,
      16,
    );
    ctx.fill();

    // The selection's wash.
    ctx.fillStyle = `rgb(${ACCENT} / 0.16)`;
    ctx.fillRect(x(start), 0, (end - start) * PPS, WAVE_HEIGHT);

    // Bars, or the bone while the decode runs.
    const fromS = Math.max(0, head - mid / PPS);
    const toS = Math.min(duration, head + mid / PPS);
    const pitchS = BAR_PITCH / PPS;
    ctx.fillStyle = `rgb(${INK} / ${WAVE_BAR_ALPHA})`;
    for (let k = Math.floor(fromS / pitchS); k * pitchS < toS; k += 1) {
      const s = k * pitchS;
      const level = waveform
        ? levelAt(waveform, s, s + pitchS)
        : failed
          ? 0
          : BONE_LEVEL;
      const h = Math.max(2, level * WAVE_HEIGHT * WAVE_INK_RATIO);
      ctx.fillRect(x(s), (WAVE_HEIGHT - h) / 2, BAR_WIDTH, h);
    }

    // The ruler: a second per label, one minor tick at the half.
    ctx.fillStyle = MUTED;
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let s = Math.floor(fromS * 2) / 2; s <= toS; s += 0.5) {
      const whole = Number.isInteger(s);
      ctx.fillRect(x(s) - 0.5, WAVE_HEIGHT, 1, whole ? 8 : 4);
      if (whole) ctx.fillText(formatTime(s), x(s), WAVE_HEIGHT + 22);
    }

    // The edges.
    ctx.fillStyle = `rgb(${ACCENT})`;
    for (const s of [start, end]) {
      ctx.beginPath();
      ctx.roundRect(x(s) - 1.5, 0, 3, WAVE_HEIGHT, 1.5);
      ctx.fill();
    }

    // The playhead: a line with Voice Memos' dots, over a ground-coloured
    // halo so the bars never strobe against it.
    ctx.fillStyle = 'rgb(13 13 13 / 0.6)';
    ctx.fillRect(mid - 3, 0, 6, WAVE_HEIGHT);
    ctx.fillStyle = PLAYHEAD;
    ctx.fillRect(mid - 1, 0, 2, WAVE_HEIGHT);
    for (const y of [5, WAVE_HEIGHT - 5]) {
      ctx.beginPath();
      ctx.arc(mid, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (failed) {
      ctx.fillStyle = MUTED;
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        t('player.clips.waveformUnavailable'),
        mid,
        WAVE_HEIGHT / 2 - 24,
      );
    }
  });

  const timeAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return head + (clientX - rect.left - width / 2) / PPS;
  };

  return (
    <canvas
      ref={ref}
      className={drag ? 'editor-band is-dragging' : 'editor-band'}
      style={{ height }}
      aria-hidden="true"
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const xs = width / 2 + (start - head) * PPS;
        const xe = width / 2 + (end - head) * PPS;
        if (Math.abs(px - xe) <= EDGE_TOUCH) setDrag({ kind: 'end' });
        else if (Math.abs(px - xs) <= EDGE_TOUCH) setDrag({ kind: 'start' });
        else setDrag({ kind: 'scrub', x0: e.clientX, base: head, head });
      }}
      onPointerMove={e => {
        if (!drag) return;
        if (drag.kind === 'start' || drag.kind === 'end')
          setEdge(drag.kind, timeAt(e.clientX));
        else if (drag.kind === 'scrub')
          setDrag({
            ...drag,
            head: Math.min(
              Math.max(drag.base - (e.clientX - drag.x0) / PPS, 0),
              duration,
            ),
          });
      }}
      onPointerUp={() => {
        if (drag?.kind === 'scrub') scrubTo(drag.head);
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}
    />
  );
}

function Overview({
  waveform,
  duration,
  head,
  start,
  end,
  setDrag,
  setEdge,
}: {
  waveform: Waveform | null;
  duration: number;
  head: number;
  start: number;
  end: number;
  setDrag: (drag: Drag | null) => void;
  setEdge: (edge: 'start' | 'end', seconds: number) => void;
}) {
  const { ref, width, context } = useCanvas(OVERVIEW_HEIGHT);
  const [held, setHeld] = useState<'start' | 'end' | 'seek' | null>(null);
  // The frame's caps stand outside the range, so the track sits inset by one.
  const inner = Math.max(1, width - CAP_WIDTH * 2);
  const x = (s: number) => CAP_WIDTH + (s / duration) * inner;

  useLayoutEffect(() => {
    const ctx = context();
    if (!ctx) return;

    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, OVERVIEW_HEIGHT, 8);
    ctx.fill();

    ctx.fillStyle = `rgb(${INK} / 0.5)`;
    const bars = Math.floor(inner / OVERVIEW_BAR_PITCH);
    const pitchS = (OVERVIEW_BAR_PITCH / inner) * duration;
    for (let i = 0; i < bars; i += 1) {
      const level = waveform
        ? levelAt(waveform, i * pitchS, (i + 1) * pitchS)
        : BONE_LEVEL;
      const h = Math.max(1.5, level * (OVERVIEW_HEIGHT - 12));
      ctx.fillRect(
        CAP_WIDTH + i * OVERVIEW_BAR_PITCH,
        (OVERVIEW_HEIGHT - h) / 2,
        OVERVIEW_BAR_WIDTH,
        h,
      );
    }

    // The selection frame: rails top and bottom, a cap at each end with a
    // chevron pointing in — the app's ClipTrimFrame.
    const left = x(start) - CAP_WIDTH;
    const right = x(end) + CAP_WIDTH;
    ctx.fillStyle = `rgb(${ACCENT})`;
    ctx.beginPath();
    ctx.roundRect(left, 0, right - left, OVERVIEW_HEIGHT, 7);
    ctx.roundRect(x(start), 4, x(end) - x(start), OVERVIEW_HEIGHT - 8, 2);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const mid = OVERVIEW_HEIGHT / 2;
    ctx.beginPath();
    ctx.moveTo(left + 9, mid - 5);
    ctx.lineTo(left + 5, mid);
    ctx.lineTo(left + 9, mid + 5);
    ctx.moveTo(right - 9, mid - 5);
    ctx.lineTo(right - 5, mid);
    ctx.lineTo(right - 9, mid + 5);
    ctx.stroke();

    ctx.fillStyle = PLAYHEAD;
    ctx.fillRect(x(head) - 1, 2, 2, OVERVIEW_HEIGHT - 4);
  });

  const timeAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return ((clientX - rect.left - CAP_WIDTH) / inner) * duration;
  };

  return (
    <canvas
      ref={ref}
      className="editor-strip"
      style={{ height: OVERVIEW_HEIGHT }}
      aria-hidden="true"
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
        if (Math.abs(px - (x(end) + CAP_WIDTH / 2)) <= CAP_WIDTH + 8)
          setHeld('end');
        else if (Math.abs(px - (x(start) - CAP_WIDTH / 2)) <= CAP_WIDTH + 8)
          setHeld('start');
        else {
          setHeld('seek');
          setDrag({ kind: 'seek', head: timeAt(e.clientX) });
        }
      }}
      onPointerMove={e => {
        if (held === 'start' || held === 'end')
          setEdge(held, timeAt(e.clientX));
        else if (held === 'seek')
          setDrag({
            kind: 'seek',
            head: Math.min(Math.max(timeAt(e.clientX), 0), duration),
          });
      }}
      onPointerUp={e => {
        if (held === 'seek')
          scrubTo(Math.min(Math.max(timeAt(e.clientX), 0), duration));
        setHeld(null);
        setDrag(null);
      }}
      onPointerCancel={() => {
        setHeld(null);
        setDrag(null);
      }}
    />
  );
}

/** Apple's gobackward.15 / goforward.15: an open arrow round the number. */
const SkipGlyph = ({ back }: { back?: boolean }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <g transform={back ? 'matrix(-1 0 0 1 32 0)' : undefined}>
      <path
        d="M16 5.5A10.5 10.5 0 1 0 26.5 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M15 1.8 20.4 5.5 15 9.2Z" fill="currentColor" />
    </g>
    <text
      x="16"
      y="20"
      textAnchor="middle"
      fontSize="10"
      fontWeight="700"
      fill="currentColor"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      15
    </text>
  </svg>
);
