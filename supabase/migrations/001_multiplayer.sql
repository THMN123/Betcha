-- Betcha multiplayer schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste this file -> Run.
-- Safe to re-run: every statement is idempotent.
--
-- Model: balances are PLAY CREDITS (no real money). Every credit movement happens inside
-- the SECURITY DEFINER functions below; clients can read tables but never write them directly.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  handle text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists balance numeric(12,2) not null default 25;
alter table public.profiles add column if not exists escrow_locked numeric(12,2) not null default 0;
alter table public.profiles add column if not exists total_earnings numeric(12,2) not null default 0;
alter table public.profiles add column if not exists matches_played int not null default 0;
alter table public.profiles add column if not exists wins_count int not null default 0;
alter table public.profiles add column if not exists last_credit_claim timestamptz;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create table if not exists public.matches (
  id text primary key,                       -- e.g. BTC-4821
  invite_code text not null unique,          -- e.g. BETCHA-4821
  title text not null,
  game_id text not null check (game_id in ('snake', '2048', 'neondodge')),
  host_id uuid not null references public.profiles (id) on delete cascade,
  host_name text not null,
  buy_in numeric(12,2) not null check (buy_in in (1, 5, 10, 25)),
  max_players int not null check (max_players in (2, 4, 8)),
  distribution text not null check (distribution in ('winner_takes_all', 'top_two')),
  duration_seconds int not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_progress', 'completed', 'cancelled')),
  total_pot numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  net_prize_pool numeric(12,2) not null default 0,
  winner_id uuid,
  winner_name text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  settled_at timestamptz
);

create table if not exists public.match_players (
  match_id text not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  avatar text,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  score int,
  completed_at timestamptz,
  rank int,
  payout numeric(12,2),
  joined_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal', 'buy_in', 'payout_win', 'platform_fee', 'refund')),
  amount numeric(12,2) not null,
  match_id text,
  description text not null,
  status text not null default 'completed' check (status in ('completed', 'pending', 'escrowed')),
  created_at timestamptz not null default now()
);

create index if not exists match_players_player_idx on public.match_players (player_id);
create index if not exists matches_status_idx on public.matches (status, created_at desc);
create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: read-only for signed-in users, writes only via functions
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.transactions enable row level security;

-- Drop any policies from earlier versions (e.g. a client-side profile upsert policy).
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('profiles', 'matches', 'match_players', 'transactions')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy matches_read on public.matches for select to authenticated using (true);
create policy match_players_read on public.match_players for select to authenticated using (true);
create policy transactions_read_own on public.transactions for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.profiles, public.matches, public.match_players, public.transactions from anon, authenticated;
grant select on public.profiles, public.matches, public.match_players, public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public._require_uid() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  return auth.uid();
end $$;

create or replace function public._duration_for(p_game text) returns int
language sql immutable as $$
  select case p_game when 'snake' then 60 when '2048' then 90 else 45 end
$$;

-- Creates the caller's profile on first sign-in (with a 25 credit welcome grant).
-- Returns the profile row. Safe to call on every sign-in.
create or replace function public.ensure_profile(p_display_name text default null, p_avatar_url text default null)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_email text;
  v_meta jsonb;
  v_name text;
  v_profile public.profiles;
begin
  select email, coalesce(raw_user_meta_data, '{}'::jsonb) into v_email, v_meta from auth.users where id = v_uid;

  v_name := nullif(trim(coalesce(p_display_name, v_meta->>'full_name', v_meta->>'name', split_part(v_email, '@', 1), '')), '');
  if v_name is null then
    v_name := 'Guest ' || substr(v_uid::text, 1, 4);
  end if;
  v_name := left(v_name, 32);

  insert into public.profiles (id, email, display_name, handle, avatar_url, balance)
  values (
    v_uid,
    v_email,
    v_name,
    '@' || coalesce(nullif(regexp_replace(lower(v_name), '[^a-z0-9_]', '', 'g'), ''), 'player') || '_' || substr(v_uid::text, 1, 4),
    coalesce(p_avatar_url, v_meta->>'avatar_url', v_meta->>'picture',
             'https://api.dicebear.com/7.x/bottts/svg?seed=' || v_uid::text),
    25
  )
  on conflict (id) do nothing;

  if found then
    insert into public.transactions (user_id, type, amount, description)
    values (v_uid, 'deposit', 25, 'Welcome bonus: 25 play credits');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  return v_profile;
end $$;

-- Free top-up: 25 credits, at most once every 20 hours.
create or replace function public.claim_credits() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;

  if v_profile.last_credit_claim is not null and v_profile.last_credit_claim > now() - interval '20 hours' then
    raise exception 'Free credits already claimed. Try again in % hours',
      ceil(extract(epoch from (v_profile.last_credit_claim + interval '20 hours' - now())) / 3600);
  end if;

  update public.profiles
     set balance = balance + 25, last_credit_claim = now(), updated_at = now()
   where id = v_uid
  returning * into v_profile;

  insert into public.transactions (user_id, type, amount, description)
  values (v_uid, 'deposit', 25, 'Daily free credits');

  return v_profile;
end $$;

-- Recomputes pot fields from the current players.
create or replace function public._recalc_pot(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_buy_in numeric;
begin
  select count(*) into v_count from public.match_players where match_id = p_match_id;
  select buy_in into v_buy_in from public.matches where id = p_match_id;
  update public.matches
     set total_pot = v_buy_in * v_count,
         platform_fee = round(v_buy_in * v_count * 0.05, 2),
         net_prize_pool = v_buy_in * v_count - round(v_buy_in * v_count * 0.05, 2)
   where id = p_match_id;
end $$;

-- ---------------------------------------------------------------------------
-- Match lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.create_match(
  p_game_id text, p_title text, p_buy_in numeric, p_max_players int, p_distribution text
) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_profile public.profiles;
  v_num int;
  v_match public.matches;
begin
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if v_profile.balance < p_buy_in then
    raise exception 'Not enough credits (you have %, buy-in is %)', v_profile.balance, p_buy_in;
  end if;

  loop
    v_num := 1000 + floor(random() * 9000)::int;
    exit when not exists (select 1 from public.matches where id = 'BTC-' || v_num);
  end loop;

  insert into public.matches (id, invite_code, title, game_id, host_id, host_name, buy_in, max_players, distribution, duration_seconds)
  values (
    'BTC-' || v_num, 'BETCHA-' || v_num,
    left(coalesce(nullif(trim(p_title), ''), 'Challenge #' || v_num), 60),
    p_game_id, v_uid, v_profile.display_name, p_buy_in, p_max_players, p_distribution,
    public._duration_for(p_game_id)
  )
  returning * into v_match;

  insert into public.match_players (match_id, player_id, name, avatar, is_host, is_ready)
  values (v_match.id, v_uid, v_profile.display_name, v_profile.avatar_url, true, true);

  update public.profiles
     set balance = balance - p_buy_in, escrow_locked = escrow_locked + p_buy_in, updated_at = now()
   where id = v_uid;

  insert into public.transactions (user_id, type, amount, match_id, description, status)
  values (v_uid, 'buy_in', -p_buy_in, v_match.id, 'Buy-in locked: ' || v_match.title, 'escrowed');

  perform public._recalc_pot(v_match.id);
  select * into v_match from public.matches where id = v_match.id;
  return v_match;
end $$;

-- Join by match id (BTC-1234) or invite code (BETCHA-1234). Joining a match you are
-- already in is a no-op that returns the match.
create or replace function public.join_match(p_code text) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_profile public.profiles;
  v_match public.matches;
  v_count int;
begin
  select * into v_match from public.matches
   where upper(id) = upper(trim(p_code)) or upper(invite_code) = upper(trim(p_code))
   for update;
  if not found then raise exception 'Match % not found', p_code; end if;

  if exists (select 1 from public.match_players where match_id = v_match.id and player_id = v_uid) then
    return v_match;
  end if;

  if v_match.status <> 'waiting' then
    raise exception 'This match has already %', case v_match.status when 'in_progress' then 'started' else 'ended' end;
  end if;

  select count(*) into v_count from public.match_players where match_id = v_match.id;
  if v_count >= v_match.max_players then raise exception 'This lobby is full'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if v_profile.balance < v_match.buy_in then
    raise exception 'Not enough credits (you have %, buy-in is %)', v_profile.balance, v_match.buy_in;
  end if;

  insert into public.match_players (match_id, player_id, name, avatar, is_host, is_ready)
  values (v_match.id, v_uid, v_profile.display_name, v_profile.avatar_url, false, false);

  update public.profiles
     set balance = balance - v_match.buy_in, escrow_locked = escrow_locked + v_match.buy_in, updated_at = now()
   where id = v_uid;

  insert into public.transactions (user_id, type, amount, match_id, description, status)
  values (v_uid, 'buy_in', -v_match.buy_in, v_match.id, 'Buy-in locked: ' || v_match.title, 'escrowed');

  perform public._recalc_pot(v_match.id);
  select * into v_match from public.matches where id = v_match.id;
  return v_match;
end $$;

create or replace function public._refund(p_match_id text, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  update public.profiles
     set balance = balance + v_match.buy_in,
         escrow_locked = greatest(0, escrow_locked - v_match.buy_in),
         updated_at = now()
   where id = p_player;
  insert into public.transactions (user_id, type, amount, match_id, description)
  values (p_player, 'refund', v_match.buy_in, p_match_id, 'Refund: ' || v_match.title);
end $$;

-- Leave a lobby before it starts. A player gets their buy-in back.
-- If the host leaves, the lobby is cancelled and everyone is refunded.
create or replace function public.leave_match(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
  r record;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if v_match.status <> 'waiting' then
    raise exception 'You cannot leave a match that has already started';
  end if;

  if v_match.host_id = v_uid then
    for r in select player_id from public.match_players where match_id = p_match_id loop
      perform public._refund(p_match_id, r.player_id);
    end loop;
    update public.matches set status = 'cancelled', settled_at = now() where id = p_match_id;
  else
    perform public._refund(p_match_id, v_uid);
    delete from public.match_players where match_id = p_match_id and player_id = v_uid;
    perform public._recalc_pot(p_match_id);
  end if;
end $$;

create or replace function public.set_ready(p_match_id text, p_ready boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
begin
  update public.match_players mp
     set is_ready = p_ready
    from public.matches m
   where mp.match_id = p_match_id and mp.player_id = v_uid
     and m.id = mp.match_id and m.status = 'waiting';
  if not found then raise exception 'Cannot change ready state for this match'; end if;
end $$;

-- Host starts the match once at least 2 players are in and everyone is ready.
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

  update public.matches set status = 'in_progress', started_at = now() where id = p_match_id
  returning * into v_match;
  return v_match;
end $$;

-- Pays out a match. Players who never submitted score 0.
-- Ranking: higher score first; on a tie, whoever submitted first.
create or replace function public._settle(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches;
  v_net numeric;
  v_first numeric;
  v_second numeric;
  r record;
  v_rank int := 0;
  v_payout numeric;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.status <> 'in_progress' then return; end if;

  perform public._recalc_pot(p_match_id);
  select * into v_match from public.matches where id = p_match_id;
  v_net := v_match.net_prize_pool;
  if v_match.distribution = 'winner_takes_all' then
    v_first := v_net; v_second := 0;
  else
    v_first := round(v_net * 0.7, 2); v_second := v_net - v_first;
  end if;

  for r in
    select player_id, name from public.match_players
     where match_id = p_match_id
     order by coalesce(score, 0) desc, completed_at asc nulls last, joined_at asc
  loop
    v_rank := v_rank + 1;
    v_payout := case v_rank when 1 then v_first when 2 then v_second else 0 end;

    update public.match_players
       set rank = v_rank, payout = v_payout, score = coalesce(score, 0)
     where match_id = p_match_id and player_id = r.player_id;

    update public.profiles
       set balance = balance + v_payout,
           escrow_locked = greatest(0, escrow_locked - v_match.buy_in),
           total_earnings = total_earnings + v_payout,
           matches_played = matches_played + 1,
           wins_count = wins_count + case when v_rank = 1 then 1 else 0 end,
           updated_at = now()
     where id = r.player_id;

    if v_payout > 0 then
      insert into public.transactions (user_id, type, amount, match_id, description)
      values (r.player_id, 'payout_win', v_payout, p_match_id,
              case v_rank when 1 then '1st place: ' else '2nd place: ' end || v_match.title);
    end if;

    if v_rank = 1 then
      update public.matches set winner_id = r.player_id, winner_name = r.name where id = p_match_id;
    end if;
  end loop;

  update public.transactions
     set status = 'completed'
   where match_id = p_match_id and type = 'buy_in' and status = 'escrowed';

  update public.matches set status = 'completed', settled_at = now() where id = p_match_id;
end $$;

-- Submit your one score for a match. When the last player submits, the match settles.
create or replace function public.submit_score(p_match_id text, p_score int) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
  v_pending int;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status <> 'in_progress' then raise exception 'This match is not in progress'; end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then raise exception 'Invalid score'; end if;

  update public.match_players
     set score = p_score, completed_at = now()
   where match_id = p_match_id and player_id = v_uid and score is null;
  if not found then raise exception 'You already submitted a score for this match (or are not in it)'; end if;

  select count(*) into v_pending from public.match_players where match_id = p_match_id and score is null;
  if v_pending = 0 then
    perform public._settle(p_match_id);
  end if;

  select * into v_match from public.matches where id = p_match_id;
  return v_match;
end $$;

-- Any player may force settlement once the round time plus a 2 minute grace period has passed,
-- so one player walking away can't freeze everyone's credits.
create or replace function public.settle_match(p_match_id text) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then raise exception 'Match not found'; end if;
  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'You are not in this match';
  end if;
  if v_match.status <> 'in_progress' then return v_match; end if;
  if v_match.started_at + make_interval(secs => v_match.duration_seconds + 120) > now() then
    raise exception 'Players still have time to finish. Try again after %',
      to_char(v_match.started_at + make_interval(secs => v_match.duration_seconds + 120), 'HH24:MI:SS');
  end if;

  perform public._settle(p_match_id);
  select * into v_match from public.matches where id = p_match_id;
  return v_match;
end $$;

-- Lock down: only the public API functions are callable by signed-in users.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_profile(text, text),
  public.claim_credits(),
  public.create_match(text, text, numeric, int, text),
  public.join_match(text),
  public.leave_match(text),
  public.set_ready(text, boolean),
  public.start_match(text),
  public.submit_score(text, int),
  public.settle_match(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Leaderboard view (top payouts)
-- ---------------------------------------------------------------------------

create or replace view public.leaderboard with (security_invoker = true) as
select mp.match_id, mp.player_id, p.handle, p.avatar_url, m.game_id, mp.score, mp.payout, m.settled_at
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  join public.profiles p on p.id = mp.player_id
 where m.status = 'completed' and mp.rank = 1 and mp.payout > 0;

grant select on public.leaderboard to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: push lobby, player and balance changes to connected clients
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['matches', 'match_players', 'profiles', 'transactions'] loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
