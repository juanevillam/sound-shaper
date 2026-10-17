import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeoutError, withTimeout } from '../../src/lib/withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes a value through when the work beats the deadline', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, 'late')).resolves.toBe(
      7,
    );
  });

  it('passes a rejection through unchanged', async () => {
    const error = new Error('boom');
    await expect(withTimeout(Promise.reject(error), 1000, 'late')).rejects.toBe(
      error,
    );
  });

  it('rejects with a TimeoutError and calls onTimeout once the deadline passes', async () => {
    const onTimeout = vi.fn();
    const pending = withTimeout(new Promise(() => {}), 1000, 'late', onTimeout);
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('never fires onTimeout for work that settled in time', async () => {
    const onTimeout = vi.fn();
    await withTimeout(Promise.resolve(1), 1000, 'late', onTimeout);

    await vi.advanceTimersByTimeAsync(5000);

    expect(onTimeout).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
