import type { GameId, GameSim, InputEvent } from './types.ts';
import { maxTicksFor } from './types.ts';
import { snakeSim } from './snake.ts';
import { g2048Sim } from './g2048.ts';
import { neonDodgeSim } from './neondodge.ts';

export type { GameId, GameSim, InputEvent } from './types.ts';
export { maxTicksFor } from './types.ts';

export const SIMS: Record<GameId, GameSim<any>> = {
  snake: snakeSim,
  '2048': g2048Sim,
  neondodge: neonDodgeSim,
};

/** Hard cap on inputs per run (far above what a human can produce). */
export const MAX_INPUTS = 20000;

/** A run must reach the server within this long after its time limit. Must match the database. */
export const SUBMIT_GRACE_MS = 60_000;

/**
 * A run can't finish meaningfully faster in real time than the game time it simulated.
 * We allow some slack for timer jitter and clock differences.
 */
export const WALLCLOCK_TOLERANCE = 0.9;
export const WALLCLOCK_SLACK_MS = 3_000;

export interface ReplayResult {
  ok: boolean;
  reason?: string;
  score: number;
  ticks: number;
}

/**
 * Replays a run exactly as the browser ran it: for each tick, apply that tick's inputs
 * in order, then step. Ends when the game is over or the time limit is reached.
 * Any malformed or impossible input log is rejected rather than "best-effort" replayed.
 */
export function replay(gameId: GameId, seed: number, durationSeconds: number, inputs: unknown): ReplayResult {
  const sim = SIMS[gameId];
  if (!sim) return { ok: false, reason: 'unknown game', score: 0, ticks: 0 };
  if (!Array.isArray(inputs)) return { ok: false, reason: 'inputs must be an array', score: 0, ticks: 0 };
  if (inputs.length > MAX_INPUTS) return { ok: false, reason: 'too many inputs', score: 0, ticks: 0 };

  const maxTicks = maxTicksFor(sim, durationSeconds);
  let prevTick = 0;
  for (const ev of inputs) {
    if (
      !Array.isArray(ev) ||
      ev.length !== 2 ||
      !Number.isInteger(ev[0]) ||
      !Number.isInteger(ev[1]) ||
      ev[0] < prevTick ||
      ev[0] >= maxTicks ||
      !sim.actionCodes.includes(ev[1])
    ) {
      return { ok: false, reason: 'malformed input event', score: 0, ticks: 0 };
    }
    prevTick = ev[0];
  }

  const events = inputs as InputEvent[];
  const state = sim.init(seed);
  let i = 0;
  let tick = 0;
  while (tick < maxTicks && !sim.isOver(state)) {
    while (i < events.length && events[i][0] === tick) {
      sim.applyInput(state, events[i][1]);
      i++;
    }
    if (sim.isOver(state)) break; // e.g. 2048 ends on a move
    sim.step(state);
    tick++;
  }

  if (i < events.length) {
    // Inputs recorded after the game had already ended: the log doesn't match this game.
    return { ok: false, reason: 'inputs after game end', score: 0, ticks: tick };
  }
  return { ok: true, score: sim.score(state), ticks: tick };
}

export interface VerifyParams {
  gameId: GameId;
  seed: number;
  durationSeconds: number;
  inputs: unknown;
  runStartedAtMs: number;
  nowMs: number;
}

/** Replay plus timing checks. This is the single source of truth for a run's official score. */
export function verifyRun(p: VerifyParams): ReplayResult {
  const result = replay(p.gameId, p.seed, p.durationSeconds, p.inputs);
  if (!result.ok) return result;

  const sim = SIMS[p.gameId];
  const elapsed = p.nowMs - p.runStartedAtMs;
  const simulatedMs = result.ticks * sim.tickMs;

  if (elapsed > p.durationSeconds * 1000 + SUBMIT_GRACE_MS) {
    return { ok: false, reason: 'run submitted too late', score: 0, ticks: result.ticks };
  }
  if (elapsed < simulatedMs * WALLCLOCK_TOLERANCE - WALLCLOCK_SLACK_MS) {
    return { ok: false, reason: 'run finished faster than real time', score: 0, ticks: result.ticks };
  }
  return result;
}
