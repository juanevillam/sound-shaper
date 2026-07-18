import {
  getCrashlytics,
  recordError as crashlyticsRecordError,
} from '@react-native-firebase/crashlytics';

/**
 * Report a handled JS error to Crashlytics as a non-fatal. Fatal JS errors in
 * release builds already surface as native `JavascriptException` crashes; this
 * is for errors we catch (e.g. the root ErrorBoundary) but still want grouped
 * and counted in the console.
 */
export const recordError = (error: unknown, errorName?: string) => {
  const err = error instanceof Error ? error : new Error(String(error));
  try {
    crashlyticsRecordError(getCrashlytics(), err, errorName);
  } catch {
    // Never let crash reporting itself take the app down.
  }
};

/**
 * Wrap a service mutation so its failures land in Crashlytics before
 * propagating to the caller (whose catch shows the snackbar / reverts the
 * optimistic state — UI catches don't need to re-report). Reporting at the
 * service layer covers both platform twins with one wrap.
 */
export const reported =
  <A extends unknown[], R>(
    context: string,
    fn: (...args: A) => Promise<R>,
  ): ((...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      recordError(error, context);
      throw error;
    }
  };

/**
 * Wrap a subscription's onError the same way: the failure is counted in
 * Crashlytics, then the caller's handler runs (even when it is a silent
 * `() => {}` — which would otherwise make production Firestore failures
 * completely invisible).
 */
export const reportedOnError =
  (context: string, onError: (error: Error) => void) =>
  (error: Error): void => {
    recordError(error, context);
    onError(error);
  };
