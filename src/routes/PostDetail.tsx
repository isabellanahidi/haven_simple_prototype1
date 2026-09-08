import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { buildCommentTree, commentErrorMessage, COMMENT_LIMIT } from '../lib/comments';
import { author, type Author, type FeedPost } from '../lib/types';
import { Byline } from '../components/Byline';
import { LikeButton } from '../components/LikeButton';
import { CommentThread, type LocalComment } from '../components/CommentThread';
import { CommentComposer, LockedComposer } from '../components/CommentComposer';
import { clearStaleSession, useSignInRedirect } from '../lib/authRedirect';
import { EmptyState, ErrorState, Loading } from '../components/States';

// depth and like_count come straight from the row.
//
// The FK hint is required, not decoration. comment_likes holds foreign keys to
// BOTH comments and profiles, which makes it a junction table and gives
// comments a second path to profiles on top of author_id. A bare
// `profiles(...)` is then ambiguous and PostgREST refuses it with PGRST201.
// This is the same trap posts has had all along — see finding 1 in section 8.
//
// One constant, deliberately: it feeds the list query AND the insert's
// returning embed, so both were broken by the same omission and both are
// fixed by the same hint.
const COMMENT_SELECT =
  'id, parent_id, depth, like_count, body, created_at, profiles!comments_author_id_fkey(display_name, avatar_emoji)';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = useUserId();
  const requireSignIn = useSignInRedirect();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<LocalComment[] | null>(null);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // My own name and emoji, so an optimistic reply has a byline before the
  // server has told us anything.
  const [me, setMe] = useState<Author | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentLikes, setCommentLikes] = useState<Set<string>>(() => new Set());
  // Which nodes the reader has opened or closed by hand. Memory only, per
  // spec — a reload starts from the depth-based default again.
  const [openOverrides, setOpenOverrides] = useState<Map<string, boolean>>(() => new Map());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [postRes, commentRes, likeRes, commentLikeRes, meRes] = await Promise.all([
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
          .order('created_at', { ascending: true })
          .limit(COMMENT_LIMIT),
        // Both are about *me*, so both are skipped when there is no me. The
        // post and its comments still load — those selects pass for anon.
        userId
          ? supabase.from('likes').select('post_id').eq('user_id', userId).eq('post_id', id)
          : null,
        // My likes on this post's comments, in one query rather than a second
        // round trip after the comment ids are known — the !inner embed turns
        // the comments join into a filter, so every reply knows its liked
        // state on first render instead of popping in afterwards.
        userId
          ? supabase
              .from('comment_likes')
              .select('comment_id, comments!inner(post_id)')
              .eq('user_id', userId)
              .eq('comments.post_id', id)
          : null,
        userId
          ? supabase
              .from('profiles')
              .select('display_name, avatar_emoji')
              .eq('id', userId)
              .maybeSingle()
          : null,
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
      setLiked((likeRes?.data?.length ?? 0) > 0);
      // A failed comment-likes query is not worth blocking the thread over —
      // hearts just render empty, exactly as the feed treats its own.
      setCommentLikes(
        new Set((commentLikeRes?.data ?? []).map((r) => (r as { comment_id: string }).comment_id)),
      );
      setMe((meRes?.data as Author | null) ?? null);

      // Same stale session as on /me, reached from a screen that still works
      // without one. profiles_select is `using (true)`, so zero rows here means
      // the row is genuinely gone, not hidden. Clearing it flips the like
      // button and reply composer into their signed-out affordances, which is
      // the honest state — a write would fail on the foreign key.
      if (userId && meRes && !meRes.error && !meRes.data) void clearStaleSession();
    })();

    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  const submitComment = useCallback(
    async (body: string, parentId: string | null): Promise<string | null> => {
      if (!id) return 'This post has no id.';
      if (!userId) return 'Sign in to reply.';

      const tempId = `pending-${crypto.randomUUID()}`;
      // Depth is guessed only for the placeholder's indent, from the parent
      // already on screen. The server's value replaces it moments later — the
      // trigger is the only real writer.
      const parentDepth = parentId
        ? ((comments ?? []).find((c) => c.id === parentId)?.depth ?? 0)
        : -1;
      const optimistic: LocalComment = {
        id: tempId,
        parent_id: parentId,
        depth: parentDepth + 1,
        like_count: 0,
        body,
        created_at: new Date().toISOString(),
        profiles: me,
        pending: true,
      };
      setComments((prev) => [...(prev ?? []), optimistic]);
      // Replying into a collapsed thread has to reveal it, or the reply lands
      // somewhere the person cannot see.
      if (parentId) setOpenOverrides((prev) => new Map(prev).set(parentId, true));

      const { data, error: insertError } = await supabase
        .from('comments')
        .insert({ post_id: id, author_id: userId, parent_id: parentId, body })
        .select(COMMENT_SELECT)
        .single();

      if (insertError || !data) {
        setComments((prev) => (prev ?? []).filter((c) => c.id !== tempId));
        // Includes the depth trigger's P0001 messages — a 100-level ceiling
        // and the same-post check. The UI never offers either, but neither
        // may be swallowed.
        return commentErrorMessage(insertError);
      }

      // Swap the placeholder for the real row, which carries the server's id,
      // timestamp, byline and authoritative depth.
      setComments((prev) =>
        (prev ?? []).map((c) => (c.id === tempId ? (data as unknown as LocalComment) : c)),
      );
      return null;
    },
    [comments, id, me, userId],
  );

  // Recursive now, not a two-pass group-by: nesting is unlimited to a ceiling
  // of 100, and the old shape could only ever represent two levels.
  const threads = useMemo(() => buildCommentTree(comments ?? []), [comments]);

  const toggleOpen = useCallback((commentId: string, open: boolean) => {
    setOpenOverrides((prev) => new Map(prev).set(commentId, open));
  }, []);

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
        <EmptyState title="Post not found" body="It may have been deleted, or the link is wrong." />
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
        <Byline author={author(post.profiles)} createdAt={post.created_at} lead />
        <h1 className="detail-title">{post.title}</h1>
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

      {userId ? (
        <CommentComposer
          placeholder="Add a reply…"
          submitLabel="Reply"
          onSubmit={(body) => submitComment(body, null)}
        />
      ) : (
        <LockedComposer label="Sign in to reply…" onTap={requireSignIn} />
      )}

      {threads.length === 0 ? (
        <EmptyState title="No replies yet" body="Nobody has answered this one." />
      ) : (
        <ul className="comment-list">
          {threads.map((node) => (
            <CommentThread
              key={node.comment.id}
              node={node}
              likedIds={commentLikes}
              userId={userId}
              replyingTo={replyingTo}
              onReplyTo={setReplyingTo}
              onSubmitReply={(body, parentId) => submitComment(body, parentId)}
              requireSignIn={requireSignIn}
              openOverrides={openOverrides}
              onToggleOpen={toggleOpen}
            />
          ))}
        </ul>
      )}
    </>
  );
}
