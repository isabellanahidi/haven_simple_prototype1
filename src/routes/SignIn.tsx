import { Link, useLocation } from 'react-router-dom';

/**
 * PLACEHOLDER. Email OTP sign-in is not built yet.
 *
 * The route exists so the redirect plumbing is real and testable: RequireAuth
 * and useSignInRedirect both send visitors here with the intended destination
 * in `location.state.from`, and whatever replaces this screen should read it
 * and return them there after verifying.
 */
export default function SignIn() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  return (
    <>
      <Link className="back-link" to="/">
        ← Feed
      </Link>

      <div className="state">
        <p className="state-title">Sign in</p>
        <p className="state-body">
          Email sign-in isn't built yet. Reading doesn't need an account —
          posting, replying, and liking will.
        </p>
        {from && (
          <p className="state-body">
            You'll be sent back to <code>{from}</code> once this works.
          </p>
        )}
      </div>
    </>
  );
}
