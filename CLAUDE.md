# Project Handoff: Anonymous Q&A App (Reddit-like prototype)

> **Purpose of this document:** This is a complete context transfer for a new Claude conversation. Everything needed to continue the build is here, including the full database schema, so no prior files or chat history are required. Decisions marked **LOCKED** have already been made deliberately — please don't relitigate them unless the user asks.

---

## 1. What we're building

A mobile-first, Reddit-style Q&A app. Prototype quality, but going in front of **real users for testing** — not just a screenshot demo. So data persistence, security, and basic abuse handling actually matter.

### Required features (the user's original ask)
1. **Anonymous accounts** — users get an identity with no signup flow
2. **Post questions** to a single community feed
3. **Like** posts
4. **Reply** to posts
5. **Edit profile**

### Hard constraint
**Two days**, starting from nothing. This constraint drove every decision below.

---

## 2. Decisions already made (LOCKED)

| Area | Decision | Reasoning |
|---|---|---|
| Platform | **Mobile web**, opened in Safari, "Add to Home Screen" | App Store review takes days-to-weeks and would blow the 2-day deadline outright. User explicitly confirmed mobile web is acceptable. |
| Frontend | **Vite + React + TypeScript, SPA** | No SSR, no React Server Components, no framework ceremony. Everything client-side. Fastest possible path for a solo dev. |
| Backend | **Supabase** (hosted Postgres + Auth + RLS) | Has *native anonymous auth* (`signInAnonymously`), which maps 1:1 onto the "anonymous accounts" requirement with zero custom auth code. |
| Security model | **Postgres Row Level Security** | The app is a pure client-side SPA, so there is no trusted server layer. RLS is the *only* thing protecting user data. This is non-negotiable. |
| Hosting | **Vercel**, auto-deploy from GitHub | One-click, free, instant HTTPS (needed for Add to Home Screen). |
| Routing | `react-router-dom` | |
| Styling | plain CSS | |

### Alternatives considered and rejected
- **Native iOS / Swift** — App Store review kills it.
- **React Native + Expo** — real-app feel, but costs several hours on build config, provisioning profiles, and TestFlight distribution. Not worth it when web is acceptable.
- **Next.js** — deploys just as easily, but the App Router's server/client component split is a source of confusion and bugs under time pressure. A plain SPA has fewer ways to go wrong.
- **Firebase** — viable, but Supabase's Postgres + RLS gives stronger guarantees with less code, and its anonymous auth is a cleaner fit.
- **Writing a custom backend** — never on the table at this timeline.

---

## 3. Scope: explicitly CUT

These were cut on purpose to protect the deadline. **Do not add them back** without the user asking.

- Communities / subreddits (there is **one global feed**)
- Downvotes (likes only)
- Image or file uploads
- Search
- Notifications
- Infinite scroll (hard `limit 50` on the feed)
- Comment threading beyond **one level** (a reply to a reply is rejected at the database level)
- Karma / reputation scores
- Sorting options (chronological only, newest first)
- Real-time subscriptions
- A moderation UI (the user moderates by hand in the Supabase SQL editor)
- Email/password auth — though see the "account fragility" risk below for an optional upgrade path

---

## 4. Current status

**Nothing has been built yet.** The schema has been *written* but the user had not yet confirmed applying it.

- [x] Vite project scaffolded
- [x] Pushed to GitHub, imported to Vercel, empty app confirmed loading on a real iPhone
- [ ] Supabase project created
- [ ] Anonymous sign-ins enabled in the Supabase dashboard
- [ ] Schema applied (SQL below)
- [ ] Auth bootstrap wired
- [ ] Feed screen
- [ ] Post detail screen
- [ ] Create post screen
- [ ] Like button
- [ ] Replies
- [ ] Profile edit screen
- [ ] Mobile polish pass
- [ ] Deployed and tested on device

**Immediate next task:** the user was about to run the schema. After that, the next deliverable is the **feed screen and post detail screen**.

---

## 5. Setup steps (in order)

The ordering matters. Step 1 exists to de-risk deployment early — discovering a build failure late on day 2 is the classic way this kind of project dies.

**Step 1 — Scaffold and deploy an empty app first.**
```bash
npm create vite@latest qna -- --template react-ts
cd qna && npm i @supabase/supabase-js react-router-dom
git init && git add -A && git commit -m "init"
```
Push to GitHub → import into Vercel → confirm the live URL loads on the user's phone.

**Step 2 — Create the Supabase project.** Then: Dashboard → Authentication → Providers → toggle **Anonymous sign-ins** to ON. It is **off by default** and this is an easy thing to miss; anonymous auth silently fails without it.

**Step 3 — Apply the schema.** Paste the SQL in section 7 into Dashboard → SQL Editor → Run.

**Step 4 — Environment variables.** In `.env.local` and in Vercel's project settings:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
The anon key is safe to ship to the client — that's what RLS is for. The **service role key must never appear in frontend code.**

**Step 5 — Auth bootstrap** (section 6).

**Step 6 — Build screens in this order, deploying after each:** feed → post detail → create post → like → reply → profile edit.

---

## 6. Auth approach

Every visitor gets a real row in `auth.users` and a matching `profiles` row, created automatically by a database trigger. There is no signup screen, no email, no password. Call this once at app startup:

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}
```

Default display names are generated by the trigger as `anon-` plus the first four characters of the user's UUID. Users can change this on the profile screen.

---

## 7. Database schema (full, authoritative)

Four tables: `profiles`, `posts`, `comments`, `likes`.

```sql
-- ============================================================
-- Anonymous Q&A prototype — Supabase schema
-- Paste into Supabase Dashboard -> SQL Editor -> Run
-- Prereq: Authentication -> Providers -> Anonymous sign-ins = ON
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'anon',
  bio           text not null default '',
  avatar_emoji  text not null default '🙂',
  created_at    timestamptz not null default now(),
  constraint display_name_len check (char_length(display_name) between 1 and 30),
  constraint bio_len check (char_length(bio) <= 300)
);

-- Auto-create a profile whenever an auth user (including anonymous) appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'anon-' || substr(new.id::text, 1, 4));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- POSTS
-- ------------------------------------------------------------
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id) on delete cascade,
  title          text not null,
  body           text not null default '',
  like_count     int  not null default 0,
  comment_count  int  not null default 0,
  hidden         boolean not null default false,  -- moderation kill switch
  created_at     timestamptz not null default now(),
  constraint title_len check (char_length(title) between 3 and 200),
  constraint body_len check (char_length(body) <= 5000)
);

create index posts_feed_idx on public.posts (created_at desc) where hidden = false;
create index posts_author_idx on public.posts (author_id, created_at desc);

-- ------------------------------------------------------------
-- COMMENTS (one level of nesting only)
-- ------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  body        text not null,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint comment_body_len check (char_length(body) between 1 and 2000)
);

create index comments_post_idx on public.comments (post_id, created_at);

-- Reject replies-to-replies so the UI never has to recurse.
create or replace function public.enforce_comment_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null
     and (select parent_id from public.comments where id = new.parent_id) is not null
  then
    raise exception 'Only one level of replies is allowed';
  end if;
  return new;
end;
$$;

create trigger comments_depth_check
  before insert or update on public.comments
  for each row execute function public.enforce_comment_depth();

-- ------------------------------------------------------------
-- LIKES (one row per user per post)
-- ------------------------------------------------------------
create table public.likes (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  post_id     uuid not null references public.posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ------------------------------------------------------------
-- DENORMALIZED COUNTERS
-- security definer so the trigger can update posts it doesn't own
-- ------------------------------------------------------------
create or replace function public.sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_counter
  after insert or delete on public.likes
  for each row execute function public.sync_like_count();

create or replace function public.sync_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger comments_counter
  after insert or delete on public.comments
  for each row execute function public.sync_comment_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- The only thing standing between users and each other's data.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.likes    enable row level security;

-- PROFILES: world-readable, self-writable
create policy profiles_select on public.profiles
  for select using (true);
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- POSTS
create policy posts_select on public.posts
  for select using (hidden = false or author_id = auth.uid());
create policy posts_insert on public.posts
  for insert with check (auth.uid() = author_id);
create policy posts_update on public.posts
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy posts_delete on public.posts
  for delete using (auth.uid() = author_id);

-- COMMENTS
create policy comments_select on public.comments
  for select using (hidden = false or author_id = auth.uid());
create policy comments_insert on public.comments
  for insert with check (auth.uid() = author_id);
create policy comments_update on public.comments
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy comments_delete on public.comments
  for delete using (auth.uid() = author_id);

-- LIKES
create policy likes_select on public.likes
  for select using (true);
create policy likes_insert on public.likes
  for insert with check (auth.uid() = user_id);
create policy likes_delete on public.likes
  for delete using (auth.uid() = user_id);
```

### Schema design notes
- **`like_count` and `comment_count` are denormalized** onto `posts` and kept in sync by triggers, so the feed is a single cheap query instead of N subqueries.
- The counter trigger functions are **`security definer`** on purpose. Without it, RLS would block the counter update, because the person liking a post is not that post's author.
- **One-level comment nesting is enforced in the database**, not just the UI. This means the reply rendering can be a flat two-pass group-by rather than a recursive component.
- `hidden` is a manual moderation flag. Caveat worth knowing: the update policy lets authors edit their own rows, so a determined author could flip their own post back to `hidden = false`. For a two-day prototype with one human moderator, deleting is the more reliable remedy.
- `likes` uses a **composite primary key** `(user_id, post_id)`, so a double-tap physically cannot double-count.
- Cascading deletes are set up throughout: deleting a user removes their profile, posts, comments, and likes.

---

## 8. Screens to build

| Route | Screen | Behavior |
|---|---|---|
| `/` | Feed | Newest 50 posts. Each card: title, author display name + emoji, like count, comment count, relative timestamp. Tapping opens detail. |
| `/p/:id` | Post detail | Full post, like button, comment list (one level of nesting), reply composer. |
| `/new` | Create post | Title + body, character counters matching the DB constraints, submit → redirect to the new post. |
| `/me` | Profile edit | Edit `display_name`, `bio`, `avatar_emoji`. Optionally list the user's own posts. |

### Suggested queries

Feed, with author joined:
```ts
const { data } = await supabase
  .from('posts')
  .select('id, title, body, like_count, comment_count, created_at, profiles(display_name, avatar_emoji)')
  .order('created_at', { ascending: false })
  .limit(50);
```

For "did I like this?", **fetch the current user's likes separately** and hold them in a `Set` — don't embed `likes(user_id)` into the feed query, since that pulls every like row for every post:
```ts
const { data: myLikes } = await supabase
  .from('likes')
  .select('post_id')
  .eq('user_id', userId);
const likedIds = new Set(myLikes?.map(l => l.post_id));
```

Toggle a like — insert or delete, with optimistic UI:
```ts
if (liked) {
  await supabase.from('likes').delete().match({ user_id: userId, post_id: postId });
} else {
  await supabase.from('likes').insert({ user_id: userId, post_id: postId });
}
```

---

## 9. Known risks and gotchas

**Account fragility (the biggest one).** Anonymous sessions live in the browser's localStorage. If a user clears Safari data, uses a different browser, or switches devices, that identity and all its posts are **orphaned with no recovery path**. Since this is going in front of real users, they should be told this in a one-line banner. Optional day-2 upgrade if time allows: `supabase.auth.updateUser({ email })` converts an anonymous user into a permanent one *in place*, preserving all their posts.

**Zero-friction abuse.** Anonymous auth means anyone can post instantly and repeatedly. If the link goes out publicly, enable Supabase's CAPTCHA for anonymous sign-ins. Keep the SQL editor handy for flipping `hidden` or deleting rows.

**Anonymous users count toward Supabase MAU** and accumulate in `auth.users` — one row per visitor, including bots. Worth periodically deleting old anonymous users with no posts.

**Mobile Safari specifics:**
- Use `100dvh`, not `100vh` — `100vh` is wrong when the URL bar is showing.
- Respect the notch: `env(safe-area-inset-bottom)` on any fixed bottom bar.
- Inputs need `font-size: 16px` or larger, otherwise Safari auto-zooms on focus.
- Tap targets ≥ 44×44px.
- Consider `-webkit-tap-highlight-color: transparent` on buttons.
- A `manifest.json` plus `apple-mobile-web-app-capable` makes the home-screen install feel closer to an app.

**RLS is the classic timeline-killer.** Get the policies right at the start. Debugging "why does my insert silently return zero rows" at midnight is miserable — that symptom is almost always a failing RLS policy.

---

## 10. Two-day plan

**Day 1 AM** — Scaffold, deploy empty app to Vercel, create Supabase project, enable anonymous auth, apply schema, get `ensureSession()` working end to end.
**Day 1 PM** — Feed screen, post detail screen, create-post screen.
**Day 2 AM** — Like button (optimistic), replies with one-level nesting.
**Day 2 PM** — Profile edit, mobile polish (safe areas, keyboard, tap targets), final deploy, test on a real iPhone, add the account-fragility banner.

---

## 11. What to ask the new Claude for next

Assuming the schema has been applied, the natural next request is:

> "Here's my project handoff doc. The schema is applied and my Vite app is deployed. Write the feed screen and post detail screen."

Still open / undecided:
- Styling approach (plain CSS vs Tailwind)
- Whether to add the optional email-upgrade path for account persistence
- Whether a PWA manifest is worth the time