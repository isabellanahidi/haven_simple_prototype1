import { Link } from 'react-router-dom';
import { author, type FeedPost } from '../lib/types';
import { Byline } from './Byline';
import { LikeButton } from './LikeButton';

/**
 * The feed card, and the one place its markup lives.
 *
 * Lifted out of Feed.tsx unchanged when /t/pcos landed, so the home drawer and
 * the topic page render the same card rather than two copies that drift. The
 * queries behind them are separate on purpose — the home feed is untouched —
 * but the row shape is identical, so this takes FeedPost from both.
 *
 * STRUCTURAL NOTE THAT KEEPS MATTERING (CLAUDE.md section 4): the card is NOT
 * a single <Link>. The like button is a real <button>, a <button> inside an
 * <a> is invalid HTML, and tapping the heart would navigate. So the card is a
 * <li> holding a <Link class="post-card-main"> for the tappable region, with
 * the like button as a SIBLING below it. Any future interactive control on a
 * card has to go outside .post-card-main the same way. The byline is safe
 * inside it only because it contains nothing interactive — if it ever gains a
 * link to the author, it moves out too.
 */
export function PostList({ posts, likedIds }: { posts: FeedPost[]; likedIds: Set<string> }) {
  return (
    <ul className="feed-list">
      {posts.map((post) => (
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
