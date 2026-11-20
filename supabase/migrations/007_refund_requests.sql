-- Betcha 007: a match only ends on normal terms; refunds need a reason, every player's OK and an admin.
-- Run after 006. Safe to re-run.
--
-- * A match ends when every player's run is in (win, lose or draw). Players can no longer end a match
--   early and hand the win to whoever finished (settle_match no longer forfeits unfinished runs).
-- * If a match can't finish (a run was lost, a bug, a no-show), any player can ask for a refund and
--   must give a reason. Every player in the match has to acknowledge it, then an admin approves it
--   (everyone gets their buy-in back in full) or rejects it with a note.
-- * Admins can only void a running match through an acknowledged refund request.
-- (Matches held for fair-play review are still decided by resolve_review.)

create table if not exists public.refund_requests (
  match_id text primary key references public.matches (id) on delete cascade,
  requested_by uuid not null references auth.users (id),
  reason text not null check (length(reason) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  admin_note text
);

create table if not exists public.refund_acks (
  match_id text not null references public.refund_requests (match_id) on delete cascade,
  player_id uuid not null references auth.users (id),
  acked_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

alter table public.refund_requests enable row level security;
alter table public.refund_acks enable row level security;

-- Players see the requests for their own matches (writes only go through the functions below).
drop policy if exists "players read their match refund requests" on public.refund_requests;
create policy "players read their match refund requests" on public.refund_requests for select to authenticated
  using (exists (select 1 from public.match_players mp where mp.match_id = refund_requests.match_id and mp.player_id = auth.uid()));
drop policy if exists "players read their match refund acks" on public.refund_acks;
create policy "players read their match refund acks" on public.refund_acks for select to authenticated
  using (exists (select 1 from public.match_players mp where mp.match_id = refund_acks.match_id and mp.player_id = auth.uid()));
grant select on public.refund_requests, public.refund_acks to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'refund_requests') then
      execute 'alter publication supabase_realtime add table public.refund_requests';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'refund_acks') then
      execute 'alter publication supabase_realtime add table public.refund_acks';
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Ending a match: only on normal terms.
-- ---------------------------------------------------------------------------
create or replace function public.settle_match(p_match_id text) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if v_match.status <> 'in_progress' then return v_match; end if;
  if exists (select 1 from public.match_players where match_id = p_match_id and score is null) then
    raise exception 'A match only ends when every player has finished. If someone can''t finish, ask for a refund.';
  end if;
  perform public._settle(p_match_id);
  select * into v_match from public.matches where id = p_match_id;
  return v_match;
end $$;

-- ---------------------------------------------------------------------------
-- Refund requests (players)
-- ---------------------------------------------------------------------------
create or replace function public.request_refund(p_match_id text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
  v_reason text := trim(coalesce(p_reason, ''));
  v_existing public.refund_requests;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if v_match.status <> 'in_progress' then raise exception 'Refunds can only be requested for a match that is being played'; end if;
  if length(v_reason) < 10 then raise exception 'Please explain why (at least 10 characters)'; end if;
  if length(v_reason) > 500 then raise exception 'Please keep the reason under 500 characters'; end if;

  select * into v_existing from public.refund_requests where match_id = p_match_id;
  if found and v_existing.status = 'pending' then raise exception 'A refund has already been requested for this match'; end if;

  -- New request (or a fresh one after a rejection): previous acknowledgements don't carry over.
  delete from public.refund_acks where match_id = p_match_id;
  insert into public.refund_requests (match_id, requested_by, reason)
  values (p_match_id, v_uid, v_reason)
  on conflict (match_id) do update
    set requested_by = excluded.requested_by, reason = excluded.reason, status = 'pending', created_at = now(),
        resolved_by = null, resolved_at = null, admin_note = null;
  insert into public.refund_acks (match_id, player_id) values (p_match_id, v_uid);

  update public.matches set review_note = review_note where id = p_match_id; -- nudge realtime listeners
end $$;

create or replace function public.ack_refund(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
begin
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if not exists (select 1 from public.refund_requests where match_id = p_match_id and status = 'pending') then
    raise exception 'There is no open refund request for this match';
  end if;
  insert into public.refund_acks (match_id, player_id) values (p_match_id, v_uid) on conflict do nothing;
  update public.matches set review_note = review_note where id = p_match_id; -- nudge realtime listeners
end $$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
-- Unsettled matches for the admin panel, now with their refund request.
create or replace function public.admin_open_matches() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'title', m.title, 'game_id', m.game_id, 'status', m.status,
      'buy_in_cents', m.buy_in_cents, 'total_pot_cents', m.total_pot_cents,
      'created_at', m.created_at, 'started_at', m.started_at,
      'escrow_cents', public._balance('escrow:' || m.id),
      'players', (
        select jsonb_agg(jsonb_build_object(
          'name', mp.name, 'is_host', mp.is_host, 'score', mp.score, 'run_status', r.status,
          'acked_refund', exists (select 1 from public.refund_acks a where a.match_id = mp.match_id and a.player_id = mp.player_id)
        ) order by mp.joined_at)
        from public.match_players mp
        left join public.runs r on r.match_id = mp.match_id and r.player_id = mp.player_id
        where mp.match_id = m.id
      ),
      'refund', (
        select jsonb_build_object(
          'status', rr.status, 'reason', rr.reason, 'created_at', rr.created_at, 'admin_note', rr.admin_note,
          'requested_by', (select mp.name from public.match_players mp where mp.match_id = rr.match_id and mp.player_id = rr.requested_by)
        )
        from public.refund_requests rr where rr.match_id = m.id
      )
    ) order by coalesce(m.started_at, m.created_at))
    from public.matches m
    where m.status in ('waiting', 'in_progress', 'under_review')
  ), '[]'::jsonb);
end $$;

-- Approve a refund request: only when every player has acknowledged it. Everyone gets their buy-in
-- back in full, no fee is taken, unfinished runs are closed and the decision is recorded.
create or replace function public.admin_void_match(p_match_id text, p_note text default null)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := public._require_admin();
  v_match public.matches;
  v_req public.refund_requests;
  v_players int;
  v_missing int;
  r record;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status <> 'in_progress' then
    raise exception 'Only a match being played can be refunded (this one is %)', v_match.status;
  end if;

  select * into v_req from public.refund_requests where match_id = p_match_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'No player has asked for a refund for this match';
  end if;
  select count(*) into v_missing from public.match_players mp
   where mp.match_id = p_match_id
     and not exists (select 1 from public.refund_acks a where a.match_id = mp.match_id and a.player_id = mp.player_id);
  if v_missing > 0 then
    raise exception '% player(s) have not acknowledged the refund yet', v_missing;
  end if;

  select count(*) into v_players from public.match_players where match_id = p_match_id;
  if public._balance('escrow:' || p_match_id) <> v_match.buy_in_cents * v_players then
    raise exception 'Escrow for % does not match its buy-ins; check it before refunding', p_match_id;
  end if;

  for r in select player_id from public.match_players where match_id = p_match_id loop
    perform public._refund(p_match_id, r.player_id, 'void_refund');
  end loop;

  update public.runs
     set status = 'rejected', score = coalesce(score, 0), reject_reason = 'match refunded', finished_at = coalesce(finished_at, now())
   where match_id = p_match_id and status = 'started';
  update public.match_players set payout_cents = 0, rank = null where match_id = p_match_id;
  update public.refund_requests
     set status = 'approved', resolved_by = v_admin, resolved_at = now(), admin_note = nullif(trim(coalesce(p_note, '')), '')
   where match_id = p_match_id;
  update public.matches
     set status = 'cancelled', settled_at = now(), winner_id = null, winner_name = null,
         review_note = concat_ws(' | ', review_note,
           'refund approved by ' || v_admin::text || ': ' || v_req.reason || coalesce(' / ' || nullif(trim(coalesce(p_note, '')), ''), ''))
   where id = p_match_id
  returning * into v_match;
  return v_match;
end $$;

create or replace function public.admin_reject_refund(p_match_id text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := public._require_admin();
begin
  if length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Tell the players why (at least 5 characters)'; end if;
  update public.refund_requests
     set status = 'rejected', resolved_by = v_admin, resolved_at = now(), admin_note = trim(p_note)
   where match_id = p_match_id and status = 'pending';
  if not found then raise exception 'No open refund request for this match'; end if;
  update public.matches set review_note = review_note where id = p_match_id; -- nudge realtime listeners
end $$;

revoke all on function
  public.settle_match(text), public.request_refund(text, text), public.ack_refund(text),
  public.admin_open_matches(), public.admin_void_match(text, text), public.admin_reject_refund(text, text)
from public, anon;
grant execute on function
  public.settle_match(text), public.request_refund(text, text), public.ack_refund(text),
  public.admin_open_matches(), public.admin_void_match(text, text), public.admin_reject_refund(text, text)
to authenticated;
