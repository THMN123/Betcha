// Shared, deterministic game simulations.
//
// These files are imported by BOTH the browser (to run the game) and the `verify-run`
// Edge Function (to replay a player's inputs and compute the official score). They must
// stay pure: no DOM, no Date/performance, no Math.random, no Math.sin/cos/etc. Only
// integer and basic float arithmetic (+ - * / min max floor), which is bit-identical
// across JavaScript engines.

export type GameId = 'snake' | '2048' | 'neondodge';

/** One recorded player action: [tickIndex, actionCode]. */
export type InputEvent = [number, number];

export interface GameSim<S> {
  id: GameId;
  /** Milliseconds of game time per tick. */
  tickMs: number;
  /** Valid action codes for this game. */
  actionCodes: readonly number[];
  /** Creates the starting state. Same seed => same game. */
  init(seed: number): S;
  /** Applies one player action. Must be a no-op once the game is over. */
  applyInput(state: S, code: number): void;
  /** Advances the game by one tick. */
  step(state: S): void;
  isOver(state: S): boolean;
  score(state: S): number;
}

/** Number of ticks a run lasts for a given match duration. */
export function maxTicksFor(sim: GameSim<unknown>, durationSeconds: number): number {
  return Math.floor((durationSeconds * 1000) / sim.tickMs);
}
