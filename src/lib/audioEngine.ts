import {
  AudioContext,
  AudioManager,
  type AudioNode,
  type AudioParam,
  type AudioTagHandle,
  type AudioBuffer,
  type BiquadFilterNode,
  type ConvolverNode,
  type GainNode,
} from 'react-native-audio-api';

import { headroomTrimDb } from './eqResponse';
import {
  ECHO_DELAY_SECONDS,
  ECHO_FEEDBACK,
  ECHO_TAIL_FLOOR,
  ECHO_FADE_SECONDS,
  ECHO_REWIRE_GAP_MS,
  ECHO_TRIM_DB,
  EQ_BANDS,
  NEXT_ROOM_DEPTH_DB,
  NEXT_ROOM_SHELF_HZ,
  NEXT_ROOM_SWEEP_SECONDS,
  NEXT_ROOM_TRIM_DB,
} from './shapeDsp';

// Re-exported so every existing caller keeps its import path — the constants
// themselves live in `shapeDsp.ts` now, which nothing native reaches into.
export { EQ_BANDS, EQ_MAX_DB, EQ_MIN_DB, type EqBand } from './shapeDsp';

// ---------------------------------------------------------------------------
// The sound-shaping engine: the ONE Web-Audio graph every sound plays through.
// The <AudioEngine> component owns the streaming <Audio> element and calls
// `buildGraph` on load; this module holds the graph nodes and applies the
// shaper settings (which live in the shaper store) to them live.
//
//   mediaSource → trim → band₀ … bandₙ → wall₀ wall₁ wall₂ → wallTrim
//     → echo (convolver) → echoTrim → destination
//
// Band gains are in dB (Web Audio biquad `gain` is dB for peaking/shelf). The
// trim is a linear gain converted from dB, and it is DERIVED, never chosen —
// see below. The three walls are Next Room — high shelves whose stacked cuts
// make the mass-law tilt — and they are in the chain even when it is off,
// because a shelf at 0 dB is an EXACT identity; the graph never branches. See
// `buildGraph` for why it must not.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THERE IS NO PREAMP CONTROL, AND THAT IS THE POINT.
//
// The trim in front of the filters is computed from the curve itself
// (`headroomTrimDb`) so a boost cannot clip. It was previously a manual dB
// setting that defaulted to 0 and had NO UI on either platform — no slider, no
// row, and its `player.eq.preamp` string was never rendered — so in practice
// the chain ran with no headroom protection at all. A second, hand-driven
// preamp beside the automatic one would only raise the question of which is
// which, so there is exactly one gain node and one meaning for it.
// ---------------------------------------------------------------------------

// How fast a parameter moves to a new value. An instantaneous AudioParam write
// is a step discontinuity in the signal — measured at 30.9x the natural
// sample-to-sample slew of a 100 Hz tone on a preset change, and 19.1x while
// dragging a band in 1 dB steps. That is the click, and the zipper noise.
// Scheduling the same moves with `setTargetAtTime` puts both back at ~1x, i.e.
// gone.
//
// 12 ms is a one-pole time constant, so a move is ~95% done in 36 ms: short
// enough that dragging still feels live, long enough that nothing steps. The
// SAME constant drives the trim, which was verified rather than assumed — on a
// limited master a flat→bass switch peaks at -0.40 dBFS mid-transition, so the
// trim never lags the boost it is compensating.
const RAMP_SECONDS = 0.012;

/**
 * The echo as an impulse response: a unit spike, then decaying repeats.
 *
 * `normalize` MUST be off on the convolver that takes this. The W3C scaling
 * would divide the whole response by its own RMS, which would pull the DRY
 * spike off unity and make the effect quieter the longer its tail — the
 * opposite of the "spacing, not depth" rule above.
 */
const createEchoImpulse = (ctx: AudioContext): AudioBuffer => {
  const rate = ctx.sampleRate;
  const delay = ECHO_DELAY_SECONDS;

  const taps: { offset: number; gain: number }[] = [{ offset: 0, gain: 1 }];
  let gain = ECHO_FEEDBACK;
  let n = 1;
  while (gain > ECHO_TAIL_FLOOR) {
    taps.push({ offset: Math.round(delay * n * rate), gain });
    gain *= ECHO_FEEDBACK;
    n += 1;
  }

  const length = taps[taps.length - 1].offset + 1;
  const impulse = ctx.createBuffer(2, length, rate);
  // The SAME taps in both channels: an echo is the same sound arriving late,
  // not a new one. (Next Room's rejected reverb needed decorrelated noise for
  // exactly the opposite reason — a room's tail is not one arrival.)
  for (let channel = 0; channel < 2; channel += 1) {
    const samples = new Float32Array(length);
    for (const tap of taps) samples[tap.offset] = tap.gain;
    impulse.copyToChannel(samples, channel);
  }
  return impulse;
};

const flatGains = (): number[] => EQ_BANDS.map(() => 0);
const dbToLinear = (db: number): number => Math.pow(10, db / 20);

type Graph = {
  mediaSource: AudioNode;
  trim: GainNode;
  bands: BiquadFilterNode[];
  /** The wall — three high shelves, all at 0 dB while Next Room is off. */
  walls: BiquadFilterNode[];
  /** The wall's own headroom, unity while it is off. */
  wallTrim: GainNode;
  echo: ConvolverNode;
  echoTrim: GainNode;
  /** Whether the convolver is CONNECTED — see `applyEcho`. */
  echoOn: boolean;
};

let context: AudioContext | null = null;
let handle: AudioTagHandle | null = null;
let graph: Graph | null = null;

/** Guards the deferred convolver rewire — see `applyEcho`. */
let echoRewireTimer: ReturnType<typeof setTimeout> | null = null;
let echoGeneration = 0;

// The last-applied settings, so a freshly-built graph (new sound) inherits the
// current shaping instead of resetting to flat.
const settings = { gains: flatGains(), nextRoom: false, echo: false };

/**
 * A fresh graph starts at its target outright; a live change slides there.
 * Fading the EQ in over the first 36 ms of a sound would be its own artefact.
 */
const writeParam = (
  param: AudioParam,
  value: number,
  at: number,
  immediate: boolean,
): void => {
  if (immediate) param.setValueAtTime(value, at);
  else param.setTargetAtTime(value, at, RAMP_SECONDS);
};

/** Push `settings` onto the live graph, recomputing the headroom trim. */
const pushSettings = (immediate: boolean): void => {
  if (!graph || !context) return;

  const at = context.currentTime;
  settings.gains.forEach((db, index) => {
    const band = graph?.bands[index];
    if (band) writeParam(band.gain, db, at, immediate);
  });

  const trim = headroomTrimDb(EQ_BANDS, settings.gains, context.sampleRate);
  writeParam(graph.trim.gain, dbToLinear(trim), at, immediate);

  const wallGain = settings.nextRoom ? dbToLinear(NEXT_ROOM_TRIM_DB) : 1;
  if (immediate) {
    graph.wallTrim.gain.setValueAtTime(wallGain, at);
  } else {
    graph.wallTrim.gain.cancelScheduledValues(at);
    graph.wallTrim.gain.setValueAtTime(graph.wallTrim.gain.value, at);
    graph.wallTrim.gain.linearRampToValueAtTime(
      wallGain,
      at + NEXT_ROOM_SWEEP_SECONDS,
    );
  }

  applyEcho(immediate, at);
  applyWall(immediate, at);
};

/**
 * Echo's transition, which CONNECTS AND DISCONNECTS the convolver.
 *
 * IT USED TO STAY IN THE CHAIN AT ALL TIMES, holding a unit spike so it
 * convolved to a passthrough. That was tidy and it was the wrong trade:
 * `ConvolverNode::performConvolution` schedules onto a thread pool and then
 * calls `threadPool_->wait()` ON THE AUDIO RENDER THREAD. Blocking the render
 * callback on another thread is a real-time violation whatever the impulse
 * holds — when the system gets busy starting its own audio, the workers are
 * descheduled and the callback misses its deadline. So the DEFAULT state was
 * paying a dropout risk for an effect nobody had switched on, which is what
 * Juan heard as the app being "disrupted" by a notification or the power-off
 * sound (2026-09-20).
 *
 * Off now means ABSENT, not neutral: `wallTrim → echoTrim` with no convolver
 * anywhere in the graph.
 *
 * THE REWIRE HAPPENS UNDER A MUTE, because a connect/disconnect is not
 * click-free and the graph manager applies it on its own schedule rather than
 * when the call is made. The gain is taken to zero, the rewire is made well
 * after the ramp has landed, and the gain comes back — the same guarded-token
 * pattern `applyWall` uses, so a toggle reversed mid-transition is safe.
 */
const applyEcho = (immediate: boolean, at: number): void => {
  if (!graph || !context) return;
  const on = settings.echo;
  const target = on ? dbToLinear(ECHO_TRIM_DB) : 1;

  echoGeneration += 1;
  const generation = echoGeneration;
  if (echoRewireTimer !== null) {
    clearTimeout(echoRewireTimer);
    echoRewireTimer = null;
  }

  if (immediate) {
    graph.echoTrim.gain.setValueAtTime(target, at);
    return;
  }
  if (graph.echoOn === on) {
    // Nothing to rewire — this push was about some other setting.
    graph.echoTrim.gain.cancelScheduledValues(at);
    graph.echoTrim.gain.setValueAtTime(graph.echoTrim.gain.value, at);
    graph.echoTrim.gain.linearRampToValueAtTime(target, at + ECHO_FADE_SECONDS);
    return;
  }

  graph.echoTrim.gain.cancelScheduledValues(at);
  graph.echoTrim.gain.setValueAtTime(graph.echoTrim.gain.value, at);
  graph.echoTrim.gain.linearRampToValueAtTime(0, at + ECHO_FADE_SECONDS);

  echoRewireTimer = setTimeout(
    () => {
      echoRewireTimer = null;
      if (generation !== echoGeneration || !graph || !context) return;

      const { wallTrim, echo, echoTrim } = graph;
      try {
        if (on) {
          wallTrim.disconnect(echoTrim);
          echo.buffer = createEchoImpulse(context);
          wallTrim.connect(echo);
          echo.connect(echoTrim);
        } else {
          wallTrim.disconnect(echo);
          echo.disconnect(echoTrim);
          wallTrim.connect(echoTrim);
        }
      } catch {
        // The graph was torn down under us; the next build wires it correctly.
        return;
      }
      graph.echoOn = on;

      const now = context.currentTime;
      echoTrim.gain.cancelScheduledValues(now);
      echoTrim.gain.setValueAtTime(0, now);
      echoTrim.gain.linearRampToValueAtTime(target, now + ECHO_FADE_SECONDS);
    },
    ECHO_FADE_SECONDS * 1000 + ECHO_REWIRE_GAP_MS,
  );
};

/**
 * The wall's transition, which is now nothing but a gain ramp.
 *
 * Off is every shelf at 0 dB — an exact identity (see `shapeDsp.ts`) — and on is
 * every shelf at `NEXT_ROOM_DEPTH_DB`. Same filter, same type, same frequency at
 * both ends, so there is no coefficient jump to hide and nothing to defer.
 *
 * LINEAR IN dB, WHICH IS ALREADY THE LOGARITHMIC DOMAIN, so an even-sounding
 * move needs no curve of its own. Anchored at the live value, so a toggle
 * reversed mid-ramp continues from where the sound actually is rather than
 * jumping back to the end it was heading for.
 *
 * THIS REPLACED A GENERATION-GUARDED TIMER, and the deletion is the point. The
 * low-pass wall had no identity setting, so "off" was a different filter TYPE
 * reached by sweeping the cutoff to a parking spot near Nyquist and flipping
 * there on a deferred token — an arrangement that shipped a marginally stable
 * filter, 0.87 dB of phase overshoot in the default state, and the only timer in
 * this file. `shapeDsp.ts` carries the full account.
 */
const applyWall = (immediate: boolean, at: number): void => {
  if (!graph) return;
  const depth = settings.nextRoom ? NEXT_ROOM_DEPTH_DB : 0;

  for (const wall of graph.walls) {
    if (immediate) {
      wall.gain.setValueAtTime(depth, at);
      continue;
    }
    wall.gain.cancelScheduledValues(at);
    wall.gain.setValueAtTime(wall.gain.value, at);
    wall.gain.linearRampToValueAtTime(depth, at + NEXT_ROOM_SWEEP_SECONDS);
  }
};

export const audioEngine = {
  /** The shared context — created lazily, reused for every sound's graph. */
  getContext(): AudioContext {
    if (!context) context = new AudioContext();
    return context;
  },

  registerHandle(next: AudioTagHandle | null): void {
    handle = next;
  },

  /**
   * Wire the just-loaded media element through a fresh EQ chain. Call from the
   * <Audio> `onLoad` (createMediaElementSource throws before the source is
   * ready). The previous graph's nodes are dropped with their <Audio>.
   */
  buildGraph(tag: AudioTagHandle): void {
    this.teardownGraph();

    const ctx = this.getContext();
    const mediaSource = ctx.createMediaElementSource(tag);

    const trim = ctx.createGain();
    const bands = EQ_BANDS.map(band => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.hz;
      if (band.q) filter.Q.value = band.q;
      filter.gain.value = 0;
      return filter;
    });

    // Next Room's wall, standing in the chain whether or not it is switched on:
    // three high shelves whose stacked cuts make the mass-law tilt, and whose
    // 0 dB state is an EXACT identity, so a graph with Next Room off is
    // bit-identical to one with no wall in it at all.
    //
    // No Q — the library's shelf coefficients take none (slope is hardcoded
    // S = 1), exactly as the EQ's own two shelves declare none. See `EQ_BANDS`.
    const walls = NEXT_ROOM_SHELF_HZ.map(hz => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'highshelf';
      filter.frequency.value = hz;
      filter.gain.value = settings.nextRoom ? NEXT_ROOM_DEPTH_DB : 0;
      return filter;
    });

    // The wall's headroom, unity while it is off — see `NEXT_ROOM_TRIM_DB`.
    const wallTrim = ctx.createGain();

    // Echo. It sits AFTER the wall on purpose: the repeats are then repeats of
    // what you actually hear, so switching Next Room on does not leave bright
    // echoes of a muffled sound ringing over the top of it.
    //
    // `normalize` off — see `createEchoImpulse`.
    const echo = ctx.createConvolver();
    echo.normalize = false;
    // THE BUFFER IS SET HERE, NOT LEFT TO `pushSettings`. A convolver with no
    // response has no partitions and no thread pool, and the native node does
    // not check before using them: it segfaults in `ThreadPool::wait()` on the
    // audio IO thread the moment anything plays. That shipped on 2026-09-17 —
    // `pushSettings` assigns the buffer only when the AMOUNT CHANGES, and on a
    // fresh graph it has not, so 'off' meant "never assigned" rather than
    // "assigned the passthrough spike".
    const echoTrim = ctx.createGain();

    // THIS CHAIN IS STRICTLY SERIAL, AND IT HAS TO BE:
    // react-native-audio-api 0.13.2 CANNOT FAN A NODE OUT TO TWO CONSUMERS.
    //
    // `AudioNode::processInputs` sets `processingBuffer = inputBuffer` — it
    // ALIASES the upstream node's own `audioBuffer_` rather than copying it —
    // and every `processNode` in the library writes through that alias IN
    // PLACE (`GainNode` multiplies the channel, `BiquadFilterNode` filters the
    // span). A second consumer of the same node then hits the
    // `isAlreadyProcessed()` guard, which hands back that same buffer, so it
    // receives whatever the FIRST consumer already did to it.
    //
    // Next Room shipped as a parallel direct/room split on 2026-09-16 and this
    // is what it cost: switching the effect OFF produced SILENCE rather than
    // the dry sound, because the room bus multiplied the shared buffer by its
    // own zero before the direct bus read it. No amount of gain scheduling
    // fixes that — two crossfade rewrites were tried first and neither could,
    // because the defect is in the buffers and not in the automation.
    //
    // So: one input, one output, all the way to the destination. Anything that
    // wants a parallel path here (a reverb's wet/dry, a sidechain) must fold it
    // into a single node instead — a convolver whose impulse response carries
    // the dry path is the worked example.
    let node: AudioNode = mediaSource;
    node.connect(trim);
    node = trim;
    for (const band of bands) {
      node.connect(band);
      node = band;
    }
    for (const wall of walls) {
      node.connect(wall);
      node = wall;
    }
    node.connect(wallTrim);
    // THE CONVOLVER IS ONLY IN THE CHAIN WHEN ECHO IS ON — see `applyEcho`.
    if (settings.echo) {
      echo.buffer = createEchoImpulse(ctx);
      wallTrim.connect(echo);
      echo.connect(echoTrim);
    } else {
      wallTrim.connect(echoTrim);
    }
    echoTrim.connect(ctx.destination);

    graph = {
      mediaSource,
      trim,
      bands,
      walls,
      wallTrim,
      echo,
      echoTrim,
      // Seeded from the live setting, so a graph rebuilt mid-session (a new
      // sound) keeps the echo the person already chose.
      echoOn: settings.echo,
    };
    pushSettings(true);
  },

  /** Drop the previous sound's nodes so reloads don't accumulate orphans. */
  teardownGraph(): void {
    if (!graph) return;
    // A pending convolver rewire belongs to the graph that scheduled it.
    if (echoRewireTimer !== null) {
      clearTimeout(echoRewireTimer);
      echoRewireTimer = null;
    }
    echoGeneration += 1;
    try {
      graph.mediaSource.disconnect();
      graph.trim.disconnect();
      graph.bands.forEach(band => band.disconnect());
      graph.walls.forEach(wall => wall.disconnect());
      graph.wallTrim.disconnect();
      graph.echo.disconnect();
      graph.echoTrim.disconnect();
    } catch {
      // The old media source rides a disposed <Audio>; ignore if already gone.
    }
    graph = null;
  },

  /**
   * Push a full shape onto the live graph (preset / reset).
   *
   * `nextRoom` is OPTIONAL and left alone when omitted, because the two are
   * independent: picking an EQ preset must not walk you back out of the room.
   * The reset path passes it explicitly, which is the case that matters — see
   * the user-scoping note in `store/shaper.ts`.
   */
  apply(gains: number[], nextRoom?: boolean, echo?: boolean): void {
    settings.gains = [...gains];
    if (nextRoom !== undefined) settings.nextRoom = nextRoom;
    if (echo !== undefined) settings.echo = echo;
    pushSettings(false);
  },

  setBandGain(index: number, db: number): void {
    settings.gains[index] = db;
    pushSettings(false);
  },

  /** Next Room on/off — the wall. */
  setNextRoom(on: boolean): void {
    settings.nextRoom = on;
    pushSettings(false);
  },

  /** Echo on/off — the repeats. */
  setEcho(on: boolean): void {
    settings.echo = on;
    pushSettings(false);
  },

  // --- Transport (delegates to the streaming <Audio> handle) ---------------
  play(): void {
    handle?.play();
  },
  pause(): void {
    handle?.pause();
  },
  seek(seconds: number): void {
    handle?.seekToTime(seconds);
  },

  /** Activate the audio session (playback category, keeps the FG service). */
  activateSession(): Promise<void> {
    return AudioManager.setAudioSessionActivity(true);
  },
};
