# Sound Shaper

Social music player + tweaker. Upload your own `.mp3`s, read their tags, play
them, clip the best parts, and top other people's songs.

See [`../../docs/sound-shaper-plan.md`](../../docs/sound-shaper-plan.md) for the
full build plan, data model, and phased milestones.

## Develop

```sh
npm install            # from the monorepo root
npx expo run:android   # or run:ios — needs the Firebase config files first
```

Requires a Firebase project and its native config files
(`google-services.json`, `GoogleService-Info.plist`) — see the `REPLACE_WITH_*`
placeholders in `app.json` and `.firebaserc`.
