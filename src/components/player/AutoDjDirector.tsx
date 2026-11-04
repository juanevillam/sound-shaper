import { useEffect } from 'react';

import { type SongMap } from '@/lib/autoDj/analysis';
import {
  AUTO_DJ_STYLES,
  nextMoveIndex,
  rng,
  stateAt,
  type AutoDjStyle,
  type DjMove,
} from '@/lib/autoDj/plan';
import {
  chooseNext,
  joinSegment,
  planSegment,
  type PoolSound,
  type Segment,
} from '@/lib/autoDj/set';
import { getSongMap } from '@/lib/autoDj/songMap';
import { type Sound } from '@/services/firebase/sounds';
import { useAutoDjStore } from '@/store/autoDj';
import { usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';
import { useSoundsStore } from '@/store/sounds';

// ---------------------------------------------------------------------------
// AUTO DJ — the hand on the controls and on the decks. Headless, mounted beside
// <AudioEngine> so it runs whether or not the player or the Shape sheet is open.
//
// WHAT IT RUNS is a SET (`lib/autoDj/set.ts`): stretches of the library's
// sounds, cut together on downbeats. Switched on, it
//   1. reads every sound in the library, the playing one first (`getSongMap`,
//      cached after the first time), publishing how far it has got;
//   2. JOINS the sound that is playing, from the playhead to the end of a
//      phrase, and picks the segment after it the moment there is a pool;
//   3. plays each segment's moves against the transport, and at the segment's
//      end CUES the next one — the next sound loaded and started on its own
//      bar line (`cueSound`).
//
// A SOUND IT DID NOT CUE IS JOINED, NOT FOUGHT. Picking a sound by hand, the
// transport's next / previous, a clip, the sound running out — any load the
// set did not ask for becomes the set's current segment from where it is,
// and the set carries on from there.
//
// A JUMP IS A FOLD. A scrub inside a segment applies the whole state the
// segment's mix has reached there (`stateAt`); a scrub past its end cuts to
// the next segment.
// ---------------------------------------------------------------------------

/** How far ahead of the playhead a move is put on a timer. */
const LOOKAHEAD_S = 0.35;
/** A position report further than this from the last one is a jump. */
const JUMP_S = 1;
/**
 * How long before the segment's end the cut is fired. The next sound's load
 * takes a moment; starting it a hair early puts its downbeat nearer the beat.
 * A first guess — tune it by ear on the device.
 */
const CUE_LEAD_S = 0.12;

/** Apply a partial state, touching only what actually changes. */
function applyMove(move: Partial<DjMove>): void {
  const shaper = useShaperStore.getState();
  const player = usePlayerStore.getState();
  if (move.gains && move.gains.some((g, i) => g !== shaper.gains[i])) {
    shaper.applyGains(move.gains);
  }
  if (move.nextRoom !== undefined && move.nextRoom !== shaper.nextRoom) {
    shaper.setNextRoom(move.nextRoom);
  }
  if (move.echo !== undefined && move.echo !== shaper.echo) {
    shaper.setEcho(move.echo);
  }
  if (move.rate !== undefined && move.rate !== player.rate) {
    player.setRate(move.rate);
  }
  if (move.keepPitch !== undefined && move.keepPitch !== player.keepPitch) {
    player.setKeepPitch(move.keepPitch);
  }
}

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

export function AutoDjDirector() {
  const on = useAutoDjStore(s => s.on);

  useEffect(() => {
    if (!on) return;

    let cancelled = false;
    const maps = new Map<string, SongMap>();
    const failed = new Set<string>();
    const played = new Set<string>();
    const random = rng(freshSeed());
    const dj = useAutoDjStore.getState();

    let setTempo = 0;

    /**
     * THE SET'S MOOD — Club, Slowed or Hyper — is the DJ's to choose, not a
     * setting (Juan, 2026-11-04: Auto DJ is on or off, and the set is a
     * combination of them). A mood holds for one to three segments and then
     * moves on, so a set has passages rather than a coin flip per song; Club
     * is the home it comes back to most.
     */
    let mood: AutoDjStyle = 'club';
    // The sound already playing is joined in Club, before the first change.
    let moodLeft = 1;
    const nextStyle = (): AutoDjStyle => {
      if (moodLeft <= 0) {
        const r = random();
        const options = AUTO_DJ_STYLES.filter(m => m !== mood);
        mood =
          r < 0.5 && mood !== 'club'
            ? 'club'
            : options[Math.floor(random() * options.length)];
        moodLeft = 1 + Math.floor(random() * 3);
      }
      moodLeft -= 1;
      return mood;
    };
    /** The segment sounding now. */
    let segment: Segment | null = null;
    /** Whether the playhead has reached `segment` yet after its cue. */
    let landed = false;
    /** The segment the set cuts to next. */
    let upNext: Segment | null = null;
    /** A cue in flight: the segment whose sound is loading. */
    let cued: Segment | null = null;
    let next = 0;
    let lastPosition = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const library = (): Sound[] => useSoundsStore.getState().sounds;

    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };

    const publishProgress = () => {
      const sounds = library();
      const done = sounds.filter(s => maps.has(s.id) || failed.has(s.id));
      dj.setProgress(done.length, sounds.length);
    };

    const pool = (): PoolSound[] =>
      library().flatMap(s => {
        const map = maps.get(s.id);
        return map ? [{ soundId: s.id, map }] : [];
      });

    /** Bring the transport onto `segment` at `position`. */
    const foldTo = (position: number) => {
      if (!segment) return;
      clearTimers();
      const at = Math.max(position, segment.startS);
      applyMove(stateAt(segment.mix, at));
      next = nextMoveIndex(segment.mix, at);
      lastPosition = position;
    };

    const chooseUpNext = () => {
      if (!segment || upNext || cued) return;
      const candidate = chooseNext(
        pool(),
        played,
        segment.soundId,
        setTempo,
        random,
      );
      if (!candidate) return;
      upNext = planSegment({
        next: candidate,
        style: nextStyle(),
        seed: Math.floor(random() * 2 ** 31),
        setTempo,
      });
    };

    const begin = (seg: Segment, position: number) => {
      segment = seg;
      landed = true;
      setTempo = seg.tempo;
      played.add(seg.soundId);
      dj.setStatus('mixing');
      foldTo(position);
      chooseUpNext();
    };

    /** Make the playing sound the set's segment, from where it is. */
    const join = () => {
      const { current, position } = usePlayerStore.getState();
      if (!current) return;
      const map = maps.get(current.id);
      if (!map) return; // read first; `pump` joins when it lands
      begin(
        joinSegment({
          sound: { soundId: current.id, map },
          style: nextStyle(),
          seed: Math.floor(random() * 2 ** 31),
          atS: position,
          setTempo,
        }),
        position,
      );
    };

    /** Cut to `upNext`. */
    const cue = () => {
      if (!upNext) return;
      const target = upNext;
      upNext = null;
      const sound = library().find(s => s.id === target.soundId);
      if (!sound) {
        chooseUpNext();
        return;
      }
      clearTimers();
      cued = target;
      segment = null;
      // The incoming state goes on as the cut is made, so the next sound
      // starts already shaped — including Echo, whose rewire the load hides.
      applyMove(stateAt(target.mix, target.startS));
      usePlayerStore.getState().cueSound(sound, target.startS);
    };

    /** Read the library, the playing sound first, one at a time. */
    let pumping = false;
    const pump = async () => {
      if (pumping) return;
      pumping = true;
      try {
        while (!cancelled) {
          const current = usePlayerStore.getState().current;
          const todo = [current, ...library()].find(
            (s): s is Sound => !!s && !maps.has(s.id) && !failed.has(s.id),
          );
          if (!todo) break;
          const map = await getSongMap(todo.id, todo.audioUrl);
          if (cancelled) return;
          if (map) maps.set(todo.id, map);
          else failed.add(todo.id);
          publishProgress();
          if (!segment && !cued) join();
          else chooseUpNext();
        }
      } finally {
        pumping = false;
      }
    };

    const onPosition = (position: number, playing: boolean) => {
      if (!segment) return;
      // After a cue, the reports before the new sound lands belong to the
      // reset, not to the segment.
      if (!landed) {
        if (position < segment.startS - 0.3) return;
        landed = true;
        foldTo(position);
        return;
      }
      const jumped =
        position < lastPosition - 0.05 || position - lastPosition > JUMP_S;
      if (jumped) {
        foldTo(position);
      }
      lastPosition = position;
      if (!playing) return;

      if (upNext && position >= segment.endS - CUE_LEAD_S) {
        cue();
        return;
      }

      const { rate } = usePlayerStore.getState();
      const { moves } = segment.mix;
      while (next < moves.length) {
        const move = moves[next];
        const ahead = move.atS - position;
        if (ahead > LOOKAHEAD_S) break;
        next += 1;
        const delayMs = Math.max(0, (ahead / rate) * 1000);
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!cancelled) applyMove(move);
        }, delayMs);
        timers.add(timer);
      }
    };

    const unsubscribe = usePlayerStore.subscribe((state, previous) => {
      if (state.loadNonce !== previous.loadNonce) {
        clearTimers();
        if (cued && state.current?.id === cued.soundId) {
          // The cut the set asked for.
          const seg = cued;
          cued = null;
          segment = seg;
          landed = false;
          setTempo = seg.tempo;
          played.add(seg.soundId);
          next = nextMoveIndex(seg.mix, seg.startS);
          lastPosition = seg.startS;
          chooseUpNext();
          return;
        }
        // A load the set did not ask for: join it once it is playing.
        cued = null;
        segment = null;
        upNext = null;
        if (state.current) {
          if (maps.has(state.current.id)) {
            // Join on the next tick, once the new stream reports.
            queueMicrotask(() => {
              if (!cancelled && !segment && !cued) join();
            });
          } else {
            void pump();
          }
        }
        return;
      }
      if (state.position !== previous.position) {
        onPosition(state.position, state.playing);
      }
      // A pause stops the clock; whatever was on a timer would land late.
      if (!state.playing && previous.playing) {
        clearTimers();
        if (segment) next = nextMoveIndex(segment.mix, state.position);
      }
    });

    dj.setStatus('preparing');
    publishProgress();
    void pump();

    return () => {
      cancelled = true;
      clearTimers();
      unsubscribe();
      dj.setProgress(0, 0);
    };
  }, [on]);

  return null;
}
