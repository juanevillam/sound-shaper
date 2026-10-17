---
description: Audit how an app talks to Firebase, Cloudinary and the media pipeline — how many reads it makes, what it caches, what it keeps alive that nobody is looking at. Report-first.
argument-hint: [surfaces to focus on or exclude]
---

# Data audit — the fewest calls that still feel instant

The moment this command exists for: the apps work, the UI is done, and the
question has moved to **what they cost while they work**. Firebase is on the
Spark (free) tier, Cloudinary is unsigned and unmetered by us, and both are easy
to overdraw without a single visible bug. A `onSnapshot` in the wrong place bills
forever and shows nothing; a full-resolution cover decoded behind an invisible
layer costs a frame every frame.

**Fewer calls is also the better UX.** Every finding here has two payoffs — the
quota and the feel — and where they disagree, the feel wins. This audit never
trades a working screen for a cheaper one.

Scope from the user (the app is Sound Shaper; any surfaces to leave alone —
the whole app if not given): $ARGUMENTS

Three contracts, same as the other portfolio audits:

1. **Scope is explicit and echoed back**, exclusions respected. A serious finding
   just outside them goes in its own labelled section for the user to decide.
2. **Report before code.** Ranked findings with file:line evidence. The user cuts
   and approves.
3. **Read every data path in scope.** This audit does not sample — its value is
   noticing that two hooks open the same query, and you cannot notice that in a
   file you didn't open.

## Phase 0 — Ground yourself in what the SDK already does

Do this before reading a line of app code, because half the plausible findings
evaporate here.

1. **Read `AGENTS.md` / `CLAUDE.md`, the app's own docs and memory.** Standing
   rules outrank every checklist below.
2. **Confirm Firestore's local persistence is on and nothing disables it.** Grep
   for `settings(`, `persistence`, `initializeFirestore`, `cacheSizeBytes`.
   React Native Firebase enables the disk cache by default. This single fact
   decides the whole audit's shape:
   - **`onSnapshot` is cheap to re-attach.** A cold start replays from disk and
     resumes the listener from its token, so only documents that actually
     CHANGED are billed. A long-lived listener over rarely-changing data is not
     the disaster it looks like.
   - **`getDocs` is not.** A one-shot read never touches the local cache: it goes
     to the server and bills every document it returns, every single time. **The
     `getDocs` call sites are where the quota actually goes.** Start there.
3. **Establish the baseline is green** — typecheck, lint, tests — and note any
   uncommitted in-flight work so you can tell your diff from the user's.
4. **Get something runnable early.** This audit ends on a device. Find the
   simulator, find which Metro serves which app (see Verification), and confirm
   the app launches before you start editing.

## Phase 1 — Inventory every call

Mechanical, and it aims the reading:

```bash
grep -rln "onSnapshot\|getDocs\|getDoc(" src modules targets media-worker --include='*.ts' --include='*.tsx'
```

For each call site, record four things:

| column            | what it answers                                            |
| ----------------- | ---------------------------------------------------------- |
| **kind**          | listener / one-shot / batched one-shot                     |
| **mounted where** | app layout (session-long), screen, component, per-row      |
| **lifetime**      | until sign-out / until the screen unmounts / per keystroke |
| **who reads it**  | the surfaces that consume the store slice — by name        |

The last column is the one that finds things. A session-long listener whose only
reader is one row of a rarely-opened sheet is the shape to hunt.

Also inventory the media path: every `<Image>`, every artwork component, and
whether each goes through the display-size URL transform.

## Phase 2 — Ask the four questions

### 1. Should this be a listener at all?

A listener is right for data **someone else changes while you are looking at it**
— your own content in a live list, a feed, a follower count. It is wrong for data
only this device writes, or that cannot change: a profile doc, a creation date, a
settings blob. Those are one reads.

> Found this session: Sound Shaper held a live `users/{uid}` listener for the
> entire session so that one row of the Account sheet could show a date nobody
> else can change. Now `useOwnProfile`, a one-shot from the sheet that reads it,
> with the store kept so a second visit is instant.

### 2. Is it attached when nothing is reading it?

A listener that follows the DATA rather than the SURFACE fires on state changes
the user cannot see.

> Found this session: the clips listener took `current?.id`, so it attached the
> moment any sound started playing. Skip through twenty tracks, twenty attaches
> — for a subcollection drawn only inside the expanded player. It follows the
> console's mount now.

Same question for RENDER: is a layer mounted-and-invisible? An expensive one
faded to `opacity: 0` still composites, still decodes, still holds memory.

### 3. Is the same query opened twice?

The client folds identical query targets into one watch stream, so the wire cost
of a duplicate is near zero — **do not report it as a bandwidth finding.** The
real cost is two React trees woken by every change and two copies of a query to
keep in step. The fix is the app's own rule: one sync hook in the authenticated
layout, everything else reads the store.

### 4. Is a `getDocs` re-answering a question it just answered?

This is where the quota goes. Debounced search, browse pages, profile hydration,
anything fired per keystroke or per mount.

> Found this session: Explore fired THREE server queries per debounced keystroke,
> with no result cache — backspacing a character and retyping it paid for all
> three again. Both platform twins had their own copy of the same three calls.
> Now one `searchExplore` behind a TTL'd session cache, shared by both.

Cache rules that came out of building it:

- **Never cache a failure.** One bad moment would stick to that query for the
  whole TTL and the retry button would have nothing to do.
- **Key by the excluded/current uid**, so an account switch cannot inherit.
- **Clear on the deliberate re-ask** — pull-to-refresh, retry, sign-out. A stale
  answer behind a refresh gesture is exactly what the gesture rules out.
- **A fetch-level cache belongs in the SERVICE**, so every caller gets it; the
  store is only the reactive half that wakes React. They are not redundant — a
  plain Map cannot re-render.

## Phase 3 — The media and playback pass

1. **Every remote image goes through the display-size transform.** Grep for the
   transform helper's call sites and for `<Image>` — the gap between the two
   lists is the finding. Expect one straggler; a term added after a surface was
   written never retrofits itself.
2. **Fetch early, render late.** A layer that is expensive to draw should not be
   mounted while invisible — but gating its mount means the first frame of the
   reveal becomes a cold fetch. Prefetch the exact URL on the data change, mount
   the layer on the reveal. The prefetch is deterministic only if it uses the
   same transform the component will.
3. **Find out whether audio/video STREAMS or downloads whole.** Do not assume;
   read the library. Streaming usually depends on conditions the app can break:
   a build flag, and whether the origin advertises byte ranges. Probe the CDN
   directly — `curl -I <url>` for `accept-ranges: bytes`, and a
   `Range: bytes=0-0` that answers `206`. Record the answer in the app's docs,
   because the fallback is silent.
4. **A high-frequency transport tick must stop at a leaf.** A player reports its
   position ~10×/s. If a large screen component subscribes to it, that whole
   tree re-renders ten times a second to move a thumb — collapsed banner
   included. Push the subscription down to the components that draw the number,
   and keep the drag-local value there with it. Everything else reads the
   playhead once, at the moment of the action, via `getState()`.

## Phase 4 — Report (stop for approval)

```
# Data audit: <app(s)> — <date>

## Verdict
One honest paragraph, and START WITH WHAT IS ALREADY RIGHT — persistence on,
listeners scoped, images transformed. A report that manufactures severity is
worse than useless, and the user needs to know what NOT to churn.

## Findings
Ranked by real cost. Each: file:line, what it costs and when, the fix.
Mark any finding that CHANGES BEHAVIOR so approval is informed.

## Checked and sound
The paths you read and found correct. This is what stops the next run of this
command re-deriving them.

## Deliberately not fixed
Anything where the honest fix is bigger than the finding. Say why.

## Ranked fix order
Batches, each independently verifiable.
```

Present it and wait.

## Phase 5 — Execute approved batches

- Highest real cost first: the per-keystroke `getDocs`, then the always-mounted
  expensive render, then the mis-scoped listeners, then the cleanups.
- **A silent cap is worse than the cost it saves.** A `limit()` with no paging
  behind it hides rows from a list that claims to be the whole list. If the
  honest fix is paging and paging is out of scope, **leave it unbounded and
  record why in the code** — do not half-solve it.
- **Never truncate the user's own content** to save reads. A personal library, a
  follower list: these are the only thing the app holds.
- After each batch: typecheck, lint, tests — and **run it**.

---

# Appendix — recurring shapes

Prompts, not boxes. The project's own rules outrank all of it.

1. **The session-long listener with one rare reader.** → one-shot from that
   screen, store kept for instant re-entry.
2. **The listener keyed on data instead of on the surface that reads it.**
3. **Two hooks on one query.** → one sync hook in the layout, stores everywhere
   else. Report as a render/maintenance finding, not a bandwidth one.
4. **The per-keystroke fan-out with no cache**, duplicated across platform twins.
5. **The per-mount `getDocs` cache that dies with the screen** (a `useRef` inside
   a hook) → lift it to the service so every caller benefits.
6. **The expensive invisible layer** — mounted always, faded by an animation.
7. **The 10Hz store write read by a 1500-line component.**
8. **A reload where a seek would do.** Remounting a media element re-pays
   connection setup and any capability probe the library runs first. Remount only
   when the element genuinely cannot continue (an ended one); otherwise seek.
9. **The one image that skips the size transform.**
10. **A one-shot backfill or migration that retries forever on failure** →
    attempt counter, keyed alongside the schema version so a bump resets it.
11. **An unbounded listener over other people's edges** (followers, following).
    Real, and the fix is paging — see the silent-cap rule before reaching for
    `limit()`.
12. **Denormalized counters and preview projections** — check they are still
    written by exactly one writer, and that the read path uses them instead of an
    N+1 subcollection query per card.

## Verification discipline

- **Prove the device is running YOUR code before you believe a screenshot.** The
  portfolio's other apps may have their own Metro on this Mac, so first find
  which serves which app (a Release build on the iPhone has no Metro at all —
  there, the check is that the build was made from this commit):

  ```bash
  lsof -nP -iTCP -sTCP:LISTEN | grep node        # the ports
  lsof -a -p <pid> -d cwd -Fn                    # the app each one serves
  ```

  Then fetch the bundle that port actually serves and grep it for a symbol you
  just wrote. This catches a stale bundle AND a bundling error in one step, before
  any UI reasoning:

  ```bash
  curl -s "http://localhost:<port>/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false" -o /tmp/app.bundle
  grep -c MyNewSymbol /tmp/app.bundle
  ```

  A near-empty bundle whose first bytes are `{"type":"UnableToResolveError"...`
  is a wrong entry path, not a broken app.

- **Exercise the paths you changed, on real data.** A data-layer diff that
  typechecks can still return nothing. Open the feed, run the search, open the
  player, collapse it.
- **Measure motion numerically, not by eye.** For anything that advances over
  time (a progress fill, a playhead), capture frames seconds apart and scan the
  same pixel row for the fill's edge in each. Three frames with three different
  edges is proof; one screenshot is not.
- **Prove the invisible thing is gone**, not just that the visible thing still
  works — collapse the surface and confirm the layer you gated is actually
  unmounted.
- Record any library limitation you hit in the project's pending-upstream doc,
  naming the exact symbol that would unlock it.
