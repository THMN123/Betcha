// Run with: deno test src/games/runCheckpoint.test.ts
import { rebuildRun } from './runCheckpoint.ts';
import { SIMS, maxTicksFor, replay, type GameId, type InputEvent } from '../../supabase/functions/_shared/games/index.ts';
import { createRng, nextFloat, nextInt } from '../../supabase/functions/_shared/games/rng.ts';

// A run is cut off at a random tick, rebuilt from its checkpoint and played on with the same moves.
// The result must be identical to an uninterrupted run, and to the server's replay of the full input log.
Deno.test('a resumed run continues exactly where it was cut off', () => {
  let checks = 0;
  for (const [g, d] of [['snake', 60], ['neondodge', 45], ['2048', 90]] as [GameId, number][]) {
    for (let run = 0; run < 100; run++) {
      const sim = SIMS[g];
      const seed = 4242 + run;
      const max = maxTicksFor(sim, d);
      const rng = createRng(run * 17 + 3);
      // Script the moves up front so both plays get the same ones.
      const script = new Map<number, number>();
      for (let t = 0; t < max; t++) if (nextFloat(rng) < (g === 'neondodge' ? 0.08 : 0.25)) script.set(t, sim.actionCodes[nextInt(rng, sim.actionCodes.length)]);

      const play = (state: any, from: number, inputs: InputEvent[], stopAt: number) => {
        let t = from;
        while (t < stopAt && !sim.isOver(state)) {
          const c = script.get(t);
          if (c !== undefined && !inputs.some((e) => e[0] === t)) {
            inputs.push([t, c]);
            sim.applyInput(state, c);
          }
          if (sim.isOver(state)) break;
          sim.step(state);
          t++;
        }
        return t;
      };

      const full: any = sim.init(seed);
      const fullInputs: InputEvent[] = [];
      const fullTicks = play(full, 0, fullInputs, max);

      const cut = nextInt(rng, Math.max(1, fullTicks));
      const first: any = sim.init(seed);
      const cpInputs: InputEvent[] = [];
      const cpTicks = play(first, 0, cpInputs, cut);
      const { state, tick, used } = rebuildRun(sim, seed, cpTicks, cpInputs, max);
      if (JSON.stringify(state) !== JSON.stringify(first)) throw new Error(`rebuild mismatch ${g} run ${run}`);
      const inputs = cpInputs.slice(0, used);
      const endTicks = play(state, tick, inputs, max);

      if (endTicks !== fullTicks || JSON.stringify(state) !== JSON.stringify(full)) throw new Error(`resume mismatch ${g} run ${run}`);
      const server = replay(g, seed, d, inputs);
      if (!server.ok || server.score !== sim.score(full)) throw new Error(`server disagrees ${g} run ${run}: ${server.reason}`);
      checks++;
    }
  }
  console.log(`resume checks: ${checks} ok`);
});
