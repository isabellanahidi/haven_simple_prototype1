import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { commentErrorMessage } from '../lib/comments';
import { author, type Author, type Comment, type FeedPost } from '../lib/types';
import { Byline } from '../components/Byline';
import { LikeButton } from '../components/LikeButton';
import { CommentComposer } from '../components/CommentComposer';
import { EmptyState, ErrorState, Loading } from '../components/States';

const COMMENT_SELECT = 'id, parent_id, body, created_at, profiles(display_name, avatar_emoji)';

/** A comment that may not have reached the server yet. */
type LocalComment = Comment & { pending?: boolean };

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = useUserId();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<LocalComment[] | null>(null);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // My own name and emoji, so an optimistic reply has a byline before the
  // server has told us anything.
  const [me, setMe] = useState<Author | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [postRes, commentRes, likeRes, meRes] = await Promise.all([
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
          .select(COMMENT_SELECT)
          .eq('post_id', id)
          .order('created_at', { ascending: true }),
        supabase.from('likes').select('post_id').eq('user_id', userId).eq('post_id', id),
        supabase
          .from('profiles')
          .select('display_name, avatar_emoji')
          .eq('id', userId)
          .maybeSingle(),
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
      setComments((commentRes.data ?? []) as unknown as LocalComment[]);
      setLiked((likeRes.data?.length ?? 0) > 0);
      setMe((meRes.data as Author | null) ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  const submitComment = useCallback(
    async (body: string, parentId: string | null): Promise<string | null> => {
      if (!id) return 'This post has no id.';

      const tempId = `pending-${crypto.randomUUID()}`;
      const optimistic: LocalComment = {
        id: tempId,
        parent_id: parentId,
        body,
        created_at: new Date().toISOString(),
        profiles: me,
        pending: true,
      };
      setComments((prev) => [...(prev ?? []), optimistic]);

      const { data, error: insertError } = await supabase
        .from('comments')
        .insert({ post_id: id, author_id: userId, parent_id: parentId, body })
        .select(COMMENT_SELECT)
        .single();

      if (insertError || !data) {
        setComments((prev) => (prev ?? []).filter((c) => c.id !== tempId));
        // Includes the depth trigger's P0001 "Only one level of replies is
        // allowed" — the UI never offers that, but it must never be swallowed.
        return commentErrorMessage(insertError);
      }

      // Swap the placeholder for the real row, which carries the server's id
      // and timestamp.
      setComments((prev) =>
        (prev ?? []).map((c) => (c.id === tempId ? (data as unknown as LocalComment) : c)),
      );
      return null;
    },
    [id, me, userId],
  );

  // Two-pass group-by, never recursive: the DB rejects replies-to-replies, so
  // the tree is only ever two levels deep.
  const threads = useMemo(() => {
    if (!comments) return [];

    const repliesByParent = new Map<string, LocalComment[]>();
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

  // Counted from the loaded list, not posts.comment_count, so an optimistic
  // reply lands in the total straight away. The two can legitimately differ:
  // RLS hides a hidden comment from the list while the counter trigger still
  // counted it. The list is what's on screen, so the list wins.
  const commentCount = comments?.length ?? 0;

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
          <LikeButton postId={post.id} initialCount={post.like_count} initialLiked={liked} />
          <span className="stat">
            <span className="stat-icon" aria-hidden="true">
              💬
            </span>
            {commentCount}
            <span className="sr-only">{commentCount === 1 ? ' reply' : ' replies'}</span>
          </span>
        </div>
      </article>

      <h2 className="section-heading">
        {commentCount === 1 ? '1 reply' : `${commentCount} replies`}
      </h2>

      <CommentComposer
        placeholder="Add a reply…"
        submitLabel="Reply"
        onSubmit={(body) => submitComment(body, null)}
      />

      {threads.length === 0 ? (
        <EmptyState title="No replies yet" body="Nobody has answered this one." />
      ) : (
        <ul className="comment-list">
          {threads.map(({ comment, replies }) => (
            <li className={comment.pending ? 'comment pending' : 'comment'} key={comment.id}>
              <Byline author={author(comment.profiles)} createdAt={comment.created_at} />
              <p className="comment-body">{comment.body}</p>

              {/* Only top-level comments get a reply button. Replies don't,
                  because the depth trigger would reject the insert — the UI
                  simply never offers the move the database forbids. */}
              {!comment.pending && replyingTo !== comment.id && (
                <button
                  type="button"
                  className="btn-quiet reply-trigger"
                  onClick={() => setReplyingTo(comment.id)}
                >
                  Reply
                </button>
              )}

              {replyingTo === comment.id && (
                <CommentComposer
                  placeholder={`Reply to ${author(comment.profiles).display_name}…`}
                  submitLabel="Reply"
                  autoFocus
                  onCancel={() => setReplyingTo(null)}
                  onSubmit={(body) => submitComment(body, comment.id)}
                />
              )}

              {replies.length > 0 && (
                <ul className="reply-list">
                  {replies.map((reply) => (
                    <li className={reply.pending ? 'reply pending' : 'reply'} key={reply.id}>
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
