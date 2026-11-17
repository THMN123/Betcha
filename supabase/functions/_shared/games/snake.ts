import type { GameSim } from './types.ts';
import { createRng, nextFloat, nextInt, type Rng } from './rng.ts';

export const SNAKE_GRID = 18;
const BONUS_LIFETIME_TICKS = 45; // ~5 seconds at 110ms/tick

export const SnakeAction = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3 } as const;

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeState {
  rng: Rng;
  snake: Cell[];
  dir: number;
  nextDir: number;
  food: Cell | null;
  bonus: Cell | null;
  bonusTicksLeft: number;
  score: number;
  multiplier: number;
  over: boolean;
  /** Event flags for sound/visual effects, reset every tick. */
  ateFood: boolean;
  ateBonus: boolean;
}

const OPPOSITE = [SnakeAction.DOWN, SnakeAction.UP, SnakeAction.RIGHT, SnakeAction.LEFT];

function freeCell(state: SnakeState, alsoAvoid: Cell | null): Cell | null {
  const taken = new Set<number>();
  for (const s of state.snake) taken.add(s.y * SNAKE_GRID + s.x);
  if (alsoAvoid) taken.add(alsoAvoid.y * SNAKE_GRID + alsoAvoid.x);
  const free: number[] = [];
  for (let i = 0; i < SNAKE_GRID * SNAKE_GRID; i++) if (!taken.has(i)) free.push(i);
  if (free.length === 0) return null;
  const idx = free[nextInt(state.rng, free.length)];
  return { x: idx % SNAKE_GRID, y: Math.floor(idx / SNAKE_GRID) };
}

export const snakeSim: GameSim<SnakeState> = {
  id: 'snake',
  tickMs: 110,
  actionCodes: [0, 1, 2, 3],

  init(seed) {
    const state: SnakeState = {
      rng: createRng(seed),
      snake: [
        { x: 9, y: 10 },
        { x: 9, y: 11 },
        { x: 9, y: 12 },
      ],
      dir: SnakeAction.UP,
      nextDir: SnakeAction.UP,
      food: null,
      bonus: null,
      bonusTicksLeft: 0,
      score: 0,
      multiplier: 1,
      over: false,
      ateFood: false,
      ateBonus: false,
    };
    state.food = freeCell(state, null);
    return state;
  },

  applyInput(state, code) {
    if (state.over) return;
    // Can't reverse into yourself (checked against the direction actually travelled last tick).
    if (code !== OPPOSITE[state.dir]) state.nextDir = code;
  },

  step(state) {
    if (state.over) return;
    state.ateFood = false;
    state.ateBonus = false;
    state.dir = state.nextDir;

    const head = { ...state.snake[0] };
    if (state.dir === SnakeAction.UP) head.y -= 1;
    else if (state.dir === SnakeAction.DOWN) head.y += 1;
    else if (state.dir === SnakeAction.LEFT) head.x -= 1;
    else head.x += 1;

    if (head.x < 0 || head.x >= SNAKE_GRID || head.y < 0 || head.y >= SNAKE_GRID) {
      state.over = true;
      return;
    }
    if (state.snake.some((s) => s.x === head.x && s.y === head.y)) {
      state.over = true;
      return;
    }

    state.snake.unshift(head);

    const ate = state.food !== null && head.x === state.food.x && head.y === state.food.y;
    if (ate) {
      state.ateFood = true;
      state.score += 100 * state.multiplier;
      state.food = freeCell(state, state.bonus);
      if (state.food === null) {
        state.over = true; // board full: nothing left to eat
        return;
      }
      // 45% chance a bonus orb appears (replaces any existing one)
      if (nextFloat(state.rng) <= 0.45) {
        state.bonus = freeCell(state, state.food);
        state.bonusTicksLeft = state.bonus ? BONUS_LIFETIME_TICKS : 0;
      }
    } else {
      state.snake.pop();
    }

    if (state.bonus && head.x === state.bonus.x && head.y === state.bonus.y) {
      state.ateBonus = true;
      state.score += 300 * state.multiplier;
      state.multiplier = Math.min(state.multiplier + 1, 4);
      state.bonus = null;
      state.bonusTicksLeft = 0;
    } else if (state.bonus) {
      state.bonusTicksLeft -= 1;
      if (state.bonusTicksLeft <= 0) state.bonus = null;
    }
  },

  isOver: (s) => s.over,
  score: (s) => s.score,
};
