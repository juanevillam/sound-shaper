import { Component, lazy, Suspense, type ReactNode } from 'react';

import { t, useLocale } from './i18n';
import { Welcome } from './screens/Welcome';
import { useSession } from './session';

const Home = lazy(() =>
  import('./screens/Home').then(m => ({ default: m.Home })),
);

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="error" style={{ minHeight: '100svh' }}>
        <p>{t('errors.message')}</p>
        <button
          type="button"
          className="pill"
          onClick={() => window.location.reload()}
        >
          {t('errors.retry')}
        </button>
      </main>
    );
  }
}

export function App() {
  const session = useSession();
  // A language change re-renders everything from here, in place.
  useLocale();

  // A persisted session resolves in a few milliseconds; a blank frame is
  // calmer than the Welcome screen flashing in front of a signed-in library.
  if (session.state === 'loading') return null;

  return (
    <ErrorBoundary>
      {session.state === 'signed-in' ? (
        <Suspense fallback={null}>
          <Home key={session.user.uid} user={session.user} />
        </Suspense>
      ) : (
        <Welcome />
      )}
    </ErrorBoundary>
  );
}
