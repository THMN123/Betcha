// Computes the best possible Neon Dodge run for a seed (perfect play with perfect foresight).
// Used to prove the game always ends, and to flag runs that come suspiciously close to perfect.
import type { InputEvent } from './types.ts';
import {
  neonDodgeSim,
  DODGE_LANE_WIDTH,
  DODGE_PLAYER_RADIUS,
  DODGE_PLAYER_Y,
  DODGE_OBSTACLE_HEIGHT,
  DODGE_OBSTACLE_INSET,
  DODGE_PLAYER_SPEED,
} from './neondodge.ts';

const laneCenter = (lane: number) => lane * DODGE_LANE_WIDTH + DODGE_LANE_WIDTH / 2;

export interface PerfectRun {
  ticks: number;
  inputs: InputEvent[];
}

export function perfectRun(seed: number, maxTicks: number): PerfectRun {
  // Walls don't depend on the player, so record them with an invulnerable dummy run.
  const s = neonDodgeSim.init(seed);
  const frames: { lane: number; y: number }[][] = [];
  for (let t = 0; t < maxTicks; t++) {
    s.x = -1000;
    neonDodgeSim.step(s);
    s.over = false;
    frames.push(s.obstacles.map((o) => ({ lane: o.lane, y: o.y })));
  }
  const hit = (x: number, frame: { lane: number; y: number }[]) =>
    frame.some(
      (o) =>
        x + DODGE_PLAYER_RADIUS > o.lane * DODGE_LANE_WIDTH + DODGE_OBSTACLE_INSET &&
        x - DODGE_PLAYER_RADIUS < (o.lane + 1) * DODGE_LANE_WIDTH - DODGE_OBSTACLE_INSET &&
        o.y + DODGE_OBSTACLE_HEIGHT >= DODGE_PLAYER_Y - DODGE_PLAYER_RADIUS &&
        o.y <= DODGE_PLAYER_Y + DODGE_PLAYER_RADIUS
    );

  type Node = { x: number; target: number; parent: Node | null; tick: number };
  const start: Node = { x: laneCenter(1), target: 1, parent: null, tick: -1 };
  let layer = new Map<string, Node>([['start', start]]);
  for (let t = 0; t < maxTicks; t++) {
    const next = new Map<string, Node>();
    for (const n of layer.values()) {
      for (const target of [0, 1, 2]) {
        const tx = laneCenter(target);
        const x = n.x < tx ? Math.min(tx, n.x + DODGE_PLAYER_SPEED) : n.x > tx ? Math.max(tx, n.x - DODGE_PLAYER_SPEED) : n.x;
        if (hit(x, frames[t])) continue;
        const key = `${x}|${target}`;
        if (!next.has(key)) next.set(key, { x, target, parent: n, tick: t });
      }
    }
    if (next.size === 0) {
      // Every possible move crashes on tick t: survive t+1 ticks, following any surviving path to t-1.
      return { ticks: t + 1, inputs: pathInputs(layer.values().next().value!) };
    }
    layer = next;
  }
  return { ticks: maxTicks, inputs: pathInputs(layer.values().next().value!) };

  function pathInputs(end: Node): InputEvent[] {
    const nodes: Node[] = [];
    for (let n: Node | null = end; n && n.parent; n = n.parent) nodes.push(n);
    nodes.reverse();
    const out: InputEvent[] = [];
    let current = 1;
    for (const n of nodes) {
      if (n.target !== current) {
        out.push([n.tick, n.target]);
        current = n.target;
      }
    }
    return out;
  }
}

export function perfectSurvivalTicks(seed: number, maxTicks: number): number {
  return perfectRun(seed, maxTicks).ticks;
}
