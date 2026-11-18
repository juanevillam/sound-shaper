---
name: portfolio-motion-audit
description: >-
  Audit and optimize 60fps/120fps motion, sheet/column transitions, View Transitions, studio parameter scopes, GPU compositing layers, rAF loops, and scroll performance across one surface (sound-shaper-web, book-highlighter, sound-shaper-ios, website, or space-explorer). Report-first. (iOS & web only, never Android.) Use when Juan invokes /portfolio-motion-audit or asks to audit/fix animation smoothness or lag.
---

> **PLATFORMS: iOS & Web ONLY — NEVER Android.**
> All products in Juan's portfolio ship on **iOS and/or the web** (or web-only). There is no Android anywhere — never audit, write, check, or propose Android code.
>
> **SINGLE-SURFACE SESSION RULE (Context Budget):**
> This audit inspects every frame, transition, rAF loop, and GPU layer of **ONE surface per session**. If Juan does not pass a surface argument, ask him which ONE surface to run in this session:
>
> 1. `sound-shaper-web` (`~/Code/portfolio/sound-shaper/web`)
> 2. `book-highlighter` (`~/Code/portfolio/book-highlighter`)
> 3. `sound-shaper-ios` (`~/Code/portfolio/sound-shaper` — `src/`, `modules/`)
> 4. `website` (`~/Code/portfolio/website` — `juanevillam.com`)
> 5. `space-explorer` (`~/Code/portfolio/space-explorer` — 50KB 3D arcade)
>
> Never audit two surfaces in one session.

# Motion & Compositing Audit — 60fps/120fps Apple-grade fluidity

The moment this command exists for: **the product looks right, and a transition, sheet open, responsive resize, scope draw, or page turn feels "pegado" (sticky/laggy) in Chrome, Safari, or on the iPhone.**

Every motion defect has a physical cause on the main thread or the GPU compositor:

- too much work in **Frame 0** of a transition (mounting heavy SVGs/canvases, firing multiple `ResizeObserver` / `getBoundingClientRect()` layout passes, or starting `requestAnimationFrame` loops while a sheet/column is sliding);
- **`document.startViewTransition(() => flushSync(...))`** snapshot stalls when multi-column CSS grids reflow over giant `filter: blur(42px–64px)` layers;
- **invisible or covered GPU layers** still ticking in `rAF` or compositing `filter: blur()` behind an opaque surface;
- **non-composited CSS properties** (`filter: brightness(...)` on a sliding sheet, `clip-path` on an SVG with `drop-shadow`, animated `box-shadow`, or layout properties) re-rasterizing every frame on CPU;
- **redundant per-frame work** (three scopes each calling `analyser.getFloatTimeDomainData` + `getFloatFrequencyData` independently in the same frame instead of reading one shared frame sample).

Three contracts:

1. **One surface per session, explicit and echoed back.** State the surface and exclusions before reading code.
2. **Report before code, measured with numbers.** Every finding cites `file:line`, what happens on Frame 0..N, the measured or traced cost, and the exact behavior-preserving fix. Mark any fix that alters visual choreography so Juan decides.
3. **Preserve the shared Web UI twin contract (`npm run check:web-ui`).** Any change to a shared primitive (`SidePanel.tsx`, `Backdrop.tsx`, `ActionSheet.tsx`, `ConfirmDialog.tsx`, `Artwork.tsx`, `StateLab.tsx`, `Toast.tsx`) or a shared CSS selector in `sound-shaper/web` or `book-highlighter` MUST be synced across both apps via `npm run sync:web-ui` and verified with `npm run check:web-ui`.

---

## Phase 0 — Ground yourself

1. **Read the surface's `AGENTS.md` and `docs/audit-playbook.md`.** Check `docs/rejected-experiments.md` so you never re-propose a rejected animation.
2. **Verify the motion grammar tokens** (`:root` in `styles.css` / `global.css` or `src/core/theme/`):
   - `--ease: cubic-bezier(0.16, 1, 0.3, 1)`
   - `--ios-curve: cubic-bezier(0.32, 0.72, 0, 1)`
   - `--spring: cubic-bezier(0.34, 1.4, 0.64, 1)`
   - `--hover: var(--dur-quick) cubic-bezier(0.25, 0.1, 0.25, 1)`
   - `--dur-micro` (140–150ms), `--dur-quick` (220–300ms), `--dur-turn` (340–450ms), `--dur-settle` (450–600ms).
3. **Confirm baseline is green**: `typecheck`, `lint`, `test`, `build` (and `npm run check:web-ui` at root for web apps).

---

## Phase 1 — Inventory every motion, rAF loop & GPU layer

Run a mechanical sweep of the target surface:

```bash
# Every rAF, View Transition, ResizeObserver, and layout read
grep -rn "requestAnimationFrame\|startViewTransition\|flushSync\|ResizeObserver\|getBoundingClientRect" <surface-src>

# Every expensive GPU filter and transition in CSS
grep -rn "backdrop-filter\|filter:\|clip-path\|will-change\|view-transition\|@keyframes\|transition:" <surface-css>
```

Build two tables before writing findings:

### Table A — Frame-by-frame Choreography of Primary Transitions

For each major transition on the surface (e.g., opening `Shape` sheet on Desktop `>= 64rem` vs Mobile/Chrome Responsive `< 64rem`; opening `Clips` / `ClipEditor`; opening `Reader` and turning pages in `slide`/`scroll`; scrolling `juanevillam.com` with `9:16` video narration):

- **Frame 0 (trigger):** What mounts? What synchronous layout reads (`getBoundingClientRect`, ` flushSync`) run? Does `startViewTransition` capture giant blurred layers?
- **Frames 1..N (in-flight, 0–380ms):** Which CSS properties animate? Are any `rAF` loops, `ResizeObserver` callbacks, or SVG path mutations running concurrently with the sheet/column slide?
- **Settled (post-transition):** Which `rAF` loops or `blur()` layers stay alive while covered or paused?

### Table B — Active `requestAnimationFrame` & GPU Layer Budget

For every `rAF` loop and `filter: blur()` / `backdrop-filter` surface:

- When does it start?
- When does it stop (`cancelAnimationFrame`)? Does it stop when `playing === false`, when `document.hidden`, when covered by a full-screen mobile sheet (`.side.is-open` at `< 64rem` or `.reader`), or when `prefers-reduced-motion: reduce`?
- How many times per frame does it sample Web Audio (`AnalyserNode`) or mutate the DOM?

---

## Phase 2 — Surface-Specific Hotspots to Audit

### A. `sound-shaper-web` (`sound-shaper/web/`) & `book-highlighter` (`book-highlighter/`)

1. **Frame-0 Sheet & Column Open Budget (`Home.tsx`, `SidePanel.tsx`, `ShapePanel.tsx`, `Scopes.tsx`, `ChaptersForm.tsx`):**
   - **Double-render on mount in `Scopes.tsx`:** `useBoxWidth` starts at `width = 0`, mounts an empty `<div className="scope">`, reads `getBoundingClientRect().width` in `useLayoutEffect`, plus fires `ResizeObserver` immediately, forcing a synchronous second React render with 3 complex SVGs right inside Frame 0 of opening the Shape sheet. Check if initial width can be seeded or if live spectrum `rAF` and ink-draw animations should wait until the sheet/column transition settles (or avoid re-measuring during the slide).
   - **3× redundant Web Audio FFT/TimeDomain sampling per frame (`Scopes.tsx` + `src/lib/analyser.ts`):** When `ShapeForm` is open while playing, `EqScope`, `EchoScope`, and `NextRoomScope` each run their own `requestAnimationFrame` loop and each call `sampleAudio()` every frame — running `getFloatTimeDomainData` (2048 floats + RMS loop) and `getFloatFrequencyData` (1024 bins + log-binning) **3 times per frame** (~180 times/sec at 60fps). Audit memoizing/sharing the audio sample once per animation frame (`performance.now()` frame timestamp cache in `analyser.ts`) or driving all live scopes from one shared `rAF` ticker.
   - **SVG `clip-path` + `filter: drop-shadow` during sheet open (`styles.css` `.scope[data-ink-state='drawing']`):** Animating `clip-path: inset(0 100% 0 0)` and `stroke-dashoffset` on 3 SVGs that carry `filter: var(--phosphor-drop)` while the sheet is sliding forces Chrome to re-rasterize 3 filtered SVG textures every frame on the CPU.
   - **Desktop `startViewTransition` + `flushSync` stall (`Home.tsx` `morph()`):**
     - First, check why `toolsShown` is synced inside a `useEffect` (`if (tooled !== toolsShown) morph(() => setToolsShown(tooled))`) — that runs **one render after** `toolLayers` already mounted the sheet DOM, causing two separate layout passes!
     - Second, check what `startViewTransition` snapshots: when `.stage` contains `.player-backdrop` with 4 oversized `filter: blur(42px–60px)` layers (`.side: calc(2.2 * max(100cqw, 100cqh))`), capturing and resizing view-transition textures in Chrome can stall Frame 0 by 40–90ms. Test whether freezing/hiding `.flow` during the view transition or transitioning the column without heavy snapshot capture eliminates the hitch.
2. **Covered & Redundant Blurred Backdrops (`Backdrop.tsx`, `Home.tsx`, `styles.css`):**
   - **Dead `<Backdrop>` behind opaque `.library`:** In both `sound-shaper/web` and `book-highlighter`, `<Backdrop>` (`position: fixed; inset: 0; filter: blur(64px)`) is rendered at the root of `<Home>`, behind `<main className="library">` which has an opaque `background: var(--ground)`. Verify if `<Backdrop>` is ever visible anywhere; if not, it is a full-viewport 64px-blurred GPU texture composited on every scroll and sheet animation for zero visual pixels.
   - **Mobile `< 64rem` covered `PlayerBackdrop` `.flow` rotation:** On mobile/responsive Chrome (`< 64rem`), when a tool sheet (`Shape`, `Clips`, `ClipEditor`, `Chapters`, `Export`) or modal sheet (`Settings`, `Account`, `Trophies`, `Edit`) is open, `.side` covers the viewport (`height: calc(100svh - ...)` with opaque `background: var(--sheet-bg)`), or in `book-highlighter` `<Reader>` covers the entire screen. Yet `PlayerBackdrop`'s `useFlow` `rAF` keeps rotating two giant `blur(42px)` layers underneath at 60fps! Pausing `flowing` when covered on `< 64rem` (or when `document.hidden` / `readingBook` is active) frees the mobile GPU immediately during sheet slides and reading.
3. **Sheet Slide & Stacking Compositing (`SidePanel.tsx`, `styles.css`):**
   - **`.side.is-open.is-under` animating `filter: brightness(0.6)`:** In `styles.css`, `.side` transitions `filter var(--dur-turn) var(--ease)` to `filter: brightness(0.6)` when a second sheet stacks over it. Applying `filter: brightness()` to a container that holds `backdrop-filter: blur(16px)` children (`.side-bar::before`, `.round`, `.glass-pill`) forces Chrome to allocate an offscreen render surface and re-rasterize the entire under-sheet on every frame of the stack animation. Check if a composited dim overlay (`::after` with `opacity`) achieves the exact same 0.6 dimming on the GPU with zero filter rasterization.
   - **Pointer-drag `setPull` re-rendering the entire sheet body (`SidePanel.tsx`):** During drag-to-dismiss, `onPointerMove` calls `setPull(...)` on every pointer move event, which re-renders `SidePanel` and its children at 60–120Hz. Updating `--pull` directly on `aside.current.style` during the drag and only committing React state on pointer start/end keeps drag-to-dismiss at zero React re-renders.
4. **Book Highlighter Reader & Photo Scanner (`Reader.tsx`, `paginator.ts`, `ChaptersForm.tsx`):**
   - Verify `slide` page-turn gestures and keyboard steps run purely on GPU `transform: translate3d / translateX` without synchronous text re-pagination mid-slide.
   - Verify `ResizeObserver` in `Reader.tsx` debounces or skips re-pagination while a modal/sheet transition is in flight.

### B. `sound-shaper-ios` (`sound-shaper/src/`, `modules/`)

1. **`ShapeScopesIos.tsx` + `shaper.tsx`:**
   - Check that `EqScope`, `EchoScope`, and `NextRoomScope` share a single post-DSP `sampleAudio` pass per frame rather than 3 separate time/frequency reads per tick.
   - Check `prepareShapeScopeCells` timers (`setTimeout(..., 120)` and `350`) so they never cause a visible jump after the sheet presentation spring starts.
2. **`PlayerSheet.tsx` & `ClipTrimEditor.tsx`:**
   - Confirm all pan/scrub gestures run on the UI thread (Reanimated worklets) with zero JS-bridge roundtrips per frame.
   - Confirm `PlayerBackdrop.tsx` pauses its rotation clock when the app is backgrounded or when a full-height `[1]` form sheet covers the console.

### C. `website` (`juanevillam.com` — `website/`) & `space-explorer` (`space-explorer/`)

1. **Desktop & Mobile Narration Director (`director.ts`, `NarrationPlayer.astro`):**
   - Zero `getBoundingClientRect()` or `getComputedStyle()` inside scroll/rAF ticks.
   - Pause off-screen `<video>` and 3D canvas simulations (`src/lib/ship/`, `src/lib/robot/`) immediately when their section leaves the viewport.
2. **Space Explorer (`space-explorer/game.js`):**
   - Zero object/array garbage allocation inside Phaser's `update()` loop (reuse scratch vectors/projections so V8 GC pauses never drop a frame).

---

## Phase 3 — Report (stop for approval)

```
# Motion & compositing audit: <surface> — <date>

## Verdict
One honest paragraph summarizing current frame pacing and the primary bottlenecks found.

## Choreography & Frame-0 Table
Transition | Frame-0 work | In-flight GPU/CPU cost | Bottleneck

## Findings (ranked by felt lag / frame drops)
1. [HIGH/MED/LOW] <title> — `file:line`
   - Cause: what stalls the main thread or GPU compositor.
   - Fix: exact change (and whether it touches shared `sync-web-ui` files).
   - Visual impact: Identical look / Minor timing refinement.

## Already smooth & verified
Motion systems checked and confirmed 60fps-clean.

## Ranked execution batches
```

Present the report and wait for Juan's approval.

---

## Phase 4 — Execute approved batches & verify

1. Apply fixes batch by batch.
2. If touching `sound-shaper/web` or `book-highlighter` shared UI files or CSS selectors, run `npm run sync:web-ui` and `npm run check:web-ui` from `/Users/juanevillam/Code/portfolio` so both web apps stay byte-for-byte in sync.
3. Run `typecheck`, `lint`, `test`, and production `build`.
4. **Verify with Chrome DevTools / Device:**
   - Measure before/after frame times at Desktop (`1440×900`) and Mobile Responsive (`390×844` @3x with CPU throttling) when opening/closing `Shape`, dragging EQ sliders while playing, stacking sheets (`Clips` → `ClipEditor` → `Shape`), and resizing across the `64rem` breakpoint.
5. Update `docs/ROADMAP.md` / `docs/internal/<surface>.md` if architecture or shared primitives changed.
