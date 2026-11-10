import { useEffect } from 'react';

import { audioEngine } from '@/lib/audioEngine';
import { type SongMap } from '@/lib/autoDj/analysis';
import { djLevelDb } from '@/lib/autoDj/loudness';
import {
  AUTO_DJ_STYLES,
  DJ_FOCUS_RANK,
  moveFocus,
  nextMoveIndex,
  rng,
  stateAt,
  type AutoDjStyle,
  type DjMove,
} from '@/lib/autoDj/plan';
import {
  firstPeakBar,
  joinSegment,
  planOrder,
  planSegment,
  planSoundSegment,
  transitionFx,
  type Part,
  type PoolSound,
  type Segment,
  type TransitionFx,
} from '@/lib/autoDj/set';
import { getSongMap } from '@/lib/autoDj/songMap';
import { djFx } from '@/lib/djFx';
import { type Sound } from '@/services/firebase/sounds';
import { useAutoDjStore } from '@/store/autoDj';
import { usePlayerStore } from '@/store/player';
import { useShaperStore } from '@/store/shaper';
import { useSoundsStore } from '@/store/sounds';

// ---------------------------------------------------------------------------
// AUTO DJ — the hand on the controls and on the decks. Headless, mounted beside
// <AudioEngine> so it runs whether or not the player or the Shape sheet is open.
//
// WHAT IT RUNS is a SET (`lib/autoDj/set.ts`): the best parts of the
// library's sounds, cut together on downbeats. Switched on, it
//   1. reads every sound in the library, the playing one first (`getSongMap`,
//      cached after the first time), publishing how far it has got;
//   2. JOINS the sound that is playing, from the playhead through its next
//      peak, so the music never stops while the rest is read;
//   3. once EVERY sound is read, PLANS THE RUN — the whole order through the
//      library, shaped like a night (`planOrder`) — and from then on takes
//      each next sound from that plan, the last one played out to its end;
//   4. plays each segment's moves against the transport, and at the segment's
//      end CUES the next one — the next sound loaded and started on its own
//      bar line (`cueSound`), with the DJ's own sounds between the two
//      (`transitionFx`, `djFx`): a riser into the cut, a hit on it.
//
// A SONG CAN BE VISITED MORE THAN ONCE. A new record often comes in on its
// OPENING and leaves before its chorus; the set then plays something else and
// COMES BACK for the rest of it later (Juan, 2026-11-04: "las primeras partes,
// después el coro de esa misma canción o de otra, y después vuelve a las
// últimas partes de la canción anterior"). Songs left with a peak still ahead
// wait in `returns` until the set picks them up again.
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

/** Minimum dwell time on a scrolled section so the sheet never bounces frantically. */
const FOCUS_HOLD_MS = 2000;
let lastFocusAt = 0;

/** Apply a partial state, touching only what actually changes. */
function applyMove(move: Partial<DjMove>): void {
  const shaper = useShaperStore.getState();
  const player = usePlayerStore.getState();
  const nextFocus = moveFocus(
    {
      gains: shaper.gains,
      nextRoom: shaper.nextRoom,
      echo: shaper.echo,
      rate: player.rate,
      keepPitch: player.keepPitch,
    },
    move,
  );
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
  if (nextFocus) {
    const dj = useAutoDjStore.getState();
    const cur = dj.focus;
    const nowMs = Date.now();
    const holdCurrent =
      cur !== null &&
      cur !== nextFocus &&
      DJ_FOCUS_RANK[cur] >= DJ_FOCUS_RANK[nextFocus] &&
      nowMs - lastFocusAt < FOCUS_HOLD_MS;
    if (!holdCurrent) {
      dj.setFocus(nextFocus);
      lastFocusAt = nowMs;
    }
  }
  // ONE LEVEL FOR THE WHOLE SET: whatever the move did to the loudness, the
  // leveller takes back — gradually, so it never reads as a jump.
  const now = useShaperStore.getState();
  audioEngine.setLevelDb(
    djLevelDb({ gains: now.gains, nextRoom: now.nextRoom, echo: now.echo }),
    levelRampS,
  );
  levelRampS = LEVEL_RAMP_S;
}

/** How long the leveller slides over: slow on the way in, then per move. */
const LEVEL_RAMP_S = 0.35;
const LEVEL_ENTER_S = 1.5;
let levelRampS = LEVEL_ENTER_S;

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

/**
 * Flip to `true` locally only when re-recording the DÁKITI demo video so every
 * take replays `DAKITI_DEMO_SEED` deterministically; kept `false` in production
 * so DJ Juan mixes DÁKITI with a fresh random seed like every other sound.
 */
const PIN_DAKITI_DEMO = false;
const DAKITI_DEMO_SEED = 846;

const isPinnedDakiti = (
  sound: Pick<Sound, 'id' | 'name'> | null | undefined,
): boolean =>
  PIN_DAKITI_DEMO &&
  !!sound &&
  (/d[aá]kit[ií]/i.test(sound.name) || /d[aá]kit[ií]/i.test(sound.id));

export function AutoDjDirector() {
  const on = useAutoDjStore(s => s.on);
  const mode = useAutoDjStore(s => s.mode);

  useEffect(() => {
    if (!on || mode === 'off') return;
    const singleSound = mode === 'sound';

    let cancelled = false;
    const maps = new Map<string, SongMap>();
    const failed = new Set<string>();
    const played = new Set<string>();
    const random = rng(freshSeed());
    const dj = useAutoDjStore.getState();
    lastFocusAt = 0;

    let setTempo = 0;
    let firstJoin = true;

    // Starting DJ Juan (or switching between This Sound and All Sounds)
    // always rewinds the playing sound to 0:00 so the mix is heard from the
    // beginning (Juan, 2026-11-09).
    const initialPlayer = usePlayerStore.getState();
    if (initialPlayer.current) {
      initialPlayer.seek(0);
      if (!initialPlayer.playing) initialPlayer.toggle();
    }

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
    /** The run through the library, planned once it is all read. */
    let order: string[] = [];
    /** Songs left with a peak still ahead: where, and how many cuts ago. */
    const returns = new Map<string, { bar: number; at: number }>();
    /** Songs that already returned once this pass — never a third play. */
    const returned = new Set<string>();
    let cuts = 0;
    let lastReturnCut = -10;
    /** The glue chosen for the cut into `upNext`, and whether it rose yet. */
    let fx: TransitionFx | null = null;
    let rose = false;
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
      if (singleSound) {
        dj.setProgress(0, 0);
        return;
      }
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

    const allRead = () =>
      library().every(s => maps.has(s.id) || failed.has(s.id));

    /** Plan the run from `fromId`: what has not played yet, else everything. */
    const planRun = (fromId: string | null) => {
      const all = pool();
      const fresh = all.filter(p => !played.has(p.soundId));
      if (fresh.filter(p => p.soundId !== fromId).length === 0) {
        played.clear();
        returned.clear();
      }
      const base = fresh.filter(p => p.soundId !== fromId).length ? fresh : all;
      order = planOrder(base, fromId, setTempo, random);
    };

    const barOf = (seg: Segment): number => {
      const map = maps.get(seg.soundId);
      if (!map) return 2;
      return map.bpm > 0 ? map.beatS * 4 : map.blockS;
    };

    const setUpNext = (seg: Segment | null) => {
      upNext = seg;
      rose = false;
      fx =
        seg && segment
          ? transitionFx(segment, seg, random, barOf(segment))
          : null;
    };

    const chooseUpNext = () => {
      if (!segment || upNext || cued) return;
      if (singleSound) {
        const map = maps.get(segment.soundId);
        if (!map) return;
        const currentSound =
          library().find(s => s.id === segment?.soundId) ??
          usePlayerStore.getState().current;
        const dakiti = isPinnedDakiti(currentSound);
        setUpNext(
          planSoundSegment({
            sound: { soundId: segment.soundId, map },
            style: dakiti ? 'club' : nextStyle(),
            seed: dakiti ? DAKITI_DEMO_SEED : Math.floor(random() * 2 ** 31),
            atS: 0,
          }),
        );
        return;
      }
      const all = pool();
      if (all.length < 2) return;
      const plan = (
        nextId: string | undefined,
        part: Part,
        fromBar = 0,
        finale = false,
      ) => {
        const nextSound = all.find(p => p.soundId === nextId);
        if (!nextSound || !segment) return;
        setUpNext(
          planSegment({
            next: nextSound,
            style: nextStyle(),
            seed: Math.floor(random() * 2 ** 31),
            setTempo,
            after: segment.endsOn,
            part,
            fromBar,
            finale,
          }),
        );
      };

      if (allRead()) {
        // Drop what left the library or played since the plan was made.
        order = order.filter(
          id => id !== segment?.soundId && maps.has(id) && !played.has(id),
        );
        // A RETURN: a song the set left at least 3 cuts ago, picked up on a
        // later part for a shorter second turn — and at most once every 5
        // cuts (1–2 times in 10 songs; Juan, 2026-11-07).
        const waiting = [...returns.entries()].filter(
          ([id, r]) =>
            id !== segment?.soundId &&
            maps.has(id) &&
            !returned.has(id) &&
            cuts - r.at >= 3,
        );
        if (
          waiting.length &&
          cuts - lastReturnCut >= 5 &&
          (!order.length || random() < 0.22)
        ) {
          const [id, r] = waiting.sort((x, y) => x[1].at - y[1].at)[0];
          returns.delete(id);
          returned.add(id);
          lastReturnCut = cuts;
          const last = !order.length && returns.size === 0;
          plan(id, 'later', r.bar, last);
          return;
        }
        if (!order.length) planRun(segment.soundId);
        const nextId = order.shift();
        const map = nextId ? maps.get(nextId) : undefined;
        // A NEW SONG: in on its opening a quarter of the time, when it has
        // one worth playing; otherwise on its best part.
        const opening = !!map && firstPeakBar(map) >= 16 && random() < 0.25;
        plan(
          nextId,
          opening ? 'opening' : 'peak',
          0,
          !order.length && returns.size === 0,
        );
        return;
      } else {
        // Still reading: the best of what is read, without a plan to keep.
        const fresh = all.filter(
          p => p.soundId !== segment?.soundId && !played.has(p.soundId),
        );
        const nextId = planOrder(
          fresh.length ? fresh : all,
          segment.soundId,
          setTempo,
          random,
        )[0];
        plan(nextId, 'peak');
      }
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

    /** Make the playing sound the set's segment, from the start on entry. */
    const join = () => {
      const player = usePlayerStore.getState();
      const { current } = player;
      if (!current) return;
      const map = maps.get(current.id);
      if (!map) return; // read first; `pump` joins when it lands
      const startFromTop = singleSound || firstJoin;
      firstJoin = false;
      if (startFromTop && player.position > 0.35) {
        player.seek(0);
      }
      const atS = startFromTop ? 0 : player.position;
      const dakiti = isPinnedDakiti(current);
      const seed = dakiti ? DAKITI_DEMO_SEED : Math.floor(random() * 2 ** 31);
      begin(
        singleSound || dakiti
          ? planSoundSegment({
              sound: { soundId: current.id, map },
              style: dakiti ? 'club' : nextStyle(),
              seed,
              atS: 0,
            })
          : joinSegment({
              sound: { soundId: current.id, map },
              style: nextStyle(),
              seed,
              atS,
              setTempo,
            }),
        dakiti ? 0 : atS,
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
      // The song being left waits for the set to come back for its later
      // parts — only on its first visit, mainly after an opening (where the
      // chorus was held back), and at most two waiting at a time.
      const leaving = segment;
      if (
        leaving?.resumeBar !== undefined &&
        leaving.part !== 'later' &&
        !returned.has(leaving.soundId) &&
        (leaving.part === 'opening' || random() < 0.15)
      ) {
        returns.set(leaving.soundId, { bar: leaving.resumeBar, at: cuts });
        if (returns.size > 2) returns.delete(returns.keys().next().value!);
      }
      returns.delete(target.soundId);
      cuts += 1;
      cued = target;
      segment = null;
      // The hit lands on the cut and the next sound eases in under it.
      const { rate } = usePlayerStore.getState();
      if (fx?.on) djFx.play(fx.on, CUE_LEAD_S / rate);
      audioEngine.fadeInNextLoad(fx?.fadeInS ?? 0.03);
      fx = null;
      // The incoming state goes on as the cut is made, so the next sound
      // starts already shaped — including Echo, whose rewire the load hides.
      applyMove(stateAt(target.mix, target.startS));
      usePlayerStore.getState().cueSound(sound, target.startS);
    };

    /** Read the library (or just the playing sound in `sound` mode), one at a time. */
    let pumping = false;
    const pump = async () => {
      if (pumping) return;
      pumping = true;
      try {
        while (!cancelled) {
          const current = usePlayerStore.getState().current;
          const candidates = singleSound ? [current] : [current, ...library()];
          const todo = candidates.find(
            (s): s is Sound => !!s && !maps.has(s.id) && !failed.has(s.id),
          );
          if (!todo) break;
          const map = await getSongMap(todo.id, todo.audioUrl);
          if (cancelled) return;
          if (map) maps.set(todo.id, map);
          else failed.add(todo.id);
          publishProgress();
          if (!segment && !cued) join();
          else if (!singleSound && allRead() && !order.length) {
            // The whole library is read: plan the run, and re-pick what
            // comes next from it unless the cut is already on its way.
            planRun(segment?.soundId ?? null);
            if (!cued) setUpNext(null);
            chooseUpNext();
          } else chooseUpNext();
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
        djFx.stopAll();
        rose = false;
        foldTo(position);
      }
      lastPosition = position;
      if (!playing) return;

      if (upNext && position >= segment.endS - CUE_LEAD_S) {
        cue();
        return;
      }

      const { rate } = usePlayerStore.getState();
      // THE RISE INTO THE CUT, started so it ends exactly on it.
      if (upNext && fx?.before && fx.beforeS && !rose) {
        const toCut = (segment.endS - position) / rate;
        const lengthS = Math.round((fx.beforeS / rate) * 20) / 20;
        if (toCut <= lengthS + 0.2 && toCut > 0.05) {
          rose = true;
          djFx.play(fx.before, toCut, lengthS);
        }
      }
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
        if (
          singleSound &&
          !cued &&
          upNext &&
          previous.playing &&
          segment &&
          previous.position >= segment.endS - 1
        ) {
          cue();
          return;
        }
        // A load the set did not ask for: join it once it is playing, and
        // plan the rest of the run from there.
        cued = null;
        segment = null;
        setUpNext(null);
        djFx.stopAll();
        order = [];
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
        djFx.stopAll();
        rose = false;
        if (segment) next = nextMoveIndex(segment.mix, state.position);
      }
    });

    dj.setStatus('preparing');
    publishProgress();
    void pump();

    return () => {
      cancelled = true;
      clearTimers();
      djFx.stopAll();
      if (!useAutoDjStore.getState().on) {
        // Back to the person's own level, as gently as the set came in.
        audioEngine.setLevelDb(0, LEVEL_ENTER_S);
        levelRampS = LEVEL_ENTER_S;
      }
      unsubscribe();
      dj.setProgress(0, 0);
    };
  }, [on, mode]);

  return null;
}
