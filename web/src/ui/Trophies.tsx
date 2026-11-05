import { useEffect, useRef, useState } from 'react';

import platinumChime from '@app/../assets/sounds/trophy-platinum.mp3';
import trophyChime from '@app/../assets/sounds/trophy.mp3';
import {
  LIBRARY_SOUND_COUNT,
  LISTENING_MINUTES,
  SAVED_CLIP_COUNT,
  TROPHY_CONFIGS,
  TROPHY_IDS,
  TROPHY_TITLES,
} from '@app/constants/trophies';
import { useTrophyStore } from '@app/trophies/store';
import { tierColor } from '@app/trophies/tierColors';
import type {
  ResolvedTrophy,
  TrophyCopy,
  TrophyTier,
} from '@app/trophies/types';
import { useTrophies } from '@app/trophies/useTrophies';
import { createPortal } from 'react-dom';

import { locale, t } from '../i18n';
import { pause, playerState, toggle } from '../player';

import { ChevronRightGlyph, CloseGlyph } from './glyphs';

/* ── Copy ── */

const COUNTS: Record<string, number> = {
  [TROPHY_IDS.library]: LIBRARY_SOUND_COUNT,
  [TROPHY_IDS.savedClips]: SAVED_CLIP_COUNT,
  [TROPHY_IDS.listening]: LISTENING_MINUTES,
};

/**
 * The app's `useTrophyContent`: the titles are English everywhere (the "-er"
 * wordplay does not translate), the objectives are localized with their
 * counts filled from the same thresholds the triggers use. The web resolves
 * its strings once per page, so this is a constant.
 */
const COPY: Record<string, TrophyCopy> = Object.fromEntries(
  TROPHY_CONFIGS.map(({ id }) => [
    id,
    {
      title: TROPHY_TITLES[id] ?? id,
      description: t(`trophies.items.${id}.description`, {
        count: String(COUNTS[id] ?? ''),
      }),
    },
  ]),
);

const tierName = (tier: TrophyTier) => t(`trophies.tier.${tier}`);

const formatDate = (achievedAt: number) =>
  new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(achievedAt));

/** "Gold · Earned Oct 17, 2026" or "Gold · Locked" — the detail's caption. */
const caption = (trophy: ResolvedTrophy) =>
  trophy.unlocked && trophy.achievedAt !== null
    ? `${tierName(trophy.tier)} · ${t('trophies.earned')} ${formatDate(trophy.achievedAt)}`
    : `${tierName(trophy.tier)} · ${t('trophies.locked')}`;

/* ── The glyph ── */

// The app's `TrophyIcon` paths, verbatim: a cup, or a padlock while locked.
const TROPHY_PATH =
  'M18 2H6v1H3a1 1 0 0 0-1 1v2a4 4 0 0 0 4 4h.55A6 6 0 0 0 11 13.91V17H8.5a1 1 0 0 0-1 1H7a1 1 0 0 0-1 1v1h12v-1a1 1 0 0 0-1-1h-.5a1 1 0 0 0-1-1H13v-3.09A6 6 0 0 0 17.45 10H18a4 4 0 0 0 4-4V4a1 1 0 0 0-1-1h-3V2ZM6 5v3a2 2 0 0 1-2-2V5h2Zm14 1a2 2 0 0 1-2 2V5h2v1Z';
const LOCK_PATH =
  'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z';

function TrophyGlyph({
  tier,
  locked,
  size,
}: {
  tier: TrophyTier;
  locked: boolean;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="trophy-glyph"
    >
      <path
        d={locked ? LOCK_PATH : TROPHY_PATH}
        fill={locked ? 'var(--muted)' : tierColor(tier)}
        fillRule="evenodd"
      />
    </svg>
  );
}

/* ── The Trophies sheet ── */

const RING = 84;
const RING_STROKE = 10;

function Ring({ fraction, label }: { fraction: number; label: string }) {
  const r = (RING - RING_STROKE) / 2;
  const length = 2 * Math.PI * r;

  return (
    <span className="ring">
      <svg viewBox={`0 0 ${RING} ${RING}`} aria-hidden="true">
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth={RING_STROKE}
        />
        {fraction > 0 && (
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${length * fraction} ${length}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        )}
      </svg>
      <span className="ring-label">{label}</span>
    </span>
  );
}

/**
 * The app's Trophies sheet: the summary card — earned, the ring, available —
 * then every trophy in the set's own order (platinum first). Until the
 * awarded set has come back the counts are not true yet, so the card and the
 * row captions stand bones instead of a confident "0 of 7".
 */
export function TrophiesForm() {
  const { trophies, earned, total, hydrated } = useTrophies(COPY);
  const [open, setOpen] = useState<string | null>(null);
  const fraction = total > 0 ? earned / total : 0;
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format(
    fraction,
  );
  const detail = trophies.find(trophy => trophy.id === open) ?? null;

  return (
    <>
      <div className="card trophy-summary" aria-busy={!hydrated}>
        <span className="figure">
          {hydrated ? (
            <strong>{earned}</strong>
          ) : (
            <span className="bone figure-bone" />
          )}
          <span>{t('trophies.earned')}</span>
        </span>
        {hydrated ? (
          <Ring fraction={fraction} label={percent} />
        ) : (
          <span className="bone ring-bone" />
        )}
        <span className="figure">
          {hydrated ? (
            <strong>{total}</strong>
          ) : (
            <span className="bone figure-bone" />
          )}
          <span>{t('trophies.available')}</span>
        </span>
      </div>

      <div className="card">
        {trophies.map(trophy => (
          <button
            key={trophy.id}
            type="button"
            className="cell link-row trophy-row"
            onClick={() => setOpen(trophy.id)}
          >
            <TrophyGlyph
              tier={trophy.tier}
              locked={!trophy.unlocked}
              size={26}
            />
            <span className="trophy-copy">
              <span className="trophy-title">{trophy.title}</span>
              {hydrated ? (
                <span className="trophy-line">
                  {tierName(trophy.tier)} ·{' '}
                  {trophy.unlocked && trophy.achievedAt !== null
                    ? `${t('trophies.earned')} ${formatDate(trophy.achievedAt)}`
                    : trophy.description}
                </span>
              ) : (
                <span className="bone line short" />
              )}
            </span>
            <span className="chevron">
              <ChevronRightGlyph />
            </span>
          </button>
        ))}
      </div>

      <TrophyDetail trophy={detail} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * One trophy, as the app shows it: a SHEET that rises over the Trophies sheet
 * (`trophy-detail`, a fitToContents detent stacked on its parent), not a
 * dialog in the middle of the window. It belongs to the panel it was opened
 * from, so it is drawn into that panel — dimming it, and only it — and leaves
 * the library and the player beside it untouched.
 */
function TrophyDetail({
  trophy,
  onClose,
}: {
  trophy: ResolvedTrophy | null;
  onClose: () => void;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  // The last trophy stays drawn while the sheet slides away.
  const shown = useRef<ResolvedTrophy | null>(null);
  if (trophy) shown.current = trophy;
  const view = trophy ?? shown.current;
  const open = trophy !== null;
  // Pulled by its grabber, like every sheet: past a threshold it goes.
  const [pull, setPull] = useState<number | null>(null);
  const grab = useRef<{ y: number; t: number } | null>(null);

  useEffect(() => {
    setHost(anchor.current?.closest<HTMLElement>('.side') ?? null);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Without preventScroll, focusing a sheet still parked below the edge
    // scrolled the panel to reach it — the Trophies list jumped up and back.
    sheet.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const layer = (
    <>
      <div
        className={open ? 'sub-scrim is-open' : 'sub-scrim'}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={sheet}
        className={
          open ? 'sub-sheet trophy-detail is-open' : 'sub-sheet trophy-detail'
        }
        role="dialog"
        aria-modal="true"
        aria-label={view?.title}
        aria-hidden={!open}
        tabIndex={-1}
        style={
          pull !== null
            ? ({
                '--pull': `${Math.max(pull, -12)}px`,
                transition: 'none',
              } as React.CSSProperties)
            : undefined
        }
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return;
          grab.current = { y: e.clientY, t: performance.now() };
          e.currentTarget.setPointerCapture(e.pointerId);
          setPull(0);
        }}
        onPointerMove={e => {
          if (!grab.current) return;
          const dy = e.clientY - grab.current.y;
          setPull(dy > 0 ? dy : dy / 6);
        }}
        onPointerUp={e => {
          const start = grab.current;
          grab.current = null;
          setPull(null);
          if (!start) return;
          const dy = e.clientY - start.y;
          const v = dy / Math.max(1, performance.now() - start.t);
          if (dy > 80 || (dy > 20 && v > 0.6)) onClose();
        }}
        onPointerCancel={() => {
          grab.current = null;
          setPull(null);
        }}
      >
        <span className="sub-grabber" aria-hidden="true" />
        <button
          type="button"
          className="round detail-close"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
        >
          <CloseGlyph />
          <span className="sr">{t('common.close')}</span>
        </button>
        {view && (
          <>
            <span
              className="trophy-disc"
              style={{
                background: view.unlocked
                  ? `color-mix(in srgb, ${tierColor(view.tier)} 16%, transparent)`
                  : 'var(--empty-media)',
              }}
            >
              <TrophyGlyph tier={view.tier} locked={!view.unlocked} size={44} />
            </span>
            <h2>{view.title}</h2>
            <p className="trophy-caption">{caption(view)}</p>
            <p>{view.description}</p>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      <span ref={anchor} hidden />
      {host && createPortal(layer, host)}
    </>
  );
}

/* ── The unlock: a banner and a chime ── */

const SHOW_MS = 4200;
const PLATINUM_SHOW_MS = 5400;
const EXIT_MS = 220;

/**
 * The app's unlock chime, and the song steps aside for it: ours pauses from
 * the first chime of a run to the last and comes back once, only if it is
 * still the same sound and still paused — anything the person did meanwhile
 * wins. A browser that refuses the chime leaves the banner to say it alone.
 */
let held: string | null = null;
let chain: Promise<void> = Promise.resolve();

const playChime = (platinum: boolean) => {
  const now = playerState();
  if (held && now.playing) held = null;
  if (!held && now.current && now.playing) {
    held = now.current.id;
    pause();
  }

  chain = chain
    .then(
      () =>
        new Promise<void>(resolve => {
          const audio = new Audio(platinum ? platinumChime : trophyChime);
          audio.volume = platinum ? 0.9 : 0.7;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        }),
    )
    .then(() => new Promise(resolve => setTimeout(resolve, 250)))
    .then(() => {
      if (!held || useTrophyStore.getState().queue.length > 1) return;
      const id = held;
      held = null;
      const after = playerState();
      if (after.current?.id === id && !after.playing) void toggle();
    });
};

/**
 * "Trophy Unlocked": the app's floating notification, one at a time in
 * unlock order, standing off the top of the window. A tap opens Trophies.
 * The platinum stays up longer and takes one pass of light across it.
 */
export function TrophyBanner({ onOpen }: { onOpen: () => void }) {
  const head = useTrophyStore(state => state.queue[0] ?? null);
  const dequeue = useTrophyStore(state => state.dequeue);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!head) return;
    setLeaving(false);
    const platinum = head.tier === 'platinum';
    playChime(platinum);
    const show = setTimeout(
      () => setLeaving(true),
      platinum ? PLATINUM_SHOW_MS : SHOW_MS,
    );
    return () => clearTimeout(show);
  }, [head]);

  useEffect(() => {
    if (!leaving) return;
    const exit = setTimeout(dequeue, EXIT_MS);
    return () => clearTimeout(exit);
  }, [leaving, dequeue]);

  if (!head) return null;

  const copy = COPY[head.id];

  return (
    <div className="trophy-slot" role="status" aria-live="polite">
      <button
        key={head.id}
        type="button"
        className={[
          'trophy-banner',
          head.tier === 'platinum' && 'is-platinum',
          leaving && 'is-leaving',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          setLeaving(true);
          onOpen();
        }}
      >
        <TrophyGlyph tier={head.tier} locked={false} size={40} />
        <span className="trophy-banner-copy">
          <span className="eyebrow">{t('trophies.unlocked')}</span>
          <span className="title">{copy?.title}</span>
          <span className="desc">{copy?.description}</span>
        </span>
      </button>
    </div>
  );
}
