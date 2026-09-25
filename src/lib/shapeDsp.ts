// ---------------------------------------------------------------------------
// The NUMBERS that define this app's sound, with no native import behind them.
//
// They lived in `audioEngine.ts` until 2026-09-17, which meant reaching for any
// of them dragged in `react-native-audio-api` and, through it, React Native —
// so `test/unit/shapeHeadroom.test.ts` could not import a single one and had to
// restate them. A test that restates the values it is checking is a test that
// passes while the app drifts away from it.
//
// Nothing here touches a node or a context: it is arithmetic the graph applies,
// which is exactly what makes it testable. `audioEngine.ts` owns the wiring.
// ---------------------------------------------------------------------------

export type EqBand = {
  hz: number;
  label: string;
  type: 'lowshelf' | 'peaking' | 'highshelf';
  q?: number;
};

// A musical 5-band graphic EQ: shelves at the extremes, peaks in between.
// The shelves declare no `q` ON PURPOSE — the native filter's shelf
// coefficients take no Q at all (slope is hardcoded S = 1), so one would be
// silently ignored. See `eqResponse.ts`.
export const EQ_BANDS: EqBand[] = [
  { hz: 80, label: '80', type: 'lowshelf' },
  { hz: 250, label: '250', type: 'peaking', q: 1 },
  { hz: 1000, label: '1k', type: 'peaking', q: 1 },
  { hz: 4000, label: '4k', type: 'peaking', q: 1 },
  { hz: 12000, label: '12k', type: 'highshelf' },
];

export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;

// ---------------------------------------------------------------------------
// EFFECT LEVELS — Next Room and Echo grade by intensity (Juan, 2026-09-25).
//
// Both were on/off switches; each is now OFF plus three named steps. The steps
// are DISCRETE ON PURPOSE, not a continuous slider: every step is a measured
// PAIR — the effect's amount and the headroom trim that amount needs — and the
// trim cannot be interpolated. It comes from sample-peak modelling of real
// signals (phase rotation changes crest factor, see the trim notes below), so
// a continuous amount would need a continuous trim law nobody has measured.
// The EQ sliders have `headroomTrimDb` computing that law from the curve;
// these effects have three verified points instead, and the honest control is
// the one that only offers verified points.
// ---------------------------------------------------------------------------
export type EffectLevel = 'off' | 'low' | 'medium' | 'high';
export type ActiveEffectLevel = Exclude<EffectLevel, 'off'>;
export const EFFECT_LEVELS: readonly EffectLevel[] = [
  'off',
  'low',
  'medium',
  'high',
];

// ---------------------------------------------------------------------------
// NEXT ROOM — the sound arriving through a wall.
//
// It is one effect standing for two things people actually describe: the party
// you are hearing from the hallway, and the music playing while you are in the
// bath. Both are the SAME physics, which is why the control names the space
// rather than the occasion.
//
// A WALL IS A TILT, NOT A CUTOFF — and reading it as a cutoff cost three
// releases. Partitions obey the mass law, so transmission loss climbs with
// frequency at roughly 6 dB PER OCTAVE and then flattens out: a real partition
// leaks around door gaps, through the floor and along the studs, so the top end
// arrives QUIETLY rather than not at all. A cascade of low-passes says the
// opposite — it has no floor, and it falls at 12 dB/oct, twice the slope the
// physics asks for.
//
// THE CUTOFF WAS WALKED UP THREE TIMES AND GOT WORSE AT THE END, which is the
// evidence that the model was wrong rather than the number. Measured through
// two cascaded Q 0.707 stages at 48 kHz:
//
//        cutoff    1 kHz    2 kHz    3 kHz    4 kHz   12 kHz   verdict
//         800      -10.7    -32.2    -46.4    -56.7   -102.4   "TOO FAR FROM
//                                                               WHERE I AM"
//        1400       -2.0    -14.3    -27.2    -37.3    -82.9   "a little too
//                                                               far still"
//        2200       -0.4     -4.5    -13.1    -22.1    -67.1   "sounds worse"
//
// Every step bought consonants by giving up the illusion, because a single
// cutoff has to carry BOTH and they pull opposite ways. 2200 is where that
// finally shows: it leaves everything under 1.5 kHz untouched and removes
// everything over 4 kHz, which is a TELEPHONE — full presence band, no air —
// and a telephone does not read as distance, it reads as damage. Juan heard it
// as the effect getting worse after being made louder, and it was.
//
// SO THE WALL IS THREE HIGH-SHELF CUTS, stacked an octave and a half apart. Each
// shelf is 6 dB/oct through its transition and flat after it, so three of them
// give a long, even 6 dB/oct tilt that ENDS on a floor instead of a cliff:
//
//        60      125      250      500       1k       2k       3k       4k
//       -0.0     -0.1     -0.8     -5.7    -12.3    -19.8    -24.0    -27.2
//        6k       8k      12k      16k
//      -31.1    -32.4    -32.9    -33.0
//
// Read it against 1400 Hz, the version Juan called a heavy wall: the tilt is
// SIX dB darker at 1 kHz (-12.3 against -2.0) and FIFTY dB brighter at 12 kHz
// (-32.9 against -82.9). Both at once is the thing a cutoff cannot do — the
// midrange goes away, which is what says "not in this room", while a quiet
// residue of the top end survives, which is what says "and the door is open".
// It is also the first version where the bass genuinely passes at unity while
// the vocal is gone; under the low-passes the two moved together.
//
// THE THREE GAINS ARE ONE NUMBER. The depth (`NEXT_ROOM_LEVELS`) is the
// distance control and the shelf frequencies are the wall's character — change
// the depth to move the listener, not the frequencies. Two shelves leave the
// floor too high to read as a wall; four is a 24 dB/oct tilt, which is a
// cutoff again wearing a different shape.
//
// THERE IS NO REVERB, AND THAT IS A CONSTRAINT AS MUCH AS A TASTE. A convolved
// room was built first and is gone for two reasons that happen to agree. The
// taste one: on device it read as "a heavy concert" — reverb is the cue that
// says LARGE, and a flat is not large. The hard one is in `patches/`' own
// territory — see the fan-out note on `buildGraph` — react-native-audio-api
// 0.13.2 cannot fan a node out to two consumers, and a wet/dry reverb mix is
// nothing but a fan-out. Baking the dry path into the impulse response would
// dodge that, and is the door left open if room-ness is ever wanted back. It is
// a SMALLER door now than it was: reverb was the missing distance cue the cutoff
// kept being pushed to compensate for, and the tilt supplies distance directly.
export const NEXT_ROOM_SHELF_HZ = [500, 1500, 4000];

/**
 * How far away the room is, as the cut EACH shelf applies — the only knob, now
 * with three positions. -11 was the single shipped depth and stays the middle
 * one: a door ajar down the hall. Deeper reads as a heavier partition (-14
 * puts 1 kHz at -15.6 and the floor at -42); shallower reads as the same room
 * with something in the way (-8 puts 1 kHz at -9.0 and the floor at -24).
 *
 * EACH DEPTH CARRIES ITS OWN TRIM, measured, not scaled — see the trim note
 * below for why a cut-only filter still needs one. Re-measured 2026-09-25
 * through the same offline DF1 model the headroom test uses, worst case on the
 * flat curve (where the wall's overshoot is unmasked): at trim 0 the three
 * depths overshoot +0.57 / +0.64 / +0.69 dB, and the trims land them at
 * -0.18 / -0.36 / -0.56. A deeper wall rotates more phase, so the trim grows
 * with the depth — which is exactly why it is a table and not one constant.
 */
export const NEXT_ROOM_LEVELS: Record<
  ActiveEffectLevel,
  { depthDb: number; trimDb: number }
> = {
  low: { depthDb: -8, trimDb: -0.75 },
  medium: { depthDb: -11, trimDb: -1.0 },
  high: { depthDb: -14, trimDb: -1.25 },
};

// OFF IS AN EXACT BYPASS, AND WITH SHELVES THAT IS FREE.
//
// The wall stands in the chain whether or not Next Room is on, because the graph
// must stay serial (see `buildGraph`). So "off" has to be a filter that does
// NOTHING — and an RBJ shelf at 0 dB gain is precisely that: at A = 1 its
// numerator equals its denominator, so H(z) = 1. Verified rather than assumed,
// in `test/unit/shapeHeadroom.test.ts`: b0 is exactly 1, b1 === a1 and
// b2 === a2. Bit-identical, which is the promise the flat EQ curve makes and the
// one the wall has to keep too.
//
// THE WHOLE SWEEP APPARATUS IS GONE WITH IT, and that is the largest thing this
// change bought. A low-pass has no identity setting, so "off" used to be a
// DIFFERENT FILTER TYPE, reached by sweeping the cutoff to a parking spot near
// Nyquist and flipping the type there on a deferred, generation-guarded timer.
// Three defects came out of that arrangement, each invisible to a magnitude
// plot:
//
//  · Parked at `sampleRate / 2` the low-pass measured -0.00 dB everywhere and
//    had a DOUBLE POLE ON THE UNIT CIRCLE (radius 1.000000) — marginally
//    stable, so it rang on any discontinuity instead of settling. Juan heard
//    exactly that whenever another app made a sound: "interference… rocky for
//    half a second".
//  · Parked lower it is stable but still ROTATES PHASE, which raises the sample
//    peak of already-limited material: 0.87 dB at 0.48 × sample rate, measured
//    on hard-clipped pink noise, in the DEFAULT state where the app is supposed
//    to be bit-transparent. The two wants pull against each other — 0.499 gets
//    the overshoot to 0.175 dB but the pole radius back to 0.9956 — so there
//    was no parking spot that was both.
//  · The type flip itself had to be deferred to the end of the sweep and
//    guarded by a generation token, because flipping early jumps the sound from
//    muffled to open in one sample.
//
// A shelf needs none of it: ON and OFF are the same filter at two gains, so the
// transition is a GAIN RAMP with nothing to schedule, nothing to flip and no
// state to keep. **MEASURE THE POLES, NOT ONLY THE RESPONSE** is what the old
// arrangement taught, and the test still asserts them — the three shelves sit at
// 0.9668 / 0.9037 / 0.7615, and the 0 dB identity at 0.9548.

// THE WALL NEEDS ITS OWN TRIM, AND "A FILTER THAT ONLY CUTS CANNOT CLIP" IS THE
// REASON IT ONCE SHIPPED WITHOUT ONE (Juan, on device, 2026-09-17: "sounds rocky
// or like the sound is low quality… more noticeable when device sound is high
// enough").
//
// That reasoning confuses two different quantities, and this file already had
// the correction written down one section up: a cut never exceeds 0 dB in
// MAGNITUDE, but filtering rotates phase, which changes the crest factor, so the
// SAMPLE PEAK can land above the input's. `headroomTrimDb`'s own notes say it
// outright — a curve that only CUT still raised sample peak by 0.32 dB.
//
// Re-measured for the tilt through the same offline DF1 model the test uses,
// across every preset curve × echo level, signals normalised to a modern
// master's 0 dBFS. Worst case at each trim, on `flat` (the curve that takes no
// trim of its own, so the wall's overshoot is unmasked), at the middle depth:
//
//   trim     pink     bass    square
//    0.0    -0.75    +0.63     +0.64   CLIPS
//   -0.5    -1.25    +0.13     +0.14   CLIPS
//   -1.0    -1.75    -0.37     -0.36   clear
//
// -1.0 dB at -11, which is 0.5 dB LESS than the low-passes needed. A gentler
// slope rotates less phase, so the tilt is half a dB louder than the thing it
// replaced as well as being brighter — worth stating plainly, because "too low
// volume" is what pushed the cutoff up in the first place and neither move was
// the answer to it. The trims for the other two depths live in
// `NEXT_ROOM_LEVELS` with their own measurements.
//
// Nothing is ever ADDED here: the effect is quieter than the dry sound by the
// energy the wall removed, which is the honest amount — make-up would put the
// bass, which passes at UNITY, straight over full scale.

// The transition. A door swinging rather than a switch being thrown — and with
// the shelves it is a straight ramp of the DEPTH, which is already the
// logarithmic domain, so an even-sounding move needs no curve of its own. (The
// low-pass version had to ramp FREQUENCY exponentially for the same reason, and
// then flip a filter type at the end of it.)
export const NEXT_ROOM_SWEEP_SECONDS = 0.2;

// ---------------------------------------------------------------------------
// ECHO — repeats, as an impulse response rather than a delay line.
//
// AN ECHO IS A FAN-OUT, AND THIS LIBRARY CANNOT FAN OUT (see `buildGraph`): the
// textbook build is a dry path beside a `DelayNode` with its output fed back
// into its own input, which is two branches and a loop. So the repeats are
// baked into a CONVOLVER's impulse response instead — a spike at 0 for the dry
// signal, then decaying spikes at the repeat interval. Convolving with that is
// identical to summing delayed copies, and it is ONE node with one input and
// one output, which is the only shape that works here.
//
// THE SPACING IS ONE SETTING, NOT AN AMOUNT (Juan, on device, 2026-09-17). It
// shipped as a picker of three SPACINGS — 0.14 / 0.26 / 0.45 s — and the two
// longer ones were rejected on the only test that counts: "I can't hear the
// lyrics because of the repetition… kinda like the sound is bugged". So the
// spacing is fixed. The LEVELS that came later (2026-09-25, below) grade the
// DEPTH — how loud the repeats are — which is a different axis: every level
// keeps the one surviving spacing, so none of them can reintroduce the
// off-grid rhythm the spacing picker died of.
//
// AND THE SURVIVING SPACING WAS STILL TOO LONG, for a reason that only shows up
// on the right material: "when there are a lot of percussions the rhythm messes
// up… when it's pure voices this doesn't happen" (2026-09-20). A FIXED delay has
// no relationship to a song's tempo — 140 ms is 0.89 of a sixteenth note at
// 95 BPM — so on reggaeton every repeat landed just off the grid and argued with
// the groove. Voices have no grid to argue with, which is why they were fine.
//
// There are exactly two delays that do not do this: one locked to the tempo,
// which needs beat detection this app has no reason to carry, and one BELOW THE
// FUSION THRESHOLD. Under roughly 35 ms the ear stops hearing a repeat as a
// separate event and merges it with the source (the precedence effect), so it
// can never form a second rhythm no matter what the music is doing.
//
// 28 ms is inside that window, and the honest cost is in the name: it no longer
// reads as a distinct repeat but as THICKENING — the sound arriving twice too
// close together to count. That is the only echo that survives percussion
// without a tempo to hold on to.
export const ECHO_DELAY_SECONDS = 0.028;

/**
 * THE LEVEL IS THE FEEDBACK — how much quieter each repeat is than the one
 * before it — AND EVERY FEEDBACK CARRIES ITS OWN TRIM, because the repeats
 * genuinely ADD (see the trim note below): more feedback is more taps landing
 * on the dry signal, so the overshoot grows with the level and the trim has to
 * follow it. Modelled 2026-09-25 on signals normalised to a modern master's
 * 0 dBFS, worst case across pink / limited bass / square:
 *
 *   feedback   overshoot at trim 0   trim    residual
 *     0.30           +2.86           -3.0     -0.14
 *     0.40           +4.20           -4.5     -0.30
 *     0.45           +5.01           -5.5     -0.49
 *
 * 0.4 was the single shipped feedback (raised from 0.3 on Juan's ask for more
 * echo, 2026-09-24) and stays the middle level; 0.3 is the earlier shipped
 * value, back as Low; 0.45 is High — the value the 2026-09-24 note priced at
 * "where 'more' stops being worth the level", now a choice rather than a
 * ceiling. NOTE the -5.5: that note's model put 0.45 at -5.0, and the current
 * model measures +0.01 dB of clip there on limited bass, so High pays the
 * extra half dB. The trim IS the cost of the echo — a louder tail is a
 * quieter overall sound, and that is the honest trade.
 */
export const ECHO_LEVELS: Record<
  ActiveEffectLevel,
  { feedback: number; trimDb: number }
> = {
  low: { feedback: 0.3, trimDb: -3.0 },
  medium: { feedback: 0.4, trimDb: -4.5 },
  high: { feedback: 0.45, trimDb: -5.5 },
};

/** Stop emitting repeats once they fall below this — ~3 audible ones at 0.4. */
export const ECHO_TAIL_FLOOR = 0.03;

// THE TRIMS ABOVE EXIST BECAUSE OF THE SAME PHASE-AND-CREST TRAP THE WALL FELL
// INTO, and here it is much larger because the repeats genuinely ADD: on
// sustained bass a tap lands on top of the dry signal rather than beside it.
// An untrimmed echo overshot by up to +5 dB — which would clip exactly the way
// Next Room did before its own trim (Juan, 2026-09-17: "rocky… more noticeable
// when device sound is high enough"). Each trim is the TIGHTEST safe value for
// its feedback, not a round one — at 0.4, -4.0 dB still clips at +0.20 — and
// each holds alone AND stacked with Next Room at any depth, which the headroom
// test sweeps.

// Echo's own fade, and the gap before the convolver is connected or
// disconnected under it. The rewire is NOT instantaneous — `AudioNode::connect`
// queues the change for the graph manager to apply on its own schedule — so the
// gap is generous rather than tight: a rewire that lands after the gain has
// come back is the click this mute exists to prevent.
export const ECHO_FADE_SECONDS = 0.08;
export const ECHO_REWIRE_GAP_MS = 120;
