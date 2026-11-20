import { SIMS, SUBMIT_GRACE_MS, maxTicksFor, type GameId, type GameSim, type InputEvent } from '../../supabase/functions/_shared/games/index.ts';

/**
 * A match run in progress on this device, saved to localStorage as it is played.
 *
 * If the arena is closed, re-rendered or the page reloads mid-run, the run is not lost: the game is
 * deterministic, so it can be rebuilt from (seed, inputs) and carry on from the saved tick, or, when
 * there is no time left to finish it, the moves made so far are submitted for a real score.
 */
export interface RunCheckpoint {
  matchId: string;
  userId: string;
  gameId: GameId;
  durationSeconds: number;
  /** One-time token sent with begin_run, so a retry gets the same run back. */
  token: string;
  /** Known once begin_run has answered. */
  seed?: number;
  /** When the server started the run, on this device's clock (Date.now scale). */
  startedAt?: number;
  ticks: number;
  inputs: InputEvent[];
}

const PREFIX = 'betcha_run_';
/** Countdown shown before a resumed run continues. */
export const RESUME_COUNTDOWN_MS = 3000;
/** Margin kept before the server's submit deadline (clock differences, slow networks). */
const SAFETY_MS = 15_000;

function storage<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function newRunToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function loadCheckpoint(matchId: string, userId: string): RunCheckpoint | null {
  const cp = storage<RunCheckpoint | null>(() => JSON.parse(localStorage.getItem(PREFIX + matchId) || 'null'), null);
  return cp && cp.userId === userId && cp.matchId === matchId ? cp : null;
}

export function saveCheckpoint(cp: RunCheckpoint): void {
  storage(() => localStorage.setItem(PREFIX + cp.matchId, JSON.stringify(cp)), undefined);
}

export function clearCheckpoint(matchId: string): void {
  storage(() => localStorage.removeItem(PREFIX + matchId), undefined);
}

export function listCheckpoints(userId: string): RunCheckpoint[] {
  return storage(() => {
    const out: RunCheckpoint[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const cp = loadCheckpoint(key.slice(PREFIX.length), userId);
      if (cp) out.push(cp);
    }
    return out;
  }, []);
}

/** Last moment (device clock) the server still accepts this run. */
function deadline(cp: RunCheckpoint): number | null {
  return cp.startedAt === undefined ? null : cp.startedAt + cp.durationSeconds * 1000 + SUBMIT_GRACE_MS;
}

/** Can this run still be resumed and finished in time? */
export function canResume(cp: RunCheckpoint, now = Date.now()): boolean {
  const end = deadline(cp);
  if (end === null) return true; // begin_run never answered: resuming asks again with the token
  const sim = SIMS[cp.gameId];
  if (!sim) return false;
  const remainingMs = Math.max(0, maxTicksFor(sim, cp.durationSeconds) - cp.ticks) * sim.tickMs;
  return now + RESUME_COUNTDOWN_MS + remainingMs <= end - SAFETY_MS;
}

/**
 * When the moves of a run that can't be resumed may be submitted. The server replays them to the
 * end of the game, so we wait until the full game time has passed in real time (otherwise it looks
 * "faster than real time"). null = not applicable (no seed yet, or resumable).
 */
export function partialSubmitAt(cp: RunCheckpoint): number | null {
  if (cp.seed === undefined || cp.startedAt === undefined) return null;
  return cp.startedAt + cp.durationSeconds * 1000 + 2000;
}

/**
 * Rebuilds a run's exact state at `ticks` from its recorded inputs, the same way the server replays it
 * (inputs for tick N are applied before step N). Returns the state, the tick reached and how many of
 * the inputs were used (inputs recorded after the game ended are dropped).
 */
export function rebuildRun<S>(sim: GameSim<S>, seed: number, ticks: number, inputs: InputEvent[], maxTicks: number, beforeStep?: (s: S) => void) {
  const state = sim.init(seed);
  const target = Math.min(ticks, maxTicks);
  let i = 0;
  let tick = 0;
  while (tick < target && !sim.isOver(state)) {
    while (i < inputs.length && inputs[i][0] === tick) sim.applyInput(state, inputs[i++][1]);
    if (sim.isOver(state)) break;
    beforeStep?.(state);
    sim.step(state);
    tick++;
  }
  // Inputs made after the last step belong to the current tick.
  while (i < inputs.length && inputs[i][0] === tick && !sim.isOver(state)) sim.applyInput(state, inputs[i++][1]);
  return { state, tick, used: i };
}
