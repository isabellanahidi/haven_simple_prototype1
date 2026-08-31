import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Sends a signed-out visitor to /signin, carrying where they were so they can
 * be returned to it. Used by the affordances that stay visible when signed out
 * — the like button and the reply composer — rather than hiding them.
 */
export function useSignInRedirect(): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    navigate('/signin', { state: { from: location } });
  }, [navigate, location]);
}
