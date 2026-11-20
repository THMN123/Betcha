import React, { useEffect, useRef } from 'react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import { g2048Sim, Move2048 } from '../../../supabase/functions/_shared/games/g2048.ts';
import { maxTicksFor } from '../../../supabase/functions/_shared/games/index.ts';
import { useGhosts } from '../../games/useGhosts';
import { GameHud, GameOverlays, DPad, Board, haptic, type GameProps, type Dir } from './GameShell';

// Cool to hot as tiles grow: easy to read at a glance.
const TILE: Record<number, string> = {
  2: 'bg-violet-950/80 text-violet-200',
  4: 'bg-violet-900 text-violet-100',
  8: 'bg-indigo-700 text-white',
  16: 'bg-indigo-500 text-white',
  32: 'bg-sky-500 text-white',
  64: 'bg-emerald-400 text-zinc-950',
  128: 'bg-lime-300 text-zinc-950',
  256: 'bg-amber-300 text-zinc-950',
  512: 'bg-orange-400 text-zinc-950',
  1024: 'bg-rose-500 text-white',
  2048: 'bg-gradient-to-br from-fuchsia-400 via-rose-400 to-amber-300 text-zinc-950',
};
const GLOW: Record<number, string> = { 64: '#34d399', 128: '#bef264', 256: '#fcd34d', 512: '#fb923c', 1024: '#f43f5e', 2048: '#f0abfc' };

const EMPTY_BOARD = Array.from({ length: 4 }, () => Array(4).fill(0));

const Puzzle2048Game: React.FC<GameProps> = ({ timeLimitSeconds, isPractice, getSeed, onFinish, live, autoStartAt, onProgress, resumeFrom }) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Opponents' boards are rebuilt from their moves; we only show their score.
  const ghosts = useGhosts(g2048Sim, live, maxTicksFor(g2048Sim, timeLimitSeconds), 0);
  const { stateRef, hud, start, resume, sendInput } = useGameRun(
    g2048Sim,
    timeLimitSeconds,
    (r) => {
      soundFx.playGameOver();
      live?.finish(r.ticks);
      live?.setMyScore(r.score, true);
      onFinish(r);
    },
    {
      afterStep: (_s, tick) => live?.tick(tick),
      onStart: (seed) => ghosts.setSeed(seed),
      onInput: (ev) => live?.input(ev),
      onProgress,
    }
  );

  const move = (code: number) => {
    const before = stateRef.current?.score ?? 0;
    haptic();
    sendInput(code);
    const after = stateRef.current?.score ?? 0;
    if (after > before) soundFx.playMerge();
    live?.setMyScore(after, false);
  };

  useEffect(() => {
    const keys: Record<string, number> = {
      ArrowUp: Move2048.UP, w: Move2048.UP,
      ArrowDown: Move2048.DOWN, s: Move2048.DOWN,
      ArrowLeft: Move2048.LEFT, a: Move2048.LEFT,
      ArrowRight: Move2048.RIGHT, d: Move2048.RIGHT,
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.key in keys) || !hud.running) return;
      e.preventDefault();
      move(keys[e.key]);
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
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? Move2048.RIGHT : Move2048.LEFT);
    else move(dy > 0 ? Move2048.DOWN : Move2048.UP);
  };

  const board = stateRef.current?.board ?? EMPTY_BOARD;
  const DIRS: Record<Dir, number> = { up: Move2048.UP, down: Move2048.DOWN, left: Move2048.LEFT, right: Move2048.RIGHT };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      <GameHud hud={hud} gameId="2048" label="Score" timeLimitSeconds={timeLimitSeconds} />
      <Board
        gameId="2048"
        className="aspect-square bg-zinc-950 p-2.5"
        onTouchStart={(e) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full">
          {board.map((row, r) =>
            row.map((val, c) => (
              <div
                key={`${r}-${c}`}
                className={`flex items-center justify-center rounded-2xl font-extrabold tabular-nums transition-colors duration-150 ${
                  val ? TILE[val] ?? TILE[2048] : 'bg-white/[0.04]'
                } ${val >= 1024 ? 'text-xl sm:text-2xl' : val >= 128 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}
                style={GLOW[val] || val > 2048 ? { boxShadow: `0 0 22px -4px ${GLOW[val] ?? GLOW[2048]}` } : undefined}
              >
                {val > 0 ? val : ''}
              </div>
            ))
          )}
        </div>
        <GameOverlays
          hud={hud}
          gameId="2048"
          howTo="Slide the tiles to merge matching numbers. Bigger merges score more. Score as much as you can before time runs out."
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
        <DPad disabled={!hud.running} onDir={(d) => move(DIRS[d])} />
      </div>
    </div>
  );
};

export default Puzzle2048Game;
