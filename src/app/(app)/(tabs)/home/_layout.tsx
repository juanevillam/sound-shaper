import { Slot } from 'expo-router';

// Android: a pass-through — the js-tabs navigator owns this tab's header, so
// no nested navigator is introduced. iOS will replace this with a native Stack
// (`_layout.ios.tsx`) when the iOS side lands.
export default function TabPassthrough() {
  return <Slot />;
}
