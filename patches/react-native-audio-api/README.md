# react-native-audio-api — music-grade Preserve Pitch

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
doesn't sound grainy". The upstream issue (with repro) is drafted in
`docs/upstream-issue-wsola-draft.md`, awaiting filing.

## What changed

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
longer the one in `patch.json`. To re-verify: diff the new version's
`WsolaTimeStretcher.{h,cpp}` against 0.13.2's (if upstream's stretcher grew a
music-grade path, retire this patch — that is the preferred outcome), re-check
the call sites listed above for API drift, then update `patch.json`. The
offline harness recipe lives in the pending-upstream entry.
