import { useEffect, useRef, useState, type ReactNode } from 'react';

import { t } from '../i18n';

import { CloseGlyph } from './glyphs';

/** How far a sheet has to be pulled down, or how fast, to let go of it. */
const DISMISS_PX = 120;
const DISMISS_VELOCITY = 0.6; // px per ms

/**
 * ONE SHEET, as the app presents them: it rises from the bottom over the
 * stage (on a desk, inside the tools column or centered in the viewport; on a
 * phone, over the whole screen), stacks over the sheet that opened it, and is
 * pulled down by its grabber or its bar to put it away — the grabber is a
 * promise of exactly that, so it is kept.
 *
 * `depth` is how many sheets stand over this one: 0 is the front. A sheet
 * under another steps back and dims, as iOS's stacked form sheets do.
 */
export function SidePanel({
  open,
  switching = false,
  depth = 0,
  index = 0,
  title,
  action,
  trailing,
  onClose,
  children,
}: {
  open: boolean;
  /** True when replacing an already-open base column in place. */
  switching?: boolean;
  depth?: number;
  /** Its place in the stack, from the bottom: each one stands a step lower. */
  index?: number;
  title: string;
  action?: ReactNode;
  /** Replaces the trailing close button when the bar commits on the right. */
  trailing?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  // iOS draws the bar's scroll edge only once something is under it.
  const form = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState(false);
  const [pull, setPull] = useState<number | null>(null);
  const grab = useRef<{ y: number; t: number; id: number } | null>(null);

  // Mounted below the edge, then raised: a sheet that mounted open would
  // simply appear.
  const [raised, setRaised] = useState(false);
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setRaised(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // A new body in the sheet starts at the top with a bare bar.
  useEffect(() => {
    if (form.current) form.current.scrollTop = 0;
    setEdge(false);
  }, [title]);

  const onPointerDown = (e: React.PointerEvent) => {
    // The third column's base panel is a column, not a sheet: it closes only
    // from its ✕ button, never by dragging its header down.
    if (
      index === 0 &&
      e.currentTarget.closest('.tools') &&
      matchMedia('(min-width: 64rem)').matches
    )
      return;
    // The bar's own controls are buttons; a press on one is not a pull.
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea'))
      return;
    grab.current = { y: e.clientY, t: performance.now(), id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPull(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!grab.current || grab.current.id !== e.pointerId) return;
    const dy = e.clientY - grab.current.y;
    // Upward, a sheet at its large detent has nowhere to go: it resists.
    setPull(dy > 0 ? dy : dy / 6);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = grab.current;
    grab.current = null;
    if (!start) return;
    const dy = e.clientY - start.y;
    const velocity = dy / Math.max(1, performance.now() - start.t);
    setPull(null);
    if (dy > DISMISS_PX || (dy > 24 && velocity > DISMISS_VELOCITY)) onClose();
  };

  const style = {
    '--index': index,
    ...(pull !== null
      ? { '--pull': `${Math.max(pull, -12)}px`, transition: 'none' }
      : null),
  } as React.CSSProperties;

  return (
    <aside
      className={[
        'side',
        index === 0 ? 'is-base' : '',
        switching ? 'is-switching' : '',
        !open ? 'is-leaving' : '',
        open && raised ? 'is-open' : '',
        depth > 0 ? 'is-under' : '',
        depth > 1 ? 'is-deep' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-label={title}
      aria-hidden={!open || depth > 0}
      inert={!open || depth > 0}
    >
      <header
        className={edge ? 'side-bar is-edge' : 'side-bar'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          grab.current = null;
          setPull(null);
        }}
      >
        <span className="side-grabber" aria-hidden="true" />
        <span className="side-lead">{action}</span>
        <h2>{title}</h2>
        {trailing ?? (
          <button type="button" className="round" onClick={onClose}>
            <CloseGlyph />
            <span className="sr">{t('common.close')}</span>
          </button>
        )}
      </header>
      <div
        ref={form}
        className="form"
        onScroll={e => setEdge(e.currentTarget.scrollTop > 0)}
      >
        {children}
      </div>
    </aside>
  );
}
