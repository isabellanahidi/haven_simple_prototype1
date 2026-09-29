-- ============================================================
-- 2026-09-29 — Author-deletable posts and replies, as tombstones
--
-- STATUS: NOT YET APPLIED. Paste into the Supabase SQL Editor and run.
--
-- Contains DDL and READ-ONLY verification queries only. NO `rollback`
-- anywhere, and none may be added: the SQL Editor runs a whole paste as
-- ONE transaction, so a rollback at the bottom silently discards the DDL
-- above it while the verification queries in the same run still report
-- success. That is finding 4f. Probes belong in supabase/probes/.
--
-- Safe to re-run: every statement is if-not-exists / drop-if-exists /
-- or-replace.
--
-- ------------------------------------------------------------
-- WHAT THIS IS
--
-- A delete that keeps the row. `deleted_at` on posts and comments; the
-- content itself is ERASED by a trigger, and the row stays so a thread
-- keeps its shape and the replies under a removed message stay readable.
--
-- THE ERASURE IS THE POINT, AND IT IS WHY THIS IS NOT JUST A FLAG. A
-- column the client merely agrees not to render is not a delete: anyone
-- holding the anon key can read the row straight off PostgREST. So the
-- BEFORE UPDATE trigger blanks title and body itself, in the same
-- statement, whatever the client sent. A client that sets deleted_at and
-- tries to keep the text gets the text blanked anyway. The CHECK
-- constraints then hold the same line independently: a row with
-- deleted_at set CANNOT hold content, trigger or no trigger.
--
-- IRREVERSIBLE, and enforced rather than promised. The trigger rejects
-- every update to a row that is already deleted, which covers clearing
-- deleted_at back to null. There is no undelete path and none may be
-- added without deciding, separately, what "restore" means for content
-- that no longer exists.
--
-- ------------------------------------------------------------
-- DIRECT UPDATE, NOT A SECURITY-DEFINER RPC. One door, deliberately.
--
-- An RPC was considered and rejected. `security definer` BYPASSES RLS, so
-- an RPC would have to re-implement "only the author may delete" by hand
-- inside the function — replacing a policy that is already correct, and
-- already verified against the live project (finding 4d, row two: a
-- non-author update returns 200 with an empty array), with hand-written
-- logic that is not. Section 7 uses `security definer` in exactly one
-- situation, the counter triggers, and for exactly one reason: RLS
-- genuinely blocks a write the trigger has to make. Nothing here is
-- blocked — an author updating their own row is what posts_update and
-- comments_update already permit.
--
-- The trigger below does the erasing no matter which path writes, so an
-- RPC would add a second door into the same room without making the room
-- safer. Direct UPDATE also keeps finding 4a's row-count check natural:
-- `.update(...).select()` returns the rows it actually touched, and an
-- empty array is how the client learns RLS refused it.
--
-- ------------------------------------------------------------
-- WHAT THIS DOES *NOT* DO, stated so nobody assumes otherwise:
--
--   * It does not erase the AUTHOR. `author_id` still points at the
--     profile, so the "[deleted]" byline is a UI treatment, not a
--     guarantee — anyone reading the API can still see who wrote a
--     tombstoned row. Erasing it is a separate decision with real
--     consequences (author_id is NOT NULL, carries the cascade, and is
--     what posts_delete / comments_delete scope on). Worth taking on
--     purpose if it matters; see CLAUDE.md section 28.
--   * It does not touch the counters. posts.comment_count is maintained
--     by an INSERT/DELETE trigger, and a tombstone is an UPDATE, so a
--     deleted reply still counts — which is correct, because it still
--     renders and still occupies a slot in the thread.
--   * It adds no index. The feed queries gain `.is('deleted_at', null)`,
--     but narrowing posts_feed_idx's predicate to match would make it
--     unusable for any query that does not repeat the term — the same
--     trap the 2026-09-17 migration records for posts_topic_pcos_idx.
--     At a hard limit of 50 rows this is not worth the risk.
-- ============================================================


-- ============================================================
-- BLOCK 1 — the columns
-- ============================================================

-- Nullable, no default: NULL means "not deleted", which is every row that
-- exists today and every row anyone writes from now on. The value is
-- always written by the trigger below, never by the client, so it cannot
-- be forged into the past or the future — the same rule comments.depth
-- follows (section 20).
alter table public.posts
  add column if not exists deleted_at timestamptz;

alter table public.comments
  add column if not exists deleted_at timestamptz;


-- ============================================================
-- BLOCK 2 — the length constraints, widened to admit a tombstone
--
-- Emptied content has to be legal, but ONLY for a deleted row. Each
-- constraint below therefore says both halves: real content keeps exactly
-- the limits it had, and an empty value is legal only alongside a
-- deleted_at. That second half is what makes the constraint an
-- independent guarantee rather than a formality — it is not possible to
-- store a tombstone that still has its text, even if the trigger were
-- dropped tomorrow.
--
-- title and body stay NOT NULL. Empty string, not NULL, so nothing
-- downstream has to learn a new nullable case.
--
-- Dropped before being added because Postgres has no
-- `add constraint if not exists`, and this file has to stay re-runnable.
-- ============================================================

-- Was: check (char_length(title) between 3 and 200)
alter table public.posts
  drop constraint if exists title_len;

alter table public.posts
  add constraint title_len check (
    (deleted_at is null and char_length(title) between 3 and 200)
    or (deleted_at is not null and title = '')
  );

-- Was: check (char_length(body) <= 5000)
-- '' already passed that, so this adds only the tombstone half.
alter table public.posts
  drop constraint if exists body_len;

alter table public.posts
  add constraint body_len check (
    char_length(body) <= 5000
    and (deleted_at is null or body = '')
  );

-- Was: check (char_length(body) between 1 and 2000)
alter table public.comments
  drop constraint if exists comment_body_len;

alter table public.comments
  add constraint comment_body_len check (
    (deleted_at is null and char_length(body) between 1 and 2000)
    or (deleted_at is not null and body = '')
  );


-- ============================================================
-- BLOCK 3 — the guards
--
-- BEFORE UPDATE, so the erasure happens inside the caller's own statement
-- and there is no window in which a deleted row still holds its text.
--
-- NOT `security definer`. These functions only rewrite NEW; they need no
-- rights the caller does not already have, and RLS has already decided
-- whether the caller may touch the row at all by the time they run.
-- ============================================================

create or replace function public.enforce_post_delete()
returns trigger
language plpgsql
as $$
begin
  -- A tombstone is final. This single rule is what makes the delete
  -- irreversible: there is no update it will accept, so there is no
  -- update that could restore content, change the title, or re-tag it.
  if old.deleted_at is not null then
    raise exception 'This post has been deleted and can no longer be changed.';
  end if;

  -- Defence in depth, and unreachable while the rule above stands: it is
  -- written out so that relaxing that rule cannot quietly re-open an
  -- undelete path. Stated separately because "already deleted rows are
  -- frozen" and "deleted_at never goes back to null" are two different
  -- promises, and only one of them is obvious from the other.
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'A deleted post cannot be restored.';
  end if;

  -- Closes the gap recorded in CLAUDE.md section 26: posts_update is
  -- row-scoped and names no columns, so it has always let an author
  -- re-tag their own post straight over PostgREST. RLS gates rows, not
  -- columns, so a policy could never have closed this -- a trigger is the
  -- fix. The topic is set at insert and is immutable from then on.
  if new.topic is distinct from old.topic then
    raise exception 'A post''s topic cannot be changed after it is created.';
  end if;

  if new.deleted_at is not null then
    -- The server's clock, not the client's. What the client sent is
    -- discarded; it only has to be non-null to say "delete this".
    new.deleted_at := now();
    -- THE ERASURE. Not a flag the reader is trusted to honour.
    new.title := '';
    new.body := '';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_delete_guard on public.posts;

create trigger posts_delete_guard
  before update on public.posts
  for each row execute function public.enforce_post_delete();


create or replace function public.enforce_comment_delete()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is not null then
    raise exception 'This reply has been deleted and can no longer be changed.';
  end if;

  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'A deleted reply cannot be restored.';
  end if;

  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := '';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_delete_guard on public.comments;

-- TRIGGER NAME ORDER MATTERS HERE, AND IT IS NOT AN ACCIDENT. Two BEFORE
-- UPDATE triggers now sit on comments, and Postgres fires same-timing
-- triggers in alphabetical order by name: comments_delete_guard sorts
-- before comments_depth_check ('del' < 'dep'), so an update to an already
-- deleted row is rejected before the depth trigger looks anything up.
-- Renaming either one can change which runs first.
--
-- The two compose cleanly on a live row: enforce_comment_depth re-reads
-- the parent on UPDATE, and because tombstones keep their rows, the
-- parent is always still there to read -- deleting a comment does not
-- orphan its children.
create trigger comments_delete_guard
  before update on public.comments
  for each row execute function public.enforce_comment_delete();


-- ============================================================
-- BLOCK 4 — the update policy on comments
--
-- Section 7 declares comments_update as already existing, with the same
-- shape as posts_update. This block is therefore expected to be a no-op;
-- it is here so that the migration is correct whether or not the live
-- database agrees with the document, since deleting a comment is an
-- UPDATE and silently having no policy would mean every delete returns
-- 200 with an empty array and no error (finding 4a) -- the exact failure
-- that looks like nothing happening.
--
-- Postgres has no `create policy if not exists`, hence the DO block.
-- Nothing is dropped: if the policy is already there it is left exactly
-- as it is rather than recreated, so a hand-tightened version survives.
-- BLOCK 6 prints what actually exists.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'comments'
      and policyname = 'comments_update'
  ) then
    create policy comments_update on public.comments
      for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
  end if;
end
$$;


-- ============================================================
-- BLOCK 5 — nothing here
--
-- Deliberately empty, as a place to say what was considered and left
-- alone: no index change (see the header), no counter change (a tombstone
-- still renders, so it should still count), no change to any select
-- policy. posts_select is `hidden = false or author_id = auth.uid()`,
-- which a deleted row still passes -- that is what keeps /p/:id loading
-- for a deleted post and what keeps replies under a deleted comment
-- readable. Excluding deleted posts from the two feeds is a client-side
-- filter, which is only acceptable BECAUSE the content is gone from the
-- row: there is nothing left for a filter to fail to hide.
-- ============================================================


-- ============================================================
-- BLOCK 6 — verification. READ-ONLY.
--
-- Running this in the same paste as the blocks above shows the change
-- PENDING, not committed. To know it committed, run this block again on
-- its own. See finding 4f.
-- ============================================================

-- Expect two rows: posts.deleted_at and comments.deleted_at, both
-- timestamptz, both nullable, neither with a default.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('posts', 'comments')
  and column_name = 'deleted_at'
order by table_name;

-- Expect three rows, each naming deleted_at in its definition.
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.posts'::regclass, 'public.comments'::regclass)
  and conname in ('title_len', 'body_len', 'comment_body_len')
order by table_name, conname;

-- Expect two rows, both BEFORE UPDATE ... FOR EACH ROW.
select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where t.tgname in ('posts_delete_guard', 'comments_delete_guard')
order by c.relname;

-- Expect comments_delete_guard to sort BEFORE comments_depth_check, which
-- is the order they will fire in. Two rows.
select tgname
from pg_trigger
where tgrelid = 'public.comments'::regclass
  and not tgisinternal
  and tgtype & 4 = 4          -- BEFORE
  and tgtype & 16 = 16        -- UPDATE
order by tgname;

-- Expect comments_update to be present, author-scoped on both sides.
-- posts_update is listed beside it as the shape it mirrors.
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('posts', 'comments')
  and cmd = 'UPDATE'
order by tablename;

-- Expect zero of each until someone deletes something. If either count is
-- non-zero, the second column must be zero too: no tombstone may still be
-- holding content.
select 'posts' as table_name,
       count(*) filter (where deleted_at is not null) as deleted_rows,
       count(*) filter (where deleted_at is not null and (title <> '' or body <> '')) as leaking
from public.posts
union all
select 'comments',
       count(*) filter (where deleted_at is not null),
       count(*) filter (where deleted_at is not null and body <> '')
from public.comments;


-- ============================================================
-- AFTERWARDS — RUN THIS ON ITS OWN, IN A SEPARATE SUBMISSION:
--
--     notify pgrst, 'reload schema';
--
-- PostgREST caches the schema it exposes. Until it reloads, selecting or
-- filtering on deleted_at comes back as `column posts.deleted_at does not
-- exist` even though the column is committed -- which reads exactly like
-- the migration having failed. It is its own submission because this file
-- is one transaction: a NOTIFY inside it would not be delivered until
-- that transaction commits, and running it here would make the ordering
-- depend on something the SQL Editor does not show you.
-- ============================================================
