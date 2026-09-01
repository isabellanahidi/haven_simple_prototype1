import { useCallback } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { supabase } from './supabase';

/** Why /signin was reached, when it wasn't simply chosen. */
export type SignInReason = 'session-expired';

/**
 * The router state every route into /signin carries. RequireAuth,
 * useSignInRedirect and useRecoverStaleSession all write this shape, and
 * SignIn reads it — one contract, declared once.
 */
export type SignInState = { from?: Location; reason?: SignInReason };

/**
 * Sends a signed-out visitor to /signin, carrying where they were so they can
 * be returned to it. Used by the affordances that stay visible when signed out
 * — the like button and the reply composer — rather than hiding them.
 */
export function useSignInRedirect(): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    navigate('/signin', { state: { from: location } satisfies SignInState });
  }, [navigate, location]);
}

/**
 * Drop a session whose user no longer exists.
 *
 * `getSession()` reads the JWT out of localStorage and never asks the server
 * whether that user is still there, so a deleted account keeps presenting as
 * signed in until the token expires. Every read scoped to `auth.uid()` then
 * comes back empty and every write fails on the foreign key — which looks like
 * a data fault and isn't one.
 *
 * **Local scope on purpose.** There is no server-side session left to revoke,
 * so a global sign-out would only fail on the way out; the token in this
 * browser is the entire thing that needs clearing.
 */
export async function clearStaleSession(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}

/**
 * Clear a stale session *and* leave, for screens that cannot function without
 * a profile. Screens that merely lose an affordance — post detail keeps
 * rendering the post — should call `clearStaleSession()` on its own and stay
 * where they are.
 */
export function useRecoverStaleSession(): () => Promise<void> {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(async () => {
    // Navigate first, then sign out. The other order publishes SIGNED_OUT
    // while RequireAuth is still mounted, so *its* redirect wins the race and
    // lands on /signin without the reason — leaving this navigation to fire
    // from an unmounted component.
    navigate('/signin', {
      state: { from: location, reason: 'session-expired' } satisfies SignInState,
      replace: true,
    });
    await clearStaleSession();
  }, [navigate, location]);
}
