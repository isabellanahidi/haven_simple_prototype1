import type { AuthError, User } from '@supabase/supabase-js';
import { authErrorMessage } from './authErrors';
import { charLength } from './text';

/**
 * Client-side floor. Supabase's own default minimum is **6**; its security
 * guidance says anything under 8 is not recommended, so we ask for 8 and let
 * the server ask for more if the project is ever configured stricter — that
 * arrives as a `weak_password` error whose message names the reason.
 *
 * Counted with charLength (code points) rather than `.length` (UTF-16 units)
 * for the same reason as everywhere else in the app. GoTrue counts bytes, and
 * a code point is never fewer bytes than one, so a password that clears 8 here
 * always clears a 6-byte minimum there.
 */
export const PASSWORD_MIN = 8;

export function passwordLength(value: string): number {
  return charLength(value);
}

/**
 * Whether this user has a password.
 *
 * **Supabase gives the client no way to ask.** A password-less OTP account and
 * a password account both carry the same `email` identity, and
 * `signInWithPassword` returns the same invalid-credentials error either way
 * (Supabase documents this explicitly). So we record it ourselves: every call
 * that sets a password also sets `data: { has_password: true }`, which lands
 * in `auth.users.raw_user_meta_data` and comes back on the session user.
 *
 * It is a hint, not a security boundary — user metadata is user-writable, and
 * nothing here grants access. The worst a forged value does is show the wrong
 * label on a button.
 */
export function hasPassword(user: User | null | undefined): boolean {
  return user?.user_metadata?.has_password === true;
}

/** Turn a failed sign-in-with-password into something worth showing a person. */
export function signInPasswordErrorMessage(error: AuthError): string {
  // Supabase returns the same error whether the password is wrong, the account
  // doesn't exist, or the account simply has no password — deliberately, so
  // that a signed-out stranger can't probe which. We can't distinguish it
  // either, so the copy has to cover all three and point at the code path,
  // which works in every one of them.
  if (error.code === 'invalid_credentials') {
    return 'Wrong password — or this account may not have one yet. Email me a code instead.';
  }
  if (error.code === 'email_not_confirmed') {
    return "This email hasn't been confirmed yet. Sign in with a code once and it will be.";
  }
  return authErrorMessage(error);
}

/** Turn a failed `updateUser({ password })` into something worth showing. */
export function setPasswordErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'weak_password':
      // The message names the reasons (length / characters / pwned), which is
      // more useful than anything we could write blind.
      return error.message;

    case 'same_password':
      return "That's already your password. Pick a different one, or leave it as it is.";

    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
    case 'reauth_nonce_missing':
      // Only reachable with "Secure password change" on and a session older
      // than 24 hours. We deliberately don't build a reauthentication flow:
      // signing out and back in with a code does the same job through the one
      // path that already exists. See CLAUDE.md section 14.
      return 'For security this needs a fresh sign-in. Sign out, sign back in with a code, then set your password.';

    case 'session_expired':
    case 'session_not_found':
    case 'bad_jwt':
      return 'Your session expired. Sign in again, then set your password.';

    default:
      return authErrorMessage(error);
  }
}
