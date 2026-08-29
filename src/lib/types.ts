// Shapes returned by the Supabase queries in CLAUDE.md section 8.
// The client is untyped (no generated DB types), so these describe the
// selected columns rather than the full tables.

export type Author = {
  display_name: string;
  avatar_emoji: string;
};

export type FeedPost = {
  id: string;
  title: string;
  body: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  profiles: Author | Author[] | null;
};

export type Comment = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profiles: Author | Author[] | null;
};

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
