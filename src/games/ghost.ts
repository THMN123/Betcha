import type { GameSim, InputEvent } from '../../supabase/functions/_shared/games/index.ts';

// structuredClone is missing on older phones (e.g. iOS < 15.4); game states are plain JSON data.
const clone: <T>(v: T) => T = typeof structuredClone === 'function' ? structuredClone : (v) => JSON.parse(JSON.stringify(v));

/**
 * Re-creates an opponent's run locally from their inputs.
 *
 * Every player in a match plays the same seed, so an opponent's game is fully determined by
 * their inputs. They only send inputs (plus an occasional tick heartbeat); we run the same
 * simulation here. Inputs are applied exactly like the server replays them: inputs recorded at
 * tick k are applied before step k.
 *
 *  - "confirmed" state: advanced only through ticks we've definitely heard about.
 *  - predicted view: confirmed + a few ticks of "no new input" prediction, so the ghost keeps
 *    moving smoothly between messages. If a late input contradicts the prediction, the next view
 *    is recomputed from the confirmed state (a small correction, never drift).
 */
export class GhostRunner<S> {
  private confirmed: S;
  private confirmedSteps = 0;
  private inputs: InputEvent[] = [];
  private viewTick = -1;
  private viewState: S | null = null;
  private prevViewState: S | null = null;
  private dirty = false;
  /** Recent confirmed states by step count, so the ghost can be drawn slightly in the past. */
  private history = new Map<number, S>();
  private static HISTORY = 90;

  lastTick = 0; // highest tick the peer has told us about
  lastHeardAt = 0; // performance.now() when we last heard from them
  done = false;
  finalTick = 0;

  constructor(private sim: GameSim<S>, private seed: number, private maxTicks: number) {
    this.confirmed = sim.init(seed);
    this.history.set(0, clone(this.confirmed));
  }

  /** Adds inputs + the peer's current tick from a message. Ignores anything malformed. */
  receive(tick: number, inputs: InputEvent[] | undefined, done: boolean, now: number) {
    if (!Number.isInteger(tick) || tick < 0 || tick > this.maxTicks) return;
    for (const ev of inputs ?? []) {
      if (!Array.isArray(ev) || !Number.isInteger(ev[0]) || !this.sim.actionCodes.includes(ev[1])) continue;
      if (ev[0] < 0 || ev[0] > this.maxTicks) continue;
      if (ev[0] < this.confirmedSteps) {
        // Arrived after we already stepped past it: rebuild from the start (cheap; runs are short).
        this.inputs.push(ev);
        this.inputs.sort((a, b) => a[0] - b[0]);
        this.confirmed = this.sim.init(this.seed);
        this.confirmedSteps = 0;
        this.history.clear();
        this.history.set(0, clone(this.confirmed));
      } else {
        this.inputs.push(ev);
        this.inputs.sort((a, b) => a[0] - b[0]);
      }
    }
    if (tick > this.lastTick) this.lastTick = tick;
    this.lastHeardAt = now;
    if (done) {
      this.done = true;
      this.finalTick = tick;
    }
    // Everything before lastTick is now known.
    this.advance(this.confirmed, this.confirmedSteps, this.lastTick, true);
    // A finished run may end on an input at its final tick (e.g. 2048 ends on a move): apply those too.
    if (this.done && this.confirmedSteps === this.finalTick) {
      for (const ev of this.inputs) if (ev[0] === this.finalTick && !this.sim.isOver(this.confirmed)) this.sim.applyInput(this.confirmed, ev[1]);
    }
    this.dirty = true;
  }

  /** Steps `state` from `from` to `to`, applying recorded inputs. Returns the step count reached. */
  private advance(state: S, from: number, to: number, isConfirmed: boolean): number {
    let k = from;
    let i = this.inputs.findIndex((e) => e[0] >= from);
    if (i < 0) i = this.inputs.length;
    while (k < to && !this.sim.isOver(state)) {
      while (i < this.inputs.length && this.inputs[i][0] === k) this.sim.applyInput(state, this.inputs[i++][1]);
      if (this.sim.isOver(state)) break;
      this.sim.step(state);
      k++;
      if (isConfirmed) {
        this.history.set(k, clone(state));
        this.history.delete(k - GhostRunner.HISTORY);
      }
    }
    if (isConfirmed) this.confirmedSteps = k;
    return k;
  }

  /** The peer's estimated current tick (they keep playing between messages). */
  estimatedTick(now: number, tickMs: number, maxLeadMs = 2000): number {
    if (this.done) return this.finalTick;
    const lead = Math.min(now - this.lastHeardAt, maxLeadMs);
    return Math.min(this.maxTicks, this.lastTick + lead / tickMs);
  }

  /**
   * State to draw at fractional tick `t` (e.g. a little behind real time to hide network delay):
   * returns the state at floor(t), the one before it, and the fraction for interpolation.
   */
  view(t: number): { cur: S; prev: S; frac: number } {
    const k = Math.max(0, Math.floor(t));
    if (k !== this.viewTick || this.dirty || !this.viewState) {
      const prev = this.viewState && k === this.viewTick + 1 && !this.dirty ? this.viewState : this.predict(Math.max(0, k - 1));
      this.prevViewState = prev;
      this.viewState = k === 0 ? prev : this.predict(k);
      this.viewTick = k;
      this.dirty = false;
    }
    return { cur: this.viewState!, prev: this.prevViewState!, frac: t - k };
  }

  private predict(k: number): S {
    if (k >= this.confirmedSteps) {
      const s = clone(this.confirmed) as S;
      if (k > this.confirmedSteps) this.advance(s, this.confirmedSteps, k, false);
      return s;
    }
    const snap = this.history.get(k);
    if (snap) return snap; // read-only use by renderers
    // Older than our history: replay from the start (rare).
    const s = this.sim.init(this.seed);
    this.advance(s, 0, k, false);
    return s;
  }

  /** Score as of the confirmed state (what we know for sure). */
  confirmedScore(): number {
    return this.sim.score(this.confirmed);
  }
}
