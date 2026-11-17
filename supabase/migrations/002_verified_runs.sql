-- Betcha: server-verified runs (anti-cheat).
-- Run after 001_multiplayer.sql: Supabase dashboard -> SQL Editor -> paste -> Run. Safe to re-run.
--
-- How it works:
--   * When the host starts a match, a secret random seed is stored in match_seeds (unreadable by players).
--   * A player taps Start: begin_run() records the attempt (one per player per match) and returns the seed,
--     so every player in the match plays the identical game.
--   * When the run ends, the browser sends its input log to the `verify-run` Edge Function, which replays
--     it with the same game code, checks timing, and calls record_run_result() with the server-computed score.
--   * Players can no longer submit scores themselves.

-- Timing rules (keep in sync with supabase/functions/_shared/games/index.ts and the app):
--   begin window: a player must start their run within 120s of the match starting
--   submit grace: a run must be submitted within duration + 60s of starting it
--   settle:       anyone in the match may force settlement after start + 120s + duration + 60s

-- Superseded: once 003 (ledger) is applied, re-running this file would bring back old balance columns.
do $$ begin
  if to_regclass('public.ledger_entries') is not null then
    raise exception 'This migration is superseded by 003_ledger_ties_review.sql and must not be re-run';
  end if;
end $$;

create table if not exists public.match_seeds (
  match_id text primary key references public.matches (id) on delete cascade,
  seed bigint not null
);

create table if not exists public.runs (
  match_id text not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started' check (status in ('started', 'verified', 'rejected')),
  score int,
  ticks int,
  inputs jsonb,
  reject_reason text,
  primary key (match_id, player_id)
);

alter table public.match_seeds enable row level security;
alter table public.runs enable row level security;

-- No policies on match_seeds: nobody but SECURITY DEFINER functions / service role can read seeds.
drop policy if exists runs_read_own on public.runs;
create policy runs_read_own on public.runs for select to authenticated using (player_id = auth.uid());

revoke all on public.match_seeds from anon, authenticated;
revoke insert, update, delete on public.runs from anon, authenticated;
grant select (match_id, player_id, started_at, finished_at, status, score, reject_reason) on public.runs to authenticated;

-- Cryptographically strong 31-bit seed (gen_random_uuid uses the OS CSPRNG).
create or replace function public._new_seed() returns bigint
language sql volatile as $$
  select (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::int & 2147483647)::bigint
$$;

-- Start: same checks as before, plus generate the secret seed.
create or replace function public.start_match(p_match_id text) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
  v_count int;
  v_not_ready int;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.host_id <> v_uid then raise exception 'Only the host can start the match'; end if;
  if v_match.status <> 'waiting' then raise exception 'Match already started'; end if;

  select count(*), count(*) filter (where not is_ready) into v_count, v_not_ready
    from public.match_players where match_id = p_match_id;
  if v_count < 2 then raise exception 'You need at least 2 players to start'; end if;
  if v_not_ready > 0 then raise exception 'Waiting for % player(s) to ready up', v_not_ready; end if;

  insert into public.match_seeds (match_id, seed) values (p_match_id, public._new_seed())
  on conflict (match_id) do nothing;

  update public.matches set status = 'in_progress', started_at = now() where id = p_match_id
  returning * into v_match;
  return v_match;
end $$;

-- Begin your one run for a match. Returns the seed the game must be played with.
create or replace function public.begin_run(p_match_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
  v_seed bigint;
  v_run public.runs;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if v_match.status <> 'in_progress' then raise exception 'This match is not in progress'; end if;

  select * into v_run from public.runs where match_id = p_match_id and player_id = v_uid;
  if found then
    raise exception 'You already started your run for this match. Each player gets one run.';
  end if;

  if now() > v_match.started_at + interval '120 seconds' then
    raise exception 'Too late: runs had to be started within 2 minutes of the match starting';
  end if;

  select seed into v_seed from public.match_seeds where match_id = p_match_id;
  if v_seed is null then raise exception 'Match seed missing'; end if;

  insert into public.runs (match_id, player_id, seed) values (p_match_id, v_uid, v_seed)
  returning * into v_run;

  return jsonb_build_object(
    'seed', v_seed,
    'game_id', v_match.game_id,
    'duration_seconds', v_match.duration_seconds,
    'started_at', v_run.started_at
  );
end $$;

-- Called ONLY by the verify-run Edge Function (service role) with the server-computed result.
-- A rejected run counts as a score of 0 and keeps the reason + input log for review.
create or replace function public.record_run_result(
  p_match_id text, p_player_id uuid, p_ok boolean, p_score int, p_ticks int, p_inputs jsonb, p_reason text
) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches;
  v_run public.runs;
  v_pending int;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;

  select * into v_run from public.runs where match_id = p_match_id and player_id = p_player_id for update;
  if not found then raise exception 'No run was started for this player'; end if;
  if v_run.status <> 'started' then raise exception 'This run was already submitted'; end if;
  if v_match.status <> 'in_progress' then raise exception 'This match is no longer in progress'; end if;

  update public.runs
     set status = case when p_ok then 'verified' else 'rejected' end,
         score = case when p_ok then p_score else 0 end,
         ticks = p_ticks,
         inputs = p_inputs,
         reject_reason = case when p_ok then null else p_reason end,
         finished_at = now()
   where match_id = p_match_id and player_id = p_player_id;

  update public.match_players
     set score = case when p_ok then greatest(p_score, 0) else 0 end, completed_at = now()
   where match_id = p_match_id and player_id = p_player_id;

  select count(*) into v_pending from public.match_players where match_id = p_match_id and score is null;
  if v_pending = 0 then
    perform public._settle(p_match_id);
  end if;

  select * into v_match from public.matches where id = p_match_id;
  return v_match;
end $$;

-- Force settlement once every player has had the chance to start and finish.
create or replace function public.settle_match(p_match_id text) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
  v_deadline timestamptz;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if v_match.status <> 'in_progress' then return v_match; end if;

  v_deadline := v_match.started_at + make_interval(secs => 120 + v_match.duration_seconds + 60);
  if now() < v_deadline then
    raise exception 'Players still have time to finish. Try again after %', to_char(v_deadline, 'HH24:MI:SS');
  end if;

  -- Unfinished runs are closed as forfeits so they can't be submitted after settlement.
  update public.runs set status = 'rejected', score = 0, reject_reason = 'not submitted before deadline', finished_at = now()
   where match_id = p_match_id and status = 'started';

  perform public._settle(p_match_id);
  select * into v_match from public.matches where id = p_match_id;
  return v_match;
end $$;

-- Players can no longer report their own score.
drop function if exists public.submit_score(text, int);

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_profile(text, text),
  public.claim_credits(),
  public.create_match(text, text, numeric, int, text),
  public.join_match(text),
  public.leave_match(text),
  public.set_ready(text, boolean),
  public.start_match(text),
  public.begin_run(text),
  public.settle_match(text)
to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.record_run_result(text, uuid, boolean, int, int, jsonb, text) to service_role';
  end if;
end $$;

-- Matches that were already in progress when this migration ran get a seed too.
insert into public.match_seeds (match_id, seed)
select id, public._new_seed() from public.matches
 where status = 'in_progress' and id not in (select match_id from public.match_seeds);
