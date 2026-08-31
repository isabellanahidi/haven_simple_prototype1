import { createContext, useContext } from 'react';

export type SessionState = {
  /** The signed-in user's id, or null. **Null is a normal state**, not a bug —
   *  the feed and post detail are readable with no session at all. */
  userId: string | null;
  /** True until the first session read resolves. Distinguishes "signed out"
   *  from "we don't know yet", which matters before redirecting anyone. */
  loading: boolean;
};

export const SessionContext = createContext<SessionState>({ userId: null, loading: true });

export function useSession(): SessionState {
  return useContext(SessionContext);
}

export function useUserId(): string | null {
  return useContext(SessionContext).userId;
}
