import type { MouseEvent } from 'react';
import { useLikeToggle } from '../lib/useLikeToggle';

type Props = {
  commentId: string;
  initialCount: number;
  initialLiked: boolean;
  /** An optimistic reply has no server row yet, so there is nothing to like. */
  disabled?: boolean;
};

/**
 * The like button on a comment. Identical behaviour to the post version — the
 * shared hook is the point — pointed at `comment_likes` and
 * `comments.like_count` instead.
 *
 * Signed out it stays visible with its real count and asks for a session on
 * tap, rather than hiding and misrepresenting the reply as unlikeable.
 */
export function CommentLikeButton({ commentId, initialCount, initialLiked, disabled }: Props) {
  const { userId, liked, count, failed, toggle } = useLikeToggle({
    table: 'comment_likes',
    column: 'comment_id',
    targetId: commentId,
    initialCount,
    initialLiked,
  });

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void toggle();
  }

  return (
    <span className="like-wrap">
      <button
        type="button"
        className={liked ? 'stat stat-btn liked' : 'stat stat-btn'}
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={userId ? liked : undefined}
        aria-label={
          !userId ? 'Sign in to like this reply' : liked ? 'Unlike this reply' : 'Like this reply'
        }
      >
        <span className="stat-icon" aria-hidden="true">
          {liked ? '♥' : '♡'}
        </span>
        {count}
      </button>
      {failed && (
        <span className="like-error" role="status">
          not saved
        </span>
      )}
    </span>
  );
}
