import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session';
import { Loading } from './States';

/**
 * Gates the routes that write. Signed-out visitors are sent to /signin with
 * the destination attached, so sign-in can return them where they meant to go.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { userId, loading } = useSession();
  const location = useLocation();

  // Redirecting before the first session read resolves would bounce a
  // signed-in user who deep-linked straight to /me.
  if (loading) return <Loading label="Checking your session…" />;

  if (!userId) return <Navigate to="/signin" state={{ from: location }} replace />;

  return <>{children}</>;
}
