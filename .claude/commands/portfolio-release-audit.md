---
name: portfolio-release-audit
description: >-
  Final pre-release and year-end gate across the portfolio (or a single surface): builds, tests, bundle/50KB budgets, PWA offline/Service Worker integrity, Open Graph & share cards, security headers/locks, standardized README/AGENTS structure, 2-layer documentation sync (docs/ROADMAP.md + docs/internal/*), and profile sync (CV, LinkedIn, GitHub Profile, juanevillam.com). Report-first; never deploys. (iOS & web only, never Android.) Use when Juan invokes /portfolio-release-audit.
---

> **PLATFORMS: iOS & Web ONLY — NEVER Android.**
>
> **SESSION SCOPING RULE (Context Budget):**
> Can run either on **one surface** (`/portfolio-release-audit <surface>`) after finishing that surface's audits, or in **`overview` mode** (`/portfolio-release-audit all`) as the final fast gate across all 6 repositories (`portfolio`, `website`, `sound-shaper`, `book-highlighter`, `space-explorer`, `github-profile`).

# Portfolio Release & Year-End Gate — GO / NO-GO across code, PWAs, docs, and career profile

This command is the closing gate of the portfolio audit sequence. It verifies that what is about to ship (or stand as the year-end flagship version of Juan's portfolio while job hunting) builds cleanly, works offline as a PWA, draws sharp share cards, enforces all security locks, and has 100% synchronized documentation and career profile surfaces.

**It never deploys and never pushes without explicit permission.** It ends with a `GO` / `NO-GO` scorecard and exact evidence.

---

## Phase 1 — The 10 Release Gates

### Gate 1 — Git Hygiene & Zero Uncommitted/Leaked Files Across All 6 Repos

Run across root `portfolio` + `website/`, `sound-shaper/`, `book-highlighter/`, `space-explorer/`, `github-profile/`:

- `git status -s` in each repo.
- Confirm **zero** `docs/internal/` files, `.DS_Store`, `.env.local`, source maps, or scratch scripts leaked into any of the 5 public nested repos.

### Gate 2 — Typecheck, Lint, Unit Tests & Clean Production Builds

For the surface(s) in scope:

- **`sound-shaper` (iOS + Web):**
  - `npm --prefix sound-shaper run typecheck`
  - `npm --prefix sound-shaper run lint`
  - `npm --prefix sound-shaper run test:unit`
  - `npm --prefix sound-shaper/web run build`
  - `node sound-shaper/scripts/apply-patches.mjs` (verify `patches/` apply cleanly)
- **`book-highlighter` (Web PWA):**
  - `npm --prefix book-highlighter run typecheck`
  - `npm --prefix book-highlighter run lint`
  - `npm --prefix book-highlighter test`
  - `npm --prefix book-highlighter run build`
- **`website` (`juanevillam.com`):**
  - `npm --prefix website run typecheck`
  - `npm --prefix website run build`
  - `npm --prefix website run narration` (24/24 clips + subtitles in sync)
- **`space-explorer` (50KB Arcade):**
  - `npm --prefix space-explorer run check-restrictions` (verify `game.js` ≤ 51,200 bytes across minifiers, zero external assets/imports, and synced to `website/public/arcade/game.js` via `npm --prefix website run arcade`).

### Gate 3 — Cross-Repo Sync Checks (`check:web-ui`, `songs`, `arcade`)

- `npm run check:web-ui` in root `portfolio` → confirms 0 byte/CSS drift between `sound-shaper/web` and `book-highlighter`.
- `npm --prefix sound-shaper run sync:website:check` → confirms `website/` Mini Sound Shaper DSP matches `sound-shaper/`.
- `diff -q space-explorer/game.js website/games/space-explorer/game.js` (or `website/public/arcade/game.js` build sync).

### Gate 4 — PWA, Service Worker & Offline-First Integrity (`sound-shaper/web` & `book-highlighter`)

- Verify `public/manifest.webmanifest` (`name`, `short_name`, `display: "standalone"`, `background_color`, `theme_color`, icons `192×192`, `512×512`, `maskable`, `apple-touch-icon`).
- Verify `public/sw.js` + `src/offline.ts`:
  - Shell cache version (`CACHE_NAME`), navigation network-first with `cache: 'no-store'` + offline shell fallback, Cloudinary cover art runtime caching, and `controllerchange` reload guard.
  - In `book-highlighter`, verify ONNX models (`public/models/det.onnx`, `rec-latin.onnx`, `rec-latin.txt`) are present in `dist/models/` and covered by immutable caching headers in `public/_headers`.
- Verify `UI_STATE_LAB` (`src/dev/uiStateLab.ts`) is gated behind `import.meta.env.DEV` (or `false` in production build) so the State Lab HUD never ships to production visitors.

### Gate 5 — Share Cards, Open Graph & SEO (`website`, `sound-shaper/web`, `book-highlighter`)

- Check built `dist/index.html` (and all `FOCUS_PAGES` in `website/dist/`):
  - `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:image` (absolute `https://` URL that resolves to an existing image file), `og:url`, `twitter:card`, `<link rel="canonical">`.

### Gate 6 — Security Headers, `security.txt` & App Store Legal Endpoints

- Check `public/_headers` and `public/.well-known/security.txt` in `website/`, `sound-shaper/web/`, and `book-highlighter/` (RFC 9116 fields, `Expires` date valid and `< 365` days away).
- Confirm `website/dist/` builds all legal routes required by App Store Connect and Google OAuth Branding:
  - `/sound-shaper/privacy-policy`, `/sound-shaper/terms-and-conditions`, `/sound-shaper/support`, `/sound-shaper/delete-account`
  - `/book-highlighter/privacy-policy`, `/book-highlighter/terms-and-conditions`, `/book-highlighter/support`, `/book-highlighter/delete-account`

### Gate 7 — Standardized `README.md` & `AGENTS.md` Across All Product Repos

Verify that `portfolio`, `sound-shaper`, `book-highlighter`, `space-explorer`, and `website` all follow the 2026-11-13 standardized `README.md` structure:

1. `# <Product Name>` + 2 direct prose paragraphs (never marketing `## Highlights` bullet lists).
2. Production links bullet list (`App Store`, `Web`, `Support`, `Privacy policy`).
3. `## Layout` table with lowercase headers (`| path | what it is |`).
4. `## Develop` section.
5. One product-specific architectural section.
6. `## Standards` linking to `AGENTS.md`.
7. `## License`.
   Plus `AGENTS.md` and `CLAUDE.md` (`@AGENTS.md`) present in each product repo.

### Gate 8 — 2-Layer Documentation Sync (`docs/ROADMAP.md` + `docs/internal/*`)

Check in root `portfolio`:

- Does `docs/ROADMAP.md` (Layer 1) list the exact current versions/tags (`website`, `sound-shaper` iOS & Web, `book-highlighter`, `space-explorer`) and current architectural features (e.g., studio parameter scopes on iOS & Web, PWA service workers, ONNX curved-line OCR)?
- Are all 6 manuals in `docs/internal/` (`README.md`, `infra-and-security.md`, `website-juanevillam.md`, `sound-shaper-ios.md`, `sound-shaper-web.md`, `book-highlighter-web.md`, `space-explorer-arcade.md`) up to date with the latest commits?

### Gate 9 — Career Profile Surfaces Sync (`docs/profile/` ↔ `github-profile/` ↔ `website/`)

Since Juan is using this portfolio to apply for top global roles, verify consistency across:

1. `docs/profile/linkedin.md`
2. `docs/profile/cv/juan-villa-cv.html` (and check if `Juan_Villa_CV.pdf` is freshly rendered from the HTML)
3. `github-profile/README.md`
4. `website/src/lib/apps.ts`, `work.ts`, `events.ts`, `releases.ts`, `i18n/ui.ts`
   Every shipped product (`Sound Shaper` on iOS App Store + Web, `Book Highlighter` Web PWA with on-device ONNX OCR, `Space Explorer` 50KB 3D game, `Tridi`, `Crol`, `Salvalo`) must have consistent URLs, descriptions, and live status across all 4 career surfaces.

---

## Phase 2 — Report (stop for approval)

```
# Portfolio release audit: <scope> — <date>

## Verdict: GO / NO-GO
One paragraph summary.

## Gate Scorecard (1–9)
Gate | Status (PASS / WARN / FAIL) | Evidence

## Action Items Before Final Push / Tag
Ranked list of any doc updates, sync scripts, or fixes needed.
```

Present the report and wait for Juan's instruction.
