import {
  getAnalytics,
  logEvent,
  logScreenView,
} from '@react-native-firebase/analytics';

/**
 * Google Analytics for Firebase — which parts of the app are used, counted,
 * never who used them. Decided by Juan on 2026-10-18
 * (`docs/telemetry-and-abuse.md`).
 *
 * WHAT IT MAY CARRY IS THE WHOLE POINT. No `setUserId`, ever; no sound titles,
 * ids or anything else a person typed or uploaded; and no advertising id —
 * the IdentitySupport pod is left out (`withoutAdIdSupport` in app.json) and
 * ad-id collection is off in firebase.json, so there is no IDFA and no App
 * Tracking Transparency prompt. Each event is a name and, at most, one of the
 * app's own constants. The App Privacy label and the policy page say exactly
 * this; a new parameter is a change to both.
 *
 * Every call is fire-and-forget: analytics failing must never be visible.
 */
type AppEvent =
  | { name: 'add_sound' }
  | { name: 'play_sound' }
  | { name: 'open_shape' }
  | { name: 'save_clip' }
  | { name: 'trophy_unlocked'; trophyId: string };

export const track = (event: AppEvent): void => {
  const { name, ...params } = event;

  try {
    void logEvent(
      getAnalytics(),
      name,
      'trophyId' in params ? { trophy_id: params.trophyId } : undefined,
    ).catch(() => {});
  } catch {
    // Never let analytics take anything down.
  }
};

/**
 * One screen view per route. The PATHNAME only — this app's routes carry no
 * ids in their path, so it names a screen and nothing in it.
 */
export const trackScreen = (pathname: string): void => {
  try {
    void logScreenView(getAnalytics(), {
      screen_class: pathname,
      screen_name: pathname,
    }).catch(() => {});
  } catch {
    // As above.
  }
};
