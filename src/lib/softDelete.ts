import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** The two tables that carry a deleted_at. */
export type DeletableTable = 'posts' | 'comments';

/**
 * Turn a failed delete into something worth showing a person.
 *
 * The same shape as commentErrorMessage in ./comments.ts, and for the same
 * reason: P0001 is a message enforce_post_delete() / enforce_comment_delete()
 * wrote FOR A PERSON ("This post has been deleted and can no longer be
 * changed."), so it passes through verbatim and survives a change of wording
 * in the migration with no edit here. Postgres's own constraint prose does
 * not, and gets translated.
 */
function deleteErrorMessage(error: PostgrestError): string {
  switch (error.code) {
    case 'P0001':
      return error.message;
    case '42501':
      return "You don't have permission to delete this.";
    default:
      return error.message;
  }
}

/**
 * Delete a post or a reply: a tombstone, not a row delete.
 *
 * Resolves to null on success, or a message to show.
 *
 * WHAT IS SENT IS ONLY A SIGNAL. `deleted_at` has to arrive non-null to mean
 * "delete this", but the BEFORE UPDATE trigger overwrites it with the
 * server's now() and blanks the content itself, so the value below never
 * reaches the table and the client cannot choose when a row was deleted.
 * Nothing else is sent: the trigger owns the erasure, so asking the client to
 * also send `title: ''` would be a second, forgeable copy of the same rule.
 *
 * THE ROW COUNT IS THE ONLY PROOF THIS DID ANYTHING, per finding 4a. An
 * update filtered out by RLS — someone else's post — comes back 200 with an
 * empty array and NO error. Treating a missing `error` as success is exactly
 * the bug that finding exists to prevent, and it would report "deleted" over
 * a row that never changed.
 */
export async function softDelete(table: DeletableTable, id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (error) return deleteErrorMessage(error);

  if (!data || data.length === 0) {
    // RLS filtered it out. Either it is not yours, or the session is stale
    // and auth.uid() no longer matches anything (section 15).
    return "That wasn't yours to delete.";
  }

  return null;
}
