import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { author, type FeedPost } from '../lib/types';
import { Byline } from '../components/Byline';
import { PostStats } from '../components/PostStats';
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
        supabase.from('likes').select('post_id').eq('user_id', userId),
      ]);

      if (cancelled) return;

      if (feed.error) {
        setError(feed.error.message);
        return;
      }

      setPosts((feed.data ?? []) as unknown as FeedPost[]);
      // A failed likes query is not worth blocking the feed over — hearts just
      // render empty.
      setLikedIds(new Set(likes.data?.map((l) => l.post_id as string) ?? []));
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) return <ErrorState title="Couldn't load the feed" message={error} />;

  if (posts === null) return <SkeletonCards />;

  if (posts.length === 0) {
    return <EmptyState title="No questions yet" body="Be the first to ask something." />;
  }

  return (
    <ul className="feed-list">
      {posts.map((post) => (
        <li key={post.id}>
          <Link className="post-card" to={`/p/${post.id}`}>
            <h2 className="post-title">{post.title}</h2>
            {post.body && <p className="post-excerpt">{post.body}</p>}
            <div className="post-meta">
              <Byline author={author(post.profiles)} createdAt={post.created_at} />
              <PostStats
                likeCount={post.like_count}
                commentCount={post.comment_count}
                liked={likedIds.has(post.id)}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
