import { useEffect, useState } from 'react';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Status =
  | { kind: 'pending' }
  | { kind: 'ok'; userId: string }
  | { kind: 'error'; message: string };

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: 'pending' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Imported lazily so a createClient() failure (e.g. blank env vars)
        // surfaces on-page instead of blanking the whole app at module load.
        const { ensureSession } = await import('./lib/supabase');
        const session = await ensureSession();
        if (cancelled) return;
        const userId = session?.user?.id;
        if (!userId) {
          setStatus({ kind: 'error', message: 'ensureSession() returned no session/user.' });
          return;
        }
        setStatus({ kind: 'ok', userId });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: 'error',
          message: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ fontSize: 16, lineHeight: 1.5, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20 }}>Supabase diagnostics</h1>

      <p style={{ fontSize: 16 }}>
        VITE_SUPABASE_URL: <strong>{url ? 'present' : 'MISSING'}</strong>
      </p>
      <p style={{ fontSize: 16 }}>
        VITE_SUPABASE_ANON_KEY: <strong>{anonKey ? 'present' : 'MISSING'}</strong>
      </p>

      <hr />

      {status.kind === 'pending' && <p style={{ fontSize: 16 }}>ensureSession(): running…</p>}

      {status.kind === 'ok' && (
        <p style={{ fontSize: 16 }}>
          ensureSession(): <strong>OK</strong> — user ID starts with{' '}
          <code style={{ fontSize: 16 }}>{status.userId.slice(0, 8)}</code>
        </p>
      )}

      {status.kind === 'error' && (
        <div style={{ fontSize: 16 }}>
          <p>
            ensureSession(): <strong>FAILED</strong>
          </p>
          <pre style={{ fontSize: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {status.message}
          </pre>
        </div>
      )}
    </div>
  );
}
