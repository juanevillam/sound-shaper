/**
 * DEV SWITCH — flipped by hand or from Settings → Dev, never read in a release build.
 * `import.meta.env.DEV`-gated at every consumer so it cannot reach production.
 */
export const STATE_LAB = true;
