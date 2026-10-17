---
description: Checkpoint audit of one app on one platform after a chunk of rework — is every repeated thing componentized, and is every surface idiomatic for that OS. Report-first.
argument-hint: [platform, and any surfaces to exclude]
---

# Craft audit — componentized, and native enough

The moment this command exists for: a **big chunk of rework just landed** on one
platform of one app, more is planned, and before continuing you want the ground
to be solid. Not "does it work" — it works, it was built and verified surface by
surface. The question is whether the _result_ is coherent: whether the twentieth
screen reuses what the first one established, and whether the whole thing reads
as an app that belongs on this OS rather than a set of screens that each solved
their own problem.

Two axes, always both, because they fail together. Duplication is what lets two
copies of one surface drift onto different idioms, and a non-idiomatic surface is
usually one somebody hand-built instead of reaching for the shared thing.

- **A. Componentization** — the same or nearly-the-same code exists once. No
  200-line block living in three files, no component nothing renders any more.
- **B. "Is this <OS>-ly enough"** — radii, spacing, sizing, color, **button
  types and variants**, containers, gestures, flows and structure are the
  platform's own, expressed through the project's tokens.

Scope from the user (the app is Sound Shaper; the platform, plus any surfaces
to leave alone — ask if not given): $ARGUMENTS

Three contracts:

1. **Scope is explicit and echoed back.** One app, one platform, plus an
   exclusion list. State your understanding of it before reading code, and
   respect the exclusions — if the worst finding in the whole audit sits just
   outside them, report it in its own clearly-labelled section and let the user
   decide, don't silently widen the scope.
2. **Report before code.** Findings first, ranked, with file:line evidence. The
   user cuts and approves. They know which asymmetries are decisions.
3. **Read everything in scope.** This audit does not sample. Its whole value is
   noticing that two files one gesture apart disagree, and you cannot notice
   that in files you didn't open.

## Phase 0 — Ground yourself

1. **Read `AGENTS.md` / `CLAUDE.md`, project docs and memory first, and turn
   the project's own standing rules into your audit checklist.** This is the
   highest-value step in the command and it is easy to skip. A mature project
   has already written down what it keeps getting wrong — press-feedback rules,
   skeleton rules, native-primitive-first rules, token systems, voice rules.
   Those beat any generic checklist below, and code that violates the project's
   _own_ documented rule is the most defensible finding you can report.
2. Establish conventions: platform file suffixes, which platform (if any) is
   **frozen** (none are, since 2026-08-29 — and treat any comment still
   claiming one as an expired blocker to re-test, not a fact), where the former
   shared packages (`src/ui`, `src/core`, `src/trophies`,
   `modules/widget-bridge`) end and app code begins, which surfaces are deliberately not
   idiomatic and why.
3. **Confirm the baseline is green before you touch anything** — typecheck,
   lint, format, tests. Note any uncommitted in-flight work so you can tell your
   changes from the user's.
4. Check what's runnable. A simulator/device with real data is how this audit
   ends; set it up early rather than discovering at the end that you can't
   verify.

## Phase 1 — Inventory

Cheap, mechanical, and it aims the reading:

- Enumerate every route, component and shared-package surface in scope.
- **Line counts, descending.** Fat files hide repeated blocks; the biggest file
  in scope is worth opening first.
- **Build the who-imports-what map.** For each component, list its importers.
  This is what finds a platform twin that nothing renders any more — a plain
  reference grep will not, because comments and skeletons still name it.
- Run a duplication detector if one is to hand (the portfolio's
  `scripts/shared-code-audit.mjs` did not come with the extraction). Treat a
  high score as a hint, never a verdict: read the pair.

Then read every file in scope, holding the Phase 0 rules in mind.

## Phase 2 — Audit both axes

Work the appendix checklists. For every finding, capture: file:line, what rule
or sibling it disagrees with, and the concrete fix. A finding without evidence
or without a fix is noise — drop it.

Two habits that decide whether this audit is worth anything:

- **Measure, don't eyeball.** Any claim about geometry (a gap, a radius, a row
  pitch, an inset) gets measured against the rendered surface. Screenshot, scan
  the pixels, quote the numbers.
- **Verify "pre-existing" before you say it.** If something looks wrong and you
  suspect it predates this rework, go test the untouched surface. "Pre-existing"
  is a claim, not an excuse, and it is often wrong.

## Phase 3 — Report (stop for approval)

```
# Craft audit: <app> — <platform> — <date>

## Verdict
One honest paragraph. If the codebase is in good shape, say so plainly —
a report that manufactures severity to look thorough is worse than useless.

## A. Componentization
Ranked. Each: file:line, what is duplicated/dead/ignored, the fix, effort.

## B. Is this <OS>-ly enough
Ranked. Each: file:line, which idiom or token it departs from, the fix.
Include a short "this is already coherent" note for the systems you checked
and found sound (e.g. the button-variant map) — it tells the user what NOT
to worry about, and stops the next audit re-deriving it.

## Outside the exclusion boundary
Anything real you found in the surfaces the user excluded. Labelled, not
acted on.

## Ranked fix order
Batches, each independently verifiable.
```

Present it and wait.

## Phase 4 — Execute approved batches

- Dead code and the defects it hides first (a skeleton standing a deleted
  component is both an A and a B finding); then real duplication; then token
  and idiom corrections; then cosmetic cleanup.
- **When you extract, extract the shared TERM, not a copy.** If a skeleton
  cannot share a style object because the real thing is a native view with no
  styles to borrow, export the measured constant from one place and have both
  sides import it. A second copy of a measurement is the defect, not the number.
- Keep behavior identical unless the finding _is_ the behavior (a wrong idiom
  usually is — a swipe replacing two permanent buttons changes interaction by
  design). Say which findings change behavior in the report, so approval is
  informed.
- After each batch: typecheck, lint, format, tests — and **run it**. Walk every
  changed surface on the device/simulator. A clean diff is not verification.
- Record discovered platform/API limitations and measured constants somewhere
  durable (project docs or memory) so the next audit inherits them.

---

# Appendix — What to look for

Prompts to investigate, not boxes to tick. The project's own rules outrank
everything here.

## A. Componentization

1. **A platform twin nothing renders.** A `.ios`/`.android` file (or a
   platform-named component) left behind when its surface was rebuilt. The tell:
   its only importer imports _one constant_ from it. Check importers, not
   mentions.
2. **A skeleton standing a component that was replaced.** The single most
   recurrent defect in a reworked codebase, because the bone is never the thing
   you are looking at when you change the real one. For every loading state, ask
   which component it stands in for _today_.
3. **Props a component ignores.** A `variant`/`mode` flag whose branch reads
   none of them, so every caller passes five dead arguments and states the real
   thing somewhere else. Split the component rather than documenting the flag.
4. **The same call-site block repeated N× in one file.** Three cells, three
   rows, three sheets — identical wiring, differing in one value. Collapse to a
   component that owns the invariant parts.
5. **Boilerplate roots repeated across sibling routes.** The same wrapper,
   the same style object, the same dev-only chip in six files.
6. **Zero-reference exports**, and constants/styles orphaned by a removed
   feature.
7. **Comments describing code that no longer exists** — sizes, mechanisms,
   components that were renamed or deleted. Stale docs actively mislead the next
   session; they are findings, not cosmetics.
8. **A type or union restated in a platform stub**, so adding a case means
   editing the other platform's file.
9. **Reimplementation beside the shared layer** — the same screen/hook/primitive
   solved once in `src/ui` / `src/core` and again in `src/components` or
   `src/hooks` (the extraction put the two worlds in one repo). Check before
   concluding: sometimes staying separate is right (genuinely different
   features, or app-specific data shapes).
10. **The right amount of extraction.** Not everything scoring high should move,
    and a shared component with per-caller presentation knobs is drift with
    extra steps: if two callers need different looks from one component, that is
    an argument to have in the component, not a prop.

## B. Is this <OS>-ly enough

1. **Hand-drawn controls where the OS has one.** The loudest tell, and the one
   worth hunting hardest: a styled pressable painted to look like a button, a
   hand-built badge, a custom picker. Search for raw pressables with background
   fills and pill radii. Each authored control must justify itself by naming the
   native component rejected and what specifically failed — "it matches the rest
   of this screen" is not a reason.
2. **Button types and variants — enumerate them.** List every button in scope
   with its variant, size and container. Then check the map reads as a system:
   one variant per job (primary/settled/inline/row/destructive), and each one a
   real system control. Outliers are either a bug or an undocumented decision.
3. **Press feedback matching its container**, per the project's rule (a card
   and an inline text action should not press alike; anything inside a native
   container keeps the system's own feedback).
4. **Raw literals where a design token exists** — radius, gutter, gap, row
   height. Usually invisible today and the reason a token change later moves
   half the app.
5. **A copied number where a shared constant sits three lines away.** Grep for
   the token's _value_ as a literal, not just its name.
6. **Container idiom.** Is a list of same-shaped things a stack of cards where
   the platform uses one grouped container (or vice versa)? Do sibling screens
   showing the same kind of content use the same container?
7. **Row actions.** Permanent buttons per row where the platform hides actions
   behind a swipe or a context menu — or a mechanism that exists on one list and
   not on its twin.
8. **Destructive flows.** Confirmation mechanism, wording, and whether the
   platform's control commits before your confirmation can run.
9. **Loading/empty/error contract applied uniformly.** Every screen's states
   should go through the same wrapper; the common miss is a skeleton that does
   not take the same scroll inset as the real content, so everything jumps on
   settle.
10. **Artwork vs container shape.** Pictures usually scale their corner with
    their size while containers hold a fixed radius — check both families follow
    the project's rule rather than whichever number was nearest.
11. **Copy and voice** — the platform's phrasing conventions, capitalization,
    and the project's terminology table. Watch for a term that is right in an
    alert but too long for a swipe or a bar button: shorten the constrained
    control and keep the full term where the decision is made.
12. **Flows and structure** — depth (how many taps to the primary job), where
    an entry point lives, whether push/sheet/modal matches what the destination
    is, and whether two ways into the same surface land in the same place.

## Verification discipline

- Baseline green before, green after: typecheck, lint, format, tests.
- **Band-scan instead of guessing.** Screenshot the rendered surface, scan the
  pixels for edges and pitches, and quote the measurement in the code comment
  next to the constant it justifies, with the device and OS version.
- **Check derived numbers against the real thing.** A constant derived from a
  correct rule can still be wrong because the rule doesn't apply — verify the
  derivation, don't just trust the arithmetic.
- **Never ship an unverified measurement.** If it can't be measured this
  session, say so in the report and name what has to be measured.
- **Never fire a destructive path to verify something you can read.** Strings,
  labels and copy come from the source; alerts and permanent deletes are not
  inspection tools.
- Confirm the input coordinate space before driving a UI (points vs pixels) — a
  scale mismatch silently clamps taps and reads as a broken app.
- Verify in both appearances (light/dark) for anything touching color or
  material.
