import { relativeTime } from '../lib/time';
import { DELETED_PLACEHOLDER, type Author } from '../lib/types';

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
  deleted = false,
}: {
  author: Author;
  createdAt: string;
  lead?: boolean;
  /**
   * A tombstoned row: the name becomes "[deleted]" and the avatar goes,
   * because a cheerful emoji over removed content reads as a glitch.
   *
   * THIS HIDES THE AUTHOR, IT DOES NOT ERASE THEM. `author_id` still points
   * at the profile, and the embed that fed `author` still returned it — so
   * anyone reading the API can see who wrote a deleted row. See the caveat
   * in CLAUDE.md section 28.
   */
  deleted?: boolean;
}) {
  return (
    <div className={lead ? 'byline byline-lead' : 'byline'}>
      {!deleted && (
        <span className="byline-emoji" aria-hidden="true">
          {author.avatar_emoji}
        </span>
      )}
      <span className={deleted ? 'byline-name byline-name-deleted' : 'byline-name'}>
        {deleted ? DELETED_PLACEHOLDER : author.display_name}
      </span>
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
