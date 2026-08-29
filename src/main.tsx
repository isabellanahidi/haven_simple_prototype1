import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

// createClient() throws on a blank URL, and App imports it transitively — so
// check the env vars here and render a readable message instead of a white
// screen. App is imported lazily so that throw can't happen before the check.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  root.render(
    <div className="state" role="alert">
      <p className="state-title">Not configured</p>
      <p className="state-body state-error">
        {`VITE_SUPABASE_URL: ${url ? 'present' : 'MISSING'}\nVITE_SUPABASE_ANON_KEY: ${anonKey ? 'present' : 'MISSING'}`}
      </p>
      <p className="state-body">
        Locally: fill in .env.local and restart the dev server. On Vercel: add both variables in
        project settings, then redeploy with the build cache off.
      </p>
    </div>,
  )
} else {
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
