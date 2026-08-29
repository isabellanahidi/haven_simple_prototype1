import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';

type Props = {
  postId: string;
  /** Read once, at mount. Both screens resolve post + likes together before
   *  first render, so these are never stale on the way in. */
  initialCount: number;
  initialLiked: boolean;
};

export function LikeButton({ postId, initialCount, initialLiked }: Props) {
  const userId = useUserId();
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

  async function toggle(event: MouseEvent<HTMLButtonElement>) {
    // The feed card sits next to a <Link>, not inside one, but stop the event
    // here anyway so a tap on the heart never bubbles into a navigation.
    event.preventDefault();
    event.stopPropagation();

    const wasLiked = liked;
    const prevCount = count;

    // Optimistic. No debounce: the composite primary key (user_id, post_id)
    // makes a double-tap physically unable to double-count.
    setLiked(!wasLiked);
    // greatest(x, 0) mirrors what the counter trigger does server-side.
    setCount(wasLiked ? Math.max(prevCount - 1, 0) : prevCount + 1);

    if (wasLiked) {
      const { data, error } = await supabase
        .from('likes')
        .delete()
        .match({ user_id: userId, post_id: postId })
        .select();

      if (error) {
        setLiked(wasLiked);
        setCount(prevCount);
        flashFailure();
        return;
      }

      // Per CLAUDE.md 4a: RLS filters rows out silently, so a delete that
      // removed nothing still comes back 200 with an empty array. An absent
      // error proves nothing — the row count is the only real signal.
      if (!data || data.length === 0) {
        // Nothing was deleted, so the counter trigger never fired and the
        // server's like_count is unchanged. `liked = false` is still the right
        // end state (there is no like row), but the decrement was wrong.
        setCount(prevCount);
      }
      return;
    }

    const { data, error } = await supabase
      .from('likes')
      .insert({ user_id: userId, post_id: postId })
      .select();

    if (error) {
      // 23505: the like row already existed, so the count already included it.
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

    if (!data || data.length === 0) {
      setCount(prevCount);
    }
  }

  return (
    <span className="like-wrap">
      <button
        type="button"
        className={liked ? 'stat stat-btn liked' : 'stat stat-btn'}
        onClick={toggle}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike this post' : 'Like this post'}
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
