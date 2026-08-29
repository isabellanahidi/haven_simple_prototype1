import { createContext, useContext } from 'react';

/** The current anonymous user's id. Null only above <SessionGate>. */
export const SessionContext = createContext<string | null>(null);

/** Read the signed-in user's id. Safe to call anywhere under <SessionGate>. */
export function useUserId(): string {
  const userId = useContext(SessionContext);
  if (!userId) throw new Error('useUserId() must be called inside <SessionGate>');
  return userId;
}
