import { useCallback, useEffect, useRef, useState } from 'react';
import { maxTicksFor, type GameSim, type InputEvent } from '../../supabase/functions/_shared/games/index.ts';

export interface RunResult {
  score: number;
  ticks: number;
  inputs: InputEvent[];
}

export interface RunHud {
  score: number;
  secondsLeft: number;
  running: boolean;
  over: boolean;
}

export interface RunHooks<S> {
  /** Called with the state just before each step (e.g. to remember positions for smooth drawing). */
  beforeStep?: (state: S) => void;
  /** Called after each step (sounds, live updates). */
  afterStep?: (state: S, tick: number) => void;
  /** Called when a run starts, with its seed. */
  onStart?: (seed: number) => void;
  /** Called with every input exactly as it is recorded for the server. */
  onInput?: (ev: InputEvent) => void;
}

/**
 * Runs a deterministic game simulation on a fixed timestep and records the player's inputs
 * exactly the way the server replays them (inputs for tick N are applied before step N).
 *
 * Rendering is decoupled: renderers read `stateRef` every animation frame and use `alphaRef`
 * (0..1, how far we are between two ticks) to draw smooth in-between positions. React only
 * re-renders when the HUD values actually change, or after an input (`version`).
 */
export function useGameRun<S>(sim: GameSim<S>, durationSeconds: number, onFinish: (result: RunResult) => void, hooks: RunHooks<S> = {}) {
  const maxTicks = maxTicksFor(sim, durationSeconds);
  const stateRef = useRef<S | null>(null);
  const ticksRef = useRef(0);
  const alphaRef = useRef(0);
  const inputsRef = useRef<InputEvent[]>([]);
  const runningRef = useRef(false);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const hooksRef = useRef(hooks);
  onFinishRef.current = onFinish;
  hooksRef.current = hooks;

  const [hud, setHud] = useState<RunHud>({ score: 0, secondsLeft: durationSeconds, running: false, over: false });
  const [version, setVersion] = useState(0);
  const hudRef = useRef(hud);
  const lastHudAt = useRef(0);

  const publish = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const next: RunHud = {
      score: sim.score(s),
      secondsLeft: Math.max(0, Math.ceil(((maxTicks - ticksRef.current) * sim.tickMs) / 1000)),
      running: runningRef.current,
      over: finishedRef.current,
    };
    const prev = hudRef.current;
    const flagsChanged = prev.running !== next.running || prev.over !== next.over;
    const valuesChanged = prev.score !== next.score || prev.secondsLeft !== next.secondsLeft;
    // The HUD is text: at most ~10 updates/s is plenty and keeps React/layout work off the game loop.
    const now = performance.now();
    if (flagsChanged || (valuesChanged && now - lastHudAt.current >= 100)) {
      lastHudAt.current = now;
      hudRef.current = next;
      setHud(next);
    }
  }, [sim, maxTicks]);

  const finish = useCallback(() => {
    if (finishedRef.current || !stateRef.current) return;
    finishedRef.current = true;
    runningRef.current = false;
    publish();
    onFinishRef.current({ score: sim.score(stateRef.current), ticks: ticksRef.current, inputs: inputsRef.current.slice() });
  }, [sim, publish]);

  const start = useCallback(
    (seed: number) => {
      stateRef.current = sim.init(seed);
      ticksRef.current = 0;
      alphaRef.current = 0;
      inputsRef.current = [];
      finishedRef.current = false;
      runningRef.current = true;
      hooksRef.current.onStart?.(seed);
      publish();
      setVersion((v) => v + 1);
    },
    [sim, publish]
  );

  const sendInput = useCallback(
    (code: number) => {
      const s = stateRef.current;
      if (!s || !runningRef.current || finishedRef.current || ticksRef.current >= maxTicks || sim.isOver(s)) return;
      const ev: InputEvent = [ticksRef.current, code];
      inputsRef.current.push(ev);
      hooksRef.current.onInput?.(ev);
      sim.applyInput(s, code);
      if (sim.isOver(s)) finish();
      else publish();
      setVersion((v) => v + 1);
    },
    [sim, maxTicks, finish, publish]
  );

  // Fixed-timestep loop. If the tab is backgrounded the game pauses (no catch-up burst),
  // which only makes the run take longer in real time, never shorter.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - last, 250);
      last = now;
      const s = stateRef.current;
      if (!s || !runningRef.current) return;
      acc += dt;
      let stepped = false;
      while (acc >= sim.tickMs && runningRef.current) {
        acc -= sim.tickMs;
        hooksRef.current.beforeStep?.(s);
        sim.step(s);
        ticksRef.current += 1;
        stepped = true;
        hooksRef.current.afterStep?.(s, ticksRef.current);
        if (sim.isOver(s) || ticksRef.current >= maxTicks) {
          finish();
          acc = 0;
          break;
        }
      }
      alphaRef.current = runningRef.current ? Math.min(1, acc / sim.tickMs) : 1;
      if (stepped) publish();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim, maxTicks, finish, publish]);

  return { stateRef, ticksRef, alphaRef, hud, version, start, sendInput, maxTicks };
}
