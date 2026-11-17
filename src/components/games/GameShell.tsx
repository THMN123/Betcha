import React, { useState } from 'react';
import { Play, RotateCcw, Loader2 } from 'lucide-react';
import type { RunHud, RunResult } from '../../hooks/useGameRun';

/** Props every Betcha game component takes. */
export interface GameProps {
  timeLimitSeconds: number;
  isPractice: boolean;
  /** Returns the seed to play with (a match's shared seed, or a random one for practice). null = can't start. */
  getSeed: () => Promise<number | null>;
  onFinish: (result: RunResult) => void;
}

export interface Theme {
  accent: string; // tailwind text color class, e.g. 'text-emerald-400'
  button: string; // tailwind classes for the primary button
  badge: string; // tailwind classes for the result badge
}

/** Score/time header shared by all games. */
/** survivalMode: show time survived instead of a countdown (games that run until you fail). */
export const GameHud: React.FC<{ hud: RunHud; label: string; theme: Theme; extra?: React.ReactNode; survivalMode?: boolean }> = ({ hud, label, theme, extra, survivalMode }) => (
  <div className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 mb-2.5 shadow-md font-mono">
    <div>
      <span className="block text-[10px] text-zinc-400 uppercase font-semibold">{label}</span>
      <span className={`text-lg sm:text-xl font-black tracking-wider ${theme.accent}`}>{hud.score.toLocaleString()}</span>
    </div>
    {extra}
    <div className="text-right">
      <span className="block text-[10px] text-zinc-400 uppercase font-semibold">{survivalMode ? 'Survived' : 'Time'}</span>
      {survivalMode ? (
        <span className="text-lg sm:text-xl font-black text-white">{(hud.score / 60).toFixed(1)}s</span>
      ) : (
        <span className={`text-lg sm:text-xl font-black ${hud.secondsLeft <= 10 && hud.running ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
          {hud.secondsLeft}s
        </span>
      )}
    </div>
  </div>
);

/** Start / game-over overlays shared by all games. */
export const GameOverlays: React.FC<{
  hud: RunHud;
  title: string;
  howTo: string;
  icon: React.ReactNode;
  theme: Theme;
  isPractice: boolean;
  timeLimitSeconds: number;
  getSeed: () => Promise<number | null>;
  start: (seed: number) => void;
}> = ({ hud, title, howTo, icon, theme, isPractice, timeLimitSeconds, getSeed, start }) => {
  const [starting, setStarting] = useState(false);

  const begin = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const seed = await getSeed();
      if (seed !== null) start(seed);
    } finally {
      setStarting(false);
    }
  };

  if (!hud.running && !hud.over) {
    return (
      <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
        <div className={`w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 ${theme.accent}`}>{icon}</div>
        <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">{title}</h3>
        <p className="text-xs text-zinc-400 mb-2 max-w-[260px]">{howTo}</p>
        <p className="text-[11px] text-zinc-500 mb-5 max-w-[260px]">
          {isPractice
            ? 'Practice run. Nothing at stake.'
            : 'This is your one run for the match. It starts the moment you tap, and every player gets the exact same game.'}
        </p>
        <button
          type="button"
          onClick={begin}
          disabled={starting}
          className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 ${theme.button}`}
        >
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{starting ? 'Starting...' : isPractice ? 'Start practice' : 'Start my run'}</span>
        </button>
      </div>
    );
  }

  if (hud.over) {
    return (
      <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <span className={`px-3 py-1 font-bold text-xs uppercase rounded-full mb-2 ${theme.badge}`}>Run finished</span>
        <h3 className="text-2xl font-black text-white font-mono mb-1">{hud.score.toLocaleString()} PTS</h3>
        {isPractice ? (
          <button
            type="button"
            onClick={begin}
            className={`mt-4 w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 ${theme.button}`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Practice again</span>
          </button>
        ) : (
          <p className="text-xs text-zinc-400 mt-1">Verifying your run on the server...</p>
        )}
      </div>
    );
  }
  return null;
};

/** Random seed for practice runs. */
export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] & 0x7fffffff;
}
