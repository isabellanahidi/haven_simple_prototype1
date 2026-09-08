import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useUserId } from './session';
import { useSignInRedirect } from './authRedirect';

type Options = {
  /** 'likes' or 'comment_likes'. */
  table: string;
  /** The column naming the liked thing — 'post_id' or 'comment_id'. */
  column: string;
  targetId: string;
  /** Read once at mount. Both screens resolve the row and its likes together
   *  before first render, so these are never stale on the way in. */
  initialCount: number;
  initialLiked: boolean;
};

/**
 * The like toggle, shared by posts and comments.
 *
 * `likes` and `comment_likes` are deliberately separate tables (CLAUDE.md
 * section 7), but the client behaviour is identical and the rollback rules
 * below are subtle enough that two copies would drift. One copy, two callers.
 *
 * **The rollback semantics are the whole point of this file**, and they are
 * not "undo the optimistic update". Per finding 4b, the counter triggers fire
 * only on a real insert or delete, so on the two anomalous paths the server's
 * count never moved — while the *liked* state the user is looking at is
 * already correct. Rolling both fields back would put the UI further from the
 * server, not closer:
 *
 *   23505 on insert     the row already existed, so the count already included
 *                       it. Keep liked = true, undo the increment only.
 *   zero rows on delete  there was no row to remove, so liked = false is the
 *                       truth. Undo the decrement only.
 *
 * Only a genuine transport or policy error gets the full rollback.
 *
 * Every write uses .select() and checks the returned row count, per finding
 * 4a: RLS filters rows out silently rather than raising, so a delete that
 * removed nothing still returns 200 with an empty array and no error. A
 * missing `error` proves nothing.
 */
export function useLikeToggle({ table, column, targetId, initialCount, initialLiked }: Options) {
  const userId = useUserId();
  const requireSignIn = useSignInRedirect();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [failed, setFailed] = useState(false);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (failTimer.current) clearTimeout(failTimer.current);
    };
  }, []);

  function flashFailure() {
    setFailed(true);
    if (failTimer.current) clearTimeout(failTimer.current);
    failTimer.current = setTimeout(() => setFailed(false), 3000);
  }

  async function toggle() {
    // Stays visible when signed out rather than disappearing — the count is
    // worth showing, and the tap is what asks for a session.
    if (!userId) {
      requireSignIn();
      return;
    }

    const wasLiked = liked;
    const prevCount = count;

    // Optimistic. No debounce: the composite primary key makes a double-tap
    // physically unable to double-count.
    setLiked(!wasLiked);
    // greatest(x, 0) mirrors what the counter trigger does server-side.
    setCount(wasLiked ? Math.max(prevCount - 1, 0) : prevCount + 1);

    if (wasLiked) {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .match({ user_id: userId, [column]: targetId })
        .select();

      if (error) {
        setLiked(wasLiked);
        setCount(prevCount);
        flashFailure();
        return;
      }

      // Nothing was deleted, so the counter trigger never fired and the
      // server's count is unchanged. liked = false is still the right end
      // state — there is no like row — but the decrement was wrong.
      if (!data || data.length === 0) setCount(prevCount);
      return;
    }

    const { data, error } = await supabase
      .from(table)
      .insert({ user_id: userId, [column]: targetId })
      .select();

    if (error) {
      // The like row already existed, so the count already included it.
      // Staying liked is correct; the increment was not.
      if (error.code === '23505') {
        setCount(prevCount);
        return;
      }
      setLiked(wasLiked);
      setCount(prevCount);
      flashFailure();
      return;
    }

    if (!data || data.length === 0) setCount(prevCount);
  }

  return { userId, liked, count, failed, toggle };
}
