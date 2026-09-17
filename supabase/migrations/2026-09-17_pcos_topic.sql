-- ============================================================
-- 2026-09-17 — PCOS topic tag on posts
--
-- STATUS: NOT YET APPLIED. Paste into the Supabase SQL Editor and run.
--
-- Contains DDL and READ-ONLY verification queries only. NO `rollback`
-- anywhere, and none may be added: the SQL Editor runs a whole paste as
-- ONE transaction, so a rollback at the bottom silently discards the DDL
-- above it while the verification queries in the same run still report
-- success. That is finding 4f. Probes belong in supabase/probes/.
--
-- Safe to re-run: every statement is if-not-exists / drop-if-exists.
--
-- What this is: ONE topic, 'pcos', tagged on posts. It is a deliberately
-- narrow re-add of the "communities / subreddits" feature cut in CLAUDE.md
-- section 3 — see section 26 for the decision. It is NOT a topics system:
-- there is no topics table, no slug registry, and the set of legal values
-- lives in a CHECK constraint precisely so that widening it is a visible
-- schema change rather than an insert.
-- ============================================================


-- ============================================================
-- BLOCK 1 — the column and its allowed values
-- ============================================================

-- Nullable, and NULL is the normal case: a post made from /new without the
-- preset is untagged, and every post that existed before today is untagged.
-- No default, so "untagged" is never something the database chose for you.
alter table public.posts
  add column if not exists topic text;

-- The real guard on the value. The client validates the preset too, but only
-- so it never sends a value it knows is wrong — this is what makes it true.
--
-- Dropped first because Postgres has no `add constraint if not exists`, and
-- this file has to stay re-runnable (finding 4f: a silently rolled-back
-- paste is recovered by running it again).
--
-- NULL passes a CHECK on its own — `topic = 'pcos'` evaluates to NULL for a
-- NULL topic, and a CHECK only fails on an explicit false — so the `is null`
-- arm is written out anyway, because a reader should not have to know that.
alter table public.posts
  drop constraint if exists posts_topic_check;

alter table public.posts
  add constraint posts_topic_check
  check (topic is null or topic = 'pcos');

-- Matches the ordering both feeds use: `.order('created_at', {ascending:
-- false})`, i.e. created_at desc. Partial on the tag, so the index holds only
-- PCOS posts and stays small while untagged posts dominate the table.
--
-- Deliberately NOT also `and hidden = false`, unlike posts_feed_idx. The topic
-- page's query does not filter on hidden — RLS does that, and it lets an
-- author still see their own hidden post. Adding the term would make the index
-- unusable for exactly that query. If the topic page ever gains an explicit
-- `.eq('hidden', false)`, this predicate should gain it too.
create index if not exists posts_topic_pcos_idx
  on public.posts (created_at desc)
  where topic = 'pcos';


-- ============================================================
-- BLOCK 2 — verification. Read-only. Run in the same paste as block 1
-- only to see it PENDING; run it again in its own submission to know it
-- COMMITTED. See finding 4f.
-- ============================================================

-- Expect one row: topic | text | YES (nullable) | no default.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'posts' and column_name = 'topic';

-- Expect one row, the CHECK above.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.posts'::regclass and conname = 'posts_topic_check';

-- Expect one row, a partial index on (created_at desc) where topic = 'pcos'.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'posts' and indexname = 'posts_topic_pcos_idx';

-- Expect the four posts policies, unchanged by this migration. RLS is
-- row-scoped and names no columns, so adding a column changes none of them:
--   posts_insert  with check (auth.uid() = author_id)  -- topic rides along
--   posts_update  using/with check (auth.uid() = author_id)
-- Consequence worth seeing written down: posts_update lets an author change
-- `topic` on their own post, both onto and off 'pcos'. See section 26.
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'posts'
order by policyname;

-- How many posts carry the tag. Zero until someone posts from /t/pcos.
select topic, count(*) from public.posts group by topic order by topic nulls first;
