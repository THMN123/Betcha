import type { GameSim } from './types.ts';
import { createRng, nextFloat, nextInt, type Rng } from './rng.ts';

const SIZE = 4;

export const Move2048 = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3 } as const;

export interface State2048 {
  rng: Rng;
  board: number[][];
  score: number;
  over: boolean;
  /** Set when the last input moved tiles (for sound effects). */
  lastMoveMerged: boolean;
}

function addRandomTile(state: State2048) {
  const empty: number[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (state.board[r][c] === 0) empty.push(r * SIZE + c);
  if (empty.length === 0) return;
  const idx = empty[nextInt(state.rng, empty.length)];
  state.board[Math.floor(idx / SIZE)][idx % SIZE] = nextFloat(state.rng) < 0.9 ? 2 : 4;
}

function slide(line: number[]): { out: number[]; gained: number } {
  const arr = line.filter((v) => v !== 0);
  let gained = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      gained += arr[i];
      arr[i + 1] = 0;
    }
  }
  const out = arr.filter((v) => v !== 0);
  while (out.length < SIZE) out.push(0);
  return { out, gained };
}

function hasMoves(board: number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
      if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

export const g2048Sim: GameSim<State2048> = {
  id: '2048',
  tickMs: 100,
  actionCodes: [0, 1, 2, 3],

  init(seed) {
    const state: State2048 = {
      rng: createRng(seed),
      board: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)),
      score: 0,
      over: false,
      lastMoveMerged: false,
    };
    addRandomTile(state);
    addRandomTile(state);
    return state;
  },

  applyInput(state, code) {
    if (state.over) return;
    state.lastMoveMerged = false;
    let moved = false;
    let gained = 0;

    for (let i = 0; i < SIZE; i++) {
      // Read the line in the direction tiles travel, slide toward index 0, write it back.
      const coords: [number, number][] = [];
      for (let j = 0; j < SIZE; j++) {
        if (code === Move2048.LEFT) coords.push([i, j]);
        else if (code === Move2048.RIGHT) coords.push([i, SIZE - 1 - j]);
        else if (code === Move2048.UP) coords.push([j, i]);
        else coords.push([SIZE - 1 - j, i]);
      }
      const line = coords.map(([r, c]) => state.board[r][c]);
      const { out, gained: g } = slide(line);
      gained += g;
      coords.forEach(([r, c], j) => {
        if (state.board[r][c] !== out[j]) moved = true;
        state.board[r][c] = out[j];
      });
    }

    if (!moved) return;
    state.lastMoveMerged = gained > 0;
    state.score += gained;
    addRandomTile(state);
    if (!hasMoves(state.board)) state.over = true;
  },

  step() {
    // Turn-based: ticks only measure the time limit.
  },

  isOver: (s) => s.over,
  score: (s) => s.score,
};
