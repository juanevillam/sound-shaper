import { useEffect, useRef, useState, type ReactNode } from 'react';

import { t } from '../i18n';

import { CloseGlyph } from './glyphs';

/**
 * The player's sheets — Shape and Clips — in one frame. On a desk it is the
 * column at the right of the now-playing one, its bar on the library's line;
 * on a phone it rises from the bottom over the player, as the app's sheets do.
 */
export function SidePanel({
  open,
  title,
  action,
  trailing,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  action?: ReactNode;
  /** Replaces the close glyph — a commit modal's ✓. */
  trailing?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  // iOS draws the bar's scroll edge only once something is under it.
  const form = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState(false);

  // A new sheet, or a new body in it, starts at the top with a bare bar.
  useEffect(() => {
    if (form.current) form.current.scrollTop = 0;
    setEdge(false);
  }, [title]);

  return (
    <aside
      className={open ? 'side is-open' : 'side'}
      aria-label={title}
      aria-hidden={!open}
      inert={!open}
    >
      <header className={edge ? 'side-bar is-edge' : 'side-bar'}>
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
