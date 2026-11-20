import React, { useEffect, useRef, useState } from 'react';
import type { LiveFeed } from '../../hooks/useLiveMatch';
import { Play, RotateCcw, Loader2, Trophy, LogOut, ShieldCheck, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import type { RunHud, RunResult } from '../../hooks/useGameRun';
import type { InputEvent } from '../../../supabase/functions/_shared/games/index.ts';
import { RESUME_COUNTDOWN_MS } from '../../games/runCheckpoint';
import type { GameId } from '../../types';
import { GAMES_LIST } from '../../data/initialData';
import GameCover, { GAME_ACCENT } from '../ui/GameCover';
import { useApp } from '../../context/AppContext';

/** A cut-off match run to continue (rebuilt from its recorded inputs). */
export interface ResumeFrom {
  ticks: number;
  inputs: InputEvent[];
}

/** Props every Betcha game component takes. */
export interface GameProps {
  timeLimitSeconds: number;
  isPractice: boolean;
  /** Returns the seed to play with (a match's shared seed, or a random one for practice). null = can't start. */
  getSeed: () => Promise<number | null>;
  onFinish: (result: RunResult) => void;
  /** Live feed of the other players in the match (display only). */
  live?: LiveFeed | null;
  /** Opponent ids, in a stable order, for ghost colors. */
  opponentIds?: string[];
  /** Local timestamp (Date.now() scale) when the synchronized match start fires; null = manual start. */
  autoStartAt?: number | null;
  /** Run progress so far, after every step and input (match runs save a resumable checkpoint). */
  onProgress?: (ticks: number, inputs: InputEvent[], kind: 'tick' | 'input') => void;
  /** Continue this cut-off run instead of starting a new one. */
  resumeFrom?: ResumeFrom | null;
}

/** A short buzz on phones that support it (a physical "click" for game controls). */
export function haptic(ms = 8): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

// ---------------------------------------------------------------------------
// Personal best (this device), per game
// ---------------------------------------------------------------------------
const bestKey = (g: GameId) => `betcha_best_${g}`;
export function readBest(g: GameId): number {
  try {
    return Number(localStorage.getItem(bestKey(g)) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function writeBest(g: GameId, v: number): void {
  try {
    localStorage.setItem(bestKey(g), String(v));
  } catch {
    /* storage unavailable */
  }
}

/** Counts up to `to` once it's set (for the results screen). */
function useCountUp(to: number, active: boolean): number {
  const [v, setV] = useState(active ? 0 : to);
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || to <= 0) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, active]);
  return v;
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
/** Score, time and a time bar. survivalMode: show time survived instead of a countdown. */
export const GameHud: React.FC<{
  hud: RunHud;
  gameId: GameId;
  label: string;
  timeLimitSeconds: number;
  extra?: React.ReactNode;
  survivalMode?: boolean;
  formatScore?: (n: number) => string;
}> = ({ hud, gameId, label, timeLimitSeconds, extra, survivalMode, formatScore }) => {
  const accent = GAME_ACCENT[gameId];
  const urgent = !survivalMode && hud.running && hud.secondsLeft <= 10;
  const left = Math.max(0, Math.min(1, hud.secondsLeft / Math.max(1, timeLimitSeconds)));
  // Survival games show your best on the right (their score already is the time survived).
  const best = survivalMode ? Math.max(readBest(gameId), hud.over ? hud.score : 0) : 0;
  return (
    <div className="w-full mb-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</div>
          <div className="text-4xl font-extrabold tabular-nums leading-none mt-1" style={{ color: accent.glow, textShadow: `0 0 24px ${accent.glow}55` }}>
            {formatScore ? formatScore(hud.score) : hud.score.toLocaleString()}
          </div>
        </div>
        {extra}
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{survivalMode ? 'Best' : 'Time'}</div>
          <div className={`text-2xl font-extrabold tabular-nums leading-none mt-1 ${urgent ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {survivalMode ? (best > 0 ? (formatScore ? formatScore(best) : best.toLocaleString()) : '–') : `${hud.secondsLeft}s`}
          </div>
        </div>
      </div>
      {!survivalMode && (
        <div className="mt-3 h-1.5 rounded-full bg-white/[0.07] overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${left * 100}%`, background: urgent ? '#fb7185' : accent.glow, boxShadow: `0 0 12px ${urgent ? '#fb7185' : accent.glow}` }}
          />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Overlays: start, countdown, resume, results
// ---------------------------------------------------------------------------
export const GameOverlays: React.FC<{
  hud: RunHud;
  gameId: GameId;
  howTo: string;
  /** Short control hints, e.g. ['Swipe', 'Arrow keys']. */
  controls: string[];
  isPractice: boolean;
  timeLimitSeconds: number;
  getSeed: () => Promise<number | null>;
  start: (seed: number) => void;
  autoStartAt?: number | null;
  resumeFrom?: ResumeFrom | null;
  resume?: (seed: number, ticks: number, inputs: InputEvent[]) => void;
  formatScore?: (n: number) => string;
}> = ({ hud, gameId, howTo, controls, isPractice, getSeed, start, autoStartAt, resumeFrom, resume, formatScore }) => {
  const { exitArena } = useApp();
  const game = GAMES_LIST.find((g) => g.id === gameId)!;
  const accent = GAME_ACCENT[gameId];
  const fmt = formatScore ?? ((n: number) => n.toLocaleString());

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const autoFired = useRef(false);
  // A cut-off run continues by itself after a short countdown.
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  useEffect(() => {
    if (resumeFrom && resume && !hud.running && !hud.over && resumeAt === null && !autoFired.current) setResumeAt(Date.now() + RESUME_COUNTDOWN_MS);
  }, [resumeFrom, resume, hud.running, hud.over, resumeAt]);
  // Opening the arena after the synchronized start has passed must not drop you into a running
  // game: late arrivals get the title screen and start their run when they're ready.
  const lateStart = useRef<boolean | null>(null);
  if (autoStartAt && lateStart.current === null) lateStart.current = autoStartAt < Date.now() - 1000;
  const fireAt = resumeAt ?? (autoStartAt && !lateStart.current ? autoStartAt : null);
  const countingDown = !!fireAt && !hud.running && !hud.over && fireAt > now - 1000 && !autoFired.current;

  // Personal best: compare once when a run ends.
  const [best, setBest] = useState(() => readBest(gameId));
  const [newBest, setNewBest] = useState(false);
  const wasOver = useRef(false);
  useEffect(() => {
    if (hud.over && !wasOver.current) {
      const prev = readBest(gameId);
      if (hud.score > prev) {
        writeBest(gameId, hud.score);
        setNewBest(prev > 0 || hud.score > 0);
        setBest(hud.score);
      } else setNewBest(false);
    }
    wasOver.current = hud.over;
  }, [hud.over, hud.score, gameId]);
  const shown = useCountUp(hud.score, hud.over);

  // Synchronized start (or resume): count down, then the run starts at that moment.
  useEffect(() => {
    if (!fireAt || hud.running || hud.over || autoFired.current) return;
    const iv = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= fireAt && !autoFired.current) {
        autoFired.current = true;
        begin();
      }
    }, 100);
    return () => clearInterval(iv);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async () => {
    if (starting) return;
    setStarting(true);
    setError(false);
    try {
      const seed = await getSeed();
      if (seed === null) setError(true);
      else if (resumeFrom && resume) resume(seed, resumeFrom.ticks, resumeFrom.inputs);
      else start(seed);
    } finally {
      setStarting(false);
    }
  };

  const primary =
    'h-13 min-h-[52px] w-full rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_12px_32px_-12px_rgba(255,255,255,0.6)] disabled:opacity-60';

  // Countdown (match start or resume)
  if (countingDown && !starting) {
    const secs = Math.max(0, Math.ceil((fireAt! - now) / 1000));
    return (
      <div className="absolute inset-0 z-10 bg-zinc-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300 mb-4">
          {resumeFrom ? 'Picking up where you stopped' : 'Everyone starts together'}
        </p>
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              key={secs}
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={accent.glow}
              strokeWidth="5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              className="countdown-ring"
              style={{ filter: `drop-shadow(0 0 6px ${accent.glow})` }}
            />
          </svg>
          <span key={`n${secs}`} className="text-6xl font-extrabold tabular-nums text-white animate-countdown">
            {secs > 0 ? secs : 'GO'}
          </span>
        </div>
      </div>
    );
  }

  // A cut-off run waiting to be resumed by hand (if the automatic resume failed)
  if (!hud.running && !hud.over && resumeFrom) {
    return (
      <div className="absolute inset-0 z-10 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
        <h3 className="text-2xl font-extrabold text-white mb-1">Your run was cut off</h3>
        <p className="text-sm text-zinc-400 mb-6 max-w-[280px]">
          {error ? "We couldn't reach the server to continue it. Check your connection and try again." : 'Nothing is lost: it continues exactly where it stopped.'}
        </p>
        <button type="button" onClick={begin} disabled={starting} className={primary}>
          {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
          {starting ? 'Resuming...' : 'Resume my run'}
        </button>
      </div>
    );
  }

  // Title screen
  if (!hud.running && !hud.over) {
    return (
      <div className="absolute inset-0 z-10 overflow-hidden">
        <GameCover gameId={gameId} className="absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-zinc-950/30" />
        <div className="relative h-full flex flex-col justify-end p-5 sm:p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accent.glow }}>
            {isPractice ? 'Practice' : 'Match run'}
          </div>
          <h3 className="text-3xl font-extrabold text-white tracking-tight leading-tight">{game.title}</h3>
          <p className="text-sm text-zinc-300 mt-1.5 leading-relaxed">{howTo}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {controls.map((c) => (
              <span key={c} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur text-xs font-semibold text-zinc-100">
                {c}
              </span>
            ))}
            {best > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-300/15 text-xs font-semibold text-amber-200 inline-flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Best {fmt(best)}
              </span>
            )}
          </div>
          {!isPractice && (
            <p className="text-xs text-zinc-400 mt-3 flex gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: accent.glow }} />
              One run per match. It starts when you tap, and everyone gets the exact same game.
            </p>
          )}
          {error && <p className="text-xs text-rose-300 mt-3">Your run didn't start. Check your connection and tap to try again.</p>}
          <button type="button" onClick={begin} disabled={starting} className={`${primary} mt-5`}>
            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {starting ? 'Starting...' : isPractice ? 'Start' : 'Start my run'}
          </button>
        </div>
      </div>
    );
  }

  // Results
  if (hud.over) {
    return (
      <div className="absolute inset-0 z-10 bg-zinc-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">{hud.secondsLeft === 0 ? "Time's up" : 'Game over'}</div>
        <div className="mt-2 text-6xl font-extrabold tabular-nums text-white" style={{ textShadow: `0 0 40px ${accent.glow}80` }}>
          {fmt(shown)}
        </div>
        <div className="mt-1 text-sm text-zinc-400">{formatScore ? 'survived' : 'points'}</div>
        {newBest ? (
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-300 text-zinc-950 text-sm font-extrabold animate-in zoom-in-95">
            <Sparkles className="w-4 h-4" /> New personal best
          </div>
        ) : (
          best > 0 && (
            <div className="mt-4 text-sm text-zinc-400 inline-flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-300" /> Best {fmt(best)}
            </div>
          )
        )}
        {isPractice ? (
          <div className="mt-7 w-full max-w-[300px] space-y-2">
            <button type="button" onClick={begin} className={primary}>
              <RotateCcw className="w-5 h-5" /> Play again
            </button>
            <button
              type="button"
              onClick={exitArena}
              className="w-full h-11 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Exit
            </button>
          </div>
        ) : (
          <p className="mt-7 text-sm text-zinc-300 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Verifying your run...
          </p>
        )}
      </div>
    );
  }
  return null;
};

export type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * On-screen arrow pad. Fires on pointer-down (no tap delay), with a small buzz on phones.
 * Laid out as a cross so thumbs find it without looking.
 */
export const DPad: React.FC<{ disabled: boolean; onDir: (d: Dir) => void }> = ({ disabled, onDir }) => {
  const btn = (d: Dir, Icon: React.FC<{ className?: string }>, label: string, area: string) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (disabled) return;
        haptic();
        onDir(d);
      }}
      className={`pad w-[68px] h-14 ${area}`}
      style={{ touchAction: 'none' }}
    >
      <Icon className="w-6 h-6" />
    </button>
  );
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-1.5 justify-center" style={{ gridTemplateAreas: '". u ." "l d r"' }}>
      {btn('up', ArrowUp, 'Up', '[grid-area:u]')}
      {btn('left', ArrowLeft, 'Left', '[grid-area:l]')}
      {btn('down', ArrowDown, 'Down', '[grid-area:d]')}
      {btn('right', ArrowRight, 'Right', '[grid-area:r]')}
    </div>
  );
};

/** The play-field frame: rounded, with the game's glow. */
export const Board: React.FC<{ gameId: GameId; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>> = ({
  gameId,
  className = '',
  children,
  ...rest
}) => {
  const a = GAME_ACCENT[gameId];
  return (
    <div
      {...rest}
      className={`relative w-full rounded-3xl overflow-hidden touch-none select-none border border-white/10 ${className}`}
      style={{ boxShadow: `0 0 0 1px ${a.glow}22, 0 24px 60px -20px ${a.glow}55` }}
    >
      {children}
    </div>
  );
};

/** Random seed for practice runs. */
export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] & 0x7fffffff;
}
