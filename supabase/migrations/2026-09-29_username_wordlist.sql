-- ============================================================
-- 2026-09-29 — Usernames: new wordlist, case-insensitive uniqueness,
--              and display_name made immutable
--
-- STATUS: APPLIED 2026-09-29, in the two submissions marked below, then
--         AMENDED the same day: the effective revoke was added and four
--         adjectives were swapped out. This file is the live state.
--
-- Contains DDL only. NO `rollback` anywhere, and none may be added: the
-- SQL Editor runs a whole paste as ONE transaction, so a rollback at the
-- bottom silently discards the DDL above it while everything in the same
-- run still reports success. That is finding 4f. Probes belong in
-- supabase/probes/.
--
-- Re-runnable as written: `create or replace function`, `revoke`,
-- `create unique index if not exists`, and `drop trigger if exists`
-- before `create trigger`.
--
-- ------------------------------------------------------------
-- WHAT CHANGED
--
--   * Name generation moved OUT of handle_new_user into its own
--     function, public.generate_display_name(). handle_new_user is now
--     three lines and calls it.
--   * A new, shorter wordlist: 48 adjectives x 48 nouns = 2304
--     combinations (the old pair was 66 x 66 = 4356). Four adjectives
--     were swapped out later the same day -- `coral`, `hazel`, `ivory`
--     and `dusky`, all complexion-adjacent, replaced by `frosty`,
--     `leafy`, `mossy` and `stormy`. The array below is the live one.
--   * Uniqueness is now CASE-INSENSITIVE, via a unique index on
--     lower(display_name). generate_display_name checks the same
--     expression, so the check and the index agree.
--   * display_name is IMMUTABLE. profiles_name_guard rejects any update
--     that changes it. Usernames are assigned, once, and kept.
--
-- ------------------------------------------------------------
-- ONE-OFF DATA FIX, DELIBERATELY NOT PART OF THIS MIGRATION
--
-- Both profiles that existed at the time were renamed by hand through
-- generate_display_name(), because they still carried the old `anon-`
-- and manually-set formats. That was a data edit, not schema, so it is
-- recorded here and not reproduced: re-running this file must not rename
-- anybody. After it, the two live names were `pearlyivy` and
-- `stillpoppy`.
--
-- Note that the rename had to happen BEFORE the unique index could be
-- created if either old name collided case-insensitively with anything
-- else. It did not, but that is the ordering to keep in mind if this is
-- ever replayed onto a database with real rows.
--
-- ------------------------------------------------------------
-- TWO THINGS WORTH KNOWING. THE FIRST IS FIXED HERE; THE SECOND IS NOT.
--
--   1. REVOKING FROM A ROLE IS NOT ENOUGH; REVOKE FROM PUBLIC. Postgres
--      grants EXECUTE on a new function to PUBLIC by default, and
--      `revoke ... from anon, authenticated` removes only grants made
--      directly to those roles -- it leaves the PUBLIC grant they both
--      inherit. With only that line in place, an unauthenticated POST to
--      /rest/v1/rpc/generate_display_name carrying just the anon key
--      returned 200 and a name. Both lines are now in the file; with the
--      second one applied the same request returns 401 and
--      `42501 permission denied for function generate_display_name`.
--      Both readings were taken against the live project on Sep 29.
--
--      Worth generalising: any `security definer` helper added to the
--      exposed schema is callable over RPC by default. Revoking from
--      PUBLIC is the line that closes it.
--
--   2. GENERATION IS CHECK-THEN-INSERT, WITH NO RETRY ON CONFLICT. The
--      loop exits as soon as it finds an unused name, and handle_new_user
--      then inserts it in a separate statement. Two signups racing on the
--      same candidate would both pass the check and the loser would hit
--      the unique index -- and because handle_new_user has no exception
--      handler, that raises out of the insert into auth.users and the
--      signup fails. The previous implementation caught unique_violation
--      and retried. At this scale (2304 combinations, a handful of users)
--      the odds are negligible; at any real volume the retry wants to
--      come back.
-- ============================================================


-- ============================================================
-- SUBMISSION 1 — generation, and case-insensitive uniqueness
-- ============================================================

create or replace function public.generate_display_name()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  adjectives text[] := array[
    'quiet','gentle','bright','calm','brave','soft','sunny','wild','misty','golden',
    'silver','frosty','amber','leafy','mossy','rosy','stormy','pearly','velvet','breezy',
    'mellow','tender','lively','dreamy','cozy','warm','swift','still','early','wandering',
    'humble','honest','kindly','merry','noble','patient','serene','steady','witty','lunar',
    'starry','dappled','summer','winter','autumn','spring','clever','gleaming'
  ];
  nouns text[] := array[
    'fern','willow','maple','cedar','juniper','laurel','ivy','sage','violet','tulip',
    'poppy','dahlia','jasmine','magnolia','peony','clover','meadow','brook','river','lake',
    'harbor','island','prairie','valley','ridge','grove','garden','orchard','petal','blossom',
    'sparrow','wren','finch','robin','heron','dove','otter','fawn','rabbit','fox',
    'moth','firefly','acorn','pebble','shell','cloud','ember','dune'
  ];
  candidate text;
  tries int := 0;
begin
  loop
    candidate := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
              || nouns[1 + floor(random() * array_length(nouns, 1))::int];
    exit when not exists (select 1 from public.profiles where lower(display_name) = lower(candidate));
    tries := tries + 1;
    if tries >= 25 then
      candidate := candidate || (10 + floor(random() * 90))::int::text;
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

revoke execute on function public.generate_display_name() from anon, authenticated;
-- The line above is not enough on its own: Postgres grants EXECUTE on a new
-- function to PUBLIC, which anon and authenticated inherit, and revoking from
-- a role does not remove a grant held through PUBLIC. Only this closes it.
revoke execute on function public.generate_display_name() from public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.generate_display_name());
  return new;
end;
$$;

create unique index if not exists profiles_display_name_key
  on public.profiles (lower(display_name));


-- ============================================================
-- SUBMISSION 2 — display_name is immutable
-- ============================================================

create or replace function public.enforce_profile_immutable_name()
returns trigger
language plpgsql
as $$
begin
  if new.display_name is distinct from old.display_name then
    raise exception 'Usernames cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_name_guard on public.profiles;
create trigger profiles_name_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_immutable_name();
