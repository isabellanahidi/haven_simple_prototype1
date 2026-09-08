-- ============================================================
-- BLOCK 1 — Nesting: store depth, raise the ceiling to 100
-- Run top to bottom in one paste. Order matters (see 1c).
-- ============================================================

-- 1a. depth 0 = top-level, 1 = reply, and so on.
alter table public.comments
  add column if not exists depth int not null default 0;

-- 1b. The trigger is kept, not dropped. It stops being a UX rule (one level)
--     and becomes what it always should have been: an abuse guard, plus the
--     thing that computes depth so the client never has to.
create or replace function public.enforce_comment_depth()
returns trigger
language plpgsql
as $$
declare
  max_depth      constant int := 100;
  parent_depth   int;
  parent_post_id uuid;
begin
  if new.parent_id is null then
    new.depth := 0;
    return new;
  end if;

  select depth, post_id
    into parent_depth, parent_post_id
    from public.comments
   where id = new.parent_id;

  -- Reachable: a BEFORE trigger runs before the foreign key is validated.
  if not found then
    raise exception 'That comment no longer exists.';
  end if;

  -- Not previously checked, and worth checking now that trees are deep: a
  -- reply pointing at a comment on another post would render as an orphan.
  if parent_post_id <> new.post_id then
    raise exception 'A reply must belong to the same post as the comment it answers.';
  end if;

  -- Always computed here, never taken from the client, so depth cannot be
  -- forged by writing it directly.
  new.depth := parent_depth + 1;

  if new.depth > max_depth then
    raise exception 'Replies can only nest % levels deep.', max_depth;
  end if;

  return new;
end;
$$;

-- 1c. Backfill existing rows.
--
--     The trigger is disabled around this on purpose. It recomputes depth from
--     the parent's CURRENT stored depth, so with it enabled the backfill would
--     read not-yet-backfilled parents and settle on the wrong answer for
--     anything below the first level. Disabling makes the block safe to run in
--     any order and safe to re-run.
alter table public.comments disable trigger comments_depth_check;

with recursive tree as (
  select id, 0 as computed
    from public.comments
   where parent_id is null
  union all
  select c.id, t.computed + 1
    from public.comments c
    join tree t on c.parent_id = t.id
)
update public.comments c
   set depth = tree.computed
  from tree
 where c.id = tree.id
   and c.depth is distinct from tree.computed;

alter table public.comments enable trigger comments_depth_check;


-- ---------- VERIFY BLOCK 1 ----------
-- Expect: depth_mismatches 0, cross_post_replies 0, trigger_present 1.
-- max_depth is whatever your data happens to be (1 before anyone nests deeper).
with recursive tree as (
  select id, 0 as computed
    from public.comments
   where parent_id is null
  union all
  select c.id, t.computed + 1
    from public.comments c
    join tree t on c.parent_id = t.id
)
select
  (select count(*) from public.comments)                                    as comments,
  (select count(*) from public.comments c
      join tree t on t.id = c.id
     where c.depth is distinct from t.computed)                             as depth_mismatches,
  (select coalesce(max(depth), 0) from public.comments)                     as max_depth,
  (select count(*) from public.comments c
      join public.comments p on p.id = c.parent_id
     where p.post_id <> c.post_id)                                          as cross_post_replies,
  (select count(*) from pg_trigger
     where tgname = 'comments_depth_check' and not tgisinternal)            as trigger_present,
  (select tgenabled = 'O' from pg_trigger
     where tgname = 'comments_depth_check' and not tgisinternal)            as trigger_enabled;


-- ---------- OPTIONAL: prove the reversal actually works ----------
-- Inserts a 3-deep chain (previously rejected at level 2) and rolls it back,
-- so nothing survives. Read the NOTICE output.
begin;
do $$
declare
  pid uuid; aid uuid; c0 uuid; c1 uuid; c2 uuid; d int;
begin
  select id into pid from public.posts limit 1;
  select id into aid from public.profiles limit 1;
  if pid is null or aid is null then
    raise notice 'No post or profile to test against — skipped.';
    return;
  end if;

  insert into public.comments (post_id, author_id, body)
       values (pid, aid, 'depth probe 0') returning id into c0;
  insert into public.comments (post_id, author_id, parent_id, body)
       values (pid, aid, c0, 'depth probe 1') returning id into c1;
  insert into public.comments (post_id, author_id, parent_id, body)
       values (pid, aid, c1, 'depth probe 2') returning id into c2;

  select depth into d from public.comments where id = c2;
  raise notice 'Third-level reply accepted, depth = %. Before this change it raised P0001.', d;
end $$;
rollback;


-- ============================================================
-- BLOCK 2 — Comment likes
-- Mirrors public.likes exactly. Two narrow tables rather than one
-- polymorphic table with two nullable foreign keys: each policy then
-- names exactly one owning column, so there is no case where a NULL
-- makes a check vacuously true.
-- ============================================================

-- 2a. Denormalised counter, same as posts.like_count.
alter table public.comments
  add column if not exists like_count int not null default 0;

-- 2b. Same shape as public.likes: composite primary key, so a double-tap
--     physically cannot double-count and the UI needs no debounce.
create table if not exists public.comment_likes (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  comment_id  uuid not null references public.comments(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, comment_id)
);

-- 2c. The primary key already indexes (user_id, ...), which is what
--     "fetch my likes" uses. This covers the other direction: deleting a
--     comment has to find its like rows to cascade, and without this that is
--     a sequential scan. NOTE: public.likes has the same gap on post_id —
--     see the optional block at the end.
create index if not exists comment_likes_comment_idx
  on public.comment_likes (comment_id);

-- 2d. Counter trigger, copied from sync_like_count.
--     security definer for the same reason: the person liking a comment is
--     not its author, so RLS would otherwise block the counter's UPDATE.
create or replace function public.sync_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update comments set like_count = like_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comment_likes_counter on public.comment_likes;
create trigger comment_likes_counter
  after insert or delete on public.comment_likes
  for each row execute function public.sync_comment_like_count();

-- 2e. RLS, identical to public.likes. No update policy, deliberately —
--     a like row has nothing to update, and its primary key is its meaning.
alter table public.comment_likes enable row level security;

drop policy if exists comment_likes_select on public.comment_likes;
create policy comment_likes_select on public.comment_likes
  for select using (true);

drop policy if exists comment_likes_insert on public.comment_likes;
create policy comment_likes_insert on public.comment_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists comment_likes_delete on public.comment_likes;
create policy comment_likes_delete on public.comment_likes
  for delete using (auth.uid() = user_id);


-- ---------- VERIFY BLOCK 2 ----------
-- Expect: like_count_col 1, rls_on true, policies 3, counter_trigger 1,
--         counter_drift 0.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'comments'
       and column_name = 'like_count')                                as like_count_col,
  (select relrowsecurity from pg_class
     where oid = 'public.comment_likes'::regclass)                    as rls_on,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'comment_likes')     as policies,
  (select count(*) from pg_trigger
     where tgname = 'comment_likes_counter' and not tgisinternal)     as counter_trigger,
  (select count(*) from public.comments c
     where c.like_count <> (select count(*) from public.comment_likes cl
                             where cl.comment_id = c.id))             as counter_drift;

-- Policy detail, so you can eyeball that insert/delete are owner-scoped
-- and select is open — the same shape as public.likes.
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename in ('likes', 'comment_likes')
 order by tablename, policyname;


-- ---------- OPTIONAL: prove the counter fires both ways ----------
begin;
do $$
declare
  cid uuid; uid uuid; after_insert int; after_delete int;
begin
  select id into cid from public.comments limit 1;
  select id into uid from public.profiles limit 1;
  if cid is null or uid is null then
    raise notice 'No comment or profile to test against — skipped.';
    return;
  end if;

  insert into public.comment_likes (user_id, comment_id) values (uid, cid);
  select like_count into after_insert from public.comments where id = cid;

  delete from public.comment_likes where user_id = uid and comment_id = cid;
  select like_count into after_delete from public.comments where id = cid;

  raise notice 'like_count after insert = %, after delete = % (expect n+1 then n).',
    after_insert, after_delete;
end $$;
rollback;


-- ============================================================
-- BLOCK 3 — Confirm posts.comment_count already counts every depth
-- No DDL. sync_comment_count keys off post_id alone and never looks at
-- parent_id, so a reply at any depth increments it. This proves it.
-- ============================================================

-- Expect: zero rows. Any row is a post whose stored counter disagrees with
-- the true number of comments at all depths.
select
  p.id,
  p.comment_count                                                     as stored,
  (select count(*) from public.comments c where c.post_id = p.id)     as actual_all_depths
from public.posts p
where p.comment_count <> (select count(*) from public.comments c where c.post_id = p.id)
order by p.created_at desc;

-- And the same broken out by depth, so you can see more than one level
-- feeding the single counter once people start nesting.
select
  c.depth,
  count(*) as comments_at_this_depth
from public.comments c
group by c.depth
order by c.depth;


-- ============================================================
-- OPTIONAL — the same missing index on the existing likes table
-- Not part of this change. public.likes has no index on post_id alone, so
-- deleting a post sequentially scans likes to cascade. Harmless at current
-- size; one line to fix whenever you like.
-- ============================================================
-- create index if not exists likes_post_idx on public.likes (post_id);
