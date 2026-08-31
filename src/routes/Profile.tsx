import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { charLength } from '../lib/text';
import {
  AVATAR_CHOICES,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  profileErrorMessage,
} from '../lib/profile';
import { relativeTime } from '../lib/time';
import { EmptyState, ErrorState, Loading } from '../components/States';

type Saved = { display_name: string; bio: string; avatar_emoji: string };

type MyPost = {
  id: string;
  title: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  hidden: boolean;
};

export default function Profile() {
  const userId = useUserId();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const [saved, setSaved] = useState<Saved | null>(null);
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [emoji, setEmoji] = useState('🙂');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const [profileRes, postsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, bio, avatar_emoji')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('posts')
          // Hits posts_author_idx (author_id, created_at desc).
          .select('id, title, like_count, comment_count, created_at, hidden')
          .eq('author_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      if (profileRes.error) {
        setLoadError(profileRes.error.message);
        return;
      }
      if (!profileRes.data) {
        // auth.users row with no profiles row — the handle_new_user trigger
        // didn't fire. See the ordering trap in section 7a.
        setLoadError('Your profile row is missing. See CLAUDE.md section 7a.');
        return;
      }

      const profile = profileRes.data as Saved;
      setSaved(profile);
      setDisplayName(profile.display_name);
      setBio(profile.bio);
      setEmoji(profile.avatar_emoji);
      setPosts((postsRes.data ?? []) as MyPost[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Count the trimmed values — that is what gets stored, and what the CHECK
  // constraints are evaluated against. charLength counts code points, matching
  // Postgres char_length(); `.length` would count an emoji in a display name
  // as two.
  const trimmedName = displayName.trim();
  const trimmedBio = bio.trim();
  const nameLen = charLength(trimmedName);
  const bioLen = charLength(trimmedBio);

  const nameTooShort = nameLen < DISPLAY_NAME_MIN;
  const nameTooLong = nameLen > DISPLAY_NAME_MAX;
  const bioTooLong = bioLen > BIO_MAX;
  const valid = !nameTooShort && !nameTooLong && !bioTooLong;

  const dirty =
    saved !== null &&
    (trimmedName !== saved.display_name ||
      trimmedBio !== saved.bio ||
      emoji !== saved.avatar_emoji);

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setJustSaved(false);
      setSaveError(null);
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !dirty || saving) return;
    // RequireAuth guarantees this, but the client is untyped: .eq('id', null)
    // would match no rows, which per section 4a is indistinguishable from an
    // RLS refusal.
    if (!userId) return;

    setSaving(true);
    setSaveError(null);

    const next = { display_name: trimmedName, bio: trimmedBio, avatar_emoji: emoji };

    const { data, error } = await supabase
      .from('profiles')
      .update(next)
      .eq('id', userId)
      .select();

    setSaving(false);

    if (error) {
      setSaveError(profileErrorMessage(error));
      return;
    }

    // Per CLAUDE.md 4a: RLS filters rows out silently rather than raising, so
    // an update that matched nothing still returns 200 with an empty array and
    // no error. The row count is the only thing that says it actually wrote.
    if (!data || data.length === 0) {
      setSaveError("That didn't save — the update matched no row you're allowed to change.");
      return;
    }

    setSaved(next);
    setJustSaved(true);
  }

  if (loadError) return <ErrorState title="Couldn't load your profile" message={loadError} />;
  if (!saved) return <Loading label="Loading your profile…" />;

  return (
    <>
      <Link className="back-link" to="/">
        ← Feed
      </Link>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="field">
          <span className="field-label" id="avatar-label">
            Avatar
          </span>
          <div className="emoji-grid" role="radiogroup" aria-labelledby="avatar-label">
            {/* Whatever is stored wins a slot even if it isn't one of the
                presets, so a value set by hand in the SQL editor isn't lost. */}
            {(AVATAR_CHOICES.includes(emoji) ? AVATAR_CHOICES : [emoji, ...AVATAR_CHOICES]).map(
              (choice) => (
                <button
                  type="button"
                  key={choice}
                  className={choice === emoji ? 'emoji-choice selected' : 'emoji-choice'}
                  onClick={() => edit(setEmoji)(choice)}
                  role="radio"
                  aria-checked={choice === emoji}
                  aria-label={`Avatar ${choice}`}
                >
                  {choice}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="field">
          <div className="field-head">
            <label className="field-label" htmlFor="display-name">
              Display name
            </label>
            <span className={nameTooLong ? 'counter over' : 'counter'} aria-live="polite">
              {nameLen} / {DISPLAY_NAME_MAX}
            </span>
          </div>
          <input
            id="display-name"
            className="text-input"
            type="text"
            value={displayName}
            onChange={(e) => edit(setDisplayName)(e.target.value)}
            placeholder="What should people call you?"
            autoComplete="off"
            disabled={saving}
          />
          {nameTooLong && (
            <p className="field-hint over">
              {nameLen - DISPLAY_NAME_MAX} character
              {nameLen - DISPLAY_NAME_MAX === 1 ? '' : 's'} too long.
            </p>
          )}
          {nameTooShort && <p className="field-hint">A display name can't be empty.</p>}
        </div>

        <div className="field">
          <div className="field-head">
            <label className="field-label" htmlFor="bio">
              Bio <span className="field-optional">optional</span>
            </label>
            <span className={bioTooLong ? 'counter over' : 'counter'} aria-live="polite">
              {bioLen} / {BIO_MAX}
            </span>
          </div>
          <textarea
            id="bio"
            className="text-input textarea comment-textarea"
            value={bio}
            onChange={(e) => edit(setBio)(e.target.value)}
            placeholder="Anything you want people to know."
            rows={4}
            disabled={saving}
          />
          {bioTooLong && (
            <p className="field-hint over">
              {bioLen - BIO_MAX} character{bioLen - BIO_MAX === 1 ? '' : 's'} too long.
            </p>
          )}
        </div>

        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}

        <button className="btn-primary" type="submit" disabled={!valid || !dirty || saving}>
          {saving ? 'Saving…' : justSaved && !dirty ? 'Saved' : 'Save profile'}
        </button>
      </form>

      <h2 className="section-heading">
        {posts === null
          ? 'Your posts'
          : posts.length === 1
            ? 'Your 1 post'
            : `Your ${posts.length} posts`}
      </h2>

      {posts === null ? (
        <Loading label="Loading your posts…" />
      ) : posts.length === 0 ? (
        <EmptyState
          title="You haven't posted yet"
          body="Anything you ask will show up here."
          action={
            <Link className="btn-primary" to="/new">
              Ask a question
            </Link>
          }
        />
      ) : (
        <ul className="feed-list">
          {posts.map((post) => (
            <li className="post-card" key={post.id}>
              <Link className="post-card-main" to={`/p/${post.id}`}>
                <h3 className="post-title">{post.title}</h3>
                <div className="byline">
                  <span>{relativeTime(post.created_at)}</span>
                  <span className="byline-dot">♥ {post.like_count}</span>
                  <span className="byline-dot">💬 {post.comment_count}</span>
                  {post.hidden && <span className="badge-hidden">hidden</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Signing out only clears the local session. The account and every post
          on it survive, and the same email brings them back. */}
      <div className="signout-row">
        <button
          type="button"
          className="btn-signout"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
            navigate('/', { replace: true });
          }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </>
  );
}
