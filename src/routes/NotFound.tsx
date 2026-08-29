import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States';

export default function NotFound() {
  return (
    <>
      <EmptyState title="Nothing here" body="That page doesn't exist." />
      <div className="state">
        <Link className="back-link" to="/">
          ← Back to the feed
        </Link>
      </div>
    </>
  );
}
