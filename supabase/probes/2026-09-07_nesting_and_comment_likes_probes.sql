-- ============================================================
-- PROBES for 2026-09-07_nesting_and_comment_likes.sql
--
-- ⚠️  RUN THIS FILE IN ITS OWN SUBMISSION. NEVER PASTE IT ALONGSIDE A
--     MIGRATION.
--
-- The Supabase SQL Editor runs everything you paste as a SINGLE
-- TRANSACTION. A `rollback;` anywhere in that submission discards
-- EVERYTHING above it in the same run — including DDL — and it does so
-- silently: statements report success as they execute, and a verification
-- query placed before the rollback reads the uncommitted state and
-- confirms the change. You get two green blocks and an unchanged
-- database.
--
-- This is not hypothetical. It is how the migration beside this file
-- first appeared to apply and had not. See CLAUDE.md section 4f.
--
-- Each probe below is self-contained and ends by rolling back, so it
-- leaves no rows behind. Run them ONE AT A TIME, and only after the
-- migration has been applied and verified in a separate submission.
-- ============================================================


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
