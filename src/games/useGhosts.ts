import { useCallback, useEffect, useRef } from 'react';
import type { GameSim } from '../../supabase/functions/_shared/games/index.ts';
import type { LiveFeed } from '../hooks/useLiveMatch';
import { GhostRunner } from './ghost';

export interface GhostView<S> {
  id: string;
  name: string;
  cur: S;
  prev: S;
  frac: number;
  done: boolean;
}

/**
 * Keeps one GhostRunner per opponent, fed from the live channel, and publishes their scores
 * for the scoreboard. `delayMs` draws ghosts slightly in the past to hide network delay.
 */
export function useGhosts<S>(sim: GameSim<S>, live: LiveFeed | null | undefined, maxTicks: number, delayMs: number) {
  const seedRef = useRef<number | null>(null);
  const runners = useRef(new Map<string, { runner: GhostRunner<S>; cursor: number; name: string }>());

  const setSeed = useCallback((seed: number) => {
    seedRef.current = seed;
    runners.current.clear();
  }, []);

  /** Pull new messages into the runners and return each opponent's state to draw now. */
  const views = useCallback(
    (now: number): GhostView<S>[] => {
      if (!live || seedRef.current === null) return [];
      const out: GhostView<S>[] = [];
      for (const peer of live.peersRef.current.values()) {
        let e = runners.current.get(peer.id);
        if (!e) {
          e = { runner: new GhostRunner(sim, seedRef.current, maxTicks), cursor: 0, name: peer.name };
          runners.current.set(peer.id, e);
        }
        while (e.cursor < peer.log.length) {
          const { msg, at } = peer.log[e.cursor++];
          e.runner.receive(msg.t, msg.i, msg.d === 1, at);
        }
        if (e.runner.lastHeardAt === 0) continue;
        const t = e.runner.done ? e.runner.finalTick : Math.max(0, e.runner.estimatedTick(now, sim.tickMs) - delayMs / sim.tickMs);
        const v = e.runner.view(t);
        const done = e.runner.done && t >= e.runner.finalTick;
        live.scoresRef.current.set(peer.id, { id: peer.id, score: e.runner.done ? e.runner.confirmedScore() : sim.score(v.cur), done });
        out.push({ id: peer.id, name: e.name, cur: v.cur, prev: v.prev, frac: v.frac, done });
      }
      return out;
    },
    [live, sim, maxTicks, delayMs]
  );

  // Games without a canvas loop (2048) still need the scoreboard to update.
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => {
      try {
        views(performance.now());
      } catch {
        /* scoreboard extras only */
      }
    }, 200);
    return () => clearInterval(iv);
  }, [live, views]);

  return { setSeed, views };
}
