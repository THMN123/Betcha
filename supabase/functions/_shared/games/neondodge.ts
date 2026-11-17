import type { GameSim } from './types.ts';
import { createRng, nextInt, type Rng } from './rng.ts';

// Logical playfield (the canvas is drawn at this size and scaled by CSS).
export const DODGE_WIDTH = 280;
export const DODGE_HEIGHT = 380;
export const DODGE_PLAYER_Y = DODGE_HEIGHT - 40;
export const DODGE_PLAYER_RADIUS = 14;
export const DODGE_OBSTACLE_HEIGHT = 30;
const SPAWN_EVERY_TICKS = 45; // 750ms at 60 ticks/s

export interface Obstacle {
  lane: number;
  y: number;
  speed: number;
  colorIndex: number;
}

export interface DodgeState {
  rng: Rng;
  tick: number;
  lane: number;
  obstacles: Obstacle[];
  score: number;
  over: boolean;
  /** Obstacles passed this tick (for sound effects). */
  passedThisTick: number;
}

export const neonDodgeSim: GameSim<DodgeState> = {
  id: 'neondodge',
  tickMs: 1000 / 60,
  actionCodes: [0, 1, 2], // move to lane 0 / 1 / 2

  init(seed) {
    return { rng: createRng(seed), tick: 0, lane: 1, obstacles: [], score: 0, over: false, passedThisTick: 0 };
  },

  applyInput(state, code) {
    if (state.over) return;
    state.lane = code;
  },

  step(state) {
    if (state.over) return;
    state.tick += 1;
    state.passedThisTick = 0;

    if (state.tick % SPAWN_EVERY_TICKS === 0) {
      state.obstacles.push({
        lane: nextInt(state.rng, 3),
        y: -50,
        speed: 4 + Math.min(state.score / 300, 6),
        colorIndex: nextInt(state.rng, 3),
      });
    }

    const kept: Obstacle[] = [];
    for (const o of state.obstacles) {
      o.y += o.speed;
      if (
        o.lane === state.lane &&
        o.y + DODGE_OBSTACLE_HEIGHT >= DODGE_PLAYER_Y - DODGE_PLAYER_RADIUS &&
        o.y <= DODGE_PLAYER_Y + DODGE_PLAYER_RADIUS
      ) {
        state.over = true;
      }
      if (o.y < DODGE_HEIGHT) {
        kept.push(o);
      } else {
        state.score += 50;
        state.passedThisTick += 1;
      }
    }
    state.obstacles = kept;
  },

  isOver: (s) => s.over,
  score: (s) => s.score,
};
