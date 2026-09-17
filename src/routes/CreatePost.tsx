import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserId } from '../lib/session';
import { charLength } from '../lib/text';
import { asTopic, topicLabel } from '../lib/topics';

// Mirrors the CHECK constraints in CLAUDE.md section 7 exactly:
//   constraint title_len check (char_length(title) between 3 and 200)
//   constraint body_len  check (char_length(body) <= 5000)
const TITLE_MIN = 3;
const TITLE_MAX = 200;
const BODY_MAX = 5000;

export default function CreatePost() {
  const userId = useUserId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // The topic preset, arriving as ?topic=pcos from the "New post" button on
  // /t/pcos. A search param rather than router state on purpose: it survives a
  // reload, and it survives the sign-in round trip, because SignIn rebuilds
  // its destination from pathname + search + hash.
  //
  // VALIDATED, because anyone can type anything into a URL. asTopic returns
  // null for anything that is not an allowed slug, so a junk preset posts
  // untagged rather than blocking the composer or sending the database a value
  // its CHECK constraint would reject. The constraint is still the real guard.
  //
  // No param at all is the ordinary case: /new reached from the tab bar posts
  // untagged, and that has not changed.
  const topic = asTopic(searchParams.get('topic'));

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Count the trimmed values, because those are what actually get stored and
  // what the DB constraint is checked against.
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const titleLen = charLength(trimmedTitle);
  const bodyLen = charLength(trimmedBody);

  const titleTooShort = titleLen < TITLE_MIN;
  const titleTooLong = titleLen > TITLE_MAX;
  const bodyTooLong = bodyLen > BODY_MAX;
  const valid = !titleTooShort && !titleTooLong && !bodyTooLong;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || submitting) return;
    // RequireAuth guarantees this, but the client is untyped: author_id: null
    // would type-check and then fail as a not-null violation at the database.
    if (!userId) return;

    setSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('posts')
      // topic is null when there is no valid preset, which is what the column
      // means by untagged. .select('id').single() stays: per finding 4a a
      // write filtered out by RLS comes back 200 with an empty result and no
      // error, so the returned row is the only proof the insert did anything.
      .insert({ author_id: userId, title: trimmedTitle, body: trimmedBody, topic })
      .select('id')
      .single();

    if (insertError || !data) {
      setSubmitting(false);
      setError(insertError?.message ?? 'The post was not created.');
      return;
    }

    // replace, not push: the back button should return to the feed rather than
    // to a composer holding a question that has already been asked.
    navigate(`/p/${data.id}`, { replace: true });
  }

  return (
    <>
      <Link className="back-link" to={topic ? `/t/${topic}` : '/'}>
        ← {topic ? topicLabel(topic) : 'Feed'}
      </Link>

      <form className="composer" onSubmit={handleSubmit}>
        {/* Says where the post will land, because the preset is otherwise
            invisible — the URL is not on screen in standalone mode. Not a
            picker: choosing a topic is not a thing this app does. */}
        {topic && (
          <p className="form-notice">Posting to {topicLabel(topic)}.</p>
        )}
        <div className="field">
          <div className="field-head">
            <label className="field-label" htmlFor="post-title">
              Question
            </label>
            <span
              className={titleTooLong ? 'counter over' : 'counter'}
              aria-live="polite"
            >
              {titleLen} / {TITLE_MAX}
            </span>
          </div>
          <input
            id="post-title"
            className="text-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to ask?"
            autoComplete="off"
            enterKeyHint="next"
            disabled={submitting}
          />
          <p className="field-hint">
            {titleTooLong
              ? `${titleLen - TITLE_MAX} character${titleLen - TITLE_MAX === 1 ? '' : 's'} too long.`
              : `At least ${TITLE_MIN} characters.`}
          </p>
        </div>

        <div className="field">
          <div className="field-head">
            <label className="field-label" htmlFor="post-body">
              Details <span className="field-optional">optional</span>
            </label>
            <span className={bodyTooLong ? 'counter over' : 'counter'} aria-live="polite">
              {bodyLen} / {BODY_MAX}
            </span>
          </div>
          <textarea
            id="post-body"
            className="text-input textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add context, if it helps."
            rows={8}
            disabled={submitting}
          />
          {bodyTooLong && (
            <p className="field-hint over">
              {bodyLen - BODY_MAX} character{bodyLen - BODY_MAX === 1 ? '' : 's'} too long.
            </p>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn-primary" type="submit" disabled={!valid || submitting}>
          {submitting ? 'Posting…' : 'Post question'}
        </button>
      </form>
    </>
  );
}
