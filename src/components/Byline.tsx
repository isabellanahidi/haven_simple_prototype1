import { relativeTime } from '../lib/time';
import type { Author } from '../lib/types';

export function Byline({ author, createdAt }: { author: Author; createdAt: string }) {
  return (
    <div className="byline">
      <span className="byline-emoji" aria-hidden="true">
        {author.avatar_emoji}
      </span>
      <span className="byline-name">{author.display_name}</span>
      <time className="byline-dot" dateTime={createdAt} title={new Date(createdAt).toLocaleString()}>
        {relativeTime(createdAt)}
      </time>
    </div>
  );
}
