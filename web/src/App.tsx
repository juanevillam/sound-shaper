import { Home } from './screens/Home';
import { Welcome } from './screens/Welcome';
import { useSession } from './session';

export function App() {
  const session = useSession();

  // A persisted session resolves in a few milliseconds; a blank frame is
  // calmer than the Welcome screen flashing in front of a signed-in library.
  if (session.state === 'loading') return null;

  return session.state === 'signed-in' ? (
    <Home key={session.user.uid} user={session.user} />
  ) : (
    <Welcome />
  );
}
