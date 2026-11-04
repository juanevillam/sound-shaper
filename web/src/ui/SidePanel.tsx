import type { ReactNode } from 'react';

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
  return (
    <aside
      className={open ? 'side is-open' : 'side'}
      aria-label={title}
      aria-hidden={!open}
      inert={!open}
    >
      <header className="side-bar">
        <span className="side-lead">{action}</span>
        <h2>{title}</h2>
        {trailing ?? (
          <button type="button" className="round" onClick={onClose}>
            <CloseGlyph />
            <span className="sr">{t('common.close')}</span>
          </button>
        )}
      </header>
      <div className="form">{children}</div>
    </aside>
  );
}
