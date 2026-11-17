-- Betcha 004: server clock, so every player's device can start a match at the same moment
-- (devices' own clocks can be seconds apart). Read-only. Safe to re-run.
create or replace function public.server_time() returns timestamptz
language sql volatile as $$ select clock_timestamp() $$;

revoke all on function public.server_time() from public, anon;
grant execute on function public.server_time() to authenticated;
