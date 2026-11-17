// Bot / solver signals computed from a verified run. Flags send a winning run to human review;
// they never change the score on their own.
import type { GameId, InputEvent } from './types.ts';
import { SIMS } from './index.ts';
import { neonDodgeSim, DODGE_LANE_WIDTH } from './neondodge.ts';
import { perfectSurvivalTicks } from './dodge_solver.ts';

export interface RunSignals {
  flags: string[];
  metrics: Record<string, number>;
}

/** More deliberate inputs than this inside any 1 second looks automated. */
export const MAX_HUMAN_INPUTS_PER_SECOND = 16;
/** Neon Dodge: a run reaching this share of the best possible survival for its seed is reviewed. */
export const DODGE_NEAR_PERFECT_RATIO = 0.9;
/** Neon Dodge: only compute perfect play (costly) for runs longer than this many ticks. */
const DODGE_SOLVER_MIN_TICKS = 30 * 60;
/** Neon Dodge: median reaction faster than this (ticks at 60/s) over enough samples looks automated. */
const DODGE_MIN_HUMAN_REACTION_TICKS = 6;

export function computeSignals(gameId: GameId, seed: number, inputs: InputEvent[], score: number, ticks: number): RunSignals {
  const sim = SIMS[gameId];
  const flags: string[] = [];
  const metrics: Record<string, number> = { inputs: inputs.length, ticks };

  // Peak input rate over a sliding 1 second window.
  const window = Math.round(1000 / sim.tickMs);
  let peak = 0;
  for (let i = 0, j = 0; i < inputs.length; i++) {
    while (inputs[i][0] - inputs[j][0] >= window) j++;
    peak = Math.max(peak, i - j + 1);
  }
  metrics.peak_inputs_per_second = peak;
  if (peak > MAX_HUMAN_INPUTS_PER_SECOND) flags.push('superhuman_input_rate');

  if (gameId === 'neondodge') {
    // Reaction: ticks between a wall becoming visible in the orb's lane and the input that leaves it.
    const reactions: number[] = [];
    const s = neonDodgeSim.init(seed);
    const firstSeen = new Map<object, number>();
    let i = 0;
    for (let t = 0; t < ticks && !s.over; t++) {
      while (i < inputs.length && inputs[i][0] === t) {
        const lane = Math.min(2, Math.max(0, Math.floor(s.x / DODGE_LANE_WIDTH)));
        if (inputs[i][1] !== lane) {
          const threat = s.obstacles.filter((o) => o.lane === lane && o.y >= 0 && o.y < 340).sort((a, b) => b.y - a.y)[0];
          if (threat && firstSeen.has(threat)) reactions.push(t - firstSeen.get(threat)!);
        }
        neonDodgeSim.applyInput(s, inputs[i][1]);
        i++;
      }
      neonDodgeSim.step(s);
      for (const o of s.obstacles) if (o.y >= 0 && !firstSeen.has(o)) firstSeen.set(o, t + 1);
    }
    if (reactions.length) {
      const sorted = [...reactions].sort((a, b) => a - b);
      metrics.median_reaction_ticks = sorted[Math.floor(sorted.length / 2)];
      metrics.reaction_samples = sorted.length;
      if (sorted.length >= 10 && metrics.median_reaction_ticks < DODGE_MIN_HUMAN_REACTION_TICKS) flags.push('superhuman_reaction');
    }

    if (score >= DODGE_SOLVER_MIN_TICKS) {
      const perfect = perfectSurvivalTicks(seed, ticks + 600);
      metrics.perfect_ticks = perfect;
      metrics.share_of_perfect = Math.round((score / perfect) * 1000) / 1000;
      if (score >= perfect * DODGE_NEAR_PERFECT_RATIO) flags.push('near_perfect_play');
    }
  }

  return { flags, metrics };
}
