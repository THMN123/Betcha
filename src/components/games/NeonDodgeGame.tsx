import React, { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import {
  neonDodgeSim,
  DODGE_WIDTH,
  DODGE_HEIGHT,
  DODGE_PLAYER_Y,
  DODGE_PLAYER_RADIUS,
  DODGE_OBSTACLE_HEIGHT,
  type DodgeState,
} from '../../../supabase/functions/_shared/games/neondodge.ts';
import { GameHud, GameOverlays, type GameProps, type Theme } from './GameShell';

const theme: Theme = {
  accent: 'text-rose-400',
  button: 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 text-white shadow-lg shadow-rose-500/25',
  badge: 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
};
const COLORS = ['#f43f5e', '#fb7185', '#ec4899'];

function draw(ctx: CanvasRenderingContext2D, s: DodgeState) {
  const lw = DODGE_WIDTH / 3;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, DODGE_WIDTH, DODGE_HEIGHT);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * lw, 0);
    ctx.lineTo(i * lw, DODGE_HEIGHT);
    ctx.stroke();
  }
  ctx.fillStyle = '#f43f5e';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(s.x, DODGE_PLAYER_Y, DODGE_PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  for (const o of s.obstacles) {
    ctx.fillStyle = COLORS[o.colorIndex];
    ctx.shadowColor = COLORS[o.colorIndex];
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(o.lane * lw + 10, o.y, lw - 20, DODGE_OBSTACLE_HEIGHT, 6);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

const NeonDodgeGame: React.FC<GameProps> = ({ timeLimitSeconds, isPractice, getSeed, onFinish }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { stateRef, hud, start, sendInput } = useGameRun(
    neonDodgeSim,
    timeLimitSeconds,
    (r) => {
      soundFx.playGameOver();
      onFinish(r);
    },
    (s) => {
      if (s.passedThisTick > 0) soundFx.playPickup();
    }
  );

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && stateRef.current) draw(ctx, stateRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stateRef]);

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
        <canvas ref={canvasRef} width={DODGE_WIDTH} height={DODGE_HEIGHT} className="w-full h-full touch-none" />
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
        />
      </div>
      <div className="w-full mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((l) => (
          <button
            key={l}
            type="button"
            disabled={!hud.running}
            onClick={() => toLane(l)}
            className={`py-3 rounded-xl border text-xs font-bold font-mono transition-all ${
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
