// Shapes returned by the Supabase queries in CLAUDE.md section 8.
// The client is untyped (no generated DB types), so these describe the
// selected columns rather than the full tables.

export type Author = {
  display_name: string;
  avatar_emoji: string;
};

export type FeedPost = {
  id: string;
  /** Selected so a screen can tell whether the reader owns the row. Only the
   *  author is offered a Delete control — and the database is what enforces
   *  that, via posts_update; this only decides what to draw. */
  author_id: string;
  title: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  /** Set by enforce_post_delete(), never by the client. Non-null means the
   *  row is a tombstone and `title` and `body` have been blanked in the
   *  database — so there is no content here to accidentally render. */
  deleted_at: string | null;
  profiles: Author | Author[] | null;
};

export type Comment = {
  id: string;
  parent_id: string | null;
  author_id: string;
  /** Assigned by enforce_comment_depth(); 0 = top level. Never computed on
   *  the client — the trigger is the only writer, so this is the one source
   *  of truth for how deep a reply sits. */
  depth: number;
  like_count: number;
  body: string;
  created_at: string;
  /** As on FeedPost: set by the trigger, and `body` is already '' when it is
   *  non-null. The row stays so the thread beneath it keeps its shape. */
  deleted_at: string | null;
  profiles: Author | Author[] | null;
};

/** True for a row the database has tombstoned. */
export function isDeleted(row: { deleted_at?: string | null }): boolean {
  return row.deleted_at != null;
}

/** What stands in for a tombstoned row's content and byline, everywhere. */
export const DELETED_PLACEHOLDER = '[deleted]';

const FALLBACK_AUTHOR: Author = { display_name: 'anon', avatar_emoji: '🙂' };

/**
 * PostgREST returns an embedded to-one relationship as an object, but older
 * clients (and some query shapes) hand back a one-element array. Normalize
 * both, and fall back if the join came back empty.
 */
export function author(profiles: Author | Author[] | null | undefined): Author {
  if (!profiles) return FALLBACK_AUTHOR;
  if (Array.isArray(profiles)) return profiles[0] ?? FALLBACK_AUTHOR;
  return profiles;
}
