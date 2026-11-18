---
name: portfolio-a11y-audit
description: >-
  Accessibility audit of one portfolio surface (sound-shaper-web, book-highlighter, sound-shaper-ios, or website) — keyboard navigation and focus trapping through stacked sheets/modals/columns, ARIA and screen-reader labels in en/es/zh, WCAG AA/AAA measured contrast over Liquid Glass and cover washes, reduced motion, zoom/Dynamic Type, and 44pt touch targets. Report-first. (iOS & web only, never Android.) Use when Juan invokes /portfolio-a11y-audit.
---

> **PLATFORMS: iOS & Web ONLY — NEVER Android.**
>
> **SINGLE-SURFACE SESSION RULE (Context Budget):**
> Audit **ONE surface per session**. If Juan does not specify which surface, ask him to pick one:
>
> 1. `sound-shaper-web` (`~/Code/portfolio/sound-shaper/web`)
> 2. `book-highlighter` (`~/Code/portfolio/book-highlighter`)
> 3. `sound-shaper-ios` (`~/Code/portfolio/sound-shaper` — iOS native)
> 4. `website` (`~/Code/portfolio/website` — `juanevillam.com`, which also has `/web-a11y-audit`)

# Portfolio Accessibility Audit — every surface works by keyboard, screen reader, and raised text size

Juan wears glasses; legibility, contrast over translucent/blurred surfaces, and calm reduced-motion fallbacks are first-class engineering requirements across the entire portfolio.

**Accessible is not a different look.** Invisible fixes (missing `aria-label` in `en`/`es`/`zh`, focus trapping / `inert` on background layers, keyboard shortcuts, `role`, `html[lang]`) are applied first. Any fix that changes visible geometry or color (contrast floor, focus ring, touch target size) is reported with measured numbers and options for Juan to choose.

Three contracts:

1. **One surface per session, echoed back up front.**
2. **Report before code**, citing `file:line`, the WCAG 2.2 criterion (or iOS HIG Accessibility rule), and whether the fix is `INVISIBLE` or `VISIBLE`.
3. **Sync shared web primitives (`npm run check:web-ui`).** Any a11y fix in a shared file between `sound-shaper/web` and `book-highlighter` (`SidePanel.tsx`, `ActionSheet.tsx`, `ConfirmDialog.tsx`, `Backdrop.tsx`, `Artwork.tsx`, `Toast.tsx`, `StateLab.tsx`) is synced to both repos.

---

## Phase 1 — Walk & Measure the 6 Axes

### 1. Keyboard Navigation & Focus Management (Web PWAs & Website)

- **Full Tab walk from cold load:** Every interactive control is reachable in logical reading order with a high-contrast `:focus-visible` ring.
- **Stacked sheets, 3-column tools & modals (`SidePanel.tsx`, `Home.tsx`, `ConfirmDialog.tsx`, `ActionSheet.tsx`, `Reader.tsx`):**
  - When a sheet is closed (`!open`) or covered by a deeper sheet in the same stack (`depth > 0`), verify it carries `inert` and `aria-hidden="true"` so `Tab` never lands inside a hidden or dimmed under-sheet.
  - When a global modal (`.modals` — Settings, Account, Trophies, Edit/New, Series) or `<Reader>` is open over the 3-column desktop stage, verify background columns (`.library`, `.stage`, `.tools`) cannot receive Tab focus behind the modal scrim, and `Escape` pops the topmost layer cleanly (`.sub-sheet.is-open` → `dialog[open]` → `modalLayers` → `toolLayers` → mobile expanded stage) and restores focus to the trigger.
- **Custom controls & sliders:**
  - `sound-shaper/web`: EQ sliders (`aria-label`, `aria-valuetext`), speed slider, scrubber, `ClipEditor` trim handles (keyboard arrow step support), and 2D library grid sorting.
  - `book-highlighter`: `Reader` (`ArrowLeft`/`ArrowRight`/`Space` in `slide` mode, `Escape` to close, TOC chapter jumps, photo line inspector checkboxes/buttons).

### 2. Screen Reader & Multilingual Names (`en` / `es` / `zh`)

- Every lone-glyph circle button (`.round`, `.glyph`, `.glass-pill button`, close `×`, gear, play/pause, skip, `+`, check `✓`, delete, export) must have an accessible name (`<span className="sr">` or `aria-label` / `accessibilityLabel`) sourced from `i18n` in all 3 languages — never hardcoded English.
- Decorative layers (`Backdrop`, `PlayerBackdrop`, `.scope`, `BookPageOrnament`, `BookPageMarginArt`, `.bars`) must carry `aria-hidden="true"` (or `accessible={false}` / `importantForAccessibility="no-hide-descendants"` on iOS).
- Dynamic announcements: Toast (`role="status"` / `aria-live="polite"`), Trophy unlock banner, error states, and busy upload/OCR progress overlays (`aria-busy="true"`).
- Document language: verify `document.documentElement.lang` updates whenever the user switches language (`en`, `es`, `zh`) in Settings so screen readers use the right voice synthesizer.

### 3. Measured Contrast (Dark & Light Themes, Liquid Glass & Cover Washes)

- Measure actual rendered contrast ratios in both **Dark** (`#0d0d0d` / `#161616`) and **Light** (`#f2f2f7` / `#ffffff`) appearances (plus all 5 `READER_THEMES` in Book Highlighter: `light`, `dark`, `sepia`, `paper`, `book`):
  - Body & primary ink (`--ink`, `--ink-body`) >= **4.5:1** (WCAG AA).
  - Secondary/muted labels (`--ink-2`, `--muted`) and metadata (`--ink-3`) against `--ground`, `--surface`, `--sheet-bg`, and `--cell-bg`.
  - Controls sitting over `PlayerBackdrop` (the blurred cover wash + `.fade` scrim ramp) and inside Liquid Glass (`.dock`, `.mini`, `.round`, `.glass-pill`) in both dark and light mode with a worst-case bright or dark cover.
  - Non-text UI boundaries (slider tracks, switch off-state, hairlines, clip trim brackets) >= **3:1** (WCAG 1.4.11).

### 4. Motion & `prefers-reduced-motion: reduce`

- Emulate `prefers-reduced-motion: reduce` (or iOS Reduce Motion):
  - `PlayerBackdrop` `.flow` rotation stops completely.
  - `Scopes` (`EqScope`, `EchoScope`, `NextRoomScope`) skip the 560ms ink-draw entrance (`data-ink-state="done"` immediately), snap `useGlide` without spring oscillation, and disable live spectrum/echo `rAF` trails.
  - Desktop `morph()` skips `document.startViewTransition`.
  - Auto DJ auto-scroll in Shape and Library Grid uses instant or calm jumps without disorienting motion.

### 5. Touch Targets & Hit Boxes (Mobile `< 64rem` & iPhone Native)

- Measure every interactive control's hit box at `390×844`:
  - Minimum `24×24` CSS px (WCAG 2.5.8), aiming for **`44×44` pt/px** on mobile bars, transport controls, sheet close/commit buttons, and list row actions.
  - Check `.round` (`2.25rem` = `36px` on desktop) — verify whether mobile touch targets have sufficient hit padding or clearance.

### 6. Zoom, Text Scaling & Reflow

- Test 200% browser zoom and `320px` narrow reflow on web (or Dynamic Type on iOS):
  - No clipped single-line captions (verify `line-height` pairs `17/22`, `15/20`, `13/18`), no overlapping bar titles, and no unscrollable fixed sheets.

---

## Phase 2 — Report (stop for approval)

```
# Accessibility audit: <surface> — <date>

## Verdict
One honest paragraph on keyboard, screen-reader, contrast, and reduced-motion readiness.

## Findings (ranked: locked-out → hard → minor)
1. [HIGH/MED/LOW] <title> — `file:line` — <WCAG criterion / HIG rule> — [INVISIBLE | VISIBLE]
   - What happens: ...
   - Concrete fix: ...

## Verified & Sound
Systems checked and passing in Dark/Light and EN/ES/ZH.

## Ranked execution batches (Invisible fixes first)
```

Present the report and wait for Juan's approval.
