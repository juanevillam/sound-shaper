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

/** The playing tile's badge: three bars that dance while the sound plays. */
export const Bars = ({ live }: { live: boolean }) => (
  <span className={live ? 'bars is-live' : 'bars'} aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);
