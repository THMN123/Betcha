-- Betcha 006: starting a run is safe to retry.
-- Run after 005. Safe to re-run. Works with older app versions (the token is optional).
--
-- The app sends a one-time token with begin_run. If the reply is lost (flaky network, page reload,
-- app re-render), calling begin_run again with the SAME token returns the same run instead of failing
-- with "You already started your run", so the player can still play it. It never grants a second run:
-- the seed and start time are unchanged, and the run must still be submitted within its time limit.

alter table public.runs add column if not exists start_token text;

drop function if exists public.begin_run(text);

create or replace function public.begin_run(p_match_id text, p_token text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
  v_seed bigint;
  v_run public.runs;
begin
  if p_token is not null and (length(p_token) < 16 or length(p_token) > 100) then
    raise exception 'Invalid run token';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if v_match.status <> 'in_progress' then raise exception 'This match is not in progress'; end if;

  select * into v_run from public.runs where match_id = p_match_id and player_id = v_uid;
  if found then
    -- Same device retrying the same start: hand back the same run.
    if p_token is not null and v_run.start_token = p_token and v_run.status = 'started' then
      return jsonb_build_object(
        'seed', v_run.seed,
        'game_id', v_match.game_id,
        'duration_seconds', v_match.duration_seconds,
        'started_at', v_run.started_at,
        'resumed', true
      );
    end if;
    raise exception 'You already started your run for this match. Each player gets one run.';
  end if;

  if now() > v_match.started_at + interval '120 seconds' then
    raise exception 'Too late: runs had to be started within 2 minutes of the match starting';
  end if;

  select seed into v_seed from public.match_seeds where match_id = p_match_id;
  if v_seed is null then raise exception 'Match seed missing'; end if;

  insert into public.runs (match_id, player_id, seed, start_token) values (p_match_id, v_uid, v_seed, p_token)
  returning * into v_run;

  return jsonb_build_object(
    'seed', v_seed,
    'game_id', v_match.game_id,
    'duration_seconds', v_match.duration_seconds,
    'started_at', v_run.started_at,
    'resumed', false
  );
end $$;

revoke execute on function public.begin_run(text, text) from public, anon;
grant execute on function public.begin_run(text, text) to authenticated;
