# Sound Shaper

Personal music player with a shapeable sound. Add your own `.mp3`s, read their
tags, play them, shape them with a 5-band EQ and a playback speed, and clip the
parts worth replaying. Your library is yours alone — there is no social module.

See [`AGENTS.md`](AGENTS.md) for the product and UX standards this app is held
to, its data layer and what it caches; the build plan it shipped against was
retired 2026-09-12 (`git log --follow -- docs/sound-shaper-plan.md`).

## Develop

```sh
npm install            # from the monorepo root
npx expo run:ios       # or run:android — needs the Firebase config files first
```

Runs against the `sound-shaper` Firebase project (`.firebaserc`); its native
client config files (`google-services.json`, `GoogleService-Info.plist`) are
committed here and wired from `app.json`.

## The audio graph is partly patched

Playback runs through `react-native-audio-api`, and its time-stretcher — the
path behind **Preserve Pitch** at any speed other than 1× — is replaced by a
phase vocoder via [`patches/react-native-audio-api/`](../../patches/react-native-audio-api/README.md).
The library's own stretcher was voice-grade and audibly granular on music.

Two consequences while working here: the root `npm install` must have run (the
`postinstall` is what applies the overlay), and **any change to that C++ needs a
native rebuild** — it compiles into the pod, so a Metro reload will keep running
the old stretcher.
