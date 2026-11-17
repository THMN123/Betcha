// Run with:  deno test supabase/functions/_shared/games/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { replay, verifyRun, SIMS, maxTicksFor, type GameId, type InputEvent } from './index.ts';
import { createRng, nextFloat, nextInt } from './rng.ts';

const GAMES: [GameId, number][] = [
  ['snake', 60],
  ['2048', 90],
  ['neondodge', 45],
];

/** Plays like the browser hook: inputs applied immediately, recorded at the current tick. */
function playLive(gameId: GameId, seed: number, duration: number, botSeed: number) {
  const sim = SIMS[gameId];
  const bot = createRng(botSeed);
  const max = maxTicksFor(sim, duration);
  const state = sim.init(seed);
  const inputs: InputEvent[] = [];
  let ticks = 0;
  while (ticks < max && !sim.isOver(state)) {
    // 0-2 inputs between ticks
    const n = nextFloat(bot) < 0.3 ? nextInt(bot, 3) : 0;
    for (let k = 0; k < n && !sim.isOver(state); k++) {
      const code = sim.actionCodes[nextInt(bot, sim.actionCodes.length)];
      inputs.push([ticks, code]);
      sim.applyInput(state, code);
    }
    if (sim.isOver(state)) break;
    sim.step(state);
    ticks++;
  }
  return { score: sim.score(state), ticks, inputs };
}

Deno.test('replay reproduces live play exactly (1000 runs per game)', () => {
  for (const [g, d] of GAMES) {
    for (let i = 0; i < 1000; i++) {
      const live = playLive(g, 1000 + i, d, 77 + i);
      const r = replay(g, 1000 + i, d, live.inputs);
      assert(r.ok, `${g} run ${i}: ${r.reason}`);
      assertEquals(r.score, live.score, `${g} run ${i} score`);
      assertEquals(r.ticks, live.ticks, `${g} run ${i} ticks`);
    }
  }
});

Deno.test('same seed gives the same game, different seeds differ', () => {
  for (const [g] of GAMES) {
    const a = JSON.stringify(SIMS[g].init(42));
    assertEquals(a, JSON.stringify(SIMS[g].init(42)));
    assert(a !== JSON.stringify(SIMS[g].init(43)), `${g} seeds 42/43 identical`);
  }
});

Deno.test('rejects malformed and tampered logs', () => {
  const bad: unknown[] = [
    'nope',
    [[0]],
    [[0, 9]], // invalid action
    [[5, 0], [3, 1]], // ticks go backwards
    [[-1, 0]],
    [[0.5, 0]],
    [[999999, 0]], // beyond time limit
    Array.from({ length: 20001 }, () => [0, 0]),
  ];
  for (const inputs of bad) assert(!replay('snake', 1, 60, inputs).ok, JSON.stringify(inputs).slice(0, 40));

  // Inputs after the snake already died => log doesn't belong to this game
  const live = playLive('snake', 5, 60, 5);
  const tampered = [...live.inputs, [live.ticks + 3, 0] as InputEvent];
  const r = replay('snake', 5, 60, tampered);
  assert(!r.ok, 'input after death must be rejected');
});

Deno.test('a log replayed with a different seed does not keep its score', () => {
  let differs = 0;
  for (let i = 0; i < 50; i++) {
    const live = playLive('2048', 500 + i, 90, i);
    const r = replay('2048', 9999 + i, 90, live.inputs);
    if (!r.ok || r.score !== live.score) differs++;
  }
  assert(differs > 40, `only ${differs}/50 differed`);
});

Deno.test('timing checks', () => {
  const live = playLive('neondodge', 7, 45, 3);
  const base = { gameId: 'neondodge' as GameId, seed: 7, durationSeconds: 45, inputs: live.inputs, runStartedAtMs: 0 };
  const simMs = live.ticks * (1000 / 60);
  assert(verifyRun({ ...base, nowMs: simMs + 500 }).ok, 'normal timing');
  assert(!verifyRun({ ...base, nowMs: 10 }).ok || simMs < 3000, 'instant submission must fail');
  assert(!verifyRun({ ...base, nowMs: 45_000 + 61_000 }).ok, 'late submission must fail');
});

/** A bot that actually plays well, so long games (speed-ups, multipliers, full boards) get exercised. */
function playSmart(gameId: GameId, seed: number, duration: number) {
  const sim = SIMS[gameId];
  const max = maxTicksFor(sim, duration);
  const state: any = sim.init(seed);
  const inputs: InputEvent[] = [];
  let ticks = 0;
  const act = (code: number) => {
    inputs.push([ticks, code]);
    sim.applyInput(state, code);
  };
  while (ticks < max && !sim.isOver(state)) {
    if (gameId === 'snake') {
      const h = state.snake[0];
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const safe = (d: number) => {
        const x = h.x + dirs[d][0], y = h.y + dirs[d][1];
        return x >= 0 && y >= 0 && x < 18 && y < 18 && !state.snake.slice(0, -1).some((c: any) => c.x === x && c.y === y);
      };
      const f = state.bonus ?? state.food;
      const pref = [f.y < h.y ? 0 : 1, f.x < h.x ? 2 : 3, 0, 1, 2, 3];
      const d = pref.find((d) => safe(d) && d !== [1, 0, 3, 2][state.dir]);
      if (d !== undefined && d !== state.nextDir) act(d);
    } else if (gameId === 'neondodge') {
      const danger = (lane: number) => state.obstacles.some((o: any) => o.lane === lane && o.y > 180 && o.y < 360);
      if (danger(state.lane)) {
        const alt = [0, 1, 2].find((l) => !danger(l));
        if (alt !== undefined) act(alt);
      }
    } else if (ticks % 3 === 0) {
      act([2, 1, 3, 0][(ticks / 3) % 4]);
    }
    if (sim.isOver(state)) break;
    sim.step(state);
    ticks++;
  }
  return { score: sim.score(state), ticks, inputs };
}

Deno.test('long skilled runs replay exactly', () => {
  for (const [g, d] of GAMES) {
    let best = 0;
    for (let i = 0; i < 200; i++) {
      const live = playSmart(g, 31337 + i, d);
      const r = replay(g, 31337 + i, d, live.inputs);
      assert(r.ok, `${g} smart run ${i}: ${r.reason}`);
      assertEquals([r.score, r.ticks], [live.score, live.ticks], `${g} smart run ${i}`);
      best = Math.max(best, live.score);
    }
    console.log(g, 'best smart score', best);
    assert(best > 1000, `${g} bot too weak to exercise long games`);
  }
});

Deno.test('cross-engine fingerprint', () => {
  // Same numbers are asserted in the Node test (scripts/sim-fingerprint.mjs) to prove engines agree.
  const out: number[] = [];
  for (const [g, d] of GAMES) for (let i = 0; i < 20; i++) out.push(playSmart(g, i * 7919, d).score);
  console.log('FINGERPRINT', out.join(','));
});
