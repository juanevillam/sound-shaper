// ---------------------------------------------------------------------------
// AUTO DJ — THE SONG'S PARTS. A DJ hears a record as sections — the intro,
// the verse, the build, the drop, the breakdown, the outro — and does
// everything by them: cues the good part, plays a build up, lets a breakdown
// breathe, and changes record where one part ends. This reads those sections
// off the song map (`analysis.ts`). Pure, so it is unit-tested.
//
// HOW: the song is cut into PHRASES on its own grid (8 bars with a pulse, 4
// time blocks of ~2 s without), each phrase is described by three numbers —
// how loud it is, how much bass it has, how bright it is — and neighbouring
// phrases that sound alike are merged into one section. A section is then
// named by what it does relative to the rest of the song:
//   · PEAK   — the song at its fullest, loud AND with its bass in: the drop,
//              the chorus. The best part, and what a set is made of;
//   · BREAK  — the bass gone out from under it: a breakdown;
//   · BUILD  — a short stretch leading straight into a peak;
//   · INTRO / OUTRO — the quieter first and last parts;
//   · VERSE  — everything else that is playing.
// ---------------------------------------------------------------------------

import { type SongMap } from './analysis';
import { findDrops } from './plan';

export type SectionKind =
  | 'intro'
  | 'verse'
  | 'build'
  | 'peak'
  | 'break'
  | 'outro';

export type Section = {
  /** [start, end) in bars (time blocks for a sound with no pulse). */
  start: number;
  end: number;
  kind: SectionKind;
  energy: number;
  bass: number;
  bright: number;
  /** How full this part is: loudness with the bass weighed in. */
  score: number;
};

/** Bars per phrase — the grid sections are cut on. */
export const phraseBars = (map: SongMap): number => (map.bpm > 0 ? 8 : 4);

const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** How alike two neighbouring phrases must be to be one section. */
const SAME = { energy: 0.12, bass: 0.18, bright: 0.18 };
/** The longest a section grows by merging, in bars. */
const MAX_SECTION_BARS = 32;

const scoreOf = (energy: number, bass: number) => 0.6 * energy + 0.4 * bass;

function describe(map: SongMap, start: number, end: number): Section {
  const energy = mean(map.bars.slice(start, end));
  const bass = mean(map.bass.slice(start, end));
  const bright = mean(map.bright.slice(start, end));
  return {
    start,
    end,
    kind: 'verse',
    energy,
    bass,
    bright,
    score: scoreOf(energy, bass),
  };
}

/** The phrase lines, on the grid the song's first drop sits on. */
export function phraseLines(map: SongMap): number[] {
  const n = map.bars.length;
  const size = phraseBars(map);
  const offset = map.bpm > 0 ? (findDrops(map.bars)[0] ?? 0) % size : 0;
  const lines = [0];
  for (let b = offset || size; b < n; b += size) {
    // A sliver of under two bars at the top joins the first phrase.
    if (b >= 2) lines.push(b);
  }
  lines.push(n);
  return lines;
}

export function findSections(map: SongMap): Section[] {
  const n = map.bars.length;
  if (!n) return [];
  const lines = phraseLines(map);

  const sections: Section[] = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    const phrase = describe(map, lines[i], lines[i + 1]);
    const last = sections[sections.length - 1];
    const alike =
      last &&
      Math.abs(last.energy - phrase.energy) < SAME.energy &&
      Math.abs(last.bass - phrase.bass) < SAME.bass &&
      Math.abs(last.bright - phrase.bright) < SAME.bright &&
      phrase.end - last.start <= MAX_SECTION_BARS;
    if (alike)
      sections[sections.length - 1] = describe(map, last.start, phrase.end);
    else sections.push(phrase);
  }

  const top = Math.max(...sections.map(s => s.score));
  const isPeak = (s: Section) => s.score >= top * 0.82 && s.energy >= 0.7;
  sections.forEach((s, i) => {
    if (isPeak(s)) s.kind = 'peak';
    else if (i === 0) s.kind = 'intro';
    else if (i === sections.length - 1 && s.score < sections[i - 1].score)
      s.kind = 'outro';
    else if (s.bass < 0.55 || s.score < top * 0.5) s.kind = 'break';
    else s.kind = 'verse';
  });
  // A short part leading straight into a peak is its build.
  sections.forEach((s, i) => {
    const next = sections[i + 1];
    if (
      next?.kind === 'peak' &&
      (s.kind === 'verse' || s.kind === 'break') &&
      s.end - s.start <= 16
    ) {
      s.kind = 'build';
    }
  });
  // A song that never reaches a peak by the rule still has a best part.
  if (!sections.some(s => s.kind === 'peak')) {
    const best = sections.reduce((a, b) => (b.score > a.score ? b : a));
    best.kind = 'peak';
  }
  return sections;
}

/**
 * THE PEAKS, BEST FIRST. Runs of neighbouring peak sections count as one
 * (a drop that changes texture halfway is still one drop), as indices
 * [first, last] into `sections`. On a near-tie the LATER one wins: the last
 * chorus is usually the biggest.
 */
export function peakRuns(sections: Section[]): [number, number][] {
  const runs: [number, number][] = [];
  sections.forEach((s, i) => {
    if (s.kind !== 'peak') return;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  const strength = ([a, b]: [number, number]) =>
    Math.max(...sections.slice(a, b + 1).map(s => s.score));
  return runs
    .map((run, order) => ({ run, order, value: strength(run) }))
    .sort((x, y) =>
      Math.abs(x.value - y.value) < 0.03
        ? y.order - x.order
        : y.value - x.value,
    )
    .map(({ run }) => run);
}

/** How strong a song is at its best — what a set's arc is built from. */
export function hotness(sections: Section[]): number {
  if (!sections.length) return 0;
  const best = Math.max(...sections.map(s => s.score));
  const bars = sections.reduce((n, s) => n + (s.end - s.start), 0) || 1;
  const average =
    sections.reduce((n, s) => n + s.score * (s.end - s.start), 0) / bars;
  return 0.5 * best + 0.5 * average;
}
