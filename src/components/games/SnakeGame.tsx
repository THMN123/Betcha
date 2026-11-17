import React, { useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import { snakeSim, SnakeAction, SNAKE_GRID, type SnakeState } from '../../../supabase/functions/_shared/games/snake.ts';
import { GameHud, GameOverlays, type GameProps, type Theme } from './GameShell';

const theme: Theme = {
  accent: 'text-emerald-400',
  button: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/25',
  badge: 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
};

function draw(ctx: CanvasRenderingContext2D, s: SnakeState) {
  const { width: w, height: h } = ctx.canvas;
  const cell = w / SNAKE_GRID;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < SNAKE_GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, h);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(w, i * cell);
    ctx.stroke();
  }
  const orb = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x * cell + cell / 2, y * cell + cell / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  if (s.food) orb(s.food.x, s.food.y, cell / 2.5, '#10b981');
  if (s.bonus) orb(s.bonus.x, s.bonus.y, cell / 2, '#f59e0b');
  s.snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? '#34d399' : '#059669';
    ctx.beginPath();
    ctx.roundRect(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2, i === 0 ? 6 : 4);
    ctx.fill();
  });
}

const SnakeGame: React.FC<GameProps> = ({ timeLimitSeconds, isPractice, getSeed, onFinish }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const { stateRef, hud, start, sendInput } = useGameRun(
    snakeSim,
    timeLimitSeconds,
    (r) => {
      soundFx.playGameOver();
      onFinish(r);
    },
    (s) => {
      if (s.ateBonus) soundFx.playCashChing();
      else if (s.ateFood) soundFx.playPickup();
    }
  );

  // Draw every animation frame from the simulation state.
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

  const turn = (code: number) => {
    soundFx.playClick();
    sendInput(code);
  };

  useEffect(() => {
    const keys: Record<string, number> = {
      ArrowUp: SnakeAction.UP, w: SnakeAction.UP, W: SnakeAction.UP,
      ArrowDown: SnakeAction.DOWN, s: SnakeAction.DOWN, S: SnakeAction.DOWN,
      ArrowLeft: SnakeAction.LEFT, a: SnakeAction.LEFT, A: SnakeAction.LEFT,
      ArrowRight: SnakeAction.RIGHT, d: SnakeAction.RIGHT, D: SnakeAction.RIGHT,
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.key in keys) || !hud.running) return;
      e.preventDefault();
      turn(keys[e.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? SnakeAction.RIGHT : SnakeAction.LEFT);
    else turn(dy > 0 ? SnakeAction.DOWN : SnakeAction.UP);
  };

  const multiplier = stateRef.current?.multiplier ?? 1;
  const pad = 'w-12 h-10 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-emerald-500 active:text-zinc-950 flex items-center justify-center text-zinc-300 shadow-md disabled:opacity-30';

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto p-2 sm:p-3">
      <GameHud
        hud={hud}
        label="Score"
        theme={theme}
        extra={
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl text-amber-400 text-xs font-bold">
            <Zap className="w-3.5 h-3.5" />
            <span>{multiplier}x</span>
          </div>
        }
      />
      <div
        onTouchStart={(e) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={onTouchEnd}
        className="relative w-full aspect-square bg-zinc-950 border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-2xl touch-none select-none"
      >
        <canvas ref={canvasRef} width={320} height={320} className="w-full h-full touch-none" />
        <GameOverlays
          hud={hud}
          title="Cyber Snake"
          howTo="Swipe or use the arrows to eat orbs. Gold orbs raise your multiplier."
          icon={<Zap className="w-7 h-7" />}
          theme={theme}
          isPractice={isPractice}
          timeLimitSeconds={timeLimitSeconds}
          getSeed={getSeed}
          start={start}
        />
      </div>
      <div className="w-full mt-3 flex flex-col items-center gap-1">
        <button type="button" className={pad} disabled={!hud.running} onClick={() => turn(SnakeAction.UP)}><ArrowUp className="w-5 h-5" /></button>
        <div className="flex items-center gap-1.5">
          <button type="button" className={pad} disabled={!hud.running} onClick={() => turn(SnakeAction.LEFT)}><ArrowLeft className="w-5 h-5" /></button>
          <button type="button" className={pad} disabled={!hud.running} onClick={() => turn(SnakeAction.DOWN)}><ArrowDown className="w-5 h-5" /></button>
          <button type="button" className={pad} disabled={!hud.running} onClick={() => turn(SnakeAction.RIGHT)}><ArrowRight className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};

export default SnakeGame;
