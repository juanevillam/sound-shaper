# Widget Bridge

`@portfolio/widget-bridge` — the app half of an **iOS Home Screen widget**: the
shared App Group container, the media cache inside it, and the WidgetKit reload.
Sound Shaper's Library grid and Topper's Your Tops both stand on it.

The monorepo's **first package to ship native code**. Expo autolinking resolves
it through the workspace symlink and CocoaPods takes the pod from
`packages/widget-bridge/ios`, so an app gains a widget by depending on the
package rather than by owning a module. Apple-only: `platforms` is `["apple"]`,
and the JS entry uses `requireOptionalNativeModule`, so Android imports the same
file and gets `null` instead of a throw at module scope.

Private and workspace-only, consumed as **TypeScript source** — no build step.

## The split, and why it is where it is

A widget is a **second process with its own sandbox**. It holds no Firebase, no
session and no translator, so everything it draws has to be written somewhere
both binaries can reach. This package carries it across; it never interprets it.

- **The snapshot is opaque**: whatever shape the caller hands over is
  serialised to JSON as-is and written through untouched. The wire format between an app and its widget is
  that app's own business — a library of sounds and a shelf of tops share
  nothing — so this package never grows a case per app.
- **Media is named by the CALLER.** The widget resolves a file name out of the
  snapshot it reads, and the only way both sides can agree on one is for the side
  that writes the snapshot to choose it. `widgetMediaFile` derives it from the
  asset's URL, which makes it content-addressed for free: a replaced cover is a
  new name, so nothing races a cached file and an unchanged one is never fetched
  twice.
- **The App Group id is a parameter**, since it is per app.

## Exports

| Export                  | Purpose                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `useWidgetPublisher`    | The publish PROTOCOL, identical in every app — see below                 |
| `publishWidgetSnapshot` | Write a snapshot plus its media and reload WidgetKit                     |
| `clearWidgetSnapshot`   | Wipe the container — sign-out and account deletion                       |
| `widgetMediaFile`       | The file name both processes agree on, from the asset's URL              |
| `canPublishWidget`      | Whether a widget can be published from this build at all (false off iOS) |

`useWidgetPublisher` exists because both apps had written the same rules out
separately — 83.7% identical, caught by `scripts/shared-code-audit.mjs`:

- publish nothing until the first server snapshot has landed, because an empty
  collection and one nobody has asked for yet look identical from here, and the
  second would flash the widget's empty state on every launch;
- **coalesce**, because a drag or a rename arrives as a burst of snapshots and the
  widget only needs where it stopped;
- skip a render that changes nothing the widget can see;
- **clear on sign-out** — a widget keeps drawing its last snapshot until something
  replaces it, so somebody else's content left on a Home Screen is a privacy bug,
  not a stale cache;
- drop an in-flight build whose inputs have already moved on.

The app supplies only what is genuinely its own: a `signature` that says
something changed, and a `build` that turns its data into a snapshot.

## THE CONTAINER IS THE BRIDGE'S, AND IT SWEEPS ITSELF

Every publish removes anything in the container root that is not `snapshot.json`
or `media/`. An App Group container is created for one purpose and nothing else
ever cleans it, so when the writer moved from Swift to TypeScript its old
`library.json` and `artwork/` were left behind forever. Enforcing the invariant
continuously means the next rename sweeps itself rather than needing a migration
nobody will write.

It is a **whitelist, not a wipe**: iOS keeps its own `Library/` in there — the app
group's `UserDefaults` live in `Library/Preferences` — and the container metadata
is a dotfile. Both are skipped.

## What an app still owns

Its widget target (`apps/<app>/targets/widget`, via `@bacons/apple-targets`), the
shape of its snapshot, and the reader that decodes it. See each app's `AGENTS.md`
for the traps that shape costs — above all that **every field a reader declares
must be one the widget draws**, because a snapshot decodes whole.
