import { useState } from 'react';

import { REPEAT_MODES, type RepeatMode } from '@app/lib/clipQueue';
import { formatTime } from '@app/lib/player';

import { deleteClip, useClips, type Clip } from '../clips';
import { t } from '../i18n';
import { playClip, setRepeat, toggle, usePlayer } from '../player';

import { ConfirmDialog } from './ConfirmDialog';
import { Bars, PencilGlyph, PlusGlyph, TrashGlyph } from './glyphs';

const range = (clip: { startMs: number; endMs: number }) =>
  `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

/**
 * The list's last row: a new clip, in words. The bar's + alone was the only
 * way in, and on a wide sheet a lone glyph in a corner is easy to miss — the
 * row is where the list itself says what can be added to it (Reminders'
 * "New Reminder").
 */
const NewClipRow = ({ onNew }: { onNew: () => void }) => (
  <button type="button" className="cell new-clip-row" onClick={onNew}>
    <span className="clip-mark">
      <PlusGlyph />
    </span>
    {t('player.clips.new')}
  </button>
);

/** The Clips sheet's body: Repeat, then the sound's clips, newest range last. */
export function ClipsForm({
  onEdit,
  onNew,
}: {
  onEdit: (clip: Clip) => void;
  onNew: () => void;
}) {
  const current = usePlayer(s => s.current);
  const repeat = usePlayer(s => s.repeat);
  const active = usePlayer(s => s.activeClip?.id ?? null);
  const playing = usePlayer(s => s.playing);
  const rate = usePlayer(s => s.rate);
  const clips = useClips(current?.id);
  const [confirming, setConfirming] = useState<Clip | null>(null);

  if (!current) return null;

  return (
    <>
      <div className="card">
        <label className="cell picker">
          <span className="cell-name">{t('player.clips.repeat.label')}</span>
          <select
            value={repeat}
            onChange={e => setRepeat(e.target.value as RepeatMode)}
          >
            {REPEAT_MODES.map(mode => (
              <option key={mode} value={mode}>
                {t(`player.clips.repeat.${mode}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {clips === null ? (
        <div className="card">
          <div className="cell">
            <span className="bone line" />
          </div>
        </div>
      ) : clips.length === 0 ? (
        <>
          <div className="side-empty">
            <h3>{t('player.clips.none')}</h3>
            <p>{t('player.clips.empty')}</p>
          </div>
          <div className="card">
            <NewClipRow onNew={onNew} />
          </div>
        </>
      ) : (
        <ul className="card clip-list">
          {clips.map(clip => {
            const isActive = active === clip.id;
            return (
              <li key={clip.id} className="cell clip-row">
                <button
                  type="button"
                  className="clip-play"
                  aria-current={isActive || undefined}
                  onClick={() =>
                    isActive ? toggle() : playClip(current.id, clip)
                  }
                >
                  <span className="clip-mark">
                    {isActive ? (
                      <Bars live={playing} rate={rate} />
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"
                          fill="currentColor"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="clip-copy">
                    <span className="clip-name">
                      {clip.label || range(clip)}
                    </span>
                    <span className="clip-length">
                      {formatTime((clip.endMs - clip.startMs) / 1000)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="round quiet"
                  onClick={() => onEdit(clip)}
                >
                  <PencilGlyph />
                  <span className="sr">{t('player.clips.edit')}</span>
                </button>
                <button
                  type="button"
                  className="round quiet"
                  onClick={() => setConfirming(clip)}
                >
                  <TrashGlyph />
                  <span className="sr">{t('player.clips.delete')}</span>
                </button>
              </li>
            );
          })}
          <li className="cell-host">
            <NewClipRow onNew={onNew} />
          </li>
        </ul>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title={t('player.clips.deleteConfirm.title')}
        message={t('player.clips.deleteConfirm.message')}
        cancel={t('player.clips.deleteConfirm.cancel')}
        confirm={t('player.clips.deleteConfirm.confirm')}
        onConfirm={() => confirming && deleteClip(current.id, confirming.id)}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}

/** The dock card's second line: "3 saved", or "None". */
export function useClipsSummary(): string {
  const current = usePlayer(s => s.current);
  const clips = useClips(current?.id);

  return clips?.length
    ? t('player.clips.count', { n: String(clips.length) })
    : t('player.clips.noneSummary');
}
