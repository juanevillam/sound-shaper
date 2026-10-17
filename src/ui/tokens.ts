/**
 * Design tokens — single source of truth for spacing and animation timings
 * across the app. Every layout value should reference one of these constants
 * instead of a raw number, so visual rhythm stays consistent everywhere.
 */

// 4-pt base grid. Keep additions aligned to multiples of 4.
const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// Reanimated timing presets. Use `duration.base` for most fades / transitions.
const duration = {
  fast: 180,
  base: 220,
  slow: 320,
} as const;

// Layout constants reused across screens.
const layout = {
  // Welcome-screen call-to-action height — ONE number for the branded sign-in
  // buttons and the system one, so the CTA stack reads as a family.
  //
  // 44 is set by the BRANDED buttons, not by the system one. Google's
  // guidelines pin that button's CONTENT and forbid resizing the "G" (logo
  // 20pt, Google Sans Medium 14/20, iOS padding 16/12/16) while pinning no
  // height, so the height is ours to choose — and the content stack is only
  // 20pt tall, which is why a taller pill reads as a small logo marooned in
  // empty space. 44 leaves a balanced 12pt above and below it AND is exactly
  // Apple's minimum tap target, so the system CTA beside it stays within
  // Apple's guidance too.
  //
  // Deliberately NOT Apple's own onboarding CTA (measured 50.3pt in the
  // Passwords app): that button carries no brand logo, so it can afford the
  // extra height. Standardising the family on the constrained button is the
  // trade — don't "restore" 50 without re-checking the Google button.
  //
  // Every consumer is iOS-only (`GoogleSignInButton.ios`, `AppleSignInButton`,
  // `WelcomeScreen.ios`) — the Android welcome sizes its Material buttons
  // itself.
  authButtonHeight: 44,
} as const;

export { duration, layout, spacing };
