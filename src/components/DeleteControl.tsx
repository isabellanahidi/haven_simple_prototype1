import { useState } from 'react';

/**
 * The Delete control, and the confirmation in front of it.
 *
 * Rendered only for the author of the row — the caller decides that, and the
 * database decides it again: posts_update and comments_update are both
 * author-scoped, so hiding this button is a courtesy, not the protection.
 *
 * AN INLINE CONFIRM, NOT window.confirm(). A native confirm is unstyleable, is
 * suppressible per-site in Safari, and reads as a browser dialog rather than
 * as part of the app. This one is two real buttons, both past the 44px
 * minimum, with the destructive one last so it is not the first thing a thumb
 * lands on.
 *
 * `role="alert"` on the question rather than a focus trap: the whole prompt is
 * three elements in the flow, so there is nothing to trap and nothing to
 * escape from — Cancel is always one tap away.
 */
export function DeleteControl({
  label,
  confirmLabel,
  onDelete,
}: {
  /** What the trigger button says, e.g. "Delete post". */
  label: string;
  /** What the confirming button says, e.g. "Delete". */
  confirmLabel: string;
  /** Resolves to null on success, or a message to show. */
  onDelete: () => Promise<string | null>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const message = await onDelete();

    if (message) {
      // Stay open on failure. Closing the prompt would leave the person
      // looking at content they just asked to remove with no sign of why it
      // is still there.
      setBusy(false);
      setError(message);
      return;
    }

    // On success the caller re-renders this row as a tombstone, which
    // unmounts this component — so there is deliberately no setBusy(false)
    // here to run against an unmounted tree.
  }

  if (!asking) {
    return (
      <button type="button" className="btn-quiet delete-trigger" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className="delete-confirm">
      <p className="delete-confirm-text" role="alert">
        Delete this? This can&rsquo;t be undone.
      </p>

      <div className="delete-confirm-actions">
        <button
          type="button"
          className="btn-quiet delete-cancel"
          onClick={() => {
            setAsking(false);
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={confirm} disabled={busy}>
          {busy ? 'Deleting…' : confirmLabel}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
