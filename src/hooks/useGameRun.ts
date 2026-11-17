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

/**
 * Runs a deterministic game simulation on a fixed timestep and records the player's inputs
 * exactly the way the server replays them (inputs for tick N are applied before step N).
 *
 * The renderer reads `stateRef.current` every animation frame; `hud` updates React for the
 * score/timer display, and `version` bumps whenever state changes (for DOM-rendered games).
 */
export function useGameRun<S>(
  sim: GameSim<S>,
  durationSeconds: number,
  onFinish: (result: RunResult) => void,
  onTick?: (state: S) => void
) {
  const maxTicks = maxTicksFor(sim, durationSeconds);
  const stateRef = useRef<S | null>(null);
  const ticksRef = useRef(0);
  const inputsRef = useRef<InputEvent[]>([]);
  const runningRef = useRef(false);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const onTickRef = useRef(onTick);
  onFinishRef.current = onFinish;
  onTickRef.current = onTick;

  const [hud, setHud] = useState<RunHud>({ score: 0, secondsLeft: durationSeconds, running: false, over: false });
  const [version, setVersion] = useState(0);

  const publish = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    setHud({
      score: sim.score(s),
      secondsLeft: Math.max(0, Math.ceil(((maxTicks - ticksRef.current) * sim.tickMs) / 1000)),
      running: runningRef.current,
      over: finishedRef.current,
    });
    setVersion((v) => v + 1);
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
      inputsRef.current = [];
      finishedRef.current = false;
      runningRef.current = true;
      publish();
    },
    [sim, publish]
  );

  const sendInput = useCallback(
    (code: number) => {
      const s = stateRef.current;
      if (!s || !runningRef.current || finishedRef.current || ticksRef.current >= maxTicks || sim.isOver(s)) return;
      inputsRef.current.push([ticksRef.current, code]);
      sim.applyInput(s, code);
      if (sim.isOver(s)) finish();
      else publish();
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
        sim.step(s);
        ticksRef.current += 1;
        stepped = true;
        onTickRef.current?.(s);
        if (sim.isOver(s) || ticksRef.current >= maxTicks) {
          finish();
          break;
        }
      }
      if (stepped) publish();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sim, maxTicks, finish, publish]);

  return { stateRef, hud, version, start, sendInput, maxTicks };
}
