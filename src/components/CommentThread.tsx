import { author, type Comment } from '../lib/types';
import {
  COLLAPSE_FROM_DEPTH,
  MAX_INDENT_DEPTH,
  type CommentNode as TreeNode,
} from '../lib/comments';
import { Byline } from './Byline';
import { CommentLikeButton } from './CommentLikeButton';
import { CommentComposer } from './CommentComposer';

/** A comment that may not have reached the server yet. */
export type LocalComment = Comment & { pending?: boolean };

type Props = {
  node: TreeNode<LocalComment>;
  likedIds: Set<string>;
  userId: string | null;
  replyingTo: string | null;
  onReplyTo: (id: string | null) => void;
  onSubmitReply: (body: string, parentId: string) => Promise<string | null>;
  requireSignIn: () => void;
  /** Per-node open state, in memory only. Undefined means "use the default". */
  openOverrides: Map<string, boolean>;
  onToggleOpen: (id: string, open: boolean) => void;
};

/**
 * One comment and everything beneath it.
 *
 * Genuinely recursive, because the database now allows nesting to 100 levels.
 * The old two-pass group-by could only represent two, and would have dropped
 * anything deeper without a word.
 */
export function CommentThread({
  node,
  likedIds,
  userId,
  replyingTo,
  onReplyTo,
  onSubmitReply,
  requireSignIn,
  openOverrides,
  onToggleOpen,
}: Props) {
  const { comment, children, descendantCount } = node;

  // Straight off the row. The trigger is the only writer, so this is the one
  // source of truth — computing it from the tree here would be a second,
  // divergent answer to a question the database already settled.
  const depth = comment.depth ?? 0;
  const indent = Math.min(depth, MAX_INDENT_DEPTH);
  // At the cap this node's own children must render at the SAME offset, not
  // one further in — the class is what stops the nested list adding a rail.
  const atIndentCap = indent >= MAX_INDENT_DEPTH;
  const flattened = depth > MAX_INDENT_DEPTH;

  // Children sit one level below this node. They start collapsed once that
  // level reaches COLLAPSE_FROM_DEPTH, unless this node has been toggled.
  const childrenDefaultOpen = depth + 1 < COLLAPSE_FROM_DEPTH;
  const childrenOpen = openOverrides.get(comment.id) ?? childrenDefaultOpen;

  const isReplying = replyingTo === comment.id;
  const authorName = author(comment.profiles).display_name;

  return (
    <li
      className={[
        'comment',
        comment.pending ? 'pending' : '',
        atIndentCap ? 'comment-indent-capped' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-depth={depth}
    >
      {/* Past the indent cap the offset stops carrying the relationship, so
          the reply says who it is answering instead. */}
      {flattened && comment.parent_id && (
        <p className="comment-context">replying to {authorName}</p>
      )}

      <Byline author={author(comment.profiles)} createdAt={comment.created_at} lead />
      <p className="comment-body">{comment.body}</p>

      <div className="comment-actions">
        <CommentLikeButton
          commentId={comment.id}
          initialCount={comment.like_count ?? 0}
          initialLiked={likedIds.has(comment.id)}
          // Nothing to like until the server has given the row an id.
          disabled={comment.pending}
        />

        {!comment.pending && !isReplying && (
          <button
            type="button"
            className="btn-quiet reply-trigger"
            onClick={() => (userId ? onReplyTo(comment.id) : requireSignIn())}
          >
            Reply
          </button>
        )}
      </div>

      {isReplying && (
        <CommentComposer
          placeholder={`Reply to ${authorName}…`}
          submitLabel="Reply"
          autoFocus
          onCancel={() => onReplyTo(null)}
          onSubmit={(body) => onSubmitReply(body, comment.id)}
        />
      )}

      {children.length > 0 && (
        <>
          {!childrenDefaultOpen && (
            <button
              type="button"
              className="thread-toggle"
              onClick={() => onToggleOpen(comment.id, !childrenOpen)}
              aria-expanded={childrenOpen}
            >
              <span className="thread-toggle-caret" aria-hidden="true">
                {childrenOpen ? '▾' : '▸'}
              </span>
              {childrenOpen
                ? 'Hide replies'
                : `${descendantCount} ${descendantCount === 1 ? 'reply' : 'replies'}`}
            </button>
          )}

          {childrenOpen && (
            <ul className="reply-list">
              {children.map((child) => (
                <CommentThread
                  key={child.comment.id}
                  node={child}
                  likedIds={likedIds}
                  userId={userId}
                  replyingTo={replyingTo}
                  onReplyTo={onReplyTo}
                  onSubmitReply={onSubmitReply}
                  requireSignIn={requireSignIn}
                  openOverrides={openOverrides}
                  onToggleOpen={onToggleOpen}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
