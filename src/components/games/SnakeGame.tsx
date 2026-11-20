import React, { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import { peerColor } from '../../hooks/useLiveMatch';
import { maxTicksFor } from '../../../supabase/functions/_shared/games/index.ts';
import { useGhosts } from '../../games/useGhosts';
import { snakeSim, SnakeAction, SNAKE_GRID, type SnakeState, type Cell } from '../../../supabase/functions/_shared/games/snake.ts';
import { GameHud, GameOverlays, DPad, Board, haptic, type GameProps, type Dir } from './GameShell';
import { useCanvasLoop, glowDot, lerp } from './canvas';


const SIZE = 320;
const CELL = SIZE / SNAKE_GRID;

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

/** Opponent ghosts are decoration: if anything about them fails, skip them rather than break your game. */
function safeViews<T>(g: { views: (now: number) => T[] }, now: number): T[] {
  try {
    return g.views(now);
  } catch (e) {
    console.warn('ghost render skipped', e);
    return [];
  }
}

const SnakeGame: React.FC<GameProps> = ({ timeLimitSeconds, isPractice, getSeed, onFinish, live, opponentIds = [], autoStartAt, onProgress, resumeFrom }) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const prevSnake = useRef<Cell[] | null>(null);
  // Opponents are drawn ~250ms in the past so their (batched) moves have arrived: no visible corrections.
  const ghosts = useGhosts(snakeSim, live, maxTicksFor(snakeSim, timeLimitSeconds), 250);

  const { stateRef, alphaRef, hud, start, resume, sendInput } = useGameRun(
    snakeSim,
    timeLimitSeconds,
    (r) => {
      soundFx.playGameOver();
      live?.finish(r.ticks);
      live?.setMyScore(r.score, true);
      onFinish(r);
    },
    {
      beforeStep: (s) => {
        prevSnake.current = s.snake.map((c) => ({ ...c }));
      },
      afterStep: (s, tick) => {
        if (s.ateBonus) soundFx.playCashChing();
        else if (s.ateFood) soundFx.playPickup();
        live?.tick(tick);
        live?.setMyScore(s.score, false);
      },
      onStart: (seed) => ghosts.setSeed(seed),
      onInput: (ev) => live?.input(ev),
      onProgress,
    }
  );

  const canvasRef = useCanvasLoop(SIZE, SIZE, (ctx, now) => {
    ctx.drawImage(grid(), 0, 0, SIZE, SIZE);
    const s = stateRef.current;

    // Opponents' ghosts (behind your own snake), rebuilt locally from their inputs.
    for (const g of safeViews(ghosts, performance.now())) {
      const pts = interpolated(g.done ? null : g.prev.snake, g.cur.snake, g.done ? 1 : g.frac);
      const color = peerColor(g.id, opponentIds);
      ctx.globalAlpha = g.done ? 0.18 : 0.38;
      drawSnakeBody(ctx, pts, color, color, CELL * 0.62);
      ctx.globalAlpha = 1;
      ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      // label above the head, or below it when the head is on the top row
      const ly = pts[0].y < CELL * 1.5 ? pts[0].y + CELL * 1.25 : pts[0].y - CELL * 0.75;
      ctx.fillText(g.name, Math.min(SIZE - 20, Math.max(20, pts[0].x)), ly);
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
    haptic();
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? SnakeAction.RIGHT : SnakeAction.LEFT);
    else turn(dy > 0 ? SnakeAction.DOWN : SnakeAction.UP);
  };

  const multiplier = stateRef.current?.multiplier ?? 1;
  const DIRS: Record<Dir, number> = { up: SnakeAction.UP, down: SnakeAction.DOWN, left: SnakeAction.LEFT, right: SnakeAction.RIGHT };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      <GameHud
        hud={hud}
        gameId="snake"
        label="Score"
        timeLimitSeconds={timeLimitSeconds}
        extra={
          <div
            className={`mb-0.5 flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-extrabold transition-colors ${
              multiplier > 1 ? 'bg-amber-300 text-zinc-950' : 'bg-white/[0.07] text-zinc-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> {multiplier}x
          </div>
        }
      />
      <Board
        gameId="snake"
        className="aspect-square bg-zinc-950"
        onTouchStart={(e) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} className="w-full h-full touch-none block" />
        <GameOverlays
          hud={hud}
          gameId="snake"
          howTo="Eat orbs to score. Gold orbs raise your multiplier. Don't hit the walls or yourself."
          controls={['Swipe the board', 'Arrow pad', 'Arrow keys / WASD']}
          isPractice={isPractice}
          timeLimitSeconds={timeLimitSeconds}
          getSeed={getSeed}
          start={start}
          autoStartAt={autoStartAt}
          resumeFrom={resumeFrom}
          resume={resume}
        />
      </Board>
      <div className="mt-5">
        <DPad disabled={!hud.running} onDir={(d) => turn(DIRS[d])} />
      </div>
    </div>
  );
};

export default SnakeGame;
