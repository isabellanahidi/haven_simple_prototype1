import type { PostgrestError } from '@supabase/supabase-js';

// constraint comment_body_len check (char_length(body) between 1 and 2000)
export const COMMENT_MAX = 2000;

/**
 * Turn a failed comment insert into something worth showing a person.
 *
 * Verified against the live project — these are the codes the schema in
 * section 7 actually produces:
 *
 *   P0001  enforce_comment_depth() raised. Its messages are written for a
 *          person ("Replies can only nest 100 levels deep.", "A reply must
 *          belong to the same post as the comment it answers."), so they pass
 *          straight through. This is the case that must never fail silently.
 *          Passing error.message through verbatim is what let the trigger's
 *          wording change in the Sep 7 migration with no edit here.
 *   23514  comment_body_len. The wording Postgres gives ("new row for
 *          relation ... violates check constraint") is not for users.
 *   42501  RLS refused the insert.
 */
export function commentErrorMessage(error: PostgrestError | null): string {
  if (!error) return "That reply didn't save. Try again.";

  switch (error.code) {
    case 'P0001':
      return error.message;
    case '23514':
      return `Replies have to be between 1 and ${COMMENT_MAX} characters.`;
    case '42501':
      return "You don't have permission to reply here.";
    default:
      return error.message;
  }
}

/**
 * Hard ceiling on how many comments a post detail screen will load.
 *
 * Generous rather than paginated: threading needs the whole tree in hand to
 * assemble it, and a partial fetch would orphan every child whose parent fell
 * outside the window. If a post ever passes this, the fix is pagination by
 * top-level thread, not a bigger number.
 */
export const COMMENT_LIMIT = 500;

/**
 * Visual indent stops growing past this depth. The database allows 100 levels;
 * at roughly 14px per level a phone runs out of width around 8, so beyond this
 * the reply renders at the same offset and says who it is answering instead.
 * This is a rendering cap only — it has nothing to do with what the DB accepts.
 */
export const MAX_INDENT_DEPTH = 5;

/**
 * Replies at or below this depth start collapsed. Depth 0 and its direct
 * replies are always visible; anything under those is behind a toggle, so a
 * long argument three levels down doesn't bury the next top-level answer.
 */
export const COLLAPSE_FROM_DEPTH = 2;

export type CommentNode<T> = {
  comment: T;
  children: CommentNode<T>[];
  /** Everything beneath this node, all levels — what collapsing actually hides. */
  descendantCount: number;
};

/**
 * Assemble a flat comment list into a tree.
 *
 * PostgREST cannot recurse, so the rows arrive flat and ordered by
 * created_at; parenting happens here.
 *
 * **Orphans are promoted to roots rather than dropped.** A parent can be
 * missing from the loaded set for two legitimate reasons — it is `hidden` and
 * RLS filtered it out, or it fell outside COMMENT_LIMIT — and silently
 * discarding its whole subtree would lose real replies with no sign that
 * anything was missing. Surfacing them detached is the lesser wrong.
 */
export function buildCommentTree<T extends { id: string; parent_id: string | null }>(
  rows: T[],
): CommentNode<T>[] {
  const nodes = new Map<string, CommentNode<T>>();
  for (const comment of rows) {
    nodes.set(comment.id, { comment, children: [], descendantCount: 0 });
  }

  const roots: CommentNode<T>[] = [];
  for (const comment of rows) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parent_id ? nodes.get(comment.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Counted bottom-up in one pass over the reversed input. Rows arrive oldest
  // first and a parent always predates its children, so walking backwards
  // guarantees every child is counted before its parent is read.
  for (let i = rows.length - 1; i >= 0; i--) {
    const node = nodes.get(rows[i].id)!;
    node.descendantCount = node.children.reduce((n, c) => n + 1 + c.descendantCount, 0);
  }

  return roots;
}
