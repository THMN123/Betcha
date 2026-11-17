import type { GameSim } from './types.ts';
import { createRng, nextFloat, nextInt, type Rng } from './rng.ts';

// Neon Reflex Dodge v2: survive as long as you can.
//
// There is no score cap. The orb takes time to slide between lanes, and walls fall faster and
// more densely the longer you last (with double walls appearing over time), so every run
// eventually ends, even with perfect play. The score is how long you survived, in 1/60 s ticks,
// which also makes exact ties between two players rare.

export const DODGE_WIDTH = 280;
export const DODGE_HEIGHT = 380;
export const DODGE_LANE_WIDTH = DODGE_WIDTH / 3;
export const DODGE_PLAYER_Y = DODGE_HEIGHT - 40;
export const DODGE_PLAYER_RADIUS = 14;
export const DODGE_OBSTACLE_HEIGHT = 30;
export const DODGE_OBSTACLE_INSET = 10; // walls are drawn 10px in from each lane edge
export const DODGE_PLAYER_SPEED = 13; // px per tick => ~7 ticks (~120ms) to cross one lane

/** Difficulty curves (functions of ticks survived). Rows keep arriving closer together until even
 *  perfect play can't slide between lanes fast enough, so every run ends. */
export function dodgeSpeed(tick: number): number {
  return 4 + tick / 600; // 4 px/tick at start, 10 at 1 min
}
export function dodgeSpawnInterval(tick: number): number {
  return Math.max(3, 45 - Math.floor(tick / 100)); // a row every 750ms, shrinking ~1 tick every 1.7s
}
export function dodgeDoubleChance(tick: number): number {
  return Math.min(0.6, tick / 4000); // chance a row blocks two lanes
}

export interface Obstacle {
  lane: number;
  y: number;
  colorIndex: number;
}

export interface DodgeState {
  rng: Rng;
  tick: number;
  targetLane: number;
  x: number; // orb center
  obstacles: Obstacle[];
  nextSpawn: number;
  passed: number;
  over: boolean;
  passedThisTick: number;
}

const laneCenter = (lane: number) => lane * DODGE_LANE_WIDTH + DODGE_LANE_WIDTH / 2;

export const neonDodgeSim: GameSim<DodgeState> = {
  id: 'neondodge',
  tickMs: 1000 / 60,
  actionCodes: [0, 1, 2], // slide toward lane 0 / 1 / 2

  init(seed) {
    return {
      rng: createRng(seed),
      tick: 0,
      targetLane: 1,
      x: laneCenter(1),
      obstacles: [],
      nextSpawn: 45,
      passed: 0,
      over: false,
      passedThisTick: 0,
    };
  },

  applyInput(state, code) {
    if (state.over) return;
    state.targetLane = code;
  },

  step(state) {
    if (state.over) return;
    state.tick += 1;
    state.passedThisTick = 0;

    // Slide the orb toward its target lane at a fixed speed.
    const tx = laneCenter(state.targetLane);
    if (state.x < tx) state.x = Math.min(tx, state.x + DODGE_PLAYER_SPEED);
    else if (state.x > tx) state.x = Math.max(tx, state.x - DODGE_PLAYER_SPEED);

    if (state.tick >= state.nextSpawn) {
      state.nextSpawn = state.tick + dodgeSpawnInterval(state.tick);
      const first = nextInt(state.rng, 3);
      state.obstacles.push({ lane: first, y: -50, colorIndex: nextInt(state.rng, 3) });
      if (nextFloat(state.rng) < dodgeDoubleChance(state.tick)) {
        const second = (first + 1 + nextInt(state.rng, 2)) % 3; // never all three lanes
        state.obstacles.push({ lane: second, y: -50, colorIndex: nextInt(state.rng, 3) });
      }
    }

    const speed = dodgeSpeed(state.tick);
    const kept: Obstacle[] = [];
    for (const o of state.obstacles) {
      o.y += speed;
      const left = o.lane * DODGE_LANE_WIDTH + DODGE_OBSTACLE_INSET;
      const right = (o.lane + 1) * DODGE_LANE_WIDTH - DODGE_OBSTACLE_INSET;
      const overlapsX = state.x + DODGE_PLAYER_RADIUS > left && state.x - DODGE_PLAYER_RADIUS < right;
      const overlapsY =
        o.y + DODGE_OBSTACLE_HEIGHT >= DODGE_PLAYER_Y - DODGE_PLAYER_RADIUS && o.y <= DODGE_PLAYER_Y + DODGE_PLAYER_RADIUS;
      if (overlapsX && overlapsY) state.over = true;
      if (o.y < DODGE_HEIGHT) kept.push(o);
      else {
        state.passed += 1;
        state.passedThisTick += 1;
      }
    }
    state.obstacles = kept;
  },

  isOver: (s) => s.over,
  score: (s) => s.tick,
};
