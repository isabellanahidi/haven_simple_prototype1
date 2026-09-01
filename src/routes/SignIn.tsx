import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { authErrorMessage, retryAfterSeconds } from '../lib/authErrors';
import { hasPassword, signInPasswordErrorMessage } from '../lib/password';
import { SetPasswordForm } from '../components/SetPasswordForm';
import { Loading } from '../components/States';

/** Supabase's default is one OTP request per 60s per user. */
const RESEND_COOLDOWN = 60;
/** `{{ .Token }}` renders a 6-digit code. */
const CODE_LENGTH = 6;

type Step = 'email' | 'code' | 'create-password';

export default function SignIn() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, loading } = useSession();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  // Set before this screen starts a sign-in of its own — see the effect below.
  const selfInitiated = useRef(false);

  // RequireAuth and useSignInRedirect both stash a full router Location under
  // state.from. Rebuild the whole path so a query string or hash survives.
  const from = (location.state as { from?: Location } | null)?.from;
  const rawDest = from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/';
  // Guard against bouncing back here and looping.
  const dest = rawDest.startsWith('/signin') ? '/' : rawDest;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  // Someone who *arrived* already signed in has nothing to do here.
  //
  // Scoped to that case only, via a flag set before the sign-in call rather
  // than after it resolves. A sign-in completed on this screen navigates
  // itself, and it has to: the create-password step needs a live session to
  // render against, so a redirect that merely watched for a session would fire
  // the instant the sign-in that precedes the step succeeded —
  // onAuthStateChange can publish the new session before the handler that
  // chose the step has run.
  useEffect(() => {
    if (loading || !userId || selfInitiated.current) return;
    navigate(dest, { replace: true });
  }, [loading, userId, navigate, dest]);

  // Placeholder for the frame between the effect above deciding to leave and
  // the navigation landing. Purely cosmetic — it makes no routing decision.
  if (!loading && userId && step === 'email') return <Loading label="Signing you in…" />;

  const trimmedEmail = email.trim();
  const emailLooksValid = /^\S+@\S+\.\S+$/.test(trimmedEmail);
  const codeComplete = code.length === CODE_LENGTH;
  const canUsePassword = emailLooksValid && password.length > 0;

  async function sendCode(address: string) {
    setBusy(true);
    setError(null);
    setNotice(null);

    // shouldCreateUser defaults to true, so this one call both registers a new
    // email and signs in an existing one. No separate signup path.
    const { error: sendError } = await supabase.auth.signInWithOtp({ email: address });
    setBusy(false);

    if (sendError) {
      setError(authErrorMessage(sendError));
      // Still start a cooldown on a rate-limit refusal, matching the delay the
      // server actually named, so the button can't be hammered.
      if (
        sendError.code === 'over_email_send_rate_limit' ||
        sendError.code === 'over_request_rate_limit'
      ) {
        setCooldown(retryAfterSeconds(sendError, RESEND_COOLDOWN));
      }
      return false;
    }

    setCooldown(RESEND_COOLDOWN);
    return true;
  }

  // The form's default action, so Enter from the email field asks for a code.
  // The password button is wired separately — see handlePasswordKeyDown.
  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (!emailLooksValid || busy) return;
    if (await sendCode(trimmedEmail)) {
      setCode('');
      setPassword('');
      setStep('code');
    }
  }

  async function handlePasswordSignIn() {
    if (!canUsePassword || busy) return;

    // Before the call, not after: by the time any effect could observe the new
    // session, this is already true.
    selfInitiated.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      setBusy(false);
      setError(signInPasswordErrorMessage(signInError));
      return;
    }

    // Signing in with a password proves there is one, so there is nothing to
    // offer here — straight through.
    navigate(dest, { replace: true });
  }

  // Enter inside the password field means "sign in with this password", not
  // the form's default of mailing a code.
  function handlePasswordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void handlePasswordSignIn();
  }

  async function handleResend() {
    if (busy || cooldown > 0) return;
    if (await sendCode(trimmedEmail)) {
      setCode('');
      setNotice('New code sent.');
    }
  }

  async function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    if (!codeComplete || busy) return;

    selfInitiated.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: code,
      type: 'email',
    });

    if (verifyError) {
      setBusy(false);
      setError(authErrorMessage(verifyError));
      setCode('');
      codeRef.current?.focus();
      return;
    }

    if (!data.session) {
      setBusy(false);
      setError('That code was accepted but no session came back. Try requesting a new one.');
      return;
    }

    setBusy(false);

    // Offer a password only to accounts that don't have one. Decided from the
    // user this call just returned rather than from context state, so it can't
    // race the provider catching up.
    if (!hasPassword(data.user)) {
      setStep('create-password');
      return;
    }

    navigate(dest, { replace: true });
  }

  function backToEmail() {
    setStep('email');
    setCode('');
    setPassword('');
    setError(null);
    setNotice(null);
  }

  return (
    <>
      <Link className="back-link" to="/">
        ← Feed
      </Link>

      {step === 'email' && (
        <form className="composer" onSubmit={handleEmailSubmit}>
          <h1 className="detail-title">Sign in</h1>
          <p className="field-hint signin-intro">
            Reading needs no account. Posting, replying, and liking do. A code by email always
            works — a password is optional, and only if you've made one.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="signin-email">
              Email
            </label>
            <input
              id="signin-email"
              className="text-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              disabled={busy}
            />
          </div>

          {/* Kept in the same <form> as the email, and adjacent to it, so iOS
              fills both from one keychain tap. */}
          <div className="field">
            <div className="field-head">
              <label className="field-label" htmlFor="signin-password">
                Password <span className="field-optional">if you've set one</span>
              </label>
            </div>
            <input
              id="signin-password"
              className="text-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handlePasswordKeyDown}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              disabled={busy}
            />
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {/* The code is the primary path deliberately: it works for everyone,
              including everyone who has never been here before. */}
          <button className="btn-primary" type="submit" disabled={!emailLooksValid || busy}>
            {busy ? 'Working…' : 'Email me a code'}
          </button>

          <button
            className="btn-secondary"
            type="button"
            onClick={handlePasswordSignIn}
            disabled={!canUsePassword || busy}
          >
            Sign in with password
          </button>
        </form>
      )}

      {step === 'code' && (
        <form className="composer" onSubmit={handleCodeSubmit}>
          <h1 className="detail-title">Enter your code</h1>

          <p className="field-hint signin-intro">
            Sent to <strong className="signin-email">{trimmedEmail}</strong>
          </p>
          <button type="button" className="btn-quiet signin-edit" onClick={backToEmail}>
            Use a different email
          </button>

          <div className="field">
            <label className="field-label" htmlFor="signin-code">
              6-digit code
            </label>
            <input
              id="signin-code"
              ref={codeRef}
              className="text-input otp-input"
              type="text"
              value={code}
              // Digits only, so a pasted "Your code is 123456" can't be submitted.
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              // numeric + one-time-code is what makes iOS surface the code
              // from the notification banner above the keyboard.
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={CODE_LENGTH}
              placeholder="000000"
              aria-describedby="signin-code-help"
              disabled={busy}
            />
            <p className="field-hint" id="signin-code-help">
              Codes last one hour.
            </p>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}

          <button className="btn-primary" type="submit" disabled={!codeComplete || busy}>
            {busy ? 'Verifying…' : 'Verify and sign in'}
          </button>

          <div className="signin-resend">
            <button
              type="button"
              className="btn-quiet"
              onClick={handleResend}
              disabled={busy || cooldown > 0}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 'create-password' && (
        <>
          <h1 className="detail-title">Add a password?</h1>
          <p className="field-hint signin-intro">
            You're signed in — this is optional. A password just saves you waiting for a code
            next time. A code by email still works, always, and it's how you get back in if you
            forget this.
          </p>

          <SetPasswordForm
            idPrefix="signup"
            submitLabel="Save password"
            busyLabel="Saving…"
            onDone={() => navigate(dest, { replace: true })}
            secondary={
              <button
                type="button"
                className="btn-quiet"
                onClick={() => navigate(dest, { replace: true })}
              >
                Not now
              </button>
            }
          />
        </>
      )}
    </>
  );
}
