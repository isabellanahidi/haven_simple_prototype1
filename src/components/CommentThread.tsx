import { author, isDeleted, DELETED_PLACEHOLDER, type Comment } from '../lib/types';
import {
  COLLAPSE_FROM_DEPTH,
  MAX_INDENT_DEPTH,
  type CommentNode as TreeNode,
} from '../lib/comments';
import { Byline } from './Byline';
import { CommentLikeButton } from './CommentLikeButton';
import { CommentComposer } from './CommentComposer';
import { DeleteControl } from './DeleteControl';

/** A comment that may not have reached the server yet. */
export type LocalComment = Comment & { pending?: boolean };

type Props = {
  node: TreeNode<LocalComment>;
  likedIds: Set<string>;
  userId: string | null;
  replyingTo: string | null;
  onReplyTo: (id: string | null) => void;
  onSubmitReply: (body: string, parentId: string) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
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
  onDelete,
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
  const deleted = isDeleted(comment);
  // The byline is "[deleted]" too, so the "replying to …" line has to match —
  // naming the author of a removed reply would undo the whole treatment.
  const authorName = deleted ? DELETED_PLACEHOLDER : author(comment.profiles).display_name;
  // Drawing the control, not authorising it: comments_update is author-scoped
  // and is what actually refuses a delete. A deleted row cannot be deleted
  // again — the trigger rejects every update to a tombstone.
  const canDelete = !deleted && !comment.pending && userId != null && userId === comment.author_id;

  return (
    <li
      className={[
        'comment',
        comment.pending ? 'pending' : '',
        deleted ? 'comment-deleted' : '',
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

      <Byline
        author={author(comment.profiles)}
        createdAt={comment.created_at}
        lead
        deleted={deleted}
      />
      {/* The body is already '' in the database for a tombstone — the trigger
          blanks it — so this renders a placeholder rather than hiding text it
          still holds. There is nothing left here to hide. */}
      <p className={deleted ? 'comment-body comment-body-deleted' : 'comment-body'}>
        {deleted ? DELETED_PLACEHOLDER : comment.body}
      </p>

      <div className="comment-actions">
        {/* Hidden on a tombstone: there is nothing to like. Existing like rows
            are left alone in the database, so a restore-less delete does not
            quietly rewrite anyone else's counts. */}
        {!deleted && (
          <CommentLikeButton
            commentId={comment.id}
            initialCount={comment.like_count ?? 0}
            initialLiked={likedIds.has(comment.id)}
            // Nothing to like until the server has given the row an id.
            disabled={comment.pending}
          />
        )}

        {/* Reply stays available under a deleted comment. The thread is still
            alive and its replies are still readable, so the conversation can
            continue — only the removed message is gone. */}
        {!comment.pending && !isReplying && (
          <button
            type="button"
            className="btn-quiet reply-trigger"
            onClick={() => (userId ? onReplyTo(comment.id) : requireSignIn())}
          >
            Reply
          </button>
        )}

        {canDelete && (
          <DeleteControl
            label="Delete"
            confirmLabel="Delete"
            onDelete={() => onDelete(comment.id)}
          />
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
                  onDelete={onDelete}
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
