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
1. ~~**Anonymous accounts** — users get an identity with no signup flow~~ → **superseded, Aug 31.** See section 13. Signup is **email OTP**, and it gates *posting*, not *reading*.
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
| Backend | **Supabase** (hosted Postgres + Auth + RLS) | ~~Native anonymous auth maps 1:1 onto the "anonymous accounts" requirement.~~ **Anonymous auth was removed Aug 31 (section 13).** Supabase is still the right call — email OTP is the same one-liner (`signInWithOtp`) and RLS is unchanged — but the *reason* in this cell no longer applies. |
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
- ~~Email/password auth~~ → **reinstated as email OTP, Aug 31.** No longer cut. See section 13.

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
- [x] **`handle_new_user` trigger confirmed firing** — verified Aug 29 against the then-current `anon-XXXX` format, which **no longer exists**; the trigger now generates two-word pseudonyms (section 7)
- [x] **Enumerate RLS + triggers explicitly** — run both queries in 7a; the join query proves the profile trigger works but does not confirm RLS is on or that the other three triggers exist
- [x] **Env vars added to Vercel project settings** — status unconfirmed; assume not done
- [x] Auth bootstrap verified end to end on a real iPhone (verified on desktop only)
- [x] Clean out the 9 test users before real testers arrive (optional, see 6c)
- [x] Feed screen
- [x] Post detail screen
- [x] Create post screen
- [x] Like button
- [x] Replies
- [x] Profile edit screen
- [ ] Mobile polish pass
- [ ] Deployed and tested on device

### Environment specifics
- GitHub repo: `isabellanahidi/haven_simple_prototype1`, branch `main`
- Vercel project: `haven-simple-prototype1`, Hobby tier, Vite preset auto-detected, root directory `./`
- Saved SQL Editor queries, named: `01_initial_schema`, `verify_users_and_profiles`, `verify_rls_and_triggers`, `backfill_orphaned_profiles`

### Immediate next task

**Every screen is built** — feed, post detail, create post, like toggle, replies, and profile edit. All compile and lint clean, and every write path is verified against the live project (4a–4d). The Home Screen install is shipped too (section 12). What remains is section 11's **final polish prompt**: safe-area insets, keyboard avoidance on the composers, and the account-fragility banner — plus supplying the three PNG icons listed in section 12.

Nav is complete: **Me** and **Ask** in the header, plus "Ask a question" buttons in the feed's and profile's empty states.

**Nothing has been seen on a real iPhone yet.** Every verification so far has been a build, a lint, or a query run against the live database — none of it says whether the app *feels* right on a phone. That is what the polish pass is for, and it is the last checkbox in this section that no amount of local checking can tick.

One structural note that will matter again: **the feed card is no longer a single `<Link>`.** A `<button>` nested inside an `<a>` is invalid HTML, and tapping the heart would navigate to the post. So the card is a `<li class="post-card">` holding a `<Link class="post-card-main">` for the tappable region, with the like button as a sibling below it. Any future interactive control on a feed card has to go outside `.post-card-main` the same way.

Nav so far: an **Ask** pill in the header routes to `/new`, and the feed's empty state has an "Ask a question" button. `/me` still has no entry point — add one with the profile screen.

### 4a. Write path verified against the live project (Day 2)

Run with a real anonymous JWT over PostgREST, not just type-checked. All four behaved correctly:

| Check | Result |
|---|---|
| Insert a valid post as its author | `201`, returns the new `id` — so the `.select('id').single()` redirect works |
| Feed query returns it with the author joined | `profiles` comes back as an **object**, not a one-element array |
| 2-char title | `400`, `23514`, `violates check constraint "title_len"` |
| Insert with someone else's `author_id` | `403`, `42501`, `violates row-level security policy` |

Two things worth carrying forward:

- **The author embed returns an object.** `src/lib/types.ts` normalizes both object and array shapes anyway, since PostgREST's to-one embed shape has varied across versions. Don't "simplify" that away on the strength of one observation.
- **A non-author delete returns `200` with an empty array, not a `403`.** This is the exact "silently returns zero rows" symptom section 9 warns about — RLS filters the rows out rather than raising. So *any* future update or delete must check the returned row count to know whether it did anything; a missing `error` proves nothing.

**Leftover test data to clear.** Verifying the write, like, reply, and profile paths necessarily created rows: eight anonymous users, plus one post titled `claude verification post`. One statement removes all of it — the cascade takes the post along with its author.

Note that one of them, `anon-6403`, **no longer has a name starting with `anon-`** — the profile verification renamed it, which is the whole point of that screen. It is matched by id instead.

```sql
delete from auth.users
where is_anonymous = true
  and id in (
    select id from public.profiles
    where display_name in ('anon-8d1e','anon-7be1','anon-8e3b','anon-14f0',
                           'anon-611c','anon-0a66','anon-d4c6')
       or id::text like '6403%'
  );
```

**Named explicitly rather than scoped by time on purpose.** A `created_at between ...` window is the tempting form, but you are creating anonymous users yourself every time you load the app, so a window written now can sweep up an identity created later — and taking an identity takes its posts with it. Your own test identity `anon-566b` (created 18:47:36Z, author of `Concerned about period`) sits outside this list and is untouched.

Per 6c, clear site data in any browser that was pointed at a deleted identity.

### 4b. Like toggle verified against the live project (Day 2)

The four paths the optimistic UI has to get right, run over PostgREST with a real JWT:

| Step | Result | `like_count` |
|---|---|---|
| Insert a like | `201` | 0 → 1 |
| Insert the same like again (double-tap) | `409`, `23505` `duplicate key ... "likes_pkey"` | **stays 1** |
| Delete with `.select()` | `200`, returns the removed row | 1 → 0 |
| Delete again, nothing to remove | `200`, returns `[]` | **stays 0** |

The last two rows are the whole reason the delete uses `.select()`. Both return `200` and neither sets `error`; the returned row count is the only thing that distinguishes them.

**What rollback means here is subtler than "undo the optimistic update."** The counter triggers fire only on an actual insert or delete, so on both anomalous paths the server's `like_count` never moved — but the *liked* state the user sees is already correct:

- **`23505` on insert** — the like row already existed, so the count already included it. Keep `liked = true`, undo the increment only.
- **Zero rows on delete** — there was no row to remove, so `liked = false` is the truth. Undo the decrement only.

Rolling both fields back in these cases would put the UI *further* from the server, not closer. Only a genuine transport or policy error gets the full rollback.

### 4c. Reply composer verified against the live project (Day 2)

| Step | Result |
|---|---|
| Insert a top-level comment, selecting the embedded author back | `201`, returns the row **with `profiles` populated** |
| Insert a depth-1 reply the same way | `201` |
| Reply to a reply | `400`, `P0001`, `Only one level of replies is allowed` |
| Empty body | `400`, `23514`, `violates check constraint "comment_body_len"` |

**The insert can return its own author embed**, which is what makes the optimistic swap clean: the placeholder row is replaced by a real row that already carries the server's id, timestamp, and byline. No refetch.

**The depth trigger's message is already written for a person.** `enforce_comment_depth()` raises it via `raise exception`, so PostgREST hands back `P0001` with the exact string, and it is displayed verbatim. The check-constraint wording is not — `new row for relation "comments" violates check constraint "comment_body_len"` gets translated. Both live in `src/lib/comments.ts`; **add a case there rather than inventing new copy at a call site.**

**The UI never offers a reply-to-a-reply.** Only top-level comments render a Reply button, so the trigger is a backstop rather than a routine path — but the error is surfaced, not swallowed, because a silent no-op after typing a reply is the worst outcome.

**Reply totals on the detail screen count the loaded list, not `posts.comment_count`.** An optimistic reply lands in the total immediately, and the number always matches what is on screen. The two can legitimately differ — RLS hides a `hidden` comment from the list while the counter trigger still counted it — and in that case the list is the honest number. The feed still reads `comment_count`, which is correct there: it is a cheap denormalized count and the feed refetches on mount.

### 4d. Profile edit verified against the live project (Day 2)

| Step | Result |
|---|---|
| Update own profile with `.select()` | `200`, returns the updated row |
| Update **someone else's** profile | `200`, returns `[]`, target unchanged |
| 31-character display name | `400`, `23514` `display_name_len` |
| **30 emoji** as a display name | `200` — accepted |
| 301-character bio | `400`, `23514` `bio_len` |

Row two is the silent case in its purest form: **`200`, no `error`, and nothing written.** RLS filtered the row out. `Profile.tsx` treats an empty array as a failure and says so, because the alternative is a screen that cheerfully reports "Saved" while the database ignored it.

Row four is why the counters use `charLength()` from `src/lib/text.ts` and not `.length`. Thirty 🎧 characters is exactly at the limit for `char_length()` and the database accepts it, while `.length` reads 60 — a counter built on `.length` would have blocked a legal name at fifteen. **Any future field with a `char_length` constraint needs the same helper.**

**`avatar_emoji` has no length constraint at all** — it is plain `text not null default '🙂'`. So it is edited through a fixed grid of choices rather than a text field, which keeps the column sane without pretending a counter could help: emoji are frequently several code points (flags are two, ZWJ sequences like 👩‍🚀 are three or more), so "one character" is not a rule counting can express. Whatever is already stored keeps a slot in the grid even if it isn't one of the presets, so a value set by hand in the SQL editor survives an edit.

**The profile screen is where a missing `profiles` row surfaces first.** If the `handle_new_user` trigger ever fails to fire, `/me` shows "Your profile row is missing" and points at 7a, rather than rendering an empty form that silently writes nothing.

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

**Step 2 — Create the Supabase project.** ✅ ~~Then toggle Anonymous sign-ins ON.~~ **No longer required — anonymous auth was removed Aug 31 (section 13).** The toggle can be switched back off; leaving it on just means the endpoint stays open for anyone holding the anon key. What email OTP needs instead is Authentication → Providers → **Email** enabled, and the Magic Link template altered to emit `{{ .Token }}` instead of `{{ .ConfirmationURL }}` (see section 13).

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

> **Rewritten Aug 31.** Anonymous auth is gone. The previous version of this
> section described `ensureSession()` and a module-level promise cache that
> called `signInAnonymously()` at startup; **that function no longer exists**
> and `src/lib/supabase.ts` now exports only the client. The race it guarded
> against cannot occur, because nothing creates a user implicitly any more.

**Reading needs no session. Writing does.** That split is the whole model.

`profiles` is `using (true)` and `posts` is `hidden = false or auth.uid() = author_id`, which passes on `hidden = false` when `auth.uid()` is null. So the anon role can read the feed, post detail, comments, and likes. **Verified against the live project on Aug 31** before any code was changed — posts, comments, likes, and profiles all returned rows both with the anon key as Bearer (exactly what supabase-js sends when signed out) and with no `Authorization` header at all.

The client pieces:

| File | Role |
|---|---|
| `src/lib/supabase.ts` | The client, and nothing else |
| `src/components/SessionProvider.tsx` | Reads the session once, subscribes to `onAuthStateChange`, **never gates children** |
| `src/lib/session.ts` | `useUserId(): string \| null` and `useSession(): { userId, loading }` |
| `src/components/RequireAuth.tsx` | Wraps `/new` and `/me`; redirects to `/signin` carrying the destination |
| `src/lib/authRedirect.ts` | `useSignInRedirect()` for in-place prompts on the like button and reply composer |

**`useUserId()` returning null is a normal state, not a bug.** It used to throw. Every consumer must handle null.

**Why `loading` exists separately from `userId`.** "Signed out" and "we haven't looked yet" are different, and conflating them makes `RequireAuth` bounce a signed-in user who deep-links straight to `/me` before `getSession()` resolves. `RequireAuth` waits on `loading` before redirecting.

**Signed-out affordances are shown, not hidden.** The like button renders with its real count and the reply composer renders in full; tapping either routes to `/signin` with the current location attached. Hiding them would misrepresent the post as having no way to engage.

**The `handle_new_user` trigger is unaffected and still needed.** It fires on insert into `auth.users` regardless of how the user got there, so an email-OTP signup still gets its `profiles` row automatically. **No schema change was needed for the auth migration itself.** The display name it generates was changed separately on Aug 31, from `anon-` plus four hex characters to a two-word pseudonym — see section 7.

### 6a. Diagnostic screen — RETIRED

The throwaway diagnostic `App.tsx` was deleted when the feed landed. `App.tsx` is now the real app shell (router + header + `<SessionProvider>`).

**The env-var guard it provided was kept, moved up into `src/main.tsx`.** That guard is still worth having, and the reasoning behind it hasn't changed: `createClient()` throws on a blank URL, and because `App` imports `supabase.ts` transitively, a plain top-level import would throw during page load and produce a white screen — the worst possible failure mode on a phone, where there is no console to check. So `main.tsx` reads both `import.meta.env` values *before* importing anything Supabase-touching, and:

- if either is missing, renders an on-page "Not configured" panel listing present/MISSING per var plus the fix for local vs. Vercel;
- otherwise `import('./App.tsx')` dynamically, which also keeps Supabase in its own build chunk.

Because the import is lazy, `App.tsx` and every screen below it can import `supabase.ts` at module top level normally. **Known reading:** both vars `MISSING` means the build had no env vars at all — locally, `.env.local` is blank or the dev server wasn't restarted; on Vercel, the deployment predates the variables being saved.

~~Session bootstrap moved into `SessionGate.tsx`...~~ **Superseded Aug 31.** `SessionGate` was deleted; `SessionProvider` replaces it and never blocks. Screens read `useUserId()`, which **can now be null** — see section 6.

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
-- Prereq: Authentication -> Providers -> Email = ON (section 13).
--         Anonymous sign-ins are no longer used.
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
  constraint bio_len check (char_length(bio) <= 300),
  -- Added Aug 31. handle_new_user's collision retry depends on this existing;
  -- without it the retry loop is dead code and duplicate names go unnoticed.
  constraint profiles_display_name_unique unique (display_name)
);

-- Auto-create a profile whenever an auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adjectives constant text[] := array[
    'alpine', 'amber', 'autumn', 'boreal', 'breezy', 'clear',
    'cloudless', 'coastal', 'cobalt', 'copper', 'crisp', 'dappled',
    'drizzly', 'early', 'eastern', 'evening', 'foggy', 'frosted',
    'gilded', 'glassy', 'golden', 'grassy', 'gravelly', 'hazy',
    'highland', 'indigo', 'inland', 'jade', 'leafy', 'linen',
    'lowland', 'lunar', 'marbled', 'misty', 'moonlit', 'morning',
    'northern', 'ochre', 'opal', 'overcast', 'paper', 'pebbled',
    'quartz', 'quiet', 'rainy', 'rocky', 'rustic', 'sandy',
    'shaded', 'silver', 'slate', 'snowy', 'solar', 'southern',
    'starlit', 'sunlit', 'twilight', 'umber', 'upland', 'velvet',
    'verdant', 'western', 'winding', 'windy', 'wintry', 'wooded'
  ];
  nouns constant text[] := array[
    'alder', 'arbor', 'ash', 'aspen', 'basin', 'beacon',
    'birch', 'bracken', 'bramble', 'branch', 'brook', 'canyon',
    'cedar', 'clover', 'cove', 'creek', 'dune', 'elm',
    'ember', 'fern', 'field', 'fjord', 'forest', 'glade',
    'glen', 'grove', 'harbor', 'heath', 'hedge', 'hill',
    'isle', 'juniper', 'lake', 'lantern', 'laurel', 'ledge',
    'marsh', 'meadow', 'mesa', 'moor', 'moss', 'oak',
    'orchard', 'pine', 'pond', 'prairie', 'quarry', 'reed',
    'reef', 'ridge', 'river', 'rowan', 'sedge', 'shore',
    'spruce', 'stone', 'stream', 'summit', 'thicket', 'thistle',
    'tide', 'timber', 'trail', 'valley', 'vine', 'willow'
  ];
  candidate text;
  id_hex    text := replace(new.id::text, '-', '');
  attempt   int;
begin
  -- Phase 1: five tries at a clean two-word name, no digits. Max 16 chars.
  for attempt in 1..5 loop
    candidate := adjectives[1 + floor(random() * 66)::int]
                 || nouns[1 + floor(random() * 66)::int];
    begin
      insert into public.profiles (id, display_name)
      values (new.id, candidate);
      return new;
    exception when unique_violation then
      -- Distinguish a name clash from a duplicate profile WITHOUT relying on
      -- the constraint's name. If a row already exists for this id then the
      -- primary key is what conflicted, which is a genuine fault and must
      -- surface. Otherwise it was display_name, so retry.
      if exists (select 1 from public.profiles where id = new.id) then
        raise;
      end if;
    end;
  end loop;

  -- Phase 2: five more with a random two-digit suffix. Max 18 chars.
  for attempt in 1..5 loop
    candidate := adjectives[1 + floor(random() * 66)::int]
                 || nouns[1 + floor(random() * 66)::int]
                 || lpad(floor(random() * 100)::int::text, 2, '0');
    begin
      insert into public.profiles (id, display_name)
      values (new.id, candidate);
      return new;
    exception when unique_violation then
      if exists (select 1 from public.profiles where id = new.id) then
        raise;
      end if;
    end;
  end loop;

  -- Terminal fallback, seeded from the user's own id. Max 28 chars.
  --
  -- This cannot collide between two users: the suffix is 12 hex characters
  -- (48 bits) taken from a UUID that is already unique, so two users would
  -- have to share a 12-character id prefix before the name could repeat.
  -- No exception handler here on purpose -- reaching this line and still
  -- failing would be a real fault, not a name collision.
  insert into public.profiles (id, display_name)
  values (new.id, adjectives[1 + floor(random() * 66)::int]
                 || nouns[1 + floor(random() * 66)::int]
                 || substr(id_hex, 1, 12));
  return new;
end;
$$;

**Wordlist exclusion standard.** This is a women's health app, so the wordlist is curated against a rule, not assembled by taste. Words are drawn only from **weather, landscape, plants, materials, and light**. A word is excluded if it could read as a remark about the person rather than a label:

| Excluded because | Words removed so far |
|---|---|
| Names or evokes a condition | `lichen` (lichen sclerosus, a vulvar condition discussed on these forums) |
| Describes skin, hair, or eye colour | `dewy`, `ivory`, `olive`, `wheaten`, `hazel`, `bronze`, `coral` |
| Reads as emptiness or infertility | `hollow`, `fallow` |
| Names a symptom | `faint` |
| Reads as a mood or temperament | `stony`, `glacial`, `distant`, `drifting`, `brisk`, `hidden` |
| Reads bleak | `chalky`, `flinty`, `tundra` |
| Refers to age | `elder`, `ancient` |

**Do not reintroduce any word in that table.** When adding words, keep both arrays at exactly 66, keep them alphabetical, and re-check: no duplicates within an array, no word in both, and no same-root cross pair (`mossy` + `moss` would yield `mossymoss`). The 1–30 `display_name_len` ceiling is set by the longest word in each array — currently `cloudless` (9) and `bracken` (7), giving 16 plain, 18 with the digit suffix, and 28 at the terminal fallback. A longer word than either raises all three.

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

**Users and their profiles.** Every row must have a populated `profile_id`. `display_name` is now a two-word lowercase pseudonym such as `quietfern` — **the old `anon-` + four-hex format is gone**, so a name matching that old pattern means the row predates Aug 31, not that things are working. Names are unique, so distinct names must equal row count.
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
select u.id, 'recovered' || substr(replace(u.id::text, '-', ''), 1, 12)
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

**~~Account fragility (the biggest one)~~ — largely solved by email OTP, Aug 31.** This was the top risk in the project for a reason: an anonymous identity lived only in localStorage, so clearing Safari data, switching browsers, or changing devices orphaned it and every post attached to it, with no way back. **An email address is a recovery path.** Losing local storage now costs a re-verification, not an identity. The one-line warning banner this section used to call for is no longer warranted and was never built — do not add it.

What remains is narrower and worth stating plainly: a user who loses access to the *email address* still loses the account, and OTP delivery now sits on the critical path for sign-in, so mail deliverability is a dependency the app did not previously have.

**Seven-day eviction: downgraded from data loss to friction.** iOS Safari still deletes localStorage after seven days without interaction, and that still ends the session. But the returning tester is now someone who signs in again and finds all their posts, not a stranger locked out of their own history. Section 12's Home Screen install is still worth having — it avoids the re-auth entirely — it is simply no longer load-bearing for data retention.

**UNVERIFIED, and now low-stakes — the Home Screen container may not inherit Safari's storage.** A Home Screen web app on iOS may get a storage container separate from Safari's. Under anonymous auth this was severe: "open in Safari → post → Add to Home Screen" would have issued a **fresh identity** in the installed app and orphaned the earlier post. Under email OTP the same sequence produces a sign-in prompt, and signing in restores the same account and the same posts.

Still worth confirming on device, because it changes what testers should be told. But it is no longer a data-loss path, and **it no longer blocks anything.**

**Abuse friction changed shape, it did not disappear.** Requiring an email before posting raises the cost of casual spam a long way above anonymous auth, but disposable-address services make it a speed bump rather than a wall. Rate limits on OTP sends matter now in a way they did not before — an open `signInWithOtp` endpoint is an email-sending endpoint pointed at addresses the sender chooses. Keep the SQL editor handy for flipping `hidden` or deleting rows.

**MAU accounting improved.** Under anonymous auth, `auth.users` grew by one row per *visitor*, bots included, and every one counted toward MAU. Under email OTP, only people who choose to sign up create a row, and readers cost nothing. The scoped-delete recipes in 6c still work for clearing test identities.


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
- A `manifest.json` plus `apple-mobile-web-app-capable` does far more than make the install *feel* app-like — it is what keeps sessions alive past seven days. See section 12.
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

**Home Screen install — DONE, and not part of polish.** See section 12. It was moved out of the prompt below because it is a data-retention mechanism, not a cosmetic one.

**Final polish:**

> Mobile polish pass: safe-area insets on any fixed bottom element, keyboard-avoidance on the composers, relative timestamps. Add a dismissible one-line banner warning that clearing Safari data will orphan the account, per section 9.

### Still open / undecided
- Whether to add the optional email-upgrade path for account persistence
- ~~Whether a PWA manifest is worth the time~~ — **resolved, and the framing was wrong.** It is not a nice-to-have; it is what keeps a returning tester's identity alive. See section 12.
- Why the LAN dev URL doesn't reach the iPhone
- ~~Whether the repo's `supabase.ts` already matched the promise-cached version~~ — **resolved.** `src/lib/supabase.ts` matches the section 6 listing exactly, caching included, and was not modified while building the feed. So the duplicate-user pairs among the 9 test users predate the fix; they aren't evidence of a surviving race.
- **UNVERIFIED, being checked on device:** whether a Home Screen web app gets a storage container separate from Safari's. Consequences in section 9. Do not write code against either answer yet.

---

## 12. Home Screen install (manifest + iOS meta tags)

**Status: shipped.** This is deliberately its own section rather than a line in the polish pass, because it is not polish.

### Why it was a data-retention feature — and what changed on Aug 31

**Read this whole subsection before acting on it; the conclusion moved.**

The original reasoning: iOS Safari evicts localStorage after **seven days without interaction**, the identity model rested entirely on a JWT in localStorage with no email and no recovery path, so a tester returning the next week was silently handed a brand-new user and lost every post they had written. Home Screen web apps keep their own use counter and are exempt, which made `apple-mobile-web-app-capable` the mechanism that made a multi-week test possible at all.

**That reasoning was sound, and it expired the moment anonymous auth did (section 13).** With email OTP the eviction still ends the session, but the returning tester signs in and finds everything intact. The install went from load-bearing to genuinely nice-to-have: it removes a re-authentication, not a data loss.

Nothing shipped here needs undoing — a standalone install is still the better experience, and the work is done. But **do not cite the seven-day argument as a reason to prioritise anything else**; it no longer carries that weight.

### What shipped

`public/manifest.json` (Vite serves `public/` at the site root, so it lands at `/manifest.json`):

| Field | Value | Why |
|---|---|---|
| `display` | `standalone` | No URL bar; this is what makes it a web app rather than a bookmark |
| `start_url` / `scope` | `/` | The icon always opens the feed; all in-app navigation stays inside the container |
| `theme_color` | `#ffffff` | Matches `--surface`, the header |
| `background_color` | `#f6f7f9` | Matches `--bg`, the launch screen |

In `index.html`: `<link rel="manifest">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (`default`, so content does not slide under the clock — the header already handles `env(safe-area-inset-top)` either way), `apple-mobile-web-app-title`, and `mobile-web-app-capable` as the non-prefixed standard. `viewport-fit=cover` was already there and is untouched.

### Icons — still outstanding, and cosmetic only

**Nothing icon-related is wired up, on purpose.** The repo has no PNG icon assets; `public/favicon.svg` and `public/icons.svg` are Vite template leftovers (a purple Vite bolt and a social-icon sprite), and **iOS ignores SVG for the home-screen icon** regardless.

To finish, drop into `public/`:

- `apple-touch-icon.png` — **180×180**, no transparency, no rounded corners (iOS masks it)
- `icon-192.png` — 192×192
- `icon-512.png` — 512×512

Then uncomment the `apple-touch-icon` link in `index.html` and add an `icons` array to the manifest. **iOS ignores the manifest's `icons` for the home-screen icon and reads `<link rel="apple-touch-icon">` instead**, so both are genuinely needed — the manifest entries serve Android and desktop installs.

Until then Add to Home Screen still works and standalone mode still works; iOS just uses a screenshot of the page as the icon. **The seven-day fix does not depend on the icons.**

### Standalone navigation audit

In standalone mode there is no back gesture and no URL bar, so every route must be leavable from within the page. Walked and confirmed:

| Route | Way out |
|---|---|
| `/` | Home. Header carries Me and Ask |
| `/p/:id` | "← Feed", on both the loaded and not-found branches |
| `/new` | "← Feed". On success it redirects to `/p/:id`, which has its own |
| `/me` | "← Feed" |
| `*` | "← Back to the feed" |

**The real guarantee is structural, not per-route:** the header lives in `App.tsx` *outside* both `<Routes>` and `<SessionGate>`, so it renders on every route and through every loading and error state — including the three `ErrorState` screens, which have no back link of their own. **Keep it outside `SessionGate`.** Moving it inside would strand a user on the auth-failure screen with no way to navigate.

One acknowledged gap: the env-var guard in `main.tsx` renders before `App` is imported, so it has no header. In standalone mode that screen is a dead end — but it only appears when the deployment has no Supabase credentials, when there is nowhere useful to navigate to anyway.

### Deployment note

`vercel.json` uses `rewrites`, which Vercel applies **after** the filesystem check, so `/manifest.json` is served as the real file rather than being swallowed by the SPA catch-all. This would not hold with the legacy `routes` key, which runs before the filesystem — if that rewrite is ever rewritten, re-check that `/manifest.json` still returns JSON and not `index.html`.

---

## 13. Architecture change — anonymous auth removed (Aug 31)

**Anonymous auth is gone.** Signup will be **email OTP**, and it gates **posting, not reading**.

### The shape of it

| | Before | After |
|---|---|---|
| Identity | `signInAnonymously()` at startup, one user per visitor | Email OTP, one user per person who chooses to sign up |
| Reading | Required a session (because one always existed) | **No session needed** |
| Writing | Any visitor | Requires a session |
| Recovery | None — localStorage was the account | The email address |

### Why reading works signed-out without touching the schema

The select policies already permitted the anon role. `profiles` is `using (true)`; `posts` is `hidden = false or auth.uid() = author_id`, and the left side passes when `auth.uid()` is null. **Verified against the live project before any code changed** — posts, comments, likes, and profiles all returned rows with the anon key as Bearer and with no `Authorization` header. No policy, table, or trigger was altered in this migration.

### What changed in the code

- **`src/lib/supabase.ts`** — `ensureSession()` and its module-level promise cache deleted. Exports the client only.
- **`SessionGate.tsx` deleted**, replaced by **`SessionProvider.tsx`**, which subscribes to `onAuthStateChange` and never gates children.
- **`useUserId()` returns `string | null`.** It used to throw on null. Null is now normal.
- **`RequireAuth`** wraps `/new` and `/me`, redirecting to `/signin` with `state.from` set.
- **Like button and reply composer stay visible when signed out** and route to `/signin` on tap. The composer renders in full with its textarea made inert in CSS, so a tap anywhere in it lands on the wrapper.
- **`/signin` is a stub.** It reads `location.state.from` and says where it would return you. Building it is the next task.
- No account-fragility banner was ever built, and it should not be — see section 9.

### Two traps found while doing it

**The Supabase client is untyped, so null user ids type-check.** `author_id: null` and `.eq('id', null)` both compile. The first fails as a not-null violation at the database; the second silently matches zero rows, which per section 4a is indistinguishable from an RLS refusal. `RequireAuth` makes both unreachable, but `CreatePost` and `Profile` carry explicit `if (!userId) return` guards anyway, because a type checker will not catch it if the routing is ever rearranged.

**`loading` has to be distinct from `userId === null`.** Redirecting on null alone bounces a signed-in user who deep-links to `/me` before `getSession()` resolves.

### Still to do

1. ~~**Build `/signin`**~~ — **done.** `signInWithOtp` → `verifyOtp`, returning to `location.state.from`. It now also carries an optional password path — see section 14.
2. **Dashboard**: Authentication → Providers → **Email** on. Alter the **Magic Link** template to emit `{{ .Token }}` instead of `{{ .ConfirmationURL }}` — the template body is what decides whether Supabase sends a link or a code. Both facts are from the Supabase docs (Email Templates; Passwordless email logins).
3. ~~**Sign-out affordance**~~ — **done.** It sits at the bottom of `/me`, under the password controls.
4. **Anonymous sign-ins can be toggled off** in the dashboard. **Still on** — confirmed against `/auth/v1/settings` on Sep 1 (`"anonymous_users": true`, `"email": true`).
5. **Existing anonymous users still exist in `auth.users`**, including the ones that own the current test posts. Decide whether to keep them readable or clear them; the scoped deletes in 6c still apply.
6. ~~The `handle_new_user` default display name is still `anon-XXXX`.~~ **Done Aug 31** — now a two-word pseudonym, with a unique constraint and collision retry. See section 7.

---

## 14. Password as an optional second login method (Sep 1)

**OTP is still the only signup path and the only recovery path.** A password is
a convenience laid on top of it — never a replacement, and never the way back
in.

### Why there is no reset flow, and must not be one

A password-reset email is a **link**. Links open in Safari. Safari is
potentially a different storage container from the Home Screen app (section 9,
still unverified on device), so a reset completed in Safari can land a session
in the wrong container and strand the person who was trying to get back in.

So: **"forgot password" is the existing code path.** Sign in with an emailed
code, land on `/me`, set a new one. Nothing to build, nothing to explain, and
one fewer email template to get right. **Do not add `resetPasswordForEmail`.**

The one place this shows through is `reauthentication_needed`, which only
appears if "Secure password change" is switched on in the dashboard *and* the
session is over 24 hours old. `setPasswordErrorMessage` answers it by pointing
at the same code path rather than by calling `reauthenticate()`.

### The shape of it

| Where | What |
|---|---|
| `/signin` | One form, email + optional password. **"Email me a code" is the primary button**; "Sign in with password" is secondary and only enables once a password is typed. |
| After `verifyOtp` | If the account has no password, an optional, skippable "Add a password?" step before the redirect. |
| `/me` | A "Create a password" / "Change password" control in an account section above sign out. |

Both password-setting call sites are the **same component**,
`src/components/SetPasswordForm.tsx`, so there is exactly one `updateUser` call
in the app. Neither is a reset: both run on a live session.

### `has_password` in user metadata, and why

**Supabase gives the client no way to ask whether a password exists.** A
password-less OTP account and a password account carry the same `email`
identity, and `signInWithPassword` returns the same `invalid_credentials` for a
wrong password, a nonexistent account, and an account with no password —
[documented deliberately](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
so a signed-out stranger can't probe which.

So we record it ourselves. Every password write is a **single call**:

```ts
await supabase.auth.updateUser({ password, data: { has_password: true } });
```

**One call, not two, on purpose.** Two calls could leave the password set and
the flag unset, which the client would then read as "no password" forever.

`hasPassword()` in `src/lib/password.ts` reads it back off the session user, and
`SessionProvider` republishes it — `onAuthStateChange` fires `USER_UPDATED`, so
the `/me` button relabels itself the moment a password is stored. **It is a
hint, not a security boundary.** User metadata is user-writable and nothing here
grants access; a forged value only puts the wrong label on a button.

Because we can't distinguish the three cases, the wrong-password copy covers all
three and points at the path that works in every one:

> Wrong password — or this account may not have one yet. Email me a code instead.

### Two things that shaped the code

**The `/signin` redirect fires only for someone who *arrived* signed in — not
merely because a session exists.** The create-password step renders *after* a
successful `verifyOtp`, so a session is live while it is on screen. A guard
that watched for a session would redirect that step away the instant the
sign-in preceding it succeeded, and `onAuthStateChange` can publish the new
session before the handler that chose the step has run — an ordering race, not
a hypothetical. The `selfInitiated` ref is what separates the two cases, and it
is set *before* the sign-in call rather than after it resolves, so it is
already true by the time any effect could observe the session. It is read in an
effect, never during render (`react-hooks/refs` rejects the render-time read,
correctly — a ref is not a render input).

**Password length is checked with `charLength()`, not `.length`** — the same
`src/lib/text.ts` helper the profile counters use, and for a related reason.
Our floor is 8; Supabase's default minimum is 6 and GoTrue counts bytes. A code
point is never fewer bytes than one, so anything clearing 8 code points here
clears 6 bytes there. A stricter project setting surfaces as `weak_password`,
whose message names the reason and is shown verbatim.

### Autofill

`autoComplete="current-password"` on `/signin`, `"new-password"` on both
create and change. The sign-in email and password sit in **one `<form>` and
adjacent to each other**, which is what lets iOS fill both from a single
keychain tap. Enter inside the password field is intercepted so it signs in
rather than triggering the form's default of mailing a code.

### Verified against the live project (Sep 1), without sending any email

| Check | Result |
|---|---|
| `/auth/v1/settings` | `"email": true` — the provider is on |
| `signInWithPassword`, unknown email | `400`, `invalid_credentials` — the exact code the copy branches on |
| `PUT /auth/v1/user` with no Bearer token | `401`, `no_authorization` — confirms this is a live-session call, not a reset |
| `data: {...}` update | Lands in `user_metadata`; `has_password: true` reads back as `hasPassword()` expects |
| A second `data` update | **Merges**, it does not replace — an unrelated pre-seeded key survived |

**Still unverified, and it needs a real inbox:** the `password` half of the
combined call against an email account, and therefore the end-to-end
create → sign-in-with-password loop. The probe above used a throwaway anonymous
session, and GoTrue refuses a password on an anonymous user outright —
`422 validation_failed`, *"Updating password of an anonymous user without an
email or phone is not allowed"*. That refusal is about the anonymous account,
not about the call shape, which matches the installed `UserAttributes` type
(`password` and `data` are siblings on one flat object) and the published docs.

That probe left **one anonymous user, `8da1f097-…`, in `auth.users`**. It owns
nothing. Clear it with:

```sql
delete from auth.users where id = '8da1f097-ef7a-43ce-9b9a-e088606bfd75';
```
