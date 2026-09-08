import { useState, type FormEvent, type ReactNode } from 'react';
import { authErrorMessage } from '../lib/authErrors';
import {
  PERSONAL_NAME_MAX,
  personalNameLength,
  personalNameValid,
  savePersonalName,
} from '../lib/personalName';

type InputProps = {
  /** Prefixes the id so two of these can never collide on one page. */
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  enterKeyHint?: 'next' | 'go' | 'done';
};

/**
 * The field on its own, with no submit of its own.
 *
 * Shared by the form below and by SetPasswordForm, which folds the name into
 * the same single updateUser() call that stores a password — so the two values
 * can never end up half-saved.
 */
export function PersonalNameInput({
  idPrefix,
  value,
  onChange,
  disabled,
  enterKeyHint = 'done',
}: InputProps) {
  const length = personalNameLength(value);
  const tooLong = length > PERSONAL_NAME_MAX;

  return (
    <div className="field">
      <div className="field-head">
        <label className="field-label" htmlFor={`${idPrefix}-personal-name`}>
          What should we call you? <span className="field-optional">optional</span>
        </label>
        <span className={tooLong ? 'counter over' : 'counter'} aria-live="polite">
          {length} / {PERSONAL_NAME_MAX}
        </span>
      </div>
      <input
        id={`${idPrefix}-personal-name`}
        className="text-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your name"
        // given-name lets iOS offer the contact card's first name. Deliberately
        // not "name", which would offer the full legal name.
        autoComplete="given-name"
        enterKeyHint={enterKeyHint}
        aria-describedby={`${idPrefix}-personal-name-help`}
        disabled={disabled}
      />
      <p className="field-hint" id={`${idPrefix}-personal-name-help`}>
        Only you ever see this. It's used to say hello, and it is never attached to anything you
        post.
      </p>
      {tooLong && (
        <p className="field-hint over">
          {length - PERSONAL_NAME_MAX} character
          {length - PERSONAL_NAME_MAX === 1 ? '' : 's'} too long.
        </p>
      )}
    </div>
  );
}

type FormProps = {
  idPrefix: string;
  /** What's already stored, so the field opens populated. */
  initial: string;
  submitLabel: string;
  busyLabel: string;
  secondary?: ReactNode;
  onDone: () => void;
};

/**
 * Field plus save, for the two places a name is set on its own: the optional
 * step after a first sign-in when the account already has a password, and the
 * account section on /me.
 *
 * This writes to auth metadata, never to `profiles` — see the hard rule in
 * src/lib/personalName.ts.
 */
export function PersonalNameForm({
  idPrefix,
  initial,
  submitLabel,
  busyLabel,
  secondary,
  onDone,
}: FormProps) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = personalNameValid(name);
  const dirty = name.trim() !== initial.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;

    setBusy(true);
    setError(null);

    const { error: updateError } = await savePersonalName(name);

    setBusy(false);

    if (updateError) {
      setError(authErrorMessage(updateError));
      return;
    }

    // No local state to sync: updateUser fires USER_UPDATED, SessionProvider
    // republishes, and the greeting re-renders on its own.
    onDone();
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <PersonalNameInput idPrefix={idPrefix} value={name} onChange={setName} disabled={busy} />

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn-primary" type="submit" disabled={!valid || !dirty || busy}>
        {busy ? busyLabel : submitLabel}
      </button>

      {secondary && <div className="signin-resend">{secondary}</div>}
    </form>
  );
}
