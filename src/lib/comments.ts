import type { PostgrestError } from '@supabase/supabase-js';

// constraint comment_body_len check (char_length(body) between 1 and 2000)
export const COMMENT_MAX = 2000;

/**
 * Turn a failed comment insert into something worth showing a person.
 *
 * Verified against the live project — these are the codes the schema in
 * section 7 actually produces:
 *
 *   P0001  enforce_comment_depth() raised "Only one level of replies is
 *          allowed". Already written for a human, so it passes straight
 *          through; this is the case that must never fail silently.
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
