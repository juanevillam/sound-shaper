# Sound Shaper

Personal music player with a shapeable sound. Add your own `.mp3`s, read their
tags, play them, shape them with a 5-band EQ and a playback speed, and clip the
parts worth replaying. Your library is yours alone — there is no social module.

See [`../../docs/sound-shaper-plan.md`](../../docs/sound-shaper-plan.md) for the
full build plan, data model, and phased milestones, and
[`AGENTS.md`](AGENTS.md) for the product and UX standards this app is held to.

## Develop

```sh
npm install            # from the monorepo root
npx expo run:ios       # or run:android — needs the Firebase config files first
```

Requires a Firebase project and its native config files
(`google-services.json`, `GoogleService-Info.plist`) — see the `REPLACE_WITH_*`
placeholders in `app.json` and `.firebaserc`.

## The audio graph is partly patched

Playback runs through `react-native-audio-api`, and its time-stretcher — the
path behind **Preserve Pitch** at any speed other than 1× — is replaced by a
phase vocoder via [`patches/react-native-audio-api/`](../../patches/react-native-audio-api/README.md).
The library's own stretcher was voice-grade and audibly granular on music.

Two consequences while working here: the root `npm install` must have run (the
`postinstall` is what applies the overlay), and **any change to that C++ needs a
native rebuild** — it compiles into the pod, so a Metro reload will keep running
the old stretcher.
