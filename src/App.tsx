import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { SessionGate } from './components/SessionGate';
import Feed from './routes/Feed';
import PostDetail from './routes/PostDetail';
import CreatePost from './routes/CreatePost';
import Profile from './routes/Profile';
import NotFound from './routes/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <Link className="app-title" to="/">
            qna
          </Link>
          <Link className="btn-quiet nav-link" to="/me">
            Me
          </Link>
          <Link className="btn-ask" to="/new">
            Ask
          </Link>
        </header>

        <main className="app-main">
          <SessionGate>
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/p/:id" element={<PostDetail />} />
              <Route path="/new" element={<CreatePost />} />
              <Route path="/me" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionGate>
        </main>
      </div>
    </BrowserRouter>
  );
}
