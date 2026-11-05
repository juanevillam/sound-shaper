import { describe, expect, it } from 'vitest';

import { songOf } from './autoDjSong';
import { findSections, hotness, peakRuns } from '../../src/lib/autoDj/sections';

describe('findSections', () => {
  it('names a dance track part by part', () => {
    const parts = findSections(songOf(128)).map(s => [s.start, s.end, s.kind]);
    expect(parts).toEqual([
      [0, 8, 'intro'],
      [8, 24, 'verse'],
      [24, 32, 'build'],
      [32, 48, 'peak'],
      [48, 56, 'break'],
      [56, 64, 'build'],
      [64, 80, 'peak'],
      [80, 88, 'outro'],
    ]);
  });

  it('ranks the bigger, later drop first', () => {
    const sections = findSections(songOf(128));
    expect(peakRuns(sections)).toEqual([
      [6, 6],
      [3, 3],
    ]);
  });

  it('still finds a best part in a song with no clear peak', () => {
    const flat = songOf(0, [
      [20, 0.5, 0.5, 0.5],
      [12, 0.62, 0.6, 0.5],
      [20, 0.5, 0.5, 0.5],
    ]);
    const sections = findSections(flat);
    expect(sections.filter(s => s.kind === 'peak').length).toBeGreaterThan(0);
  });

  it('scores a song with a big drop above a quiet one', () => {
    const quiet = songOf(128, [
      [32, 0.5, 0.4, 0.5],
      [32, 0.6, 0.5, 0.5],
    ]);
    expect(hotness(findSections(songOf(128)))).toBeGreaterThan(
      hotness(findSections(quiet)) - 0.5,
    );
  });
});
