import { useEffect, useRef, useState } from 'react';

export type StateLabEntry = {
  label: string;
  note: string;
  value: string;
};

export type StateLabGroup = {
  key: string;
  label: string;
  onChange: (value: string) => void;
  states: readonly StateLabEntry[];
  value: string;
};

/**
 * THE DEV STATE LAB — Web counterpart to `sound-shaper/src/ui/StateLab.tsx`.
 * Renders nothing in production (`!import.meta.env.DEV`).
 */
export function StateLab({
  groups,
  bottomOffset = 0,
}: {
  groups: readonly StateLabGroup[];
  bottomOffset?: number;
}) {
  const [activeKey, setActiveKey] = useState(groups[groups.length - 1]?.key);
  const prevKeysRef = useRef<string>('');
  const [bounceDir, setBounceDir] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    const keysSig = groups.map(g => g.key).join('|');
    if (keysSig !== prevKeysRef.current) {
      prevKeysRef.current = keysSig;
      const latest = groups[groups.length - 1];
      if (latest) setActiveKey(latest.key);
    }
  }, [groups]);

  if (!import.meta.env.DEV || groups.length === 0) return null;

  const group =
    groups.find(entry => entry.key === activeKey) ?? groups[groups.length - 1];
  const index = Math.max(
    0,
    group.states.findIndex(state => state.value === group.value),
  );
  const entry = group.states[index];
  if (!entry) return null;

  const step = (delta: number) => {
    const { length } = group.states;
    group.onChange(group.states[(index + delta + length) % length].value);
    setBounceDir(delta < 0 ? 'left' : 'right');
  };

  return (
    <aside
      className="state-lab-shell"
      aria-label="Developer State Lab"
      style={
        bottomOffset > 0
          ? ({ '--lab-offset': `${bottomOffset}px` } as React.CSSProperties)
          : undefined
      }
    >
      <div className="state-lab-card">
        {groups.length > 1 && (
          <div className="segmented state-lab-picker" role="tablist">
            {groups.map(option => {
              const isPinned = option.value !== 'live';
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={option.key === group.key}
                  className={[
                    option.key === group.key ? 'is-active' : '',
                    isPinned ? 'is-pinned' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setActiveKey(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="state-lab-row">
          <button
            type="button"
            className={
              bounceDir === 'left'
                ? 'state-lab-step is-bouncing-left'
                : 'state-lab-step'
            }
            aria-label="Previous UI state"
            onAnimationEnd={() => setBounceDir(null)}
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="state-lab-copy">
            <div className="state-lab-head">
              <span className="state-lab-title">
                {`${group.label.toUpperCase()}  ${index + 1}/${group.states.length}  ${entry.label}`}
              </span>
              <button
                type="button"
                className={
                  group.value !== 'live'
                    ? 'state-lab-reset is-shown'
                    : 'state-lab-reset'
                }
                tabIndex={group.value !== 'live' ? 0 : -1}
                aria-hidden={group.value === 'live'}
                onClick={() => group.onChange('live')}
              >
                Reset
              </button>
            </div>
            <p className="state-lab-note">{entry.note}</p>
          </div>

          <button
            type="button"
            className={
              bounceDir === 'right'
                ? 'state-lab-step is-bouncing-right'
                : 'state-lab-step'
            }
            aria-label="Next UI state"
            onAnimationEnd={() => setBounceDir(null)}
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M7.5 4.5 13 10l-5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
