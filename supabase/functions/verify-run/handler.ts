import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { verifyRun, MAX_INPUTS, type GameId, type InputEvent } from '../_shared/games/index.ts';
import { computeSignals } from '../_shared/games/signals.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export interface Env {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  now?: () => number;
}

/**
 * POST { match_id, inputs }  (Authorization: Bearer <user access token>)
 * Replays the caller's run server-side and records the official score.
 * Responds { ok, score, reason? }. A rejected run is recorded as a 0 (forfeit).
 */
export async function handleVerifyRun(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Not signed in' });

  // Identify the caller from their own token (never trust a player id in the body).
  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(authHeader.slice(7));
  if (userErr || !userData?.user) return json(401, { error: 'Not signed in' });
  const playerId = userData.user.id;

  let body: { match_id?: unknown; inputs?: unknown };
  try {
    const text = await req.text();
    if (text.length > 1_000_000) return json(413, { error: 'Run too large' });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  if (typeof body.match_id !== 'string') return json(400, { error: 'match_id required' });
  if (!Array.isArray(body.inputs) || body.inputs.length > MAX_INPUTS) return json(400, { error: 'inputs must be an array' });

  const admin: SupabaseClient = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: run, error: runErr } = await admin
    .from('runs')
    .select('seed, started_at, status')
    .eq('match_id', body.match_id)
    .eq('player_id', playerId)
    .maybeSingle();
  if (runErr) return json(500, { error: 'Could not load run' });
  if (!run) return json(404, { error: 'You have not started a run for this match' });
  if (run.status !== 'started') return json(409, { error: 'This run was already submitted' });

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('game_id, duration_seconds, status')
    .eq('id', body.match_id)
    .maybeSingle();
  if (matchErr || !match) return json(404, { error: 'Match not found' });

  const result = verifyRun({
    gameId: match.game_id as GameId,
    seed: Number(run.seed),
    durationSeconds: match.duration_seconds,
    inputs: body.inputs,
    runStartedAtMs: new Date(run.started_at).getTime(),
    nowMs: (env.now ?? Date.now)(),
  });

  // Bot/solver signals: flags don't change the score, they hold a winning payout for human review.
  const signals = result.ok
    ? computeSignals(match.game_id as GameId, Number(run.seed), body.inputs as InputEvent[], result.score, result.ticks)
    : { flags: [], metrics: {} };

  const { error: recErr } = await admin.rpc('record_run_result', {
    p_match_id: body.match_id,
    p_player_id: playerId,
    p_ok: result.ok,
    p_score: result.score,
    p_ticks: result.ticks,
    p_inputs: body.inputs,
    p_reason: result.reason ?? null,
    p_flags: signals.flags,
    p_metrics: signals.metrics,
  });
  if (recErr) return json(409, { error: recErr.message });

  return json(200, { ok: result.ok, score: result.ok ? result.score : 0, reason: result.reason ?? null });
}
