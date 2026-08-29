import { useState, type FormEvent } from 'react';
import { charLength } from '../lib/text';
import { COMMENT_MAX } from '../lib/comments';

type Props = {
  placeholder: string;
  submitLabel: string;
  /** Resolves to an error message, or null on success. */
  onSubmit: (body: string) => Promise<string | null>;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export function CommentComposer({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus,
}: Props) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = body.trim();
  const len = charLength(trimmed);
  const tooLong = len > COMMENT_MAX;
  const valid = len >= 1 && !tooLong;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || submitting) return;

    const draft = trimmed;
    // Clear immediately — the reply is already on screen by the time the
    // request resolves, and leaving the draft in place would show it twice.
    setBody('');
    setError(null);
    setSubmitting(true);

    const message = await onSubmit(draft);
    setSubmitting(false);

    if (message) {
      // Put the text back so nothing is lost, unless a new draft has been
      // started in the meantime — that one wins.
      setBody((current) => (current.trim() === '' ? draft : current));
      setError(message);
      return;
    }

    onCancel?.();
  }

  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      <textarea
        className="text-input textarea comment-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        autoFocus={autoFocus}
      />

      <div className="composer-actions">
        <span className={tooLong ? 'counter over' : 'counter'} aria-live="polite">
          {len} / {COMMENT_MAX}
        </span>
        <div className="composer-buttons">
          {onCancel && (
            <button type="button" className="btn-quiet" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn-primary btn-compact" type="submit" disabled={!valid || submitting}>
            {submitLabel}
          </button>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
