# Project Handoff: Anonymous Q&A App (Reddit-like prototype)

> **Purpose of this document:** This is a complete context transfer for a new Claude conversation. Everything needed to continue the build is here, including the full database schema, so no prior files or chat history are required. Decisions marked **LOCKED** have already been made deliberately — please don't relitigate them unless the user asks.
>
> **Save this file into the repo root as `CLAUDE.md`.** Claude Code reads it automatically at the start of every session, so all context below travels with the project instead of being re-pasted.
>
> *Last updated: Day 1, Aug 27. Revision 3.*

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
| Routing | `react-router-dom` | v7 installed. |
| Styling | **Plain CSS — one global stylesheet with CSS variables.** | Only four screens, so Tailwind's consistency payoff never arrives. Every mobile-Safari fix in section 9 (`100dvh`, safe-area insets, 16px inputs) is raw CSS regardless, and Tailwind adds build-config surface that can break the Vercel deploy under time pressure. |
| Linting | **ESLint — whatever the Vite template scaffolded.** | Already wired with typescript-eslint, react-hooks, react-refresh. Zero setup. Oxlint is genuinely faster but that only matters at thousands of files; this app is ~15. The rule that actually earns its keep here is `react-hooks/exhaustive-deps`, which the template gives for free. |
| Build tool | **Claude Code**, with this doc as `CLAUDE.md` | |

### Alternatives considered and rejected
- **Native iOS / Swift** — App Store review kills it.
- **React Native + Expo** — real-app feel, but costs several hours on build config, provisioning profiles, and TestFlight distribution. Not worth it when web is acceptable.
- **Next.js** — deploys just as easily, but the App Router's server/client component split is a source of confusion and bugs under time pressure. A plain SPA has fewer ways to go wrong.
- **Firebase** — viable, but Supabase's Postgres + RLS gives stronger guarantees with less code, and its anonymous auth is a cleaner fit.
- **Writing a custom backend** — never on the table at this timeline.
- **Tailwind** — see styling row above.
- **Oxlint** — see linting row above. Fine to revisit *after* the deadline; it supports incremental adoption alongside ESLint.

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

- [x] Vite project scaffolded (`react-ts` template)
- [x] Pushed to GitHub → imported to Vercel → empty app confirmed loading on a real iPhone
- [x] Supabase project created
- [x] Anonymous sign-ins enabled in the Supabase dashboard
- [x] Dependencies installed — `@supabase/supabase-js` ^2.112.4, `react-router-dom` ^7.18.2
- [x] `vercel.json` added — SPA rewrite, `/(.*)` → `/index.html`
- [x] `src/lib/supabase.ts` — client + `ensureSession()` (promise-cached, see section 6)
- [x] `src/App.tsx` — temporary diagnostic screen (see section 6a)
- [x] `.env.local` created and **values filled in**; gitignored via `*.local`
- [x] **Schema applied** — all of section 7 run in the SQL Editor
- [x] **`handle_new_user` trigger confirmed firing** — 9 anonymous users, each with a matching `profiles` row and a correct `anon-XXXX` display name (verified with the join query in 7a)
- [x] **Enumerate RLS + triggers explicitly** — run both queries in 7a; the join query proves the profile trigger works but does not confirm RLS is on or that the other three triggers exist
- [x] **Env vars added to Vercel project settings** — status unconfirmed; assume not done
- [x] Auth bootstrap verified end to end on a real iPhone (verified on desktop only)
- [x] Clean out the 9 test users before real testers arrive (optional, see 6c)
- [x] Feed screen
- [x] Post detail screen
- [ ] Create post screen
- [ ] Like button
- [ ] Replies
- [ ] Profile edit screen
- [ ] Mobile polish pass
- [ ] Deployed and tested on device

### Environment specifics
- GitHub repo: `isabellanahidi/haven_simple_prototype1`, branch `main`
- Vercel project: `haven-simple-prototype1`, Hobby tier, Vite preset auto-detected, root directory `./`
- Saved SQL Editor queries, named: `01_initial_schema`, `verify_users_and_profiles`, `verify_rls_and_triggers`, `backfill_orphaned_profiles`

### Immediate next task

**Feed (`/`) and post detail (`/p/:id`) are built.** Both compile, lint clean, and their queries are verified against the live Supabase project. Next up is section 11's **create-post prompt (`/new`)**.

**Why `/new` is genuinely the blocker, not just the next item.** There are zero rows in `posts`, and nothing in the app can create one — so the feed currently renders its empty state and the detail screen is unreachable by tapping. Neither has been seen with real data. `/new` is what makes them verifiable, so build it before doing any visual polish on the two screens that exist.

Two smaller notes carried into the next session:

- **The like heart on the feed and detail is display-only right now.** The current user's likes are fetched into a `Set` (separately from the feed query, per section 8) and drive the filled/empty state, but tapping does nothing yet. Section 11's like-button prompt wires up the toggle.
- **No nav to `/new` or `/me` exists yet.** The header links to `/` only — deliberately, since linking to routes that aren't built yet just produces 404s. Add the nav alongside those screens.

---

## 5. Setup steps (in order)

Steps 1–5 are **done**. Recorded for context.

**Step 1 — Scaffold and deploy an empty app first.** ✅
```bash
npm create vite@latest qna -- --template react-ts
cd qna && npm i @supabase/supabase-js react-router-dom
git init && git add -A && git commit -m "init"
```
Push to GitHub → import into Vercel → confirm the live URL loads on the user's phone.

**Step 2 — Create the Supabase project.** ✅ Then: Dashboard → Authentication → Providers → toggle **Anonymous sign-ins** to ON. It is **off by default** and this is an easy thing to miss; anonymous auth silently fails without it.

**Step 3 — Apply the schema.** ✅ Section 7 pasted into Dashboard → SQL Editor → Run.

**Step 4 — Environment variables.** Local copy ✅; Vercel copy ⬅️ *unconfirmed.*
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
Both values come from Supabase → Settings → API Keys (**Project URL** and the **anon / publishable** key). The anon key is safe to ship to the client — that's what RLS is for. The **service role key must never appear in frontend code**, and must never be given a `VITE_` prefix, because Vite would inline it into a public bundle.

**Step 5 — Auth bootstrap** (section 6). ✅ Written and verified on desktop.

**Step 6 — Build screens in this order, deploying after each:** feed → post detail → create post → like → reply → profile edit.

---

## 6. Auth approach

Every visitor gets a real row in `auth.users` and a matching `profiles` row, created automatically by a database trigger. There is no signup screen, no email, no password. Call this once at app startup:

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

let sessionPromise: Promise<Session | null> | null = null;

export function ensureSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return session;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) { sessionPromise = null; throw error; }
      return data.session;
    })();
  }
  return sessionPromise;
}
```

Default display names are generated by the trigger as `anon-` plus the first four characters of the user's UUID. Users can change this on the profile screen.

**Why the promise is cached at module level.** The naive version calls `getSession()` then `signInAnonymously()`. If two callers race — React StrictMode double-invoking an effect in development is the usual cause — both see no session and both create a user. Only one token lands in localStorage; the other user is orphaned on creation. Caching the in-flight promise means concurrent callers share one request. Resetting to `null` on error keeps failures retryable. The cache is per page load, which is correct: a refresh re-reads the token from localStorage and creates nothing new.

Evidence this was real: among the 9 test users, three pairs were created within microseconds of each other (`e13441b3`/`be4141aa` identical to the microsecond; `8f2927ea`/`17f9f90c` 27µs apart; `c267b69e`/`5dec26d8` 80ms apart). **Caveat — the repo copy of `supabase.ts` already contains the caching, so those pairs may predate the fix rather than survive it. Worth confirming the file matches the code above before assuming it's handled.**

### 6a. Diagnostic screen — RETIRED

The throwaway diagnostic `App.tsx` was deleted when the feed landed. `App.tsx` is now the real app shell (router + header + `<SessionGate>`).

**The env-var guard it provided was kept, moved up into `src/main.tsx`.** That guard is still worth having, and the reasoning behind it hasn't changed: `createClient()` throws on a blank URL, and because `App` imports `supabase.ts` transitively, a plain top-level import would throw during page load and produce a white screen — the worst possible failure mode on a phone, where there is no console to check. So `main.tsx` reads both `import.meta.env` values *before* importing anything Supabase-touching, and:

- if either is missing, renders an on-page "Not configured" panel listing present/MISSING per var plus the fix for local vs. Vercel;
- otherwise `import('./App.tsx')` dynamically, which also keeps Supabase in its own build chunk.

Because the import is lazy, `App.tsx` and every screen below it can import `supabase.ts` at module top level normally. **Known reading:** both vars `MISSING` means the build had no env vars at all — locally, `.env.local` is blank or the dev server wasn't restarted; on Vercel, the deployment predates the variables being saved.

Session bootstrap moved into `src/components/SessionGate.tsx`, which calls `ensureSession()` once and blocks rendering until there's a user id, surfacing failures as an on-page error. Screens read the id via `useUserId()` (`src/lib/session.ts`), so **no screen ever has to handle a null user.**

### 6b. Template cleanup — DONE

- `src/index.css` deleted (it set `#root { text-align: center }` and a border, which would have fought the real layout). `src/main.tsx` now imports `src/styles.css`, the single global stylesheet.
- `src/App.css` deleted — was unimported and dead.
- `src/assets/react.svg` deleted — unused template leftover. `src/assets/hero.png` was left alone; it isn't template scaffolding.

### 6c. Test-identity hygiene (worked out this session)

Three separate concerns that are easy to conflate. Only the first is a consequence of deleting users.

**Deleting test users is optional housekeeping, not a fix.** The 9 existing rows are your own diagnostic loads across two days. Reasons to clear them: real testers become countable (anonymous users have no email or name, so you can't distinguish them after the fact), and every anonymous user counts toward Supabase MAU.

```sql
delete from auth.users where is_anonymous = true;
```

Cascade removes the profile rows. **Only safe while every anonymous user is yours** — after real testers exist, this deletes their accounts and all their posts. Scope by time instead:

```sql
delete from auth.users
where is_anonymous = true
  and created_at < '2026-08-28';
```

**After deleting, clear site data in any browser you tested in.** `getSession()` reads the JWT from localStorage without asking the server whether that user still exists, so the app looks signed in while pointing at a deleted user, and the first post insert fails on the foreign key with no obvious cause. Self-heals within the hour when the token expires and the refresh is rejected, but the diagnostic confusion in the meantime is the real cost — it looks like a broken trigger or a bad schema.

**Which browser to use when:**

- **Normal browser for day-to-day development.** You keep one stable identity and accumulate your own test posts, replies, and likes. This is what you want during screen-building.
- **Private tab when you specifically want to be a new visitor** — testing the sign-up path, or checking what an empty feed looks like. Fresh localStorage, discarded on close. Close the tab fully between tests or you'll reuse the same session within it.
- **Private tab on iOS when verifying a fresh deploy**, because iOS Safari otherwise serves a stale bundle.

Do not develop in private tabs full-time. You'd get a new identity on every close and never build up test data.

**How to clear site data:**
- Chrome/Edge: DevTools (⌘⌥I) → Application → Storage → Clear site data
- Safari macOS: Settings (⌘,) → Privacy → Manage Website Data → search the domain → Remove. (Develop → Empty Caches does *not* clear localStorage.)
- Safari iOS: Settings app → Safari → Advanced → Website Data → swipe left on the entry → Delete

---

## 7. Database schema (full, authoritative)

Four tables: `profiles`, `posts`, `comments`, `likes`. **Applied.** Kept here as the authoritative reference — a saved SQL Editor query is a scratchpad, not a migration record, so if the schema changes, change it here too or a fresh Claude Code session will build against a stale definition.

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
- `likes` uses a **composite primary key** `(user_id, post_id)`, so a double-tap physically cannot double-count. No debounce logic needed in the UI for that case.
- Cascading deletes are set up throughout: deleting a user removes their profile, posts, comments, and likes.

### 7a. Verification queries

Keep these saved in the SQL Editor. Useful now and any time something behaves oddly.

**Users and their profiles.** Every row must have a populated `profile_id`, and `display_name` must be `anon-` plus the first four chars of `id`.
```sql
select
  u.id,
  u.created_at    as user_created,
  u.is_anonymous,
  p.id            as profile_id,
  p.display_name,
  p.created_at    as profile_created
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

**RLS enabled?** Expect four rows, all `true`. If any is `false`, every policy on that table is inert and there is no access control.
```sql
select relname, relrowsecurity
from pg_class
where relname in ('profiles','posts','comments','likes');
```

**All four triggers present?** Expect four rows.
```sql
select tgname from pg_trigger
where tgname in ('on_auth_user_created','comments_depth_check',
                 'likes_counter','comments_counter');
```

**Backfill orphaned profiles.** Safe to run when there are none — affects zero rows. Only needed if a user was created before the trigger existed.
```sql
insert into public.profiles (id, display_name)
select u.id, 'anon-' || substr(u.id::text, 1, 4)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
```

**Ordering trap worth understanding.** The trigger only runs for users created after it exists. A user created before the schema was applied has no profile and never will — that's an orphan, and the backfill above is the fix. The inverse case is different: if the trigger exists but *errors*, the insert rolls back in the same transaction and `signInAnonymously()` returns an error to the client. So "user row present, profile row absent" means the trigger wasn't there yet, not that it's broken.

**Teardown**, if the schema ever needs re-applying from scratch. `create table` fails on re-run, so drop first:
```sql
drop table if exists public.likes, public.comments, public.posts, public.profiles cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.enforce_comment_depth cascade;
drop function if exists public.sync_like_count cascade;
drop function if exists public.sync_comment_count cascade;
```
The cascade on `handle_new_user` also removes its trigger on `auth.users`, which is otherwise easy to leave orphaned.

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
  .select('id, title, body, like_count, comment_count, created_at, profiles!posts_author_id_fkey(display_name, avatar_emoji)')
  .order('created_at', { ascending: false })
  .limit(50);
```

**The `!posts_author_id_fkey` is required, not decoration.** `posts` reaches `profiles` two different ways — many-to-one via `author_id`, and many-to-many via the `likes` join table. A bare `profiles(...)` is ambiguous, and PostgREST refuses to guess: it returns HTTP 300 with `PGRST201`, "Could not embed because more than one relationship was found". Naming the foreign key picks the author edge. Verified against the live project on Day 2. **Comments are unaffected** — `comments` reaches `profiles` only through `author_id`, so `profiles(display_name, avatar_emoji)` is unambiguous there and works as written. This trap will reappear on any future `posts → profiles` embed.

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

**Anonymous users count toward Supabase MAU** and accumulate in `auth.users` — one row per visitor, including bots. Worth periodically deleting old anonymous users with no posts. See 6c for the scoped delete.

**RLS is the classic timeline-killer.** Get the policies right at the start. Debugging "why does my insert silently return zero rows" at midnight is miserable — that symptom is almost always a failing RLS policy, and it has no error message to work from.

**A stale session token survives a user deletion.** `getSession()` doesn't check the server. See 6c — this is a self-inflicted-only condition, but it presents as a mysterious foreign-key failure.

**If `auth.users` has a row but `profiles` is empty**, the `handle_new_user` trigger didn't fire. Stop and fix it, because every post and comment insert will fail on the foreign key. See the ordering trap in 7a.

### Environment-variable mechanics (learned the hard way)

- **Vite reads env files only at boot.** Editing `.env.local` while `npm run dev` is running changes nothing. Restart the server.
- **`.env.local` must sit in the repo root**, next to `package.json` — not inside `src/`.
- No quotes, no spaces around `=`, no trailing semicolons in the file.
- **Only `VITE_`-prefixed vars reach client code.** This is deliberate on Vite's part; a var named `SUPABASE_URL` reads as `undefined` no matter where it's set.
- **Vercel needs its own copy** — it never reads `.env.local`, which is gitignored and never leaves the laptop. Vercel injects its dashboard values at build time, and Vite compiles them as literal strings into the shipped bundle.
- **Vercel deployments are immutable.** A build created before the variables were saved has `undefined` baked in permanently; reloading won't help. Redeploy (⋯ → Redeploy, build cache off).
- **The anon key ends up publicly readable in the bundle. That's fine and by design** — RLS is the actual access control. The gitignore is hygiene, not protection.

### Mobile Safari specifics
- Use `100dvh`, not `100vh` — `100vh` is wrong when the URL bar is showing.
- Respect the notch: `env(safe-area-inset-bottom)` on any fixed bottom bar.
- Inputs need `font-size: 16px` or larger, otherwise Safari auto-zooms on focus.
- Tap targets ≥ 44×44px.
- Consider `-webkit-tap-highlight-color: transparent` on buttons.
- A `manifest.json` plus `apple-mobile-web-app-capable` makes the home-screen install feel closer to an app.
- **iOS Safari caches aggressively.** When verifying a fresh deploy, use a Private tab or clear website data, otherwise you may be reading a stale bundle and misdiagnosing.
- **Deep links need the SPA rewrite.** `vercel.json` is in place; verify by loading `/p/test` directly and reloading. A 404 there means every shared post link is broken.

### Unresolved: LAN dev URL doesn't reach the iPhone

`npm run dev -- --host` prints a `192.168.x.x` Network URL. It works on the MacBook but the iPhone can't reach it. Not yet diagnosed. Most likely causes, in order: a VPN or iCloud Private Relay routing phone traffic off the local network; the two devices on different SSIDs (2.4 vs 5GHz, or a guest network with client isolation); macOS firewall dropping incoming connections to node.

**Current workaround:** test on the `.vercel.app` URL instead — commit, push, wait for Ready, reload on phone. Roughly a 90-second loop instead of instant HMR. Survivable, but worth another attempt at fixing the LAN path before the screen-building phase, where iteration speed actually matters.

---

## 10. Two-day plan

**Day 1 AM** — Scaffold, deploy empty app to Vercel, create Supabase project, enable anonymous auth, apply schema, get `ensureSession()` working end to end. ✅ *(Schema applied and trigger verified. Vercel env vars and on-device verification outstanding.)*
**Day 1 PM** — Feed screen, post detail screen, create-post screen.
**Day 2 AM** — Like button (optimistic), replies with one-level nesting.
**Day 2 PM** — Profile edit, mobile polish (safe areas, keyboard, tap targets), final deploy, test on a real iPhone, add the account-fragility banner.

---

## 11. Claude Code prompts for the remaining screens

One prompt per screen. Commit and push after each — deploy failures are trivial to find when they're one screen old. Ask Claude Code to tick the section 4 checkboxes as it goes, so a fresh session picks up accurately.

**Feed + post detail:**

> Read CLAUDE.md. Auth is verified working end to end. Build the feed (`/`) and post detail (`/p/:id`) screens per section 8, with react-router-dom. Use the exact feed query from section 8 — including fetching my own likes separately into a Set rather than embedding likes in the feed query. Also create a single global stylesheet with CSS variables for color and spacing, and apply the mobile-Safari baseline from section 9: 100dvh, 16px minimum on inputs, 44px minimum tap targets, transparent tap highlight. Plain CSS only, no Tailwind. Comments render as a flat two-pass group-by, never recursive. Handle loading and empty states. Also do the template cleanup in section 6b and retire the diagnostic App.tsx.

**Create post:**

> Build `/new` per section 8. Character counters that match the DB constraints exactly — title 3–200, body max 5000 — and disable submit when invalid. On success, redirect to the new post's detail page.

**Like button:**

> Add the like toggle on both the feed cards and post detail, using the insert/delete pattern from section 8. Optimistic UI: update the count and filled state immediately, roll back on error. The composite primary key means a double-tap can't double-count, so don't add debounce logic for that.

**Replies:**

> Add the reply composer to post detail. Top-level comments plus one level of replies only. Replying to a reply is rejected by a DB trigger — surface that error message rather than letting it fail silently. Optimistic insert.

**Profile:**

> Build `/me` per section 8 — edit display_name, bio, avatar_emoji, respecting the DB length constraints. List my own posts below. Add nav so I can reach this screen from the feed.

**Final polish:**

> Mobile polish pass: safe-area insets on any fixed bottom element, keyboard-avoidance on the composers, relative timestamps. Add a dismissible one-line banner warning that clearing Safari data will orphan the account, per section 9. Add a PWA manifest and apple-mobile-web-app-capable meta tags so Add to Home Screen feels app-like.

### Still open / undecided
- Whether to add the optional email-upgrade path for account persistence
- Whether a PWA manifest is worth the time (folded into the polish prompt above; drop it if the clock is tight)
- Why the LAN dev URL doesn't reach the iPhone
- ~~Whether the repo's `supabase.ts` already matched the promise-cached version~~ — **resolved.** `src/lib/supabase.ts` matches the section 6 listing exactly, caching included, and was not modified while building the feed. So the duplicate-user pairs among the 9 test users predate the fix; they aren't evidence of a surviving race.