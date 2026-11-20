import React, { useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import { g2048Sim, Move2048 } from '../../../supabase/functions/_shared/games/g2048.ts';
import { maxTicksFor } from '../../../supabase/functions/_shared/games/index.ts';
import { useGhosts } from '../../games/useGhosts';
import { GameHud, GameOverlays, type GameProps, type Theme } from './GameShell';

const theme: Theme = {
  accent: 'text-purple-400',
  button: 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 text-white shadow-lg shadow-purple-500/25',
  badge: 'bg-purple-500/10 border border-purple-500/20 text-purple-400',
};

const TILE: Record<number, string> = {
  2: 'bg-purple-950 text-purple-200 border-purple-800',
  4: 'bg-purple-900 text-purple-100 border-purple-700',
  8: 'bg-indigo-800 text-white border-indigo-500 shadow-lg shadow-indigo-500/20',
  16: 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/40',
  32: 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-500/40',
  64: 'bg-emerald-500 text-zinc-950 font-black border-emerald-300 shadow-xl',
  128: 'bg-amber-500 text-zinc-950 font-black border-amber-300 shadow-xl',
  256: 'bg-amber-400 text-zinc-950 font-black border-amber-200 shadow-2xl',
  512: 'bg-rose-500 text-white font-black border-rose-300 shadow-2xl',
  1024: 'bg-pink-500 text-white font-black border-pink-300 shadow-2xl',
  2048: 'bg-gradient-to-r from-emerald-400 via-purple-500 to-pink-500 text-zinc-950 font-black border-white shadow-2xl animate-pulse',
};

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
  const pad = 'w-14 h-12 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-purple-500 active:text-white flex items-center justify-center text-zinc-300 shadow-md disabled:opacity-40';

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto p-3">
      <GameHud hud={hud} label="Merge Score" theme={theme} />
      <div
        onTouchStart={(e) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={onTouchEnd}
        className="relative w-full aspect-square bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-3 shadow-2xl grid grid-cols-4 gap-2.5 touch-none select-none"
      >
        {board.map((row, r) =>
          row.map((val, c) => (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center rounded-xl border font-mono text-base sm:text-lg font-bold transition-all duration-150 ${
                TILE[val] ?? (val ? TILE[2048] : 'bg-zinc-900/80 border-zinc-800 text-zinc-600')
              }`}
            >
              {val > 0 ? val : ''}
            </div>
          ))
        )}
        <GameOverlays
          hud={hud}
          title="2048 Neon Rush"
          howTo="Slide tiles to merge matching numbers. Score as much as you can before time runs out."
          icon={<Sparkles className="w-7 h-7" />}
          theme={theme}
          isPractice={isPractice}
          timeLimitSeconds={timeLimitSeconds}
          getSeed={getSeed}
          start={start}
          autoStartAt={autoStartAt}
          resumeFrom={resumeFrom}
          resume={resume}
        />
      </div>
      <div className="w-full mt-4 flex flex-col items-center gap-1.5">
        <button type="button" className={pad} disabled={!hud.running} onClick={() => move(Move2048.UP)}><ArrowUp className="w-6 h-6" /></button>
        <div className="flex items-center gap-2">
          <button type="button" className={pad} disabled={!hud.running} onClick={() => move(Move2048.LEFT)}><ArrowLeft className="w-6 h-6" /></button>
          <button type="button" className={pad} disabled={!hud.running} onClick={() => move(Move2048.DOWN)}><ArrowDown className="w-6 h-6" /></button>
          <button type="button" className={pad} disabled={!hud.running} onClick={() => move(Move2048.RIGHT)}><ArrowRight className="w-6 h-6" /></button>
        </div>
      </div>
    </div>
  );
};

export default Puzzle2048Game;
