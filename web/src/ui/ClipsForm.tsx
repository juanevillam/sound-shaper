import { useState } from 'react';

import { REPEAT_MODES, type RepeatMode } from '@app/lib/clipQueue';
import { formatTime } from '@app/lib/player';

import { deleteClip, useClips, type Clip } from '../clips';
import { UI_STATE_LAB, useUiStateLab } from '../dev/uiStateLab';
import { t } from '../i18n';
import { playClip, setRepeat, toggle, usePlayer } from '../player';

import { ActionSheet } from './ActionSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { ClipGlyph, MoreGlyph, SpeakerWaveGlyph } from './glyphs';
import { showToast } from './Toast';

const range = (clip: { startMs: number; endMs: number }) =>
  `${formatTime(clip.startMs / 1000)} – ${formatTime(clip.endMs / 1000)}`;

/**
 * The Clips sheet's body, the app's branch for branch: nothing until the
 * clips are known, the EMPTY STATE in place of the whole form while there are
 * none (scissors, title, line — Repeat is about how clips play, so it only
 * exists once there are clips), and otherwise Repeat and the clips card.
 */
export function ClipsForm({ onEdit }: { onEdit: (clip: Clip) => void }) {
  const current = usePlayer(s => s.current);
  const repeat = usePlayer(s => s.repeat);
  const active = usePlayer(s => s.activeClip?.id ?? null);
  const realClips = useClips(current?.id);
  const clipsLab = useUiStateLab(s => (UI_STATE_LAB ? s.clips : 'live'));
  const clips = clipsLab === 'empty' ? [] : realClips;
  const [menuClip, setMenuClip] = useState<Clip | null>(null);
  const [confirming, setConfirming] = useState<Clip | null>(null);

  if (!current) return null;

  return (
    <>
      {clips === null ? null : clips.length === 0 ? (
        <div className="side-empty is-full">
          <span className="side-empty-mark">
            <ClipGlyph />
          </span>
          <h3>{t('player.clips.none')}</h3>
          <p>{t('player.clips.empty')}</p>
        </div>
      ) : (
        <>
          <div className="card">
            <label className="cell picker">
              <span className="cell-name">
                {t('player.clips.repeat.label')}
              </span>
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

          <ul className="card clip-list">
            {clips.map((clip, idx) => {
              const isActive = active === clip.id;
              return (
                <li
                  key={clip.id}
                  style={{ '--i': Math.min(idx, 18) } as React.CSSProperties}
                  className="cell clip-row"
                >
                  <button
                    type="button"
                    className={isActive ? 'clip-play is-active' : 'clip-play'}
                    aria-current={isActive || undefined}
                    onClick={() =>
                      isActive ? toggle() : playClip(current.id, clip)
                    }
                  >
                    <span className="clip-name">
                      {clip.label || range(clip)}
                    </span>
                    {isActive && (
                      <span className="clip-active-icon" aria-hidden="true">
                        <SpeakerWaveGlyph />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="round quiet"
                    onClick={() => setMenuClip(clip)}
                  >
                    <MoreGlyph />
                    <span className="sr">{t('player.clips.editAction')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ActionSheet
        open={menuClip !== null}
        cancel={t('common.cancel')}
        actions={[
          {
            label: t('player.clips.editAction'),
            onSelect: () => {
              if (menuClip) onEdit(menuClip);
            },
          },
          {
            label: t('player.clips.delete'),
            destructive: true,
            onSelect: () => {
              if (menuClip) setConfirming(menuClip);
            },
          },
        ]}
        onClose={() => setMenuClip(null)}
      />

      <ConfirmDialog
        open={confirming !== null}
        title={t('player.clips.deleteConfirm.title')}
        message={t('player.clips.deleteConfirm.message')}
        cancel={t('player.clips.deleteConfirm.cancel')}
        confirm={t('player.clips.deleteConfirm.confirm')}
        onConfirm={() => {
          if (!confirming) return;
          deleteClip(current.id, confirming.id).then(
            () => showToast(t('snackbar.clip-deleted')),
            () => showToast(t('snackbar.clip-delete-failed')),
          );
        }}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}

/** The dock card's second line: "3 saved", or "None". */
export function useClipsSummary(active = true): string {
  const current = usePlayer(s => s.current);
  const clips = useClips(active ? current?.id : undefined);

  return clips?.length
    ? t('player.clips.count', { n: String(clips.length) })
    : t('player.clips.noneSummary');
}
