import { Slot } from 'expo-router';

// Android: a pass-through — the js-tabs navigator owns this tab's header.
export default function TabPassthrough() {
  return <Slot />;
}
