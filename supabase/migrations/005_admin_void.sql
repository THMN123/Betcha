-- Betcha 005: admins can void any unsettled match (stuck, bugged, or disputed) with full refunds.
-- Run after 003/004. Safe to re-run.

-- Every unsettled match, for the admin panel.
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
          'name', mp.name, 'is_host', mp.is_host, 'score', mp.score, 'run_status', r.status
        ) order by mp.joined_at)
        from public.match_players mp
        left join public.runs r on r.match_id = mp.match_id and r.player_id = mp.player_id
        where mp.match_id = m.id
      )
    ) order by coalesce(m.started_at, m.created_at))
    from public.matches m
    where m.status in ('waiting', 'in_progress', 'under_review')
  ), '[]'::jsonb);
end $$;

-- Void an unsettled match: every player gets their buy-in back in full, no fee is taken,
-- unfinished runs are closed, and the decision is recorded on the match.
create or replace function public.admin_void_match(p_match_id text, p_note text default null)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := public._require_admin();
  v_match public.matches;
  v_players int;
  r record;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status not in ('waiting', 'in_progress', 'under_review') then
    raise exception 'Only unsettled matches can be voided (this one is %)', v_match.status;
  end if;

  select count(*) into v_players from public.match_players where match_id = p_match_id;
  if public._balance('escrow:' || p_match_id) <> v_match.buy_in_cents * v_players then
    raise exception 'Escrow for % does not match its buy-ins; check it before voiding', p_match_id;
  end if;

  for r in select player_id from public.match_players where match_id = p_match_id loop
    perform public._refund(p_match_id, r.player_id, 'void_refund');
  end loop;

  update public.runs
     set status = 'rejected', score = coalesce(score, 0), reject_reason = 'match voided by admin', finished_at = coalesce(finished_at, now())
   where match_id = p_match_id and status = 'started';
  update public.match_players set payout_cents = 0, rank = null where match_id = p_match_id;
  update public.matches
     set status = 'cancelled', settled_at = now(), winner_id = null, winner_name = null,
         review_note = concat_ws(' | ', review_note, 'void by ' || v_admin::text || coalesce(': ' || p_note, ''))
   where id = p_match_id
  returning * into v_match;
  return v_match;
end $$;

revoke all on function public.admin_open_matches(), public.admin_void_match(text, text) from public, anon;
grant execute on function public.admin_open_matches(), public.admin_void_match(text, text) to authenticated;
