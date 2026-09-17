import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { PCOS, topicLabel } from '../lib/topics';
import { type FeedPost } from '../lib/types';
import { PostList } from '../components/PostList';
import { EmptyState, ErrorState, SkeletonCards } from '../components/States';

/**
 * /t/pcos — the one topic page.
 *
 * A literal route, not a parameterised one: there is no topics table and no
 * general topics feature, and a `/t/:slug` route would invite one. See
 * CLAUDE.md section 26 and src/lib/topics.ts.
 *
 * READABLE SIGNED OUT, like the feed and post detail. `posts_select` is
 * `hidden = false or author_id = auth.uid()`, whose left arm passes when
 * auth.uid() is null, so the anon role gets the list. Only the "New post"
 * button needs a session, and it gets its gating for free: it links to /new,
 * which RequireAuth already wraps.
 *
 * The home feed is untouched by this page's existence — PCOS posts still
 * appear there, because that query does not filter on topic.
 */
export default function TopicPcos() {
  const userId = useUserId();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Same shape as the home feed's pair of queries, and for the same
      // reasons: the author embed needs its FK hint because `likes` makes
      // posts -> profiles ambiguous (PGRST201), and my own likes are fetched
      // separately into a Set rather than embedded, which would pull every
      // like row for every post.
      //
      // Same ordering and the same hard limit of 50 as the feed. No pagination
      // — infinite scroll is cut (section 3).
      //
      // The likes query is NOT narrowed to this page's posts: it is the same
      // one the feed runs, so the two share a cached response rather than
      // issuing two near-identical requests.
      const [list, likes] = await Promise.all([
        supabase
          .from('posts')
          .select(
            'id, title, body, like_count, comment_count, created_at, profiles!posts_author_id_fkey(display_name, avatar_emoji)',
          )
          .eq('topic', PCOS)
          .order('created_at', { ascending: false })
          .limit(50),
        userId ? supabase.from('likes').select('post_id').eq('user_id', userId) : null,
      ]);

      if (cancelled) return;

      if (list.error) {
        setError(list.error.message);
        return;
      }

      setPosts((list.data ?? []) as unknown as FeedPost[]);
      // A failed likes query is not worth blocking the list over — hearts just
      // render empty, exactly as on the feed.
      setLikedIds(new Set(likes?.data?.map((l) => l.post_id as string) ?? []));
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <>
      <Link className="back-link" to="/">
        ← Home
      </Link>

      <div className="topic-page-head">
        <h1 className="detail-title topic-page-title">{topicLabel(PCOS)}</h1>
        {/* Signed out this still renders and still reads as available —
            RequireAuth on /new sends the person to /signin carrying the
            destination, query string included, so they land back in the
            composer with the topic still preset. Hiding it would misrepresent
            the page as read-only. */}
        <Link className="btn-primary topic-page-new" to={`/new?topic=${PCOS}`}>
          New post
        </Link>
      </div>

      <Body posts={posts} likedIds={likedIds} error={error} />
    </>
  );
}

function Body({
  posts,
  likedIds,
  error,
}: {
  posts: FeedPost[] | null;
  likedIds: Set<string>;
  error: string | null;
}) {
  if (error) return <ErrorState title="Couldn't load these posts" message={error} />;

  if (posts === null) return <SkeletonCards />;

  if (posts.length === 0)
    return (
      <EmptyState
        title="Nothing here yet"
        body="Be the first to post about PCOS."
        action={
          <Link className="btn-primary" to={`/new?topic=${PCOS}`}>
            New post
          </Link>
        }
      />
    );

  return <PostList posts={posts} likedIds={likedIds} />;
}
