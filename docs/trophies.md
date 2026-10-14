# Trophies

`@portfolio/trophies` — a reusable, PlayStation-style achievements module:
a config-driven engine plus the UI (unlock popup, trophy screen, tier-tinted
icon). **Persistence-agnostic** — storage lives behind an injected adapter, so
any app can back it with Firestore, AsyncStorage, or anything else. Topper was
the first consumer (7 trophies, Firestore-persisted under
`users/{uid}/trophies/{id}`); Sound Shaper and Booker use it the same way.

Private and workspace-only. Consumed as **TypeScript source** — `main` / `types`
point at `src/index.ts`, so there is **no build step**.

## How it works

1. **Configure once per session** — `configureTrophies({ configs, adapter })`
   with the app's `TrophyConfig[]` (id + tier: `bronze` / `silver` / `gold` /
   `platinum`) and a `TrophyPersistenceAdapter` (`load()` / `save(id, achievedAt)`).
2. **Award from app triggers** — `awardTrophy(id)` is **idempotent**: already-won
   ids no-op, new ones persist through the adapter, update the zustand cache, and
   queue the popup. Winning every non-platinum trophy auto-awards the platinum
   (self-healing on hydration too).
3. **Render** — mount `TrophyOverlay` once near the app root (top-anchored
   animated popup with a queue and platinum flair) and push a screen that renders
   `TrophiesScreen` (the PS-style list). Copy (`TrophyCopy` title/description per
   id) and colors arrive via props, so the package stays i18n- and theme-agnostic.

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

## Peer dependencies

Provided by the host app: `@expo/ui`, `@portfolio/mobile-ui`, `react`, `react-native`, `react-native-gesture-handler`,
`react-native-reanimated`, `react-native-safe-area-context`, `react-native-svg`,
`zustand`.

> See Topper for a full integration: configs + thresholds in
> `apps/topper/src/constants/trophies.ts`, the Firestore adapter and session
> hydration in `apps/topper/src/hooks/useTrophiesSync.ts`, and award triggers in
> `useTrophyTriggers.ts`.
