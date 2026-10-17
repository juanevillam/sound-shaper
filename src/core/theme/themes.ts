/**
 * Theme preference — the value the user picks in settings. `system` defers to
 * the OS color scheme; `light` / `dark` force it. Font choices stay app-specific
 * (each app ships its own typefaces), so they are not part of `src/core`.
 */
export type Theme = 'light' | 'dark' | 'system';

export const DEFAULT_THEME: Theme = 'system';

export const SUPPORTED_THEMES: Theme[] = ['system', 'light', 'dark'];
