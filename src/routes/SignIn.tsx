import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { authErrorMessage, retryAfterSeconds } from '../lib/authErrors';

/** Supabase's default is one OTP request per 60s per user. */
const RESEND_COOLDOWN = 60;
/** `{{ .Token }}` renders a 6-digit code. */
const CODE_LENGTH = 6;

type Step = 'email' | 'code';

export default function SignIn() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId, loading } = useSession();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

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

  // Already signed in — nothing to do here. Also covers the moment after
  // verifyOtp when onAuthStateChange has landed.
  if (!loading && userId) return <Navigate to={dest} replace />;

  const trimmedEmail = email.trim();
  const emailLooksValid = /^\S+@\S+\.\S+$/.test(trimmedEmail);
  const codeComplete = code.length === CODE_LENGTH;

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

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (!emailLooksValid || busy) return;
    if (await sendCode(trimmedEmail)) {
      setCode('');
      setStep('code');
    }
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

    navigate(dest, { replace: true });
  }

  function backToEmail() {
    setStep('email');
    setCode('');
    setError(null);
    setNotice(null);
  }

  return (
    <>
      <Link className="back-link" to="/">
        ← Feed
      </Link>

      {step === 'email' ? (
        <form className="composer" onSubmit={handleEmailSubmit}>
          <h1 className="detail-title">Sign in</h1>
          <p className="field-hint signin-intro">
            Reading needs no account. Posting, replying, and liking do. Enter your email and
            we'll send a code — there's no password to remember.
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

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button className="btn-primary" type="submit" disabled={!emailLooksValid || busy}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
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
    </>
  );
}
