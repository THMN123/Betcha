// Run with: deno run --config supabase/functions/deno.json src/games/ghost.test.ts   (or deno test)
import { GhostRunner } from './ghost.ts';
import { SIMS, maxTicksFor, type GameId, type InputEvent } from '../../supabase/functions/_shared/games/index.ts';
import { createRng, nextFloat, nextInt } from '../../supabase/functions/_shared/games/rng.ts';

// A peer plays (random-ish but survives a while), sending batched messages; we feed them to a GhostRunner
// with jitter and occasional reordering, and compare the ghost to the peer's real state every tick it reports.
Deno.test('ghosts rebuild opponents exactly from batched, delayed, reordered inputs', () => {
  let checks = 0, mismatches = 0; const per: Record<string, number> = {};
for (const [g, d] of [['snake', 60], ['neondodge', 120], ['2048', 90]] as [GameId, number][]) {
  for (let run = 0; run < 150; run++) {
    const sim = SIMS[g]; const seed = 9000 + run; const max = maxTicksFor(sim, d);
    const real: any = sim.init(seed); const rng = createRng(run * 31 + 7);
    const ghost = new GhostRunner(sim, seed, max);
    const pending: { tick: number; inputs: InputEvent[]; done: boolean; deliverAt: number }[] = [];
    let batch: InputEvent[] = []; let lastSent = 0; let t = 0; let clock = 0;
    const snaps = new Map<number, string>();
    while (t < max && !sim.isOver(real)) {
      if (nextFloat(rng) < (g === 'neondodge' ? 0.08 : 0.25)) {
        const c = sim.actionCodes[nextInt(rng, sim.actionCodes.length)];
        batch.push([t, c]); sim.applyInput(real, c);
      }
      if (sim.isOver(real)) break;
      sim.step(real); t++; clock += sim.tickMs;
      snaps.set(t, JSON.stringify(real));
      if ((batch.length && clock - lastSent >= 200) || clock - lastSent >= 2000) {
        pending.push({ tick: t, inputs: batch, done: false, deliverAt: clock + 30 + nextInt(rng, 250) }); // jitter => reordering
        batch = []; lastSent = clock;
      }
    }
    snaps.set(t, JSON.stringify(real));
    pending.push({ tick: t, inputs: batch, done: true, deliverAt: clock + 400 });
    pending.sort((a, b) => a.deliverAt - b.deliverAt);
    for (const m of pending) ghost.receive(m.tick, m.inputs, m.done, m.deliverAt);
    // After everything arrives, the ghost must match the real game at every tick we kept.
    for (const k of [Math.floor(t / 3), Math.floor(t / 2), t]) {
      const v = ghost.view(k);
      checks++;
      if (JSON.stringify(v.cur) !== snaps.get(k) && k > 0) { mismatches++; per[g] = (per[g] ?? 0) + 1; if (mismatches < 4) console.log('MISMATCH', g, run, k); }
    }
    if (ghost.confirmedScore() !== sim.score(real)) { mismatches++; per[g + "-score"] = (per[g + "-score"] ?? 0) + 1; }
  }
}
if (mismatches) throw new Error(`ghost mismatches: ${mismatches}`);
  console.log(`ghost checks: ${checks}, mismatches: ${mismatches}`, JSON.stringify(per));
});
