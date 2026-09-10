import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { greetingName } from '../lib/personalName';
import { author, type FeedPost } from '../lib/types';
import { Byline } from '../components/Byline';
import { LikeButton } from '../components/LikeButton';
import { BottomSheet } from '../components/BottomSheet';
import { HelloLettering } from '../components/HelloLettering';
import { TopicGrid } from '../components/TopicGrid';
import { EmptyState, ErrorState, SkeletonCards } from '../components/States';

/**
 * Placed per the Figma frame: above the topic grid, left-aligned, immediately
 * under the header.
 *
 * The name comes from the session context, which reads it off the session
 * user's metadata — there is no fetch here, and there must not be one. After a
 * save, updateUser fires USER_UPDATED, SessionProvider republishes, and this
 * re-renders with the new name without a reload.
 *
 * Rendered as text. `{name}` is a JSX expression, so React escapes it; it must
 * never be moved into dangerouslySetInnerHTML or interpolated into markup.
 */
function Greeting({ name }: { name: string | null }) {
  return (
    <h1 className="feed-greeting">
      {/* "Hello," is the design's own lettering, drawn as outlines. The name is
          live text beside it on the same baseline — it comes from user
          metadata, so it can never be part of the artwork. The design sets it
          in DM Sans Bold, which is still not loaded, so it renders in the
          system stack. See CLAUDE.md section 23. */}
      <span className="sr-only">Hello, </span>
      <HelloLettering /> <span className="feed-greeting-name">{greetingName(name)}!</span>
    </h1>
  );
}

/**
 * Per the Figma frames Home-NDTab-closed (179:3533) and SwipeableDrawer
 * (192:804), the discussion feed is not the page — it lives inside a
 * bottom-sheet drawer that peeks above the tab bar and drags up to full
 * height. The page behind it is the greeting and the topic grid.
 *
 * The query below is unchanged from before the drawer landed: the same
 * limit 50, the same posts -> profiles embed with its FK hint, the same
 * separate fetch of my own likes into a Set.
 */
export default function Feed() {
  const { userId, personalName } = useSession();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Two queries, not one. Embedding likes(user_id) into the feed select
      // would pull every like row for every post; this pulls only mine.
      //
      // Signed out there are no likes of mine to fetch, so that query is
      // skipped entirely — the feed itself still loads, because the posts
      // select policy passes for the anon role on hidden = false.
      const [feed, likes] = await Promise.all([
        supabase
          .from('posts')
          // The FK must be named: posts relates to profiles two ways — directly
          // via author_id, and many-to-many through likes. A bare
          // `profiles(...)` is ambiguous and PostgREST rejects it (PGRST201).
          .select(
            'id, title, body, like_count, comment_count, created_at, profiles!posts_author_id_fkey(display_name, avatar_emoji)',
          )
          .order('created_at', { ascending: false })
          .limit(50),
        userId ? supabase.from('likes').select('post_id').eq('user_id', userId) : null,
      ]);

      if (cancelled) return;

      if (feed.error) {
        setError(feed.error.message);
        return;
      }

      setPosts((feed.data ?? []) as unknown as FeedPost[]);
      // A failed likes query is not worth blocking the feed over — hearts just
      // render empty.
      setLikedIds(new Set(likes?.data?.map((l) => l.post_id as string) ?? []));
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="feed-page">
      {/* Signed out gets no greeting at all. userId is null while the session
          is still resolving too, so the greeting appears once rather than
          flickering through a wrong state. */}
      {userId && <Greeting name={personalName} />}

      <TopicGrid />

      {/* "New Discussions" is the pill's label in both frames. */}
      <BottomSheet title="New Discussions">
        <FeedBody posts={posts} likedIds={likedIds} error={error} />
      </BottomSheet>
    </div>
  );
}

function FeedBody({
  posts,
  likedIds,
  error,
}: {
  posts: FeedPost[] | null;
  likedIds: Set<string>;
  error: string | null;
}) {
  if (error) return <ErrorState title="Couldn't load the feed" message={error} />;

  if (posts === null) return <SkeletonCards />;

  if (posts.length === 0)
    return (
      <EmptyState
        title="No questions yet"
        body="Be the first to ask something."
        action={
          <Link className="btn-primary" to="/new">
            Ask a question
          </Link>
        }
      />
    );

  return (
    <ul className="feed-list">
      {posts.map((post) => (
        // The like button is a real <button>, so it sits beside the card's
        // <Link> rather than inside it — a button nested in an anchor is
        // invalid, and tapping the heart would navigate.
        <li className="post-card" key={post.id}>
          <Link className="post-card-main" to={`/p/${post.id}`}>
            <Byline author={author(post.profiles)} createdAt={post.created_at} lead />
            <h2 className="post-title">{post.title}</h2>
            {post.body && <p className="post-excerpt">{post.body}</p>}
          </Link>
          <div className="post-meta">
            <LikeButton
              postId={post.id}
              initialCount={post.like_count}
              initialLiked={likedIds.has(post.id)}
            />
            <Link className="stat" to={`/p/${post.id}`}>
              <span className="stat-icon" aria-hidden="true">
                💬
              </span>
              {post.comment_count}
              <span className="sr-only">{post.comment_count === 1 ? ' reply' : ' replies'}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
