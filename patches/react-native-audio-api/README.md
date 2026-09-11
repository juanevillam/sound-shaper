# react-native-audio-api — music-grade Preserve Pitch, and an Android stream that can carry it

Replaces the library's `WsolaTimeStretcher` implementation (the path behind
`preservesPitch` at any rate ≠ 1×) with a phase-vocoder backend —
[Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch)
(MIT, vendored under `common/cpp/audioapi/dsp/signalsmith/` together with the
two headers it needs from
[signalsmith-linear](https://github.com/Signalsmith-Audio/linear)). The class
name and its entire public surface are unchanged, so both consumers
(`AudioFileSourceNode`, `AudioBufferBaseSourceNode`) compile untouched and the
iOS podspec / Android CMake globs pick the vendored headers up on their own.

## Why

The library's own WSOLA is voice-grade (20 ms grains, similarity search
decimated 12×) and on music it is not tunable into shape — the artifact is
inherent to time-domain overlap-add at this quality bar. Measured offline by
compiling the stretcher into a standalone harness and driving it exactly the
way `AudioFileSourceNode` does (128-frame quanta, warm-up top-off):

| 2 kHz click train, 44.1 kHz     | stock WSOLA                    | this patch |
| ------------------------------- | ------------------------------ | ---------- |
| 0.5× — clicks found (expect 32) | 69 (every click doubled)       | 32         |
| 2.0× — clicks found (expect 32) | 16 (every other click dropped) | 32         |
| 0.5× — timing error             | 10.6 ms mean, 20 ms max        | 0.00 ms    |
| 0.5× — inter-click echo floor   | −27 dB                         | −65 dB     |

A parameter sweep (windows 20/40/60 ms × search 15/30/50 ms × decimation 4/12)
made every variant worse or equal: doubling/dropping transients is what WSOLA
_is_ when the rate moves away from 1. Hence the algorithm swap, not a tuning.

Full brief and history: `docs/pending-upstream.md` § "Preserve Pitch that
doesn't sound grainy". **Nothing was filed upstream and nothing should be** —
that is a deliberate call (2026-08-22), not a to-do; the reasoning is in that
entry.

## Why the Android half exists too

The stretcher above is shared C++ and has been compiled into the Android build
all along — **the overlay was never iOS-only, and nobody should "port" it**
(verified 2026-09-11: the `.so` in the installed APK carries the signalsmith
symbols, and `compile_commands.json` shows `WsolaTimeStretcher.cpp` built at
`-DHAVE_ARM_NEON_INTRINSICS=1 -O3`). Preserve Pitch still crackled on a Galaxy
A54 at any rate ≠ 1×, and the cause was not the DSP: it was the stream the
Android backend asks for.

`AudioPlayer::openAudioStream()` opened an **exclusive MMAP stream in
`PerformanceMode::LowLatency`**, which on the A54 is a 96-frame burst — a
**2.0 ms** callback deadline, on whichever core the scheduler picks (measured: a
Cortex-A55 little core). A phase vocoder cannot land its FFT in that window.
**iOS is clean with the identical C++ purely because it never asks**: nothing in
`ios/` calls `setPreferredIOBufferDuration`, so AVAudioSession keeps its playback
default (~23 ms). The library overrides the buffer on one platform only, and
overrode it toward hard real time.

Measured on the A54, audio thread via `/proc/<tid>/schedstat`, release builds
(**debug builds are useless here** — an unoptimized graph burned 43% of a core at
1× and compressed every comparison):

| 1.5×, Preserve Pitch on | callback deadline | CPU    | preemptions/s |
| ----------------------- | ----------------- | ------ | ------------- |
| upstream (LowLatency)   | 2.0 ms            | 38.2 % | 46.2          |
| this patch (None)       | 26.7 ms           | 19.4 % | 46.2          |

(1× passthrough moved 9.6 % → 2.3 % on the same pair.)

**The preemption rate is IDENTICAL, and that is the point.** The thread is
interrupted just as often; what changed is that an interruption inside a 26.7 ms
window has slack and one inside a 2.0 ms window does not. Chasing the preemption
count — pinning to a big core, raising thread priority — would have treated the
symptom; the deadline was the defect.

A file player with an EQ has no use for low-latency mode; the cost is ~27 ms of
play/pause latency, which is imperceptible and is what iOS has always had.
Juan confirmed by ear on the A54 the same day.

## What changed

- `android/src/main/cpp/audioapi/android/core/AudioPlayer.cpp` — the output
  stream is opened `SharingMode::Shared` + `PerformanceMode::None`, and
  `setFramesPerDataCallback(RENDER_QUANTUM_SIZE)` is dropped (128 does not
  divide the hardware burst, so callbacks never aligned with it; `onAudioReady()`
  already loops in `RENDER_QUANTUM_SIZE` chunks with a `std::min` clamp, so any
  `numFrames` is safe). **No `setBufferSizeInFrames()` call** — Oboe already
  defaults the buffer to the full capacity on this path, so an explicit one
  measured as a no-op and would only be a number that looks meaningful.
- `common/cpp/audioapi/dsp/WsolaTimeStretcher.h` — same API, pimpl over the
  vendored stretcher. Latency constants updated (60/60 ms: the default preset's
  120 ms analysis block, half on each side).
- `common/cpp/audioapi/dsp/WsolaTimeStretcher.cpp` — feeds `playbackRate`
  input frames per output frame (fractional carry), maps `pitchFactor` to
  `setTransposeFactor`, materializes the end-of-stream tail on the first
  `drainOutput()` call.
- `common/cpp/audioapi/dsp/signalsmith/**` — vendored MIT headers, licenses
  alongside.

## Verifying after a version bump

`scripts/apply-patches.mjs` fails the install when the installed version is no
longer the one in `patch.json`. For `AudioPlayer.cpp`, re-check whether upstream
still opens the stream `LowLatency` — if it has switched to a playback-shaped
stream, or exposed the performance mode as an option, **delete that file from the
overlay** rather than rebasing it. For the stretcher: diff the new version's
`WsolaTimeStretcher.{h,cpp}` against 0.13.2's (if upstream's stretcher grew a
music-grade path, retire this patch — that is the preferred outcome), re-check
the call sites listed above for API drift, then update `patch.json`. The
offline harness recipe lives in the pending-upstream entry.
