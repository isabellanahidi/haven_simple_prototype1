import { relativeTime } from '../lib/time';
import type { Author } from '../lib/types';

/**
 * `lead` places the byline above the post it belongs to, per the Figma frame.
 * Comments keep the default, where the byline sits at the top of the comment
 * already and needs no extra spacing.
 *
 * Nothing in here is interactive, which is what lets it sit inside the card's
 * <Link> — see finding 5 in CLAUDE.md section 4. If a byline ever gains a link
 * to the author's profile, it has to move out of .post-card-main the same way
 * the like button did.
 */
export function Byline({
  author,
  createdAt,
  lead = false,
}: {
  author: Author;
  createdAt: string;
  lead?: boolean;
}) {
  return (
    <div className={lead ? 'byline byline-lead' : 'byline'}>
      <span className="byline-emoji" aria-hidden="true">
        {author.avatar_emoji}
      </span>
      <span className="byline-name">{author.display_name}</span>
      <time
        className="byline-dot"
        dateTime={createdAt}
        title={new Date(createdAt).toLocaleString()}
      >
        {relativeTime(createdAt)}
      </time>
    </div>
  );
}
