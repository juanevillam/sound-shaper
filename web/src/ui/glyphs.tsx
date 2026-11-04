/**
 * The transport's glyphs — the website's Songs player's (SongsPlayer.astro),
 * filled like SF Symbols' `backward.fill` / `play.fill` / `pause.fill`.
 */
export const PreviousGlyph = () => (
  <svg viewBox="0 0 32 20" aria-hidden="true">
    <path
      d="M15 3.2v13.6a1 1 0 0 1-1.55.83L3.6 10.83a1 1 0 0 1 0-1.66l9.85-6.8A1 1 0 0 1 15 3.2Zm14 0v13.6a1 1 0 0 1-1.55.83l-9.85-6.8a1 1 0 0 1 0-1.66l9.85-6.8A1 1 0 0 1 29 3.2Z"
      fill="currentColor"
    />
  </svg>
);

export const NextGlyph = () => (
  <svg viewBox="0 0 32 20" aria-hidden="true">
    <path
      d="M3 3.2v13.6a1 1 0 0 0 1.55.83l9.85-6.8a1 1 0 0 0 0-1.66L4.55 2.37A1 1 0 0 0 3 3.2Zm14 0v13.6a1 1 0 0 0 1.55.83l9.85-6.8a1 1 0 0 0 0-1.66l-9.85-6.8A1 1 0 0 0 17 3.2Z"
      fill="currentColor"
    />
  </svg>
);

export const PlayPauseGlyph = ({ playing }: { playing: boolean }) =>
  playing ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3.5" width="5" height="17" rx="1.4" fill="currentColor" />
      <rect x="14" y="3.5" width="5" height="17" rx="1.4" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 4.1v15.8a1.2 1.2 0 0 0 1.8 1.03l13.2-7.9a1.2 1.2 0 0 0 0-2.06L7.8 3.07A1.2 1.2 0 0 0 6 4.1Z"
        fill="currentColor"
      />
    </svg>
  );

export const ShapeGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M3 6h18M3 12h18M3 18h18"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <circle
      cx="15.5"
      cy="6"
      r="2.6"
      fill="var(--glass-ink)"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <circle
      cx="8"
      cy="12"
      r="2.6"
      fill="var(--glass-ink)"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <circle
      cx="13"
      cy="18"
      r="2.6"
      fill="var(--glass-ink)"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </svg>
);

export const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7 7l10 10M17 7 7 17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const ChevronDownGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="m6 9 6 6 6-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The playing tile's mark — the app's `NowPlayingBars`: three white
 * hairlines breathing inside a round scrim, slow and shallow, keeping time
 * with the playback speed. Paused, they settle level.
 */
export const Bars = ({ live, rate = 1 }: { live: boolean; rate?: number }) => (
  <span
    className={live ? 'bars is-live' : 'bars'}
    style={
      { '--tempo': Math.min(Math.max(rate, 0.25), 4) } as React.CSSProperties
    }
    aria-hidden="true"
  >
    <i />
    <i />
    <i />
  </span>
);

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const PlusGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" {...strokeProps} strokeWidth={2} />
  </svg>
);

export const TrashGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.5-1.3 1.2-1.3h2.6c.7 0 1.2.6 1.2 1.3v1.7M6.5 6.5l.8 12.2c.1 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8l.8-12.2"
      {...strokeProps}
    />
  </svg>
);

export const ClipGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6" cy="6" r="3" {...strokeProps} />
    <circle cx="6" cy="18" r="3" {...strokeProps} />
    <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" {...strokeProps} />
  </svg>
);

export const PencilGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M15.5 4.5l4 4L9 19l-5 1 1-5L15.5 4.5ZM13.5 6.5l4 4"
      {...strokeProps}
    />
  </svg>
);

export const CheckGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" {...strokeProps} strokeWidth={2.2} />
  </svg>
);

/** SF Symbols' `gearshape`: the home bar's one glyph, as in every app. */
export const GearGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3" {...strokeProps} strokeWidth={1.7} />
    <path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      {...strokeProps}
      strokeWidth={1.7}
    />
  </svg>
);

export const ChevronRightGlyph = () => (
  <svg viewBox="0 0 8 13" aria-hidden="true">
    <path d="M1.5 1.5 6.5 6.5l-5 5" {...strokeProps} strokeWidth={1.8} />
  </svg>
);

export const ChevronLeftGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" {...strokeProps} strokeWidth={2} />
  </svg>
);
