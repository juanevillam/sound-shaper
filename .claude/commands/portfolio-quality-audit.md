---
description: Complete engineering audit of a finished product — code quality, structure, security, performance, dependencies, privacy, release/store config. Behavior-preserving, plan-first.
argument-hint: [dimensions or folders to focus on]
---

# Quality audit — audit "the other side" of a finished product

The situation this command exists for: the product is **done and human-approved**
— features, UI, and flows are exactly as the user wants them (often built by
AI under close human guidance, verified live rather than by reading code).
What hasn't had that scrutiny is everything underneath: the code itself, its
structure, security, performance, configuration, and release hygiene. Audit
that side to the standard of a high-quality production app **today** — and
change the product side nothing.

Optional scope from the user (dimensions or folders — full audit if
empty): $ARGUMENTS

Two contracts, non-negotiable:

1. **Behavior-preserving.** No feature, UI, flow, or copy changes. Refactors
   must leave the running app indistinguishable. Anything that _would_ change
   behavior — including UI/UX improvement ideas you spot along the way — goes
   in a report section as a suggestion, never into code.
2. **Plan before action.** The audit produces a prioritized findings report
   and execution plan, and the user approves it before any code changes. The
   user knows their product deeply; they must stay the decision-maker.

## Phase 0 — Scope

1. Read the project's `AGENTS.md` / `CLAUDE.md`, memory, and repo docs. They
   define conventions and standards that override generic
   advice here.
2. Map the terrain: the app, the former shared packages now inside it
   (`src/ui`, `src/core`, `src/trophies`, `modules/widget-bridge`,
   `modules/audio-session`), the `patches/` overlay, the widget in
   `targets/widget`, and the deployed Worker in `media-worker/`. Backend:
   Firebase (Spark) and Cloudinary. Release target: the App Store first.
   This audit is release gate 3 in `docs/release.md`, which also lists what
   it must clear (the `npm audit` high advisories, then making that CI step
   blocking again).
3. Confirm the baseline works: the app builds and runs _before_ you touch
   anything, so regressions are attributable. If devices/simulators are
   connected, note the working state.

## Phase 1 — Fan-out audit

Audit each dimension below. These are independent — parallelize with
subagents (one dimension each); multi-agent
orchestration (Workflow) is appropriate here if available. Each auditor reads
code and configs and returns findings with file:line evidence, severity
(Critical/High/Medium/Low), and a concrete fix. Findings without evidence or
a fix are noise — drop them. Give each auditor its dimension's section from
the appendix checklist below, plus the two contracts above.

1. **Security & secrets** — leaked keys, backend/security rules, auth, input
   validation, insecure storage/transport, abuse surfaces (UGC, rate limits).
2. **Dependency health** — `npm audit`/equivalent vulnerabilities, outdated
   or unmaintained packages, duplicate/overlapping deps, lockfile integrity.
3. **Code quality & consistency** — dead code, duplication, typing strictness,
   error handling, lint/format enforcement, leftover debug artifacts. AI-built
   codebases drift stylistically between sessions; look for the seams.
4. **Architecture & structure** — module boundaries, shared-package hygiene,
   circular deps, state-management consistency, config sprawl.
5. **Performance & resource use** — bundle/app size, re-render and
   subscription hotspots, list virtualization, image pipeline, startup path,
   memory/listener leaks.
6. **Reliability & observability** — crash reporting coverage, error
   boundaries, offline/degraded behavior, race conditions, retry logic.
7. **Privacy & compliance** — data collection vs store data-safety forms,
   permission minimization + rationale, account/data deletion completeness,
   privacy policy touchpoints, third-party SDK data flows.
8. **Release & store configuration** — build config, versioning, signing,
   shrinking/obfuscation, icons/splash, deep links, target SDK/OS levels,
   store-listing prerequisites.
9. **Tooling & process** — CI, tests (AI-guided projects verified live often
   have none — assess what a minimal high-value test net would be), scripts,
   docs accuracy, `.gitignore` correctness.
10. **UI/UX & accessibility (report-only)** — polish opportunities, a11y
    labels/contrast/touch targets, i18n completeness. These violate contract
    #1 if applied, so they're always suggestions for the user.

## Phase 2 — Consolidated report & plan (stop for approval)

Merge, dedupe, and _verify_ findings — re-check each Critical/High against
the actual code before reporting; auditor false positives are common. Then:

```
# Quality audit: <project> — <date>

## Executive summary
Honest overall assessment: what's solid, where the real risk is.

## Findings by severity
Critical → Low. Each: dimension, file:line evidence, why it matters,
concrete fix, effort (S/M/L).

## Suggestions (not part of the fix plan)
UI/UX and behavior-affecting ideas, clearly separated.

## Proposed execution plan
Batches in order — security/data-risk first, then correctness, then
hygiene. Each batch independently verifiable (app still builds + runs).
```

Present it and wait. The user cuts, reorders, approves.

## Phase 3 — Execute approved batches

- Security and data-risk fixes first; cosmetic hygiene last.
- After each batch: build passes, app launches, and the touched flows still
  behave identically (verify on a live device/simulator when one is
  connected — a clean diff is not verification).
- If a fix turns out to require a behavior change, stop that item and return
  it to the user as a decision, don't improvise.
- Track batch completion against the plan so a long audit can pause and
  resume across sessions; leave durable notes (docs/memory) about what was
  audited and when, so the next audit diffs instead of restarting.

---

# Appendix — Per-dimension audit checklist

Items here are prompts to investigate, not boxes to tick blindly — skip what
doesn't apply to the stack, add what the stack demands.

## 1. Security & secrets

- Secrets scan: API keys, tokens, service-account files, signing configs in
  the repo or git history (`git log -p` samples, `.env` handling, app config
  files that ship in the bundle). Client-side keys that are _meant_ to be
  public (e.g. Firebase web keys) are fine — flag only what actually grants
  privilege.
- Backend security rules (Firestore/RTDB/Storage/Supabase RLS/API authz):
  every collection/route — who can read, write, escalate? Test rules against
  the actual client access patterns; look for owner checks, field-level
  validation, and rules that trust client-supplied IDs.
- AuthN/AuthZ: session handling, token storage (secure storage vs
  AsyncStorage/localStorage), sign-in provider config, account-linking edge
  cases.
- Input validation & injection: anywhere client input reaches queries,
  storage paths, URLs, deep links, or rendered HTML.
- Transport: cleartext traffic allowed? Certificate config? Upload endpoints
  (e.g. unsigned upload presets) abusable?
- Abuse surfaces: UGC without rate limits, unauthenticated writes, spam/
  enumeration vectors, file-upload size/type limits.

## 2. Dependency health

- Vulnerability scan (`npm audit` / `pnpm audit` / `yarn audit`,
  `pip-audit`, etc.); triage — dev-only vs shipped, reachable vs not.
- Outdated majors and _unmaintained_ packages (last publish > ~2y, archived
  repos) on the critical path.
- Duplicates/overlaps: two libs doing one job, split versions across a
  workspace, phantom deps (imported but not declared).
- Lockfile committed, consistent, and the single source (no mixed package
  managers).
- Licenses compatible with distribution.

## 3. Code quality & consistency

- Dead code: unused exports, components, assets, feature-flagged remnants,
  commented-out blocks, orphaned files from removed features.
- Duplication: near-identical components/hooks/utils that should merge —
  especially between `src/ui` / `src/core` and the app code beside them.
- Types: strictness flags on; `any`/casts/`@ts-ignore` hotspots; API
  boundary types honest (nullable where data can be missing).
- Error handling: swallowed catches, unhandled promise rejections, missing
  user-visible failure states; consistent error strategy.
- Debug artifacts: `console.log`, test toggles, force-flags, hardcoded IDs.
- Lint/format: config exists, passes, and is enforced (script or hook) —
  style consistency across AI sessions is exactly what linters are for.
- Naming/idiom drift: same concept named differently in different areas.

## 4. Architecture & structure

- Module boundaries: `src/ui` / `src/core` / `src/trophies` reaching back into
  app code (they were packages and stay app-agnostic), deep relative imports
  crossing layers.
- Circular dependencies (madge or equivalent).
- State management: one pattern used consistently? Server-state vs UI-state
  separation? Subscriptions centralized or duplicated per screen?
- Config sprawl: env/config values defined once; magic constants centralized.
- File/folder layout matches the project's own stated conventions.

## 5. Performance & resource use

- Startup path: what runs before first frame; deferred vs eager init of
  SDKs; splash-to-interactive continuity.
- Lists: virtualization on every long list; stable keys; memoized rows.
- Re-renders: context/store selectors that subscribe too broadly; heavy
  components without memo where measurably hot.
- Images/media: sizing, caching policy, format; uploading — resize before
  upload? CDN transforms used?
- Leaks: listeners/subscriptions (Firestore snapshots, event emitters,
  intervals, animation loops) cleaned up on unmount; retained timers.
- Bundle/app size: heavyweight deps for small jobs; assets shipped but
  unused; Hermes/minification enabled for release.
- Backend read/write economics: N+1 query patterns, unindexed queries,
  chatty realtime subscriptions.

## 6. Reliability & observability

- Crash reporting: initialized on all platforms, uploads symbolicated,
  catches JS + native; non-fatal error reporting where failures are silent.
- Error boundaries around navigation roots / risky trees.
- Offline & degraded: airplane-mode behavior on core flows; retry/backoff on
  writes; optimistic updates reconciled on failure.
- Race conditions: rapid double-taps on mutating buttons, navigation during
  in-flight writes, listener-vs-write ordering.
- Logging strategy: enough to debug production, nothing sensitive logged.

## 7. Privacy & compliance

- Data inventory: what user data is collected/stored/transmitted, first- and
  third-party (analytics, crash, media CDNs) — does it match the store
  data-safety declarations you'll file?
- Permissions: each requested permission actually used, requested in
  context, with platform-appropriate rationale strings.
- Account deletion: complete (auth + all user docs + storage/CDN assets +
  third-party data), reachable in-app (store requirement), and documented.
- Privacy policy & data-deletion URLs exist and match reality.
- Kids/ads/tracking flags correct (ATT on iOS if applicable, ad ID
  declaration on Android).

## 8. Release & store configuration

- Versioning strategy sane and documented; build numbers auto-managed.
- Signing: release keys managed safely (EAS/keystore/App Store Connect),
  never in repo.
- Android: R8/ProGuard on with working rules, target/compile SDK current,
  app bundle (.aab), edge-to-edge compliance for current OS, adaptive +
  themed icons.
- iOS: ATS exceptions justified, required-reason APIs declared, correct
  entitlements/capabilities, icon set complete, plist privacy strings.
- Deep links / app links verified (assetlinks.json / AASA).
- Env separation: dev endpoints, debug menus, and test users unreachable in
  release builds.
- OTA-update config (if any) points at the right channel/runtime.

## 9. Tooling & process

- CI: at minimum typecheck + lint + build on push; release builds
  reproducible from a clean checkout.
- Tests: assess the _gap_ pragmatically — for a live-verified product, the
  high-value net is: pure logic units (engines, parsers, reducers), backend
  security-rules tests, and one smoke E2E per platform. Recommend, don't
  gold-plate.
- Scripts: `package.json` scripts work and are documented; one-command dev
  setup for a fresh machine.
- Docs: README/AGENTS.md accurate to current reality (stale docs actively
  mislead future AI sessions); architecture decisions recorded.
- `.gitignore`: generated/native/prebuild output ignored; nothing ignored
  that should be tracked (lockfiles!).

## 10. UI/UX & accessibility — REPORT-ONLY

Never apply these; they change the product. Report as suggestions:

- A11y: labels on interactive elements, contrast, touch-target minimums,
  screen-reader flow on core screens, reduce-motion respected, font-scaling
  tolerated without broken layouts.
- i18n: all strings translated (no missing-key artifacts), locale formatting
  (dates/numbers), RTL if claimed.
- Polish opportunities noticed while auditing: inconsistent spacing/radius,
  missing empty/loading/error states, awkward flows — one line each, ranked,
  clearly labeled "requires product owner decision".
