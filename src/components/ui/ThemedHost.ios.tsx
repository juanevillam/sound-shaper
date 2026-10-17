// iOS counterpart of `ThemedHost`. The themed SwiftUI embed point lives in
// `src/ui` so every app hosts SwiftUI identically; re-exported
// under this name so shared call sites keep importing `ThemedHost` and get the
// right native layer per platform.
//
// The Android variant forwards `seedColor` for Material You. SwiftUI has no
// palette extraction (`getMaterialColors` is Android-only — calling it on iOS
// is what crashed the first launch), so the iOS theme resolves to core's
// Apple system colors and only `colorScheme` crosses over.
export { SwiftUIHost as ThemedHost } from '@/ui';
