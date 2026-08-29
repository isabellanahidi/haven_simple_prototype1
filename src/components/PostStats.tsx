type Props = {
  likeCount: number;
  commentCount: number;
  liked: boolean;
};

/**
 * Read-only counters. The like toggle is a separate step; this only reflects
 * whether the current user's like row exists.
 */
export function PostStats({ likeCount, commentCount, liked }: Props) {
  return (
    <div className="stat-row">
      <span className={liked ? 'stat liked' : 'stat'}>
        <span className="stat-icon" aria-hidden="true">
          {liked ? '♥' : '♡'}
        </span>
        {likeCount}
        <span className="sr-only"> {likeCount === 1 ? 'like' : 'likes'}</span>
      </span>
      <span className="stat">
        <span className="stat-icon" aria-hidden="true">
          💬
        </span>
        {commentCount}
        <span className="sr-only"> {commentCount === 1 ? 'reply' : 'replies'}</span>
      </span>
    </div>
  );
}
