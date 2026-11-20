// Run with: deno test src/games/tiles2048.test.ts
import { nextTiles, tilesFromBoard, type Tile } from './tiles2048.ts';
import { g2048Sim } from '../../supabase/functions/_shared/games/g2048.ts';
import { createRng, nextInt } from '../../supabase/functions/_shared/games/rng.ts';

// The animated tiles must always describe exactly the game's real board, move after move,
// without ever falling back to a resync (which would skip the animation).
Deno.test('2048 tile tracking matches the game on every move', () => {
  let moves = 0;
  let resyncs = 0;
  for (let game = 0; game < 300; game++) {
    const state = g2048Sim.init(1000 + game);
    let tiles: Tile[] = tilesFromBoard(state.board);
    const rng = createRng(game * 7 + 1);
    for (let i = 0; i < 400 && !state.over; i++) {
      const before = JSON.stringify(state.board);
      const dir = nextInt(rng, 4);
      g2048Sim.applyInput(state, dir);
      if (JSON.stringify(state.board) === before) continue; // no-op move: nothing to animate
      const res = nextTiles(tiles, dir, state.board);
      if (!res.animated) resyncs++;
      tiles = res.tiles;
      const shown = Array.from({ length: 4 }, () => Array(4).fill(0));
      for (const t of tiles) if (!t.consumed) shown[t.r][t.c] = t.value;
      if (JSON.stringify(shown) !== JSON.stringify(state.board)) throw new Error(`mismatch in game ${game}, move ${i}`);
      const ids = tiles.filter((t) => !t.consumed).map((t) => t.id);
      if (new Set(ids).size !== ids.length) throw new Error('duplicate tile ids');
      moves++;
    }
  }
  if (resyncs > 0) throw new Error(`${resyncs} moves fell back to a resync`);
  console.log(`2048 tile checks: ${moves} moves, 0 resyncs`);
});
