import type { ReactNode } from 'react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <p className="state-body">{label}</p>
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-line medium" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      <p className="state-body">{body}</p>
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state" role="alert">
      <p className="state-title">{title}</p>
      {/* Rendered on-page, not to the console — there is no console on a phone. */}
      <p className="state-body state-error">{message}</p>
    </div>
  );
}
