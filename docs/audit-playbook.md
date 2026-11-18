# The Audit Playbook — 8 Standardized Portfolio Audits (Sound Shaper iOS & Web)

> **PLATFORMS: iOS & Web ONLY — NEVER Android (since 2026-11-04).**
> Sound Shaper ships on **iOS** (`src/`, `modules/`, `targets/widget`) and **Web PWA** (`web/`, deployed at `soundshaper.juanevillam.com`). Every audit runs on **ONE surface per session** (`sound-shaper-ios` or `sound-shaper-web`) so 100% of files in scope are read with zero sampling.

| #     | Command                                                                    | The Moment & Scope                                                                                                                                                                                                                   |
| :---- | :------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `/portfolio-craft-audit <sound-shaper-ios\|sound-shaper-web>`              | Lock componentization, dead code/props, design tokens, and shared web UI twins (`npm run check:web-ui`).                                                                                                                             |
| **2** | `/portfolio-data-audit <sound-shaper-ios\|sound-shaper-web>`               | Prune Firestore listeners vs `getDocs`, Cloudinary `thumbUrl` transforms, Web Audio streaming, and `media-worker` calls.                                                                                                             |
| **3** | `/portfolio-cache-audit <sound-shaper-ios\|sound-shaper-web>`              | Bank immutable facts (`durationMs`, waveforms, Auto DJ analysis, `sw.js` shell/cover cache, local iOS file mirror) with one home, one key, one death.                                                                                |
| **4** | `/portfolio-motion-audit <sound-shaper-ios\|sound-shaper-web>`             | 60fps/120fps fluidity: Shape sheet & 3 studio scopes Frame-0 open budget, shared `rAF` `sampleAudio`, desktop `startViewTransition` over `blur()` layers, covered `PlayerBackdrop` `.flow` pause, and Reanimated UI-thread worklets. |
| **5** | `/portfolio-parity-audit <sound-shaper-twins\|web-twins\|responsive-i18n>` | Zero drift between `sound-shaper` iOS ⇄ `sound-shaper/web` ⇄ `juanevillam.com` Mini Player, `sound-shaper/web` ⇄ `book-highlighter`, and Desktop ⇄ Mobile × `en`/`es`/`zh` × `dark`/`light`.                                         |
| **6** | `/portfolio-a11y-audit <sound-shaper-ios\|sound-shaper-web>`               | Keyboard navigation, focus trapping (`inert` on under-sheets), ARIA/VoiceOver labels in `en`/`es`/`zh`, measured contrast over Liquid Glass & cover washes, `prefers-reduced-motion`, and 44pt touch targets.                        |
| **7** | `/portfolio-quality-audit <sound-shaper-ios\|sound-shaper-web>`            | 10-dimension engineering gate (security, deps, code quality, architecture, performance, reliability, privacy, store/web config, tests).                                                                                              |
| **8** | `/portfolio-release-audit sound-shaper`                                    | Final pre-release gate across builds, unit tests, patches, PWA `sw.js`, legal links, and docs sync.                                                                                                                                  |

## Recommended Order (One Surface Per Session)

```
/portfolio-motion-audit  sound-shaper-web     # 1  fix Shape sheet / scopes / ViewTransition hitches
/portfolio-craft-audit   sound-shaper-web     # 2  lock Web structure & shared UI twins
/portfolio-craft-audit   sound-shaper-ios     # 3  lock iOS SwiftUI reference + motion check
/portfolio-data-audit    sound-shaper-web     # 4  prune network & Firestore reads (Web + iOS)
/portfolio-cache-audit   sound-shaper-web     # 5  bank what remains (SW, waveforms, durationMs, Auto DJ)
/portfolio-parity-audit  sound-shaper-twins   # 6  verify iOS ⇄ Web ⇄ Website Mini Player + responsive i18n
/portfolio-a11y-audit    sound-shaper-web     # 7  keyboard, focus trap, contrast, reduced motion
/portfolio-quality-audit sound-shaper         # 8  10-dimension engineering audit
/portfolio-release-audit sound-shaper         # 9  final GO / NO-GO gate
```

## Standing Rules

- **One surface per session.** Never overload a single session with both iOS and Web full-codebase audits at once.
- **Report-first, always.** Stop after the report for Juan's approval before editing code.
- **Keep `sound-shaper/web` and `book-highlighter` shared UI twins in sync** via `npm run check:web-ui` in the root portfolio repo.
