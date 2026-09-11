# react-native-audio-api — music-grade Preserve Pitch, an Android stream that can carry it, and a now-playing artwork that can be CLEARED

Three changes, two unrelated subjects. The first two are halves of one feature
(Preserve Pitch on music) and are described together below; the third is a
plain defect in the now-playing surface and has its own section at the end.

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

## The third change: a now-playing artwork nothing could clear

**The defect.** Play a sound with a cover, then one without, and the Dynamic
Island / Lock Screen / Control Center (iOS) and the shade and lock-screen media
card (Android) kept the FIRST sound's artwork beside the second sound's title.
Reported on device 2026-09-11.

Both platforms MERGE a publish over the last one, and neither has a removal:

- **iOS** `updateNowPlayingInfo:` takes `[self.playingInfoCenter.nowPlayingInfo
mutableCopy]` and writes only the keys the payload carries.
  `MPMediaItemPropertyArtwork` therefore survives, and so do the two other
  places the cover is held — `_currentInfo[@"artwork"]`, which the method
  re-reads at its tail, and `self.artworkUrl`. `updateArtworkIfNeeded:` opens
  with `if (!artworkUrl) return;`, so nil is a no-op rather than a clear.
- **Android** holds the decoded cover in an `artwork: Bitmap?` FIELD that
  outlives the track, and `updateInternal`'s tail does
  `if (artwork != null) md.putBitmap(METADATA_KEY_ART, artwork)` on a metadata
  builder that is otherwise rebuilt from scratch every publish. The
  notification's `setLargeIcon` keeps it too.

**No value a caller could send cleared it.** Omitting the key skipped the block
on both sides; `""` and `null` reached the load path, failed to decode, and
left every field untouched. Only `hide()` clears — and on Android `hide()`
releases the `MediaSessionCompat` and zeroes the `controls` bitmask, so using it
between tracks tears the notification down and re-posts it with `actions=0`
(the same failure `NowPlayingBridge.tsx` already documents from
`dumpsys media_session`).

**A SECOND staleness path was found doing this, and it survives the first fix.**
The artwork load is a blocking network read — `[NSData dataWithContentsOfURL:]`
on a background queue, `URL.openConnection()` on a bare `Thread` — with nothing
that cancels one. iOS never cancelled at all; Android's `interrupt()` does not
abort a socket read. So skipping tracks quickly leaves several loads in flight
and the LAST to COMPLETE wins the slot, which need not be the one playing. Left
alone this would have beaten the clear: the outgoing track's late load would
stamp its cover over the cover-less track that replaced it, and the clear would
appear not to work.

### What changed

- `ios/audioapi/ios/system/notification/PlaybackNotification.mm` — an empty
  `artwork` value (absent, `NSNull`, `@""`, or a `{uri:}` dict holding either)
  now REMOVES: the key goes from the center's dictionary and from
  `_currentInfo`, and `self.artworkUrl` goes to nil. `isEmptyArtwork:` is the
  new helper. An `_artworkGeneration` counter stamps each load; the completion
  block drops itself when the session has moved past it, and `hide` and every
  clear move the counter on.
- `android/src/main/java/com/swmansion/audioapi/system/notification/PlaybackNotification.kt`
  — the same, in Kotlin, lifted out of `updateInternal` into an `updateArtwork`
  of its own: an empty uri nulls the `artwork` field and calls
  `setLargeIcon(null as Bitmap?)`, and an `artworkGeneration` counter guards the
  `runOnUiQueueThread` block.

Two smaller things came with the Android half, both of which iOS already had:

- **An unchanged cover is no longer re-fetched.** Upstream interrupted the
  thread and started a fresh network read on EVERY publish, and a player
  publishes on every pause, every rate change and every scrub —
  `updateArtworkIfNeeded:` has always returned early on an unchanged url whose
  image is in place, and `artworkUri` is that guard. A load that FAILS clears
  `artworkUri`, so the next publish is still a retry.
- **A cover that fails to load falls back to the system placeholder**, not to
  the PREVIOUS track's cover, which is the same inheritance this patch exists
  to stop.

Everything here is additive — a cover that loads behaves exactly as before, so
any other consumer is unaffected.

### Verified

On the Galaxy A54 (2026-09-11), reading `adb shell dumpsys media_session`, whose
`metadata: size=` counts the keys the session carries — 5 with a cover
(TITLE, ARTIST, ALBUM, DURATION, ART), 4 without:

| step                          | session                                       |
| ----------------------------- | --------------------------------------------- |
| a covered sound               | `size=5, description=Nightmare, plenka`       |
| skip to a COVER-LESS sound    | `size=4, description=Closed, plenka`          |
| skip on to a covered one      | `size=5, description=snobbery, LONOWN`        |
| four skips fired back to back | `size=5, description=Immortals, Fall Out Boy` |

The shade card drew `Closed / plenka` on a plain surface with no inherited
artwork, the transport intact (`actions=310`, prev / pause / next) — the clear
does not go through `hide()`, so the control bitmask is untouched. The last row
is the race: the settled session names the sound the app is actually playing.

### Who asks for it

`apps/sound-shaper/src/components/player/NowPlayingBridge.tsx` publishes
`artwork: ''` for a sound with no `artUrl`, where it used to omit the key. What
the emptied slot falls back to is each platform's own art-less placeholder —
which is what Music and Podcasts show, and what this app already showed for a
sound that never had a cover, so both cover-less cases now agree.

## Verifying after a version bump

`scripts/apply-patches.mjs` fails the install when the installed version is no
longer the one in `patch.json`. For the two `PlaybackNotification` files, check
whether upstream has given `artwork` a removal of its own (a nullable metadata
setter, an explicit `clearArtwork`, or a merge that honours an absent key) and
whether the load has grown a cancellation or a session token — if BOTH are
there, delete those two files from the overlay; if only one is,
`NowPlayingBridge.tsx` still needs the other, so rebase the half that is still
missing. Nothing else in either file is ours, so a rebase is a re-apply of the
blocks marked `PATCH:`. For `AudioPlayer.cpp`, re-check whether upstream
still opens the stream `LowLatency` — if it has switched to a playback-shaped
stream, or exposed the performance mode as an option, **delete that file from the
overlay** rather than rebasing it. For the stretcher: diff the new version's
`WsolaTimeStretcher.{h,cpp}` against 0.13.2's (if upstream's stretcher grew a
music-grade path, retire this patch — that is the preferred outcome), re-check
the call sites listed above for API drift, then update `patch.json`. The
offline harness recipe lives in the pending-upstream entry.
