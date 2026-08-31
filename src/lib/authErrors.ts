import type { AuthError } from '@supabase/supabase-js';

/**
 * Turn a Supabase auth failure into something worth showing a person.
 *
 * The codes below are from `@supabase/auth-js` error-codes.d.ts as installed
 * (supabase-js 2.112.4), not guessed.
 *
 * **How a transport failure is told apart from a rejected code.** Per the
 * AuthError docs: "Most errors coming from HTTP responses will have a code,
 * though some errors that occur before a response is received will not have
 * one present. In that case status will also be undefined." So no status and
 * no code means the request never reached Supabase — the network, not the
 * token. Those two cases must not read the same: one means "check the code
 * you typed", the other means "check your connection".
 */
export function authErrorMessage(error: AuthError): string {
  if (error.status === undefined && error.code === undefined) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  switch (error.code) {
    case 'otp_expired':
      return 'That code is wrong or has expired. Codes last one hour — request a new one if you need to.';

    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      // Worth saying explicitly that this is project-wide. A tester who hits
      // it has almost certainly done nothing unusual themselves, and "you are
      // sending too fast" would be actively misleading.
      return `${error.message} This limit is shared across everyone testing the app, not per person — waiting a few minutes usually clears it.`;

    case 'otp_disabled':
      return 'Email sign-in is currently switched off for this project.';

    case 'validation_failed':
      return "That doesn't look like a valid email address.";

    default:
      return error.message;
  }
}

/**
 * Supabase phrases its per-user throttle as "... after N seconds". Reading the
 * number back means the on-screen cooldown matches what the server will
 * actually accept, rather than guessing.
 */
export function retryAfterSeconds(error: AuthError, fallback: number): number {
  const match = /after (\d+) seconds?/i.exec(error.message);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
