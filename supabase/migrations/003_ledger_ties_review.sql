-- Betcha 003: double-entry ledger in integer cents, equal tie splits, platform fee account,
-- bot-review holds, new-account stake limits, and admin review tools.
-- Run after 002. Safe to re-run.
--
-- MONEY MODEL
--   * Every credit movement is a ledger transaction whose entries sum to exactly 0 (enforced).
--   * Amounts are integer cents (bigint). No floating point anywhere.
--   * Accounts:  user:<uuid>          a player's spendable balance (can't go negative)
--                escrow:<match_id>    buy-ins held for a match (can't go negative)
--                platform:fees        the 5% fee and split remainders (your revenue)
--                platform:promotions  source of welcome/daily/opening credits (goes negative = credits issued)
--   * Ledger rows can never be updated or deleted.
--   * Sum of every account balance is always 0. Check any time with: select * from public.ledger_check();

-- ---------------------------------------------------------------------------
-- Settings (tunable without code changes)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;

insert into public.settings (key, value) values
  ('new_account_max_buy_in_cents', '500'),          -- new accounts can only join 5-credit (or smaller) matches
  ('new_account_min_completed_matches', '5'),       -- ...until they've completed this many matches
  ('review_score_above', '{"neondodge": 2400}')     -- any run above this score is held for review (per game)
on conflict (key) do nothing;

create or replace function public._setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.settings where key = p_key
$$;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'opening_balance', 'welcome_bonus', 'daily_credits', 'buy_in', 'refund', 'settlement', 'void_refund'
  )),
  match_id text references public.matches (id),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id bigserial primary key,
  txn_id uuid not null references public.ledger_transactions (id),
  account text not null check (account ~ '^(user:[0-9a-f-]{36}|escrow:.+|platform:(fees|promotions))$'),
  amount_cents bigint not null check (amount_cents <> 0),
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_entries_account_idx on public.ledger_entries (account, created_at desc);
create index if not exists ledger_entries_txn_idx on public.ledger_entries (txn_id);

create table if not exists public.account_balances (
  account text primary key,
  balance_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  -- players and escrow can never go below zero; platform accounts may
  constraint account_balances_non_negative check (balance_cents >= 0 or account like 'platform:%')
);

-- Ledger history is append-only.
create or replace function public._ledger_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Ledger rows are append-only and cannot be changed or deleted';
end $$;
drop trigger if exists ledger_entries_immutable on public.ledger_entries;
create trigger ledger_entries_immutable before update or delete on public.ledger_entries
  for each row execute function public._ledger_immutable();
drop trigger if exists ledger_transactions_immutable on public.ledger_transactions;
create trigger ledger_transactions_immutable before update or delete on public.ledger_transactions
  for each row execute function public._ledger_immutable();

-- Every transaction must balance to zero (checked at commit, so multi-row inserts are fine).
-- SECURITY DEFINER: the check must see every entry of the transaction, not just the rows the
-- current player is allowed to read.
create or replace function public._ledger_txn_balanced() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sum bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_sum from public.ledger_entries where txn_id = new.txn_id;
  if v_sum <> 0 then
    raise exception 'Unbalanced ledger transaction % (off by % cents)', new.txn_id, v_sum;
  end if;
  return null;
end $$;
drop trigger if exists ledger_entries_balanced on public.ledger_entries;
create constraint trigger ledger_entries_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function public._ledger_txn_balanced();

-- Post a balanced transaction. p_entries: [{"account": "...", "cents": 123, "memo": "..."}]
create or replace function public._post(p_kind text, p_match_id text, p_description text, p_entries jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_txn uuid;
  v_sum bigint;
  v_constraint text;
  e jsonb;
begin
  select coalesce(sum((x->>'cents')::bigint), 0) into v_sum from jsonb_array_elements(p_entries) x;
  if v_sum <> 0 then raise exception 'Ledger entries must sum to zero (got %)', v_sum; end if;

  insert into public.ledger_transactions (kind, match_id, description) values (p_kind, p_match_id, p_description)
  returning id into v_txn;

  for e in select * from jsonb_array_elements(p_entries) loop
    if (e->>'cents')::bigint = 0 then continue; end if;
    insert into public.ledger_entries (txn_id, account, amount_cents, memo)
    values (v_txn, e->>'account', (e->>'cents')::bigint, e->>'memo');
    -- Update first (an upsert would check the bare delta against the no-negative rule).
    update public.account_balances
       set balance_cents = balance_cents + (e->>'cents')::bigint, updated_at = now()
     where account = e->>'account';
    if not found then
      insert into public.account_balances (account, balance_cents) values (e->>'account', (e->>'cents')::bigint);
    end if;
  end loop;
  return v_txn;
exception
  when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'account_balances_non_negative' then
      raise exception 'Not enough credits for this';
    end if;
    raise;
end $$;

create or replace function public._user_acct(p_uid uuid) returns text
language sql immutable as $$ select 'user:' || p_uid::text $$;

create or replace function public._balance(p_account text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select balance_cents from public.account_balances where account = p_account), 0)
$$;

-- Integrity check: every account's balance equals its entries, every transaction balances, total is zero.
create or replace function public.ledger_check()
returns table (check_name text, ok boolean, detail text)
language sql stable security definer set search_path = public as $$
  select 'total of all accounts is zero', coalesce(sum(balance_cents), 0) = 0, coalesce(sum(balance_cents), 0)::text
    from public.account_balances
  union all
  select 'balances match entries', count(*) = 0, count(*)::text || ' mismatched accounts'
    from (
      select b.account from public.account_balances b
      left join (select account, sum(amount_cents) s from public.ledger_entries group by account) e using (account)
      where b.balance_cents <> coalesce(e.s, 0)
    ) x
  union all
  select 'every transaction balances', count(*) = 0, count(*)::text || ' unbalanced transactions'
    from (select txn_id from public.ledger_entries group by txn_id having sum(amount_cents) <> 0) y
  union all
  select 'settled matches have empty escrow', count(*) = 0, count(*)::text || ' matches with leftover escrow'
    from public.matches m join public.account_balances b on b.account = 'escrow:' || m.id
   where m.status in ('completed', 'cancelled') and b.balance_cents <> 0
$$;

-- ---------------------------------------------------------------------------
-- Cents columns on matches / match_players, review fields on runs, admin flag
-- ---------------------------------------------------------------------------
alter table public.matches add column if not exists buy_in_cents bigint;
alter table public.matches add column if not exists total_pot_cents bigint not null default 0;
alter table public.matches add column if not exists platform_fee_cents bigint not null default 0;
alter table public.matches add column if not exists net_prize_cents bigint not null default 0;
alter table public.matches add column if not exists review_note text;
alter table public.match_players add column if not exists payout_cents bigint;
alter table public.runs add column if not exists flags jsonb not null default '[]';
alter table public.runs add column if not exists metrics jsonb not null default '{}';
alter table public.runs add column if not exists review_status text not null default 'none';
alter table public.profiles add column if not exists is_admin boolean not null default false;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'buy_in') then
    update public.matches set buy_in_cents = round(buy_in * 100)::bigint where buy_in_cents is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_players' and column_name = 'payout') then
    update public.match_players set payout_cents = round(payout * 100)::bigint where payout is not null and payout_cents is null;
  end if;
end $$;

alter table public.matches alter column buy_in_cents set not null;
alter table public.matches drop constraint if exists matches_buy_in_cents_check;
alter table public.matches add constraint matches_buy_in_cents_check check (buy_in_cents in (100, 500, 1000, 2500));
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('waiting', 'in_progress', 'under_review', 'completed', 'cancelled'));
alter table public.runs drop constraint if exists runs_review_status_check;
alter table public.runs add constraint runs_review_status_check
  check (review_status in ('none', 'flagged', 'cleared', 'confirmed_cheat'));

-- ---------------------------------------------------------------------------
-- Move existing balances into the ledger (once)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  if exists (select 1 from public.ledger_transactions where kind = 'opening_balance') then
    return; -- already migrated
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'balance') then
    for r in select id, round(balance * 100)::bigint as cents from public.profiles where balance > 0 loop
      perform public._post('opening_balance', null, 'Balance carried over to the new ledger', jsonb_build_array(
        jsonb_build_object('account', 'platform:promotions', 'cents', -r.cents),
        jsonb_build_object('account', public._user_acct(r.id), 'cents', r.cents, 'memo', 'Balance carried over')
      ));
    end loop;
  end if;

  -- Buy-ins currently held by unfinished matches
  for r in
    select m.id, m.buy_in_cents * count(mp.*) as cents
      from public.matches m join public.match_players mp on mp.match_id = m.id
     where m.status in ('waiting', 'in_progress')
     group by m.id, m.buy_in_cents
  loop
    perform public._post('opening_balance', r.id, 'Escrow carried over to the new ledger', jsonb_build_array(
      jsonb_build_object('account', 'platform:promotions', 'cents', -r.cents),
      jsonb_build_object('account', 'escrow:' || r.id, 'cents', r.cents)
    ));
  end loop;
end $$;

-- Run the queued "every ledger transaction balances" checks now. The SQL editor runs this whole file as one
-- transaction, and Postgres won't ALTER ledger_entries (below) while those checks are still pending.
set constraints all immediate;

-- Retire the old balance sources so there is exactly one.
drop trigger if exists on_auth_user_created on auth.users;  -- old signup hook wrote a second wallet
do $$
begin
  if to_regclass('public.wallets') is not null and to_regclass('public.wallets_legacy') is null then
    alter table public.wallets rename to wallets_legacy;
  end if;
  if exists (select 1 from pg_class where relname = 'transactions' and relnamespace = 'public'::regnamespace and relkind = 'r') then
    if to_regclass('public.transactions_legacy_v1') is null then
      alter table public.transactions rename to transactions_legacy_v1;
    else
      alter table public.transactions rename to transactions_legacy_v1b;
    end if;
  end if;
end $$;
-- Old publication entry for the renamed table is harmless; remove it if present.
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transactions_legacy_v1') then
    alter publication supabase_realtime drop table public.transactions_legacy_v1;
  end if;
end $$;

drop view if exists public.leaderboard;
alter table public.profiles drop column if exists balance;
alter table public.profiles drop column if exists escrow_locked;
alter table public.profiles drop column if exists total_earnings;
alter table public.matches drop column if exists buy_in;
alter table public.matches drop column if exists total_pot;
alter table public.matches drop column if exists platform_fee;
alter table public.matches drop column if exists net_prize_pool;
alter table public.match_players drop column if exists payout;

-- ---------------------------------------------------------------------------
-- Read models for the app
-- ---------------------------------------------------------------------------
create or replace view public.transactions with (security_invoker = true) as
select
  e.id,
  substr(e.account, 6)::uuid as user_id,
  case t.kind
    when 'buy_in' then 'buy_in'
    when 'settlement' then 'payout_win'
    when 'refund' then 'refund'
    when 'void_refund' then 'refund'
    else 'deposit'
  end as type,
  e.amount_cents,
  t.match_id,
  coalesce(e.memo, t.description) as description,
  case when t.kind = 'buy_in' and m.status in ('waiting', 'in_progress', 'under_review') then 'escrowed' else 'completed' end as status,
  e.created_at
from public.ledger_entries e
join public.ledger_transactions t on t.id = e.txn_id
left join public.matches m on m.id = t.match_id
where e.account like 'user:%';

create or replace view public.my_wallet with (security_invoker = true) as
select
  coalesce((select b.balance_cents from public.account_balances b where b.account = 'user:' || auth.uid()::text), 0)::bigint as balance_cents,
  (select coalesce(sum(m.buy_in_cents), 0) from public.match_players mp join public.matches m on m.id = mp.match_id
    where mp.player_id = auth.uid() and m.status in ('waiting', 'in_progress', 'under_review'))::bigint as escrow_cents,
  (select coalesce(sum(mp.payout_cents), 0) from public.match_players mp join public.matches m on m.id = mp.match_id
    where mp.player_id = auth.uid() and m.status = 'completed')::bigint as total_won_cents;

create or replace view public.leaderboard with (security_invoker = true) as
select mp.match_id, mp.player_id, p.handle, p.avatar_url, m.game_id, mp.score, mp.payout_cents, m.settled_at
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  join public.profiles p on p.id = mp.player_id
 where m.status = 'completed' and mp.rank = 1 and mp.payout_cents > 0;

-- ---------------------------------------------------------------------------
-- Row level security / grants for the new objects
-- ---------------------------------------------------------------------------
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.account_balances enable row level security;

drop policy if exists ledger_entries_read_own on public.ledger_entries;
create policy ledger_entries_read_own on public.ledger_entries for select to authenticated
  using (account = 'user:' || auth.uid()::text);
drop policy if exists ledger_transactions_read_own on public.ledger_transactions;
create policy ledger_transactions_read_own on public.ledger_transactions for select to authenticated
  using (exists (select 1 from public.ledger_entries e where e.txn_id = ledger_transactions.id and e.account = 'user:' || auth.uid()::text));
drop policy if exists account_balances_read_own on public.account_balances;
create policy account_balances_read_own on public.account_balances for select to authenticated
  using (account = 'user:' || auth.uid()::text);

revoke all on public.ledger_transactions, public.ledger_entries, public.account_balances from anon, authenticated;
grant select on public.ledger_transactions, public.ledger_entries, public.account_balances to authenticated;
grant select on public.transactions, public.my_wallet, public.leaderboard to authenticated;
revoke all on public.transactions, public.my_wallet, public.leaderboard from anon;

-- Players may read their own run's review state but never the input logs or metrics.
revoke select on public.runs from authenticated;
grant select (match_id, player_id, started_at, finished_at, status, score, reject_reason, review_status) on public.runs to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'account_balances') then
    alter publication supabase_realtime add table public.account_balances;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public._duration_for(p_game text) returns int
language sql immutable as $$
  -- Neon Dodge has no score cap; 120s is a safety limit (perfect play ends by ~60s).
  select case p_game when 'snake' then 60 when '2048' then 90 else 120 end
$$;

create or replace function public._require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._require_uid();
begin
  if not coalesce((select is_admin from public.profiles where id = v_uid), false) then
    raise exception 'Admins only';
  end if;
  return v_uid;
end $$;

create or replace function public._check_stake_limit(p_uid uuid, p_buy_in_cents bigint) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_played int;
  v_min int := coalesce((public._setting('new_account_min_completed_matches'))::int, 0);
  v_max bigint := coalesce((public._setting('new_account_max_buy_in_cents'))::bigint, 2500);
begin
  select matches_played into v_played from public.profiles where id = p_uid;
  if coalesce(v_played, 0) < v_min and p_buy_in_cents > v_max then
    raise exception 'New accounts can play for up to % credits until they have completed % matches (you have %)',
      v_max / 100, v_min, coalesce(v_played, 0);
  end if;
end $$;

create or replace function public._recalc_pot(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pot bigint;
  v_fee bigint;
begin
  select m.buy_in_cents * count(mp.*) into v_pot
    from public.matches m left join public.match_players mp on mp.match_id = m.id
   where m.id = p_match_id group by m.buy_in_cents;
  v_fee := (v_pot * 5 + 50) / 100; -- 5%, rounded to the nearest cent
  update public.matches
     set total_pot_cents = v_pot, platform_fee_cents = v_fee, net_prize_cents = v_pot - v_fee
   where id = p_match_id;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles & free credits
-- ---------------------------------------------------------------------------
drop function if exists public.ensure_profile(text, text);
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
  if v_name is null then v_name := 'Guest ' || substr(v_uid::text, 1, 4); end if;
  v_name := left(v_name, 32);

  insert into public.profiles (id, email, display_name, handle, avatar_url)
  values (
    v_uid, v_email, v_name,
    '@' || coalesce(nullif(regexp_replace(lower(v_name), '[^a-z0-9_]', '', 'g'), ''), 'player') || '_' || substr(v_uid::text, 1, 4),
    coalesce(p_avatar_url, v_meta->>'avatar_url', v_meta->>'picture', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || v_uid::text)
  )
  on conflict (id) do nothing;

  -- Welcome credits, exactly once: only when this call created the profile.
  if found then
    perform public._post('welcome_bonus', null, 'Welcome bonus: 25 play credits', jsonb_build_array(
      jsonb_build_object('account', 'platform:promotions', 'cents', -2500),
      jsonb_build_object('account', public._user_acct(v_uid), 'cents', 2500)
    ));
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  return v_profile;
end $$;

drop function if exists public.claim_credits();
create or replace function public.claim_credits() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_uid();
  v_last timestamptz;
begin
  select last_credit_claim into v_last from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if v_last is not null and v_last > now() - interval '20 hours' then
    raise exception 'Free credits already claimed. Try again in % hours',
      ceil(extract(epoch from (v_last + interval '20 hours' - now())) / 3600);
  end if;
  update public.profiles set last_credit_claim = now(), updated_at = now() where id = v_uid;
  perform public._post('daily_credits', null, 'Daily free credits', jsonb_build_array(
    jsonb_build_object('account', 'platform:promotions', 'cents', -2500),
    jsonb_build_object('account', public._user_acct(v_uid), 'cents', 2500)
  ));
  return jsonb_build_object('balance_cents', public._balance(public._user_acct(v_uid)));
end $$;

-- ---------------------------------------------------------------------------
-- Match lifecycle
-- ---------------------------------------------------------------------------
drop function if exists public.create_match(text, text, numeric, int, text);
create or replace function public.create_match(
  p_game_id text, p_title text, p_buy_in_cents bigint, p_max_players int, p_distribution text
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
  perform public._check_stake_limit(v_uid, p_buy_in_cents);
  if public._balance(public._user_acct(v_uid)) < p_buy_in_cents then
    raise exception 'Not enough credits (you have %, buy-in is %)',
      public._balance(public._user_acct(v_uid)) / 100.0, p_buy_in_cents / 100.0;
  end if;

  loop
    v_num := 1000 + floor(random() * 9000)::int;
    exit when not exists (select 1 from public.matches where id = 'BTC-' || v_num);
  end loop;

  insert into public.matches (id, invite_code, title, game_id, host_id, host_name, buy_in_cents, max_players, distribution, duration_seconds)
  values ('BTC-' || v_num, 'BETCHA-' || v_num, left(coalesce(nullif(trim(p_title), ''), 'Challenge #' || v_num), 60),
          p_game_id, v_uid, v_profile.display_name, p_buy_in_cents, p_max_players, p_distribution, public._duration_for(p_game_id))
  returning * into v_match;

  insert into public.match_players (match_id, player_id, name, avatar, is_host, is_ready)
  values (v_match.id, v_uid, v_profile.display_name, v_profile.avatar_url, true, true);

  perform public._post('buy_in', v_match.id, 'Buy-in: ' || v_match.title, jsonb_build_array(
    jsonb_build_object('account', public._user_acct(v_uid), 'cents', -p_buy_in_cents),
    jsonb_build_object('account', 'escrow:' || v_match.id, 'cents', p_buy_in_cents)
  ));

  perform public._recalc_pot(v_match.id);
  select * into v_match from public.matches where id = v_match.id;
  return v_match;
end $$;

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
    raise exception 'This match has already %', case v_match.status when 'waiting' then 'started' when 'in_progress' then 'started' else 'ended' end;
  end if;
  select count(*) into v_count from public.match_players where match_id = v_match.id;
  if v_count >= v_match.max_players then raise exception 'This lobby is full'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  perform public._check_stake_limit(v_uid, v_match.buy_in_cents);
  if public._balance(public._user_acct(v_uid)) < v_match.buy_in_cents then
    raise exception 'Not enough credits (you have %, buy-in is %)',
      public._balance(public._user_acct(v_uid)) / 100.0, v_match.buy_in_cents / 100.0;
  end if;

  insert into public.match_players (match_id, player_id, name, avatar, is_host, is_ready)
  values (v_match.id, v_uid, v_profile.display_name, v_profile.avatar_url, false, false);

  perform public._post('buy_in', v_match.id, 'Buy-in: ' || v_match.title, jsonb_build_array(
    jsonb_build_object('account', public._user_acct(v_uid), 'cents', -v_match.buy_in_cents),
    jsonb_build_object('account', 'escrow:' || v_match.id, 'cents', v_match.buy_in_cents)
  ));

  perform public._recalc_pot(v_match.id);
  select * into v_match from public.matches where id = v_match.id;
  return v_match;
end $$;

drop function if exists public._refund(text, uuid);
create or replace function public._refund(p_match_id text, p_player uuid, p_kind text default 'refund') returns void
language plpgsql security definer set search_path = public as $$
declare v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  perform public._post(p_kind, p_match_id, 'Refund: ' || v_match.title, jsonb_build_array(
    jsonb_build_object('account', 'escrow:' || p_match_id, 'cents', -v_match.buy_in_cents),
    jsonb_build_object('account', public._user_acct(p_player), 'cents', v_match.buy_in_cents)
  ));
end $$;

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
  if v_match.status <> 'waiting' then raise exception 'You cannot leave a match that has already started'; end if;

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

-- Ranks players and computes payouts (no money moves here).
--   * Tied scores share a rank, and share equally the prizes for every place they occupy.
--     e.g. top-two 70/30 with two players tied for 1st: each gets 50% of the prize pool.
--   * Cents that can't be split evenly go to platform:fees (at most n-1 cents per tie).
create or replace function public._compute_results(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches;
  v_prizes bigint[];
  v_rank int;
  v_size int;
  v_group bigint;
  v_place int;
  g record;
begin
  perform public._recalc_pot(p_match_id);
  select * into v_match from public.matches where id = p_match_id;

  if v_match.distribution = 'winner_takes_all' then
    v_prizes := array[v_match.net_prize_cents];
  else
    v_prizes := array[v_match.net_prize_cents * 70 / 100, v_match.net_prize_cents - v_match.net_prize_cents * 70 / 100];
  end if;

  update public.match_players set score = coalesce(score, 0) where match_id = p_match_id;

  v_rank := 1;
  for g in
    select score, count(*) as n from public.match_players where match_id = p_match_id
     group by score order by score desc
  loop
    v_size := g.n;
    v_group := 0;
    for v_place in v_rank .. v_rank + v_size - 1 loop
      if v_place <= array_length(v_prizes, 1) then v_group := v_group + v_prizes[v_place]; end if;
    end loop;
    update public.match_players
       set rank = v_rank, payout_cents = v_group / v_size
     where match_id = p_match_id and score = g.score;
    v_rank := v_rank + v_size;
  end loop;

  update public.matches m
     set winner_id = w.player_id, winner_name = w.name
    from (select player_id, name from public.match_players where match_id = p_match_id and rank = 1
           order by completed_at nulls last, joined_at limit 1) w
   where m.id = p_match_id;
  -- With a tie for first, winner_name lists everyone sharing it.
  update public.matches
     set winner_name = (select string_agg(name, ' & ' order by joined_at) from public.match_players where match_id = p_match_id and rank = 1)
   where id = p_match_id;
end $$;

-- Moves the money for a match whose results are computed, and closes it.
create or replace function public._pay_out(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches;
  v_escrow bigint;
  v_paid bigint;
  v_entries jsonb := '[]'::jsonb;
  r record;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  v_escrow := public._balance('escrow:' || p_match_id);
  if v_escrow <> v_match.total_pot_cents then
    raise exception 'Escrow for % holds % cents but the pot is % cents', p_match_id, v_escrow, v_match.total_pot_cents;
  end if;

  select coalesce(sum(payout_cents), 0) into v_paid from public.match_players where match_id = p_match_id;
  v_entries := v_entries || jsonb_build_object('account', 'escrow:' || p_match_id, 'cents', -v_escrow);
  for r in select player_id, payout_cents, rank from public.match_players where match_id = p_match_id and payout_cents > 0 loop
    v_entries := v_entries || jsonb_build_object('account', public._user_acct(r.player_id), 'cents', r.payout_cents,
      'memo', case when r.rank = 1 then 'Winnings: ' else 'Prize: ' end || v_match.title);
  end loop;
  v_entries := v_entries || jsonb_build_object('account', 'platform:fees', 'cents', v_escrow - v_paid,
    'memo', '5% fee' || case when v_escrow - v_paid <> v_match.platform_fee_cents then ' + split remainder' else '' end);
  perform public._post('settlement', p_match_id, 'Settlement: ' || v_match.title, v_entries);

  update public.profiles p
     set matches_played = matches_played + 1,
         wins_count = wins_count + case when mp.rank = 1 then 1 else 0 end,
         updated_at = now()
    from public.match_players mp
   where mp.match_id = p_match_id and p.id = mp.player_id;

  update public.matches set status = 'completed', settled_at = now() where id = p_match_id;
end $$;

-- Settles an in-progress match: compute results, then pay out, unless a paying run is flagged,
-- in which case the pot stays in escrow and the match waits for an admin decision.
create or replace function public._settle(p_match_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.status <> 'in_progress' then return; end if;

  perform public._compute_results(p_match_id);

  if exists (
    select 1 from public.match_players mp
      join public.runs r on r.match_id = mp.match_id and r.player_id = mp.player_id
     where mp.match_id = p_match_id and mp.payout_cents > 0 and r.review_status = 'flagged'
  ) then
    update public.matches set status = 'under_review' where id = p_match_id;
    return;
  end if;

  perform public._pay_out(p_match_id);
end $$;

-- Called only by the verify-run Edge Function (service role).
drop function if exists public.record_run_result(text, uuid, boolean, int, int, jsonb, text);
create or replace function public.record_run_result(
  p_match_id text, p_player_id uuid, p_ok boolean, p_score int, p_ticks int, p_inputs jsonb, p_reason text,
  p_flags jsonb default '[]', p_metrics jsonb default '{}'
) returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_match public.matches;
  v_run public.runs;
  v_pending int;
  v_flags jsonb := coalesce(p_flags, '[]');
  v_threshold int;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  select * into v_run from public.runs where match_id = p_match_id and player_id = p_player_id for update;
  if not found then raise exception 'No run was started for this player'; end if;
  if v_run.status <> 'started' then raise exception 'This run was already submitted'; end if;
  if v_match.status <> 'in_progress' then raise exception 'This match is no longer in progress'; end if;

  v_threshold := (public._setting('review_score_above')->>v_match.game_id)::int;
  if p_ok and v_threshold is not null and p_score > v_threshold then
    v_flags := v_flags || '["score_above_review_threshold"]'::jsonb;
  end if;

  update public.runs
     set status = case when p_ok then 'verified' else 'rejected' end,
         score = case when p_ok then p_score else 0 end,
         ticks = p_ticks,
         inputs = p_inputs,
         reject_reason = case when p_ok then null else p_reason end,
         flags = v_flags,
         metrics = coalesce(p_metrics, '{}'),
         review_status = case when p_ok and jsonb_array_length(v_flags) > 0 then 'flagged' else 'none' end,
         finished_at = now()
   where match_id = p_match_id and player_id = p_player_id;

  update public.match_players
     set score = case when p_ok then greatest(p_score, 0) else 0 end, completed_at = now()
   where match_id = p_match_id and player_id = p_player_id;

  select count(*) into v_pending from public.match_players where match_id = p_match_id and score is null;
  if v_pending = 0 then perform public._settle(p_match_id); end if;

  select * into v_match from public.matches where id = p_match_id;
  return v_match;
end $$;

-- ---------------------------------------------------------------------------
-- Admin review
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_queue() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'match', to_jsonb(m) - 'review_note',
      'players', (
        select jsonb_agg(jsonb_build_object(
          'player_id', mp.player_id, 'name', mp.name, 'score', mp.score, 'rank', mp.rank, 'payout_cents', mp.payout_cents,
          'run_status', r.status, 'review_status', r.review_status, 'flags', r.flags, 'metrics', r.metrics,
          'matches_played', p.matches_played, 'account_created', p.created_at
        ) order by mp.rank)
        from public.match_players mp
        left join public.runs r on r.match_id = mp.match_id and r.player_id = mp.player_id
        left join public.profiles p on p.id = mp.player_id
        where mp.match_id = m.id
      )
    ) order by m.started_at)
    from public.matches m where m.status = 'under_review'
  ), '[]'::jsonb);
end $$;

-- p_decision: 'release'    pay out as computed (flags were false alarms)
--             'disqualify' players in p_players score 0 (marked as cheating), results recomputed, then paid out
--             'void'       nobody wins: every buy-in is refunded in full, no fee taken
create or replace function public.resolve_review(p_match_id text, p_decision text, p_players uuid[] default null, p_note text default null)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := public._require_admin();
  v_match public.matches;
  r record;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status <> 'under_review' then raise exception 'Match is not under review'; end if;

  if p_decision = 'release' then
    update public.runs set review_status = 'cleared' where match_id = p_match_id and review_status = 'flagged';
    perform public._pay_out(p_match_id);
  elsif p_decision = 'disqualify' then
    if p_players is null or cardinality(p_players) = 0 then raise exception 'Name the players to disqualify'; end if;
    update public.runs set review_status = 'confirmed_cheat' where match_id = p_match_id and player_id = any (p_players);
    update public.runs set review_status = 'cleared' where match_id = p_match_id and review_status = 'flagged';
    update public.match_players set score = 0 where match_id = p_match_id and player_id = any (p_players);
    perform public._compute_results(p_match_id);
    update public.match_players set payout_cents = 0 where match_id = p_match_id and player_id = any (p_players);
    perform public._pay_out(p_match_id); -- forfeited prize shares fall to platform:fees as remainder
  elsif p_decision = 'void' then
    for r in select player_id from public.match_players where match_id = p_match_id loop
      perform public._refund(p_match_id, r.player_id, 'void_refund');
    end loop;
    update public.match_players set payout_cents = 0, rank = null where match_id = p_match_id;
    update public.matches set status = 'cancelled', settled_at = now(), winner_id = null, winner_name = null where id = p_match_id;
  else
    raise exception 'Decision must be release, disqualify or void';
  end if;

  update public.matches
     set review_note = concat_ws(' | ', review_note, p_decision || ' by ' || v_admin::text || coalesce(': ' || p_note, ''))
   where id = p_match_id;
  select * into v_match from public.matches where id = p_match_id;
  return v_match;
end $$;

create or replace function public.admin_ledger_check()
returns table (check_name text, ok boolean, detail text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query select * from public.ledger_check();
end $$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_profile(text, text),
  public.claim_credits(),
  public.create_match(text, text, bigint, int, text),
  public.join_match(text),
  public.leave_match(text),
  public.set_ready(text, boolean),
  public.start_match(text),
  public.begin_run(text),
  public.settle_match(text),
  public.admin_review_queue(),
  public.resolve_review(text, text, uuid[], text),
  public.admin_ledger_check()
to authenticated;
-- ledger_check() is for admins: run it in the SQL editor, or through admin_ledger_check() in the app.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.record_run_result(text, uuid, boolean, int, int, jsonb, text, jsonb, jsonb) to service_role';
  end if;
end $$;
