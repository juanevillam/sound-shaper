# Trophies

`src/trophies` (imported as `@/trophies`) — PlayStation-style achievements: a
config-driven engine plus the UI (unlock popup, trophy screen, tier-tinted
icon). **Persistence-agnostic** — storage lives behind an injected adapter. This
app backs it with Firestore under `users/{uid}/trophies/{id}`
(`src/services/firebase/trophies.ts`).

## How it works

1. **Configure once per session** — `configureTrophies({ configs, adapter })`
   with a `TrophyConfig[]` (id + tier: `bronze` / `silver` / `gold` /
   `platinum`) and a `TrophyPersistenceAdapter` (`load()` / `save(id, achievedAt)`).
2. **Award from triggers** — `awardTrophy(id)` is **idempotent**: already-won
   ids no-op, new ones persist through the adapter, update the zustand cache, and
   queue the popup. Winning every non-platinum trophy auto-awards the platinum
   (self-healing on hydration too).
3. **Render** — `TrophyOverlay` is mounted once near the root (top-anchored
   animated popup with a queue and platinum flair) and a route renders
   `TrophiesScreen` (the PS-style list). Copy (`TrophyCopy` title/description per
   id) and colours arrive via props, so the module stays i18n- and theme-agnostic.

## Exports

| Export                                                                                                                    | Purpose                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `configureTrophies` / `awardTrophy` / `resetTrophies` / `useTrophyStore`                                                  | The engine + its zustand cache (instant reads, optimistic pops).                          |
| `resolveTrophies` / `useTrophies` / `TrophySummary`                                                                       | Merge configs + awarded state into display-ready lists.                                   |
| `TrophyOverlay` (+ colors/strings/props types)                                                                            | The unlock popup — mount once, feeds off the award queue.                                 |
| `TrophiesScreen` (+ colors/strings/props types)                                                                           | The PS-style trophy list screen.                                                          |
| `TrophyDetailSheet` / `TrophyDetailContent` (+ colors/props types)                                                        | One trophy's detail — the sheet, and its body for a host that supplies its own container. |
| `TrophyIcon`, `TIER_COLORS` / `tierColor`                                                                                 | Standalone tier-tinted trophy glyph and the tier palette.                                 |
| `TrophyConfig`, `TrophyCopy`, `TrophyTier`, `TrophyPersistenceAdapter`, `AwardedTrophy`, `QueuedTrophy`, `ResolvedTrophy` | The types.                                                                                |

## Where the app wires it

- Configs: `src/constants/trophies.ts`.
- Adapter and session hydration: `src/hooks/useTrophiesSync.ts` over
  `src/services/firebase/trophies.ts`.
- Award triggers: `src/hooks/useTrophyTriggers.ts`. Two of them read counts
  (`src/store/listening.ts`, `src/store/clipsSaved.ts`) that
  `src/lib/trophyCounters.ts` keeps in step with the totals on `users/{uid}`.
- Copy: `src/hooks/useTrophyContent.ts`.
