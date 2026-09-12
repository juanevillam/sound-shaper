import { beforeEach, describe, expect, it } from 'vitest';

import { type Sound } from '../../src/services/firebase/sounds';
import { nextLeadPosition, useSoundsStore } from '../../src/store/sounds';

const sound = (id: string, position: number | null): Sound =>
  ({ id, position }) as Sound;

/**
 * A NEW UPLOAD LANDS AT THE FRONT OF THE SOUNDS — never past them, and never
 * past the add tile either, which holds its own slot in the same order and is
 * deliberately not consulted here.
 */
describe('nextLeadPosition', () => {
  beforeEach(() => {
    useSoundsStore.setState({ sounds: [] });
  });

  it('seeds an empty library', () => {
    expect(nextLeadPosition()).toBe(0);
  });

  it('lands before every existing sound', () => {
    useSoundsStore.setState({
      sounds: [sound('a', 0), sound('b', 1), sound('c', 2)],
    });

    expect(nextLeadPosition()).toBeLessThan(0);
  });

  it('keeps leading even after repeated uploads', () => {
    useSoundsStore.setState({ sounds: [sound('a', 0)] });

    const first = nextLeadPosition();

    useSoundsStore.setState({
      sounds: [sound('new', first), sound('a', 0)],
    });

    expect(nextLeadPosition()).toBeLessThan(first);
  });

  it('ignores sounds written before positions existed', () => {
    useSoundsStore.setState({
      sounds: [sound('legacy', null), sound('a', 5)],
    });

    expect(nextLeadPosition()).toBe(4);
  });
});
