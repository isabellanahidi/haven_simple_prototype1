import { useEffect, useState, type ReactNode } from 'react';
import { ensureSession } from '../lib/supabase';
import { SessionContext } from '../lib/session';
import { Loading, ErrorState } from './States';

type State =
  | { kind: 'pending' }
  | { kind: 'ready'; userId: string }
  | { kind: 'error'; message: string };

/**
 * Bootstraps the anonymous session once and blocks rendering until there is a
 * user id. Every screen below this reads it with useUserId(), so no screen has
 * to handle a null user.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'pending' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await ensureSession();
        if (cancelled) return;
        const userId = session?.user?.id;
        if (!userId) {
          setState({ kind: 'error', message: 'Signed in but no user id came back.' });
          return;
        }
        setState({ kind: 'ready', userId });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'pending') return <Loading label="Signing you in…" />;

  if (state.kind === 'error') {
    return <ErrorState title="Couldn't sign you in" message={state.message} />;
  }

  return <SessionContext.Provider value={state.userId}>{children}</SessionContext.Provider>;
}
