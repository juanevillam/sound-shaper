/**
 * Reject when `promise` has not settled within `ms`. A NETWORK WAIT WITH NO
 * DEADLINE IS A HANG: a Firestore write offline resolves only on the server's
 * acknowledgement, and a stalled socket never resolves at all, so anything a
 * person is watching a spinner over takes one of these.
 *
 * The timeout does NOT stop the underlying work — a promise cannot be
 * cancelled — so `onTimeout` is where a caller that CAN cancel (an upload
 * task) does so. The timer is cleared either way.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> => {
  let handle: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    handle = setTimeout(() => {
      onTimeout?.();
      reject(new TimeoutError(message));
    }, ms);
  });

  return Promise.race([promise, deadline]).finally(() => clearTimeout(handle));
};
