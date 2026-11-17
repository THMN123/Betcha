import React, { useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import { peerColor } from '../../hooks/useLiveMatch';
import { snakeSim, SnakeAction, SNAKE_GRID, type SnakeState, type Cell } from '../../../supabase/functions/_shared/games/snake.ts';
import { GameHud, GameOverlays, type GameProps, type Theme } from './GameShell';
import { useCanvasLoop, glowDot, lerp } from './canvas';

const theme: Theme = {
  accent: 'text-emerald-400',
  button: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/25',
  badge: 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
};

const SIZE = 320;
const CELL = SIZE / SNAKE_GRID;
const TICK_MS = snakeSim.tickMs;

/** Grid is drawn once into an offscreen canvas, then blitted each frame. */
let gridCache: HTMLCanvasElement | null = null;
function grid(): HTMLCanvasElement {
  if (gridCache) return gridCache;
  const c = document.createElement('canvas');
  c.width = SIZE * 2; // matches the 2x canvas cap, so drawing it is a straight copy
  c.height = SIZE * 2;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  g.fillStyle = '#090d16';
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = '#162033';
  g.lineWidth = 0.5;
  for (let i = 1; i < SNAKE_GRID; i++) {
    g.beginPath();
    g.moveTo(i * CELL, 0);
    g.lineTo(i * CELL, SIZE);
    g.moveTo(0, i * CELL);
    g.lineTo(SIZE, i * CELL);
    g.stroke();
  }
  gridCache = c;
  return c;
}

/** Positions of each segment, interpolated between the previous and current tick. */
function interpolated(prev: Cell[] | null, cur: Cell[], t: number): { x: number; y: number }[] {
  return cur.map((c, i) => {
    const p = prev ? prev[Math.min(i, prev.length - 1)] : c;
    // never interpolate across a wrap/teleport (more than one cell apart)
    const far = Math.abs(p.x - c.x) + Math.abs(p.y - c.y) > 1;
    return { x: (far ? c.x : lerp(p.x, c.x, t)) * CELL + CELL / 2, y: (far ? c.y : lerp(p.y, c.y, t)) * CELL + CELL / 2 };
  });
}

function drawSnakeBody(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], body: string, head: string, width: number) {
  if (pts.length === 0) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = body;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  glowDot(ctx, pts[0].x, pts[0].y, width * 0.62, head);
}

function unflatten(g: unknown): Cell[] | null {
  if (!Array.isArray(g) || g.length < 2) return null;
  const out: Cell[] = [];
  for (let i = 0; i + 1 < g.length; i += 2) out.push({ x: Number(g[i]), y: Number(g[i + 1]) });
  return out;
}

const SnakeGame: React.FC<GameProps> = ({ timeLimitSeconds, isPractice, getSeed, onFinish, live, opponentIds = [], autoStartAt }) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const prevSnake = useRef<Cell[] | null>(null);

  const { stateRef, alphaRef, hud, start, sendInput } = useGameRun(
    snakeSim,
    timeLimitSeconds,
    (r) => {
      soundFx.playGameOver();
      const s = stateRef.current;
      live?.send({ s: r.score, t: r.ticks, st: 'd', g: s ? s.snake.flatMap((c) => [c.x, c.y]) : undefined });
      onFinish(r);
    },
    {
      beforeStep: (s) => {
        prevSnake.current = s.snake.map((c) => ({ ...c }));
      },
      afterStep: (s, tick) => {
        if (s.ateBonus) soundFx.playCashChing();
        else if (s.ateFood) soundFx.playPickup();
        // Broadcast every tick (~9/s): compact flat cell list.
        live?.send({ s: s.score, t: tick, st: 'p', g: s.snake.flatMap((c) => [c.x, c.y]) });
      },
    }
  );

  const canvasRef = useCanvasLoop(SIZE, SIZE, (ctx, now) => {
    ctx.drawImage(grid(), 0, 0, SIZE, SIZE);
    const s = stateRef.current;

    // Opponents' ghosts (behind your own snake), interpolated between their last two updates.
    if (live) {
      for (const peer of live.peersRef.current.values()) {
        const cur = unflatten(peer.g);
        if (!cur) continue;
        const prev = unflatten(peer.prevG);
        const t = peer.st === 'd' ? 1 : Math.min(1, (now - peer.at) / TICK_MS);
        const pts = interpolated(prev, cur, t);
        const color = peerColor(peer.id, opponentIds);
        ctx.globalAlpha = peer.st === 'd' ? 0.18 : 0.38;
        drawSnakeBody(ctx, pts, color, color, CELL * 0.62);
        ctx.globalAlpha = 1;
        ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        // label above the head, or below it when the head is on the top row
        const ly = pts[0].y < CELL * 1.5 ? pts[0].y + CELL * 1.25 : pts[0].y - CELL * 0.75;
        ctx.fillText(peer.n, Math.min(SIZE - 20, Math.max(20, pts[0].x)), ly);
      }
    }

    if (!s) return;
    if (s.food) glowDot(ctx, s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL / 2.6, '#10b981');
    if (s.bonus) {
      const pulse = 1 + Math.sin(now / 120) * 0.08;
      glowDot(ctx, s.bonus.x * CELL + CELL / 2, s.bonus.y * CELL + CELL / 2, (CELL / 2.1) * pulse, '#f59e0b');
    }
    const t = hud.over || s.over ? 1 : alphaRef.current;
    drawSnakeBody(ctx, interpolated(prevSnake.current, s.snake, t), '#059669', '#34d399', CELL * 0.78);
  });

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
        <canvas ref={canvasRef} className="w-full h-full touch-none block" />
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
          autoStartAt={autoStartAt}
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
