import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './components/SessionProvider';
import { RequireAuth } from './components/RequireAuth';
import { TabBar } from './components/TabBar';
import Feed from './routes/Feed';
import PostDetail from './routes/PostDetail';
import CreatePost from './routes/CreatePost';
import Profile from './routes/Profile';
import SignIn from './routes/SignIn';
import NotFound from './routes/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <div className="app">
          {/* Header and tab bar sit outside <Routes>, so navigation survives
              every route and every loading and error state. See CLAUDE.md
              section 12. */}
          <header className="app-header">
            {/* The logo is not a link: the Home tab is the way back to the
                feed, and a second tap target for the same destination would
                only compete with it. */}
            <img className="app-logo" src="/havenlogo.svg" alt="Haven" />

            <Link className="icon-btn" to="/me" aria-label="Settings">
              <img className="icon-btn-glyph" src="/icons/settings.svg" alt="" />
            </Link>
          </header>

          <main className="app-main">
            <Routes>
              {/* Readable with no session — the RLS select policies pass for
                  the anon role. */}
              <Route path="/" element={<Feed />} />
              <Route path="/p/:id" element={<PostDetail />} />
              <Route path="/signin" element={<SignIn />} />

              {/* Writing needs a user. */}
              <Route
                path="/new"
                element={
                  <RequireAuth>
                    <CreatePost />
                  </RequireAuth>
                }
              />
              <Route
                path="/me"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          <TabBar />
        </div>
      </SessionProvider>
    </BrowserRouter>
  );
}
