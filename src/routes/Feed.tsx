import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { author, type FeedPost } from '../lib/types';
import { Byline } from '../components/Byline';
import { LikeButton } from '../components/LikeButton';
import { EmptyState, ErrorState, SkeletonCards } from '../components/States';

export default function Feed() {
  const userId = useUserId();
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

  if (error) return <ErrorState title="Couldn't load the feed" message={error} />;

  if (posts === null) return <SkeletonCards />;

  if (posts.length === 0) {
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
  }

  return (
    <ul className="feed-list">
      {posts.map((post) => (
        // The like button is a real <button>, so it sits beside the card's
        // <Link> rather than inside it — a button nested in an anchor is
        // invalid, and tapping the heart would navigate.
        <li className="post-card" key={post.id}>
          <Link className="post-card-main" to={`/p/${post.id}`}>
            <h2 className="post-title">{post.title}</h2>
            {post.body && <p className="post-excerpt">{post.body}</p>}
            <Byline author={author(post.profiles)} createdAt={post.created_at} />
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
              <span className="sr-only">
                {post.comment_count === 1 ? ' reply' : ' replies'}
              </span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
