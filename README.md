# Betcha

Challenge friends to quick arcade games (Cyber Snake, 2048 Neon Rush, Neon Reflex Dodge).
Everyone buys in with **play credits**, plays the same game, and the highest score takes the pot (minus a 5% fee).
Credits have no cash value.

## How a match works

1. Host creates a lobby (game, buy-in, 2/4/8 players, winner-takes-all or 70/30) and shares the invite link or code.
2. Friends open the link, sign in, and are joined automatically. Their buy-in is held until the match ends.
3. Everyone taps **I'm ready**; the host taps **Start match**. All players are pulled into the game.
4. Each player gets one run, and every player in the match gets the identical game (same seed). Runs must be started
   within 2 minutes of the match starting. When a run ends, the browser sends its input log; the `verify-run` Edge Function
   replays it with the same game code and records the server-computed score. When the last run is verified the match
   settles. If someone never finishes, any player can end the match after start + 2 min + round time + 1 min (no-shows score 0).
5. Before the start, players can leave for a refund; if the host cancels, everyone is refunded.

All of this runs server-side: clients can read data but every credit movement goes through database functions, and
scores can only be recorded by the `verify-run` Edge Function after it has replayed the run.

### Anti-cheat model

- Games are deterministic simulations in `supabase/functions/_shared/games/`, shared by the browser and the server.
  **Every new game must follow the same pattern** (pure `init/applyInput/step`, seeded RNG, no `Math.random`/`Date`).
- Seeds are random (OS CSPRNG), stored in `match_seeds` (unreadable by players) and revealed only when a run begins.
- The server rejects malformed logs, inputs after the game ended, runs that finish faster than real time, late runs,
  and second attempts. Rejected runs score 0 and keep their input log and reason in `runs` for review.
- Not covered yet: bots/solvers that play (or pre-compute) the game for a player. Input logs are stored so bot
  detection can be added; plan for it before real money.

Run the game tests with `cd supabase/functions && deno test _shared/games/`.

## One-time Supabase setup

1. **Create the tables and functions.** Supabase dashboard → SQL Editor → New query → paste the contents of
   `supabase/migrations/001_multiplayer.sql` → Run. It is safe to run again later.
2. **Verified runs.** Paste and run `supabase/migrations/002_verified_runs.sql` too, then deploy the Edge Function with
   the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase login`, `supabase link --project-ref YOUR-REF`,
   `supabase functions deploy verify-run`. Do these together with deploying the new app version: the old app can't
   submit scores once 002 is applied, and the new app can't without it.
3. **Email sign-up.** Works out of the box. If "Confirm email" is on (Authentication → Sign In / Providers → Email),
   players must click the link in their inbox first; turn it off for instant sign-up while testing.
4. **Optional: Google sign-in.** Authentication → Sign In / Providers → Google: enable it and add your Google OAuth client.
   Add your site URL under Authentication → URL Configuration.
5. **Optional: Play as Guest.** Authentication → Sign In / Providers → enable "Allow anonymous sign-ins".
6. **Realtime** is enabled by the SQL script. If lobbies don't update live, check Database → Publications →
   `supabase_realtime` includes `matches`, `match_players`, `profiles`, `transactions`. (The app also refreshes every 15s
   and whenever the tab regains focus, so it still works without realtime, just slower.)

## Run locally

Prerequisites: Node.js

```bash
npm install
```

Optionally create `.env.local` with your own project (otherwise the built-in project URL/key are used):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

```bash
npm run dev
```

## Known limits

- Bots/solvers are not detected yet (see Anti-cheat model).
- Play credits only. Real-money wagering needs a licence/legal opinion, an approved payment provider, KYC/age checks,
  geo-blocking, responsible-gambling controls and an independent security review before launch.
