# Sound Shaper

Third portfolio app: a **PERSONAL** music player + tweaker — zero social
features, by design (2026-07-18): every upload is for the uploader alone, which
keeps the copyright surface at zero. Upload your own `.mp3`s, read their tags,
play them, shape the sound. Same engineering mentality as Topper — native UI
per platform, shared portfolio Welcome / Settings / Manage-account screens,
full Firebase (Spark), no self-hosted backend.

**No tabs.** Home (playlists) is the single root screen; Settings hangs off its
app-bar gear; playlist-detail / now-playing / manage-account push from there.
There is NO Explore and NO profile screen — the username lives in Settings'
account section only. Don't reintroduce social affordances (visibility
toggles, feeds, follows) — simplicity is the point.

**The build plan is the source of truth:**
[`../../docs/sound-shaper-plan.md`](../../docs/sound-shaper-plan.md) — scope,
data model, phases, and the copyright rule (owner hears the full song, the
public feed plays only the clip preview).

## Status

**Playlist phase (P1) — Topper-structure port, Android-first.** P0 (scaffold +
Firebase + Google/Apple auth) is done and device-verified. This phase mirrors
Topper's architecture with playlists in place of tops and songs in place of
items: `(tabs)` home/explore/profile behind the Compose `AppTabBar`, playlist
CRUD via `EditPlaylistSheet`, song upload via document-picker → ID3 parse
(`src/lib/id3.ts`) → `EditSongSheet` → **Cloudinary** (audio as a `video`
resource + embedded art) + Firestore, drag-reorder via react-native-sortables,
username claim + profile tab, manage-account info screen.

**No Firebase Storage, no Cloud Functions** — both need the Blaze (paid) plan,
and this app stays on Spark (free). Media goes to **Cloudinary** (same cloud
`juanevillam` as Topper, unsigned preset `sound_shaper_unsigned`,
`src/services/cloudinary/`). Consequence: Cloudinary deletion needs a signed
backend call we don't have, so deleting a song/playlist orphans its Cloudinary
assets (a known gap, exactly Topper's pre-Functions state).

P2 (playback) is BUILT: expo-audio singleton (`src/lib/player.ts` +
`src/store/player.ts`), tap-to-play SongCards (long-press = edit), pure-RN
MiniPlayer pinned above the bottom inset, now-playing screen (scrubber,
transport, speed presets 0.5–2×, keep-pitch switch), background playback.

Deliberate gaps, in build order: clips (P3), delete-account flow (needs
reauth + sweep), **iOS route twins** (`*.ios.tsx` — Android-first like Topper
was; the Compose screens don't render on iOS yet).

Brand is deliberately **deferred to the end** — the launcher icon / splash /
welcome hero currently use **placeholder art borrowed from expo-starter**; the
Welcome hero falls back to the app initial (no `logo` prop yet). Replace with a
real stroke glyph (48-grid, stroke 3.25, sibling to the Topper crown) at the
brand phase.

## Expo has changed

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing native code. `@expo/ui` (Jetpack Compose + SwiftUI) markdown snapshots
live in `../expo-starter/docs/`. The installed TypeScript types under
`node_modules/@expo/ui` are the source of truth when the docs disagree.

## Native projects (CNG)

`android/` and `ios/` are **gitignored prebuild output** — never hand-edit them.
All native config lives in `app.json` + `expo-build-properties`. Regenerate with
`npx expo prebuild --clean`.
