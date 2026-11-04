import { t } from '../i18n';
import { next, toggle, usePlayer } from '../player';

import { Artwork } from './Artwork';
import { NextGlyph, PlayPauseGlyph } from './glyphs';

/**
 * The phone's now-playing banner — the app's collapsed PlayerSheet: glass
 * over the library, the cover, the title over the subtitle, play and next.
 * A tap anywhere else expands it.
 */
export function MiniPlayer({ onExpand }: { onExpand: () => void }) {
  const current = usePlayer(s => s.current);
  const playing = usePlayer(s => s.playing);
  const position = usePlayer(s => s.position);
  const duration = usePlayer(s => s.duration);

  if (!current) return null;

  return (
    <div className="mini">
      <button type="button" className="mini-open" onClick={onExpand}>
        <Artwork artUrl={current.artUrl} name={current.name} width={48} eager />
        <span className="mini-copy">
          <span className="mini-title">{current.name}</span>
          {current.artist && (
            <span className="mini-artist">{current.artist}</span>
          )}
        </span>
        <span className="sr">{t('player.title')}</span>
      </button>
      <button type="button" className="glyph" onClick={toggle}>
        <PlayPauseGlyph playing={playing} />
        <span className="sr">
          {playing ? t('player.pause') : t('player.play')}
        </span>
      </button>
      <button type="button" className="glyph skip" onClick={next}>
        <NextGlyph />
        <span className="sr">{t('player.next')}</span>
      </button>
      <span
        className="mini-progress"
        style={
          {
            '--progress': duration ? position / duration : 0,
          } as React.CSSProperties
        }
        aria-hidden="true"
      />
    </div>
  );
}
