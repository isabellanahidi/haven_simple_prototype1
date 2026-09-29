import { EmptyState } from '../components/States';
import { BackButton } from '../components/BackButton';

export default function NotFound() {
  return (
    <>
      <EmptyState title="Nothing here" body="That page doesn't exist." />
      <BackButton to="/" />
    </>
  );
}
