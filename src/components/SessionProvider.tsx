import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { SessionContext, type SessionState } from '../lib/session';
import { hasPassword } from '../lib/password';
import { personalName } from '../lib/personalName';

function read(session: Session | null): SessionState {
  return {
    userId: session?.user?.id ?? null,
    loading: false,
    hasPassword: hasPassword(session?.user),
    personalName: personalName(session?.user),
  };
}

/**
 * Publishes the current session and **never gates its children**.
 *
 * Reading is open to signed-out visitors — the RLS select policies pass for
 * the anon role — so blocking render on a session would hide a feed the
 * database is perfectly willing to serve. Screens that genuinely need a user
 * wrap themselves in <RequireAuth> instead.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    userId: null,
    loading: true,
    hasPassword: false,
    personalName: null,
  });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setState(read(session));
    });

    // Keeps every screen in step with sign-in, sign-out, and token refresh
    // without any of them polling. USER_UPDATED lands here too, which is what
    // makes hasPassword flip the moment updateUser() stores one — and what
    // makes the feed's greeting change the moment a name is saved, with no
    // refetch and no reload.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(read(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
