---
name: portfolio-parity-audit
description: >-
  Audit cross-surface, cross-layout, and cross-language parity: (1) Web Twin parity between sound-shaper/web and book-highlighter (check:web-ui + CSS tokens), (2) Product Twin parity between Sound Shaper iOS, Sound Shaper Web, and juanevillam.com Mini Sound Shaper, or (3) Responsive & i18n layout parity (Desktop >=64rem vs Mobile <64rem across en/es/zh and dark/light) on a single surface. Report-first. (iOS & web only, never Android.) Use when Juan invokes /portfolio-parity-audit.
---

> **PLATFORMS: iOS & Web ONLY — NEVER Android.**
> `/portfolio-native-parity` (which compared iOS to Android) was retired on 2026-11-04 when Android was deleted. This skill is its modern replacement for the **iOS + Web** portfolio.
>
> **SINGLE-SCOPE SESSION RULE (Context Budget):**
> To keep context sharp and never overload a session, run **ONE scope mode per session**. If Juan does not specify a scope, ask him which ONE of these to run today:
>
> - **Mode 1 — `web-twins`**: `sound-shaper/web` ⇄ `book-highlighter` (shared UI components, `:root` / `light` CSS tokens, 3-column & modal sheet geometry, `npm run check:web-ui`).
> - **Mode 2 — `sound-shaper-twins`**: `sound-shaper` (iOS) ⇄ `sound-shaper/web` ⇄ `website` (Mini Sound Shaper on `juanevillam.com`) — shared DSP, Auto DJ, studio scopes, trophies, i18n, and feature/summary parity.
> - **Mode 3 — `responsive-i18n <surface>`**: Desktop (`1440×900`, `1280×800`) ⇄ Mobile (`390×664`, `390×844`, `375×667`) × (`en`, `es`, `zh`) × (`dark`, `light`) on **ONE** surface (`sound-shaper-web`, `book-highlighter`, or `website`).

# Portfolio Parity Audit — zero twin drift across products, layouts, and languages

Juan's #1 engineering rule is **One of Everything & Zero Twin Drift (`standardization-is-key`)**. When two surfaces solve the same problem — `sound-shaper/web` and `book-highlighter` sharing their web shell, Sound Shaper iOS and Sound Shaper Web sharing their audio engine and studio scopes, or desktop and mobile layouts rendering in English, Spanish, and Chinese — any unrecorded divergence is a defect.

Three contracts:

1. **One mode/surface per session, echoed back up front.**
2. **Measured numbers, never guesses.** Every layout or token comparison is a table of exact values (`px`/`rem`/hex/curve) across the compared sides.
3. **Report before code.** Behavioral differences are flagged for Juan's decision, never silently overwritten.

---

## Mode 1 — `web-twins` (`sound-shaper/web` ⇄ `book-highlighter`)

Both web PWAs share the exact same visual DNA, 3-column desktop stage (`LibraryGrid` → `Stage` → `Tools`) + global centered `.modals` stack, and mobile swipe-to-dismiss sheets.

### Phase 1 — Automated & Token Diff

1. Run `npm run check:web-ui` in `/Users/juanevillam/Code/portfolio` (`node scripts/sync-web-ui.mjs --check`).
2. Compare the full `:root` and `:root[data-theme='light']` blocks of `sound-shaper/web/src/styles.css` and `book-highlighter/src/styles.css`:
   - Every shared token (`--ground`, `--ink`, `--ink-2`, `--ink-3`, `--surface`, `--hairline`, `--lg-fill`, `--lg-blur`, `--lg-rim`, `--sheet-bg`, `--cell-bg`, `--separator`, `--ease`, `--spring`, `--ios-curve`, `--dur-*`, `--hover`, `--bar-h`) must match 1:1.
3. Compare non-synced shared UI files and patterns between `sound-shaper/web/src/ui/` and `book-highlighter/src/ui/`:
   - `AccountForm.tsx`, `SettingsForm.tsx`, `Trophies.tsx`, `Welcome.tsx`, `Home.tsx` (`morph`, `useLargeTitle`, `leaveIn`, `renderStack`, `.home`, `.library`, `.stage`, `.tools`, `.modals`), `offline.ts`, and `public/sw.js`.
4. Check `scripts/sync-web-ui.mjs` itself: did a recent feature add a shared CSS rule or UI helper in one app that should be added to `SHARED_CSS_SELECTORS` or `SHARED_UI_FILES`?

---

## Mode 2 — `sound-shaper-twins` (`sound-shaper` iOS ⇄ `sound-shaper/web` ⇄ `website`)

Sound Shaper lives in three places: native iOS (`sound-shaper/src/`), Web PWA (`sound-shaper/web/src/`), and the interactive snippet on `juanevillam.com` (`website/src/components/SongsPlayer.astro` + `website/src/lib/autoDj/`).

### Phase 1 — Engine, Scopes, Copy & Sync Diff

1. **Website DSP sync check:** Run `npm --prefix sound-shaper run sync:website:check` to verify `website/` has the latest DSP / Auto DJ modules from `sound-shaper`.
2. **iOS ⇄ Web feature & state parity:**
   - Compare `sound-shaper/src/app/(app)/shaper.tsx` + `ShapeScopesIos.tsx` against `sound-shaper/web/src/ui/ShapePanel.tsx` + `Scopes.tsx`:
     - Preset list, EQ band frequencies/ranges, `eqExtremeDb`, `echoTapDb`, `nextRoom1kDb`, `formatSignedDb`, `SCOPE_HEIGHT` (38), curve math, and `useShapeSummary` formatting.
   - Compare `ClipTrimEditor.tsx` (iOS) against `web/src/ui/ClipEditor.tsx`:
     - Zoom scale, overview strip, corner captions (start, duration, end), ±15s skip, and bar buttons (`HeaderGlyphGroupIos` vs `.glass-pill`).
   - Compare `Settings`, `Account`, `Trophies`, and `Edit Sound` fields, destructive confirmations, and i18n keys (`src/i18n/locales/{en,es,zh}.ts`).
   - Document intentional platform differences (e.g., iOS C++ phase vocoder vs Web `preservesPitch`; iOS Sign in with Apple + Google vs Web Google-only; iOS native Widget + local file mirror vs Web PWA Service Worker) and flag any unintentional drift.

---

## Mode 3 — `responsive-i18n <surface>` (`Desktop ⇄ Mobile × en/es/zh × dark/light`)

Run against ONE surface (`sound-shaper-web`, `book-highlighter`, or `website`).

### Phase 1 — Build & Multi-Viewport Measurement

1. Build and serve the production bundle.
2. Measure at the 5 canonical viewports:
   - Desktop: **`1440×900`**, Laptop: **`1280×800`**
   - Mobile: **`390×664`** (iPhone with browser bars), **`390×844`** (standalone PWA / bars collapsed), Narrow: **`375×667`**
3. At each viewport, test **`en`**, **`es`** (~25% longer strings), and **`zh`** (CJK line breaks, no spaces), in both **`dark`** and **`light`** themes (website is dark-only):
   - **Zero horizontal overflow:** `document.documentElement.scrollWidth === window.innerWidth` on every screen and open sheet.
   - **Dock / Bar / Pill stability:** `.dock` compartments (`Shape`, `Clips`, `Edit` or `Chapters`, `Export`, `Edit`), `.segmented` controls, `.picker` rows, and `.section-head.split` never wrap onto two lines, clip descenders, or shift column widths when switching `en` → `es` → `zh`.
   - **Tabular numerals:** Live counters, timers, dB readouts (`+6.0 dB`), speed (`1.25×`), and reader page numbers hold fixed width (`font-variant-numeric: tabular-nums`) without jitter.
   - **1-to-2-to-3 column transitions on desktop:** Opening and closing the 3rd column (`.tools`) at `1280×800` and `1440×900` never crushes the center `.stage` cover or clips `.trophy-summary` (`@container` rule).

---

## Phase 2 — Report (stop for approval)

```
# Parity audit: <mode / surface> — <date>

## Verdict
One honest paragraph with the pass/drift count.

## Drift & Measurement Table
Item / Selector / Screen | Side A | Side B (or en / es / zh) | Expected | Status

## Findings (ranked)
Each with file:line on both sides, measured delta, and exact fix.

## Intentional asymmetries (verified & documented)
So future audits never re-flag them.

## Ranked fix batches
```

Present the report and wait for Juan's approval before editing code.
