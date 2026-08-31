import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { SessionContext, type SessionState } from '../lib/session';

/**
 * Publishes the current session and **never gates its children**.
 *
 * Reading is open to signed-out visitors — the RLS select policies pass for
 * the anon role — so blocking render on a session would hide a feed the
 * database is perfectly willing to serve. Screens that genuinely need a user
 * wrap themselves in <RequireAuth> instead.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ userId: null, loading: true });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setState({ userId: session?.user?.id ?? null, loading: false });
    });

    // Keeps every screen in step with sign-in, sign-out, and token refresh
    // without any of them polling.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ userId: session?.user?.id ?? null, loading: false });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
