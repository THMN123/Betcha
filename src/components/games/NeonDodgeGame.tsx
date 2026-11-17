import React, { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import { peerColor } from '../../hooks/useLiveMatch';
import {
  neonDodgeSim,
  dodgeSpeed,
  DODGE_WIDTH,
  DODGE_HEIGHT,
  DODGE_LANE_WIDTH,
  DODGE_PLAYER_Y,
  DODGE_PLAYER_RADIUS,
  DODGE_OBSTACLE_HEIGHT,
  DODGE_OBSTACLE_INSET,
} from '../../../supabase/functions/_shared/games/neondodge.ts';
import { maxTicksFor } from '../../../supabase/functions/_shared/games/index.ts';
import { useGhosts } from '../../games/useGhosts';
import { GameHud, GameOverlays, type GameProps, type Theme } from './GameShell';
import { useCanvasLoop, glowDot, lerp } from './canvas';

const theme: Theme = {
  accent: 'text-rose-400',
  button: 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 text-white shadow-lg shadow-rose-500/25',
  badge: 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
};
const COLORS = ['#f43f5e', '#fb7185', '#ec4899'];

const NeonDodgeGame: React.FC<GameProps> = ({ timeLimitSeconds, isPractice, getSeed, onFinish, live, opponentIds = [], autoStartAt }) => {
  const prevX = useRef<number | null>(null);
  // Same walls for everyone (shared seed + synchronized start): draw opponents' orbs at "now".
  const ghosts = useGhosts(neonDodgeSim, live, maxTicksFor(neonDodgeSim, timeLimitSeconds), 0);

  const { stateRef, alphaRef, hud, start, sendInput } = useGameRun(
    neonDodgeSim,
    timeLimitSeconds,
    (r) => {
      soundFx.playGameOver();
      live?.finish(r.ticks);
      live?.setMyScore(r.score, true);
      onFinish(r);
    },
    {
      beforeStep: (s) => {
        prevX.current = s.x;
      },
      afterStep: (s, tick) => {
        if (s.passedThisTick > 0) soundFx.playPickup();
        live?.tick(tick);
        if (tick % 6 === 0) live?.setMyScore(s.tick, false);
      },
      onStart: (seed) => ghosts.setSeed(seed),
      onInput: (ev) => live?.input(ev),
    }
  );

  const canvasRef = useCanvasLoop(DODGE_WIDTH, DODGE_HEIGHT, (ctx, now) => {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, DODGE_WIDTH, DODGE_HEIGHT);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(DODGE_LANE_WIDTH - 1, 0, 2, DODGE_HEIGHT);
    ctx.fillRect(DODGE_LANE_WIDTH * 2 - 1, 0, 2, DODGE_HEIGHT);

    const s = stateRef.current;
    const t = s && !s.over ? alphaRef.current : 1;

    if (s) {
      // Walls moved `speed` px in the last tick: draw them part-way for smooth motion.
      const back = s.over ? 0 : dodgeSpeed(s.tick) * (1 - t);
      for (const o of s.obstacles) {
        const x = o.lane * DODGE_LANE_WIDTH + DODGE_OBSTACLE_INSET;
        const w = DODGE_LANE_WIDTH - DODGE_OBSTACLE_INSET * 2;
        const y = o.y - back;
        ctx.fillStyle = COLORS[o.colorIndex];
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.roundRect(x - 4, y - 4, w + 8, DODGE_OBSTACLE_HEIGHT + 8, 9);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, DODGE_OBSTACLE_HEIGHT, 6);
        ctx.fill();
      }
    }

    // Opponents' orbs (ghosts).
    let views: ReturnType<typeof ghosts.views> = [];
    try {
      views = ghosts.views(performance.now()); // decoration only: never let it break your run
    } catch (e) {
      console.warn('ghost render skipped', e);
    }
    for (const g of views) {
      const gx = g.done ? g.cur.x : lerp(g.prev.x, g.cur.x, g.frac);
      const color = peerColor(g.id, opponentIds);
      glowDot(ctx, gx, DODGE_PLAYER_Y, DODGE_PLAYER_RADIUS * 0.85, color, g.done ? 0.25 : 0.55);
      ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(g.name, gx, DODGE_PLAYER_Y + DODGE_PLAYER_RADIUS + 12);
    }

    if (s) {
      const x = prevX.current === null ? s.x : lerp(prevX.current, s.x, t);
      glowDot(ctx, x, DODGE_PLAYER_Y, DODGE_PLAYER_RADIUS, '#f43f5e');
    }
  });

  const toLane = (lane: number) => {
    if (stateRef.current?.targetLane === lane) return;
    soundFx.playClick();
    sendInput(lane);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hud.running) return;
      const lane = stateRef.current?.targetLane ?? 1;
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        toLane(Math.max(0, lane - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        toLane(Math.min(2, lane + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!hud.running) return;
    const rect = e.currentTarget.getBoundingClientRect();
    toLane(Math.min(2, Math.floor(((e.touches[0].clientX - rect.left) / rect.width) * 3)));
  };

  const lane = stateRef.current?.targetLane ?? 1;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto p-3">
      <GameHud hud={hud} label="Distance" theme={theme} survivalMode />
      <div
        onTouchStart={onTouch}
        className="relative w-full aspect-[280/380] bg-zinc-950 border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-2xl touch-none select-none"
      >
        <canvas ref={canvasRef} className="w-full h-full touch-none block" />
        <GameOverlays
          hud={hud}
          title="Neon Reflex Dodge"
          howTo="Tap a lane (or use arrow keys) to slide over and dodge the walls. They keep speeding up, so the run ends when you crash. Last longest to win."
          icon={<Zap className="w-7 h-7" />}
          theme={theme}
          isPractice={isPractice}
          timeLimitSeconds={timeLimitSeconds}
          getSeed={getSeed}
          start={start}
          autoStartAt={autoStartAt}
        />
      </div>
      <div className="w-full mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((l) => (
          <button
            key={l}
            type="button"
            disabled={!hud.running}
            onClick={() => toLane(l)}
            className={`py-3 rounded-xl border text-xs font-bold font-mono transition-colors ${
              lane === l ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
          >
            LANE {l + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NeonDodgeGame;
