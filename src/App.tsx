import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './components/SessionProvider';
import { RequireAuth } from './components/RequireAuth';
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
          {/* Outside <Routes>, so navigation survives every route and every
              loading and error state. See CLAUDE.md section 12. */}
          <header className="app-header">
            <Link className="app-title" to="/">
              {/* alt="" on purpose — the adjacent text already names the app,
                  so announcing it twice is noise for a screen reader. */}
              <img className="app-logo" src="/logoCircle.svg" alt="" />
              Haven
            </Link>
            <Link className="btn-quiet nav-link" to="/me">
              Me
            </Link>
            <Link className="btn-ask" to="/new">
              Ask
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
        </div>
      </SessionProvider>
    </BrowserRouter>
  );
}
