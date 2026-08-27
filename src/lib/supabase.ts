// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

let sessionPromise: Promise<Session | null> | null = null;

export function ensureSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return session;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) { sessionPromise = null; throw error; }
      return data.session;
    })();
  }
  return sessionPromise;
}
