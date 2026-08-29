import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { author, type Comment, type FeedPost } from '../lib/types';
import { Byline } from '../components/Byline';
import { PostStats } from '../components/PostStats';
import { EmptyState, ErrorState, Loading } from '../components/States';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = useUserId();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [postRes, commentRes, likeRes] = await Promise.all([
        supabase
          .from('posts')
          // See Feed.tsx — the author FK has to be named to disambiguate.
          .select(
            'id, title, body, like_count, comment_count, created_at, profiles!posts_author_id_fkey(display_name, avatar_emoji)',
          )
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('comments')
          .select('id, parent_id, body, created_at, profiles(display_name, avatar_emoji)')
          .eq('post_id', id)
          .order('created_at', { ascending: true }),
        supabase.from('likes').select('post_id').eq('user_id', userId).eq('post_id', id),
      ]);

      if (cancelled) return;

      if (postRes.error) {
        setError(postRes.error.message);
        return;
      }
      if (!postRes.data) {
        setNotFound(true);
        return;
      }

      setPost(postRes.data as unknown as FeedPost);
      setComments((commentRes.data ?? []) as unknown as Comment[]);
      setLiked((likeRes.data?.length ?? 0) > 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  // Two-pass group-by, never recursive: the DB rejects replies-to-replies, so
  // the tree is only ever two levels deep.
  const threads = useMemo(() => {
    if (!comments) return [];

    const repliesByParent = new Map<string, Comment[]>();
    for (const c of comments) {
      if (!c.parent_id) continue;
      const bucket = repliesByParent.get(c.parent_id);
      if (bucket) bucket.push(c);
      else repliesByParent.set(c.parent_id, [c]);
    }

    return comments
      .filter((c) => !c.parent_id)
      .map((top) => ({ comment: top, replies: repliesByParent.get(top.id) ?? [] }));
  }, [comments]);

  if (error) return <ErrorState title="Couldn't load this post" message={error} />;

  if (notFound) {
    return (
      <>
        <Link className="back-link" to="/">
          ← Feed
        </Link>
        <EmptyState
          title="Post not found"
          body="It may have been deleted, or the link is wrong."
        />
      </>
    );
  }

  if (!post) return <Loading label="Loading post…" />;

  return (
    <>
      <Link className="back-link" to="/">
        ← Feed
      </Link>

      <article className="detail-card">
        <h1 className="detail-title">{post.title}</h1>
        <Byline author={author(post.profiles)} createdAt={post.created_at} />
        {post.body && <p className="detail-body">{post.body}</p>}
        <div className="post-meta">
          <PostStats
            likeCount={post.like_count}
            commentCount={post.comment_count}
            liked={liked}
          />
        </div>
      </article>

      <h2 className="section-heading">
        {post.comment_count === 1 ? '1 reply' : `${post.comment_count} replies`}
      </h2>

      {threads.length === 0 ? (
        <EmptyState title="No replies yet" body="Nobody has answered this one." />
      ) : (
        <ul className="comment-list">
          {threads.map(({ comment, replies }) => (
            <li className="comment" key={comment.id}>
              <Byline author={author(comment.profiles)} createdAt={comment.created_at} />
              <p className="comment-body">{comment.body}</p>

              {replies.length > 0 && (
                <ul className="reply-list">
                  {replies.map((reply) => (
                    <li className="reply" key={reply.id}>
                      <Byline author={author(reply.profiles)} createdAt={reply.created_at} />
                      <p className="comment-body">{reply.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
