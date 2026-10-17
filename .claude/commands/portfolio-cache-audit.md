---
description: Audit what an app recomputes, refetches or relearns that it already knew — and give every stable value one home, one key, one death. Report-first.
argument-hint: [surfaces to focus on or exclude]
---

# Cache audit — never learn the same thing twice

The moment this command exists for: the user keeps catching the app relearning
something it already knew and asking "can't this be cached?" — a duration
relearned on every skip, a waveform re-decoded on every open, a placeholder
flashing over a value the app held two seconds ago. Each of those is one
question asked over and over: **does this value change, and if not, why is it
being recomputed?** This audit asks it everywhere at once, so nobody has to
keep asking it one flicker at a time.

This is the data audit's sibling, not its overlap. `/portfolio-data-audit`
counts what the app asks the NETWORK and what that costs; this one hunts what
the app asks ITSELF — decodes, measurements, derivations, relearned facts —
and what the re-asking costs in flicker, spinners and dropped frames. Where a
finding is about wire reads or listener scope, hand it to the data audit's
rules rather than re-deriving them here.

**The symptom is almost always visible.** A recompute of a stable value shows
up as UI: a `0:00` or `-:--` where a number was just known, a skeleton for
content seen ten seconds ago, a beat of blank artwork, a control that measures
itself and then jumps. Hunt the symptoms and the recomputes underneath them
fall out.

Scope from the user (the app is Sound Shaper; any surfaces to leave alone —
the whole app if not given): $ARGUMENTS

Three contracts, same as the other portfolio audits:

1. **Scope is explicit and echoed back**, exclusions respected. A serious
   finding just outside them goes in its own labelled section for the user to
   decide.
2. **Report before code.** Ranked findings with file:line evidence. The user
   cuts and approves. Mark any finding whose fix CHANGES BEHAVIOR (a new
   Firestore field, a new device file) so approval is informed.
3. **Read every compute path in scope.** The audit's value is noticing that a
   value learned in one file is relearned in another, and you cannot notice
   that in a file you didn't open.

## Phase 0 — Ground yourself in what is already cached

Half the plausible findings evaporate here; the other half sharpen.

1. **Read `AGENTS.md` / `CLAUDE.md`, the app's docs and memory.** Standing
   rules outrank every checklist below — and this repo's docs record several
   caches that already exist, each with reasoning worth not re-deriving.
2. **Inventory the caches the app already has**, because the fix for a finding
   is usually "join an existing cache", not "invent a new one":
   - Firestore's local persistence (on by default in RN Firebase) — cold
     starts replay from disk; see the data audit for what that does and
     doesn't cover.
   - `expo-image`'s `memory-disk` cache, and any `prefetch` call sites — the
     fetch-early-render-late pattern (`prefetchPlayerBackdrop` is the model:
     prefetch the EXACT transformed URL the component will request, so the
     prefetch IS the cache key).
   - Any versioned derived-data cache (`lib/waveform.ts` is the model: JSON on
     disk, `CACHE_VERSION` in the key, bucket params in the version).
   - Any banked-metadata field (`Sound.durationMs` is the model: learned from
     the engine's first report, written once to the doc, seeded on every later
     load, engine still wins over the seed).
   - Zustand stores that survive navigation, and which of them persist.
3. **Establish the baseline is green** — typecheck, lint, tests — and note any
   in-flight work so your diff stays separable.
4. **Get something runnable early.** Findings here are proven by timing and by
   flicker, both of which need the app running on real data.

## Phase 1 — Inventory every recompute

Mechanical, and it aims the reading. Sweep for the four families:

```bash
# derivations and decodes
grep -rn "decode\|useMemo\|measure(\|measureInWindow\|onLayout" src modules --include='*.ts' --include='*.tsx' -l
# placeholder branches — every one marks a value the app claims not to know
grep -rn "'-:--'\|'--:--'\|Skeleton\|placeholder\|useDelayedShow" src -l
# device storage already in play
grep -rn "AsyncStorage\|FileSystem\|persist(" src modules -l
```

For each site, record four things:

| column                 | what it answers                                              |
| ---------------------- | ------------------------------------------------------------ |
| **value**              | what is being computed / fetched / measured                  |
| **stability**          | immutable / changes only on user edit / live                 |
| **trigger**            | per render / per mount / per navigation / per session / once |
| **cost when re-asked** | a flicker, a spinner, a decode, a dropped frame, nothing     |

The finding shape is a row where **stability** says "immutable" and
**trigger** says anything but "once".

## Phase 2 — The four questions

### 1. Does this value ever change — and who could change it?

The whole audit in one question. A sound's duration, a decoded waveform, a
file's hash, a measured intrinsic size: nobody can change these, so learning
them twice is a defect. A name, a cover, a setting: the user changes them, so
they cache until the edit. A playhead, a follower count: live, and not this
audit's business.

> Found this session: the player relearned every sound's duration from the
> engine on every load, so every skip flashed `3:09 → 0:00 → 2:50`. The
> duration never changes — it is metadata that nothing had ever stored.

### 2. Where is the value's one home?

Scope decides the home, and the table is short:

| the value should survive               | home                          | model in this repo       |
| -------------------------------------- | ----------------------------- | ------------------------ |
| the device (it's THIS user's, forever) | a field on the doc            | `Sound.durationMs`       |
| the install (derived, recomputable)    | versioned file / AsyncStorage | waveform JSON cache      |
| the session (cheap to relearn cold)    | module map / zustand store    | explore search TTL cache |
| the render (same props, same answer)   | `useMemo` / `memo`            | tile SVG chunks          |

Two rules that keep the table honest. **A fetch-level cache belongs in the
SERVICE**, so every caller gets it — a `useRef` inside one hook dies with the
screen and helps nobody else. And **a doc field is the strongest home but the
only one that costs a write and a rules check** — it must be a value worth
having on every device, and the write must be once, fire-and-forget, with no
`updatedAt` bump (nothing the person edited changed).

### 3. What is the key, and what is the version?

- **Key by everything that changes the answer** — source id, transform params,
  and the uid where an account switch could inherit another account's cache.
- **Version every derived cache** (`CACHE_VERSION` in the key), and bump it
  when the derivation changes — the waveform cache went `v1 → v2` when its
  bucket size changed, which is what kept stale buckets from rendering at the
  new scale.
- **Never cache a failure.** One bad moment sticks for the whole TTL and the
  retry button has nothing to do.

### 4. When does it die?

Every cache needs a stated death, or it is a stale-data bug on a delay:

- **Immutable facts never die** — but the live source still WINS over the
  seed. The pattern is seed-then-override: show the cached value on frame one,
  let the authoritative report land over it, and re-bank if they disagree
  beyond tolerance. That tolerance matters — `durationMs` re-banks only past
  1s, so container jitter doesn't rewrite the doc on every play.
- **User-edited values die on the edit** — which is free when the cache IS the
  doc and the app already listens to it.
- **Session caches die on the deliberate re-ask** — pull-to-refresh, retry,
  sign-out. A stale answer behind a refresh gesture is exactly what the
  gesture rules out.
- **Derived caches die on the version bump**, and old entries get cleaned up,
  not abandoned — a cache directory that only ever grows is a finding too.

## Phase 3 — The UI recompute pass

The same question at render scale, where the cost is frames rather than
flicker:

1. **Same props, same answer, re-derived per render.** Heavy `useMemo`-less
   derivations in components that re-render often (anything subscribed near
   the transport tick). The leaf-reader rule from the data audit applies
   before memoization: first stop the re-render, then memo what remains.
2. **Measured once is measured.** An `onLayout` or `measureInWindow` answer
   for a box that cannot change should be taken once and kept (the transport
   anchor is the model: measured when the expand settles, stored in a module,
   read forever). But **never put a cached measurement on the layout path of
   its own first frame** — that is the async-answer family the root AGENTS.md
   documents; state the box instead.
3. **A modifier re-sent is a computation re-run.** Native-side state
   (SwiftUI modifiers, adaptive materials) re-evaluates when React re-sends
   identical props — `memo` on decorative native surfaces is a cache too
   (`GlassSurfaceIos` is the model, and the adaptive-glass flip was the bug).
4. **Prefetch is the cache for first frames.** Where a layer mounts on reveal,
   its assets should be warmed on the DATA change (`prefetchPlayerBackdrop`),
   keyed by the exact URL the component will request.

## Phase 4 — Report (stop for approval)

```
# Cache audit: <app(s)> — <date>

## Verdict
One honest paragraph, and START WITH WHAT IS ALREADY CACHED RIGHT — the
versioned caches, the banked fields, the prefetches. The user needs to know
what NOT to churn.

## Findings
Ranked by felt cost (flicker the user sees > frames > cold-start time).
Each: file:line, the value, its stability, what re-asking costs, the fix and
its HOME from the Phase 2 table. Mark behavior changes (new doc fields, new
files on disk) explicitly.

## Checked and sound
The recompute paths you read and found correct — what stops the next run
re-deriving them.

## Deliberately not cached
Where the honest answer is "recompute is fine" — cheap derivations, live
values, caches whose invalidation would cost more than the recompute. Say why,
so the question stays answered.

## Ranked fix order
Batches, each independently verifiable.
```

Present it and wait.

## Phase 5 — Execute approved batches

- Felt-cost order: the flickers the user reported first, then first-frame
  costs, then frame-rate costs, then cold-start costs.
- **Seed-then-override, never seed-and-trust**: wherever a cached value stands
  in for a live source, the live source must still land over it and win.
- **A wrong cached value that looks right is worse than a placeholder.** If
  the cache cannot be trusted yet (no version, no tolerance), ship the
  placeholder until it can.
- After each batch: typecheck, lint, tests — and **prove the cache with the
  app**, not the code.

## Verification discipline

- **Prove the HIT, not just the miss.** First open must show the learn path
  (placeholder, decode); second open must not. For a banked doc field, play
  once, cold-restart, and confirm the value is on the first frame of the next
  load.
- **Prove the death.** Trip each invalidation you claimed — the edit, the
  refresh, the version bump — and confirm the cache actually re-learns.
  A cache whose invalidation was never exercised is a stale-data bug waiting.
- **Time it or frame-scan it.** "Feels faster" is not a result. A first-vs-
  second-open comparison, a band-scan showing the placeholder frame gone, a
  bundle-served-by-which-Metro check before believing any of it (the probe
  recipe is in `/portfolio-data-audit`'s verification section).
- **Watch the account switch.** Sign out, sign in as nobody, and confirm no
  cache keyed without a uid leaks the previous account's values.
