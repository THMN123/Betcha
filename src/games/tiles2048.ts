import { Move2048 } from '../../supabase/functions/_shared/games/g2048.ts';

/**
 * Display-only tile tracking for 2048, so tiles can slide, merge and appear with animation.
 *
 * The game itself (g2048Sim, replayed by the server) only knows a grid of numbers. Here every
 * tile gets an identity: for each move we replay the same slide rules on tiles to learn where each
 * one went and which pairs merged, then take the newly spawned tile from the game's real board.
 * If the result ever differs from the real board (e.g. after a resumed run), we resync from it.
 */
export interface Tile {
  id: number;
  value: number;
  r: number;
  c: number;
  /** Just spawned: grows in. */
  isNew?: boolean;
  /** Result of a merge this move: pops after its halves arrive. */
  merged?: boolean;
  /** One half of a merge: slides into place, then is removed. */
  consumed?: boolean;
}

const SIZE = 4;
let nextId = 1;

export function tilesFromBoard(board: number[][], isNew = false): Tile[] {
  const out: Tile[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c]) out.push({ id: nextId++, value: board[r][c], r, c, isNew });
  return out;
}

function boardOf(tiles: Tile[]): number[][] {
  const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const t of tiles) if (!t.consumed) b[t.r][t.c] = t.value;
  return b;
}

const same = (a: number[][], b: number[][]) => a.every((row, r) => row.every((v, c) => v === b[r][c]));

/**
 * Tiles after a move. `prev` is what's on screen, `board` the game's board after the move.
 * Returns the tiles to draw (including consumed halves, drawn underneath) and whether it animated.
 */
export function nextTiles(prev: Tile[], dir: number, board: number[][]): { tiles: Tile[]; animated: boolean } {
  const live = prev.filter((t) => !t.consumed).map((t) => ({ ...t, isNew: false, merged: false }));
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (const t of live) grid[t.r][t.c] = t;

  const result: Tile[] = [];
  for (let i = 0; i < SIZE; i++) {
    // Same traversal as the game: index 0 is where tiles travel to.
    const coords: [number, number][] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === Move2048.LEFT) coords.push([i, j]);
      else if (dir === Move2048.RIGHT) coords.push([i, SIZE - 1 - j]);
      else if (dir === Move2048.UP) coords.push([j, i]);
      else coords.push([SIZE - 1 - j, i]);
    }
    const line = coords.map(([r, c]) => grid[r][c]).filter((t): t is Tile => !!t);
    let slot = 0;
    for (let k = 0; k < line.length; k++) {
      const [r, c] = coords[slot];
      const a = line[k];
      const b = line[k + 1];
      if (b && a.value === b.value) {
        result.push({ ...a, r, c, consumed: true }, { ...b, r, c, consumed: true });
        result.push({ id: nextId++, value: a.value * 2, r, c, merged: true });
        k++;
      } else {
        result.push({ ...a, r, c });
      }
      slot++;
    }
  }

  // The tile the game spawned: on its board but not produced by the slide.
  const slid = boardOf(result);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] && !slid[r][c]) result.push({ id: nextId++, value: board[r][c], r, c, isNew: true });
    }
  }

  if (!same(boardOf(result), board)) return { tiles: tilesFromBoard(board), animated: false };
  return { tiles: result, animated: true };
}
