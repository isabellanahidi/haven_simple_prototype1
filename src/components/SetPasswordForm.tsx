import { useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { PASSWORD_MIN, passwordLength, setPasswordErrorMessage } from '../lib/password';

type Props = {
  /** Prefixes the input ids so two of these can never collide on a page. */
  idPrefix: string;
  submitLabel: string;
  busyLabel: string;
  /** Rendered under the submit button — "Not now" on sign-in, "Cancel" on /me. */
  secondary?: ReactNode;
  /** Called after the password is actually stored. */
  onDone: () => void;
};

/**
 * The one place in the app that sets a password.
 *
 * Both callers — the optional step after a first sign-in, and the control on
 * /me — are the *same* call on a live session. Neither is a reset flow, and
 * there is no reset flow: password recovery emails are links, links open in
 * Safari, and Safari is a different storage container from the Home Screen
 * app. "Forgot password" is the existing code path. See CLAUDE.md section 14.
 */
export function SetPasswordForm({ idPrefix, submitLabel, busyLabel, secondary, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = passwordLength(password);
  const longEnough = length >= PASSWORD_MIN;
  const matches = confirm.length > 0 && confirm === password;
  const valid = longEnough && matches;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;

    setBusy(true);
    setError(null);

    // has_password rides along in the same call on purpose. Two calls could
    // leave the password set and the flag unset, which reads as "no password"
    // forever after — the client has no other way to check.
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
    });

    setBusy(false);

    if (updateError) {
      setError(setPasswordErrorMessage(updateError));
      return;
    }

    setPassword('');
    setConfirm('');
    onDone();
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-password`}>
          New password
        </label>
        <input
          id={`${idPrefix}-password`}
          className="text-input"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          // new-password is what makes iOS offer to generate one and save it
          // to the keychain, rather than trying to fill an existing entry.
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          aria-describedby={`${idPrefix}-password-help`}
          disabled={busy}
        />
        <p className="field-hint" id={`${idPrefix}-password-help`}>
          At least {PASSWORD_MIN} characters.
        </p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-confirm`}>
          Confirm password
        </label>
        <input
          id={`${idPrefix}-confirm`}
          className="text-input"
          type="password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          disabled={busy}
        />
        {/* Only complain once they've started typing the second one. */}
        {confirm.length > 0 && !matches && (
          <p className="field-hint over">Those don't match yet.</p>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn-primary" type="submit" disabled={!valid || busy}>
        {busy ? busyLabel : submitLabel}
      </button>

      {secondary && <div className="signin-resend">{secondary}</div>}
    </form>
  );
}
