import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import SnakeGame from '../games/SnakeGame';
import Puzzle2048Game from '../games/Puzzle2048Game';
import NeonDodgeGame from '../games/NeonDodgeGame';
import { GAMES_LIST } from '../../data/initialData';
import { randomSeed } from '../games/GameShell';
import type { RunResult } from '../../hooks/useGameRun';
import GameErrorBoundary from '../common/GameErrorBoundary';
import MatchSummaryOverlay from './MatchSummaryOverlay';
import { cr } from '../../utils/credits';
import { supabase } from '../../lib/supabaseClient';
import { useLiveMatch } from '../../hooks/useLiveMatch';
import LiveScoreboard from './LiveScoreboard';
import Sheet from '../ui/Sheet';
import { GAME_ACCENT } from '../ui/GameCover';
import type { InputEvent } from '../../../supabase/functions/_shared/games/index.ts';
import type { GameId } from '../../types';
import { canResume, loadCheckpoint, newRunToken, saveCheckpoint, type RunCheckpoint } from '../../games/runCheckpoint';

/** Everyone's run starts this long after the host taps Start (time to get every player into the arena). */
const SYNC_START_DELAY_MS = 6000;

/** Stable dependency for re-reading the checkpoint when the server-side run state changes. */
function localRunKey(myRun: string | undefined): string {
  return myRun ?? 'none';
}

const PlayArenaModal: React.FC = () => {
  const {
    activePlayingMatch,
    practiceGameId,
    exitArena,
    rooms,
    beginRun,
    submitRun,
    pendingSubmissions,
    user,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'game' | 'leaderboard'>('game');
  const [showSummary, setShowSummary] = useState<boolean>(false);

  // True from the moment this device starts a run until it has been submitted.
  // 'starting' is set BEFORE asking the server, so a data refresh that sees the new run can never
  // mistake it for one from another device and swap the game out mid-start.
  const [localRun, setLocalRun] = useState<'idle' | 'starting' | 'playing' | 'submitting'>('idle');

  // Live view of the other players (display only; results come from server verification).
  const matchId = activePlayingMatch?.id ?? null;
  const liveRoom = matchId ? rooms.find((r) => r.id === matchId) ?? activePlayingMatch : null;
  // How often batched moves go out: Neon Dodge ghosts are drawn in real time, so it batches tighter.
  const batchMs = liveRoom?.gameId === 'neondodge' ? 100 : liveRoom?.gameId === '2048' ? 300 : 200;
  const live = useLiveMatch(matchId, { id: user.id, name: user.displayName }, liveRoom?.players.map((p) => p.id) ?? [], batchMs);

  // Server clock offset, so every device fires the synchronized start at the same moment.
  const [clockOffset, setClockOffset] = useState<number | null>(null);
  useEffect(() => {
    setClockOffset(null);
    if (!matchId || !supabase) return;
    const t0 = Date.now();
    supabase.rpc('server_time').then(({ data, error }) => {
      const t1 = Date.now();
      setClockOffset(error || !data ? 0 : new Date(data as string).getTime() + (t1 - t0) / 2 - t1);
    });
  }, [matchId]);

  // This device's saved progress for the current match run (survives re-renders and reloads).
  const checkpoint = useMemo(
    () => (matchId && user.id ? loadCheckpoint(matchId, user.id) : null),
    // Re-read when the run's state changes (started, cut off, submitted).
    [matchId, user.id, localRunKey(liveRoom?.myRun), localRun] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const resumeFrom = useMemo(() => (checkpoint ? { ticks: checkpoint.ticks, inputs: checkpoint.inputs } : null), [checkpoint]);
  const progress = useRef<{ cp: RunCheckpoint | null; savedAt: number }>({ cp: null, savedAt: 0 });

  // Make sure the latest progress is on disk if the page is closed or hidden mid-run.
  useEffect(() => {
    const flush = () => {
      if (progress.current.cp) saveCheckpoint(progress.current.cp);
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  // Each new match/practice session starts on the game, not on a stale summary.
  useEffect(() => {
    setShowSummary(false);
    setActiveTab('game');
    setLocalRun('idle');
  }, [activePlayingMatch?.id, practiceGameId]);

  // Lock body scroll and prevent pull-to-refresh/viewport bounce when playing in Arena
  useEffect(() => {
    if (activePlayingMatch || practiceGameId) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';

      const preventTouchMove = (e: TouchEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Allow touch scrolling inside explicitly marked scrollable panels (e.g. leaderboard)
        if (!target.closest('.scrollable-content')) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      };

      document.addEventListener('touchmove', preventTouchMove, { passive: false });

      return () => {
        document.body.style.overflow = '';
        document.body.style.overscrollBehavior = '';
        document.removeEventListener('touchmove', preventTouchMove);
      };
    }
  }, [activePlayingMatch, practiceGameId]);

  if (!activePlayingMatch && !practiceGameId) return null;

  const isPractice = !!practiceGameId;
  const gameId = isPractice ? practiceGameId : activePlayingMatch?.gameId || 'snake';
  const gameInfo = GAMES_LIST.find((g) => g.id === gameId);

  // Live match state if tournament match
  const liveMatch = activePlayingMatch
    ? rooms.find((r) => r.id === activePlayingMatch.id) || activePlayingMatch
    : null;

  // A match run that this device isn't currently playing (already finished, or started elsewhere / before a reload).
  const runElsewhere = !isPractice && !!liveMatch?.myRun && localRun === 'idle';
  const awaitingVerification = !!liveMatch && pendingSubmissions.includes(liveMatch.id);
  const interrupted = runElsewhere && liveMatch?.myRun === 'started' && !awaitingVerification;
  // Was it cut off on THIS device? Then it can be resumed (or its moves submitted if time ran out).
  const savedRun = interrupted && checkpoint ? checkpoint : null;
  const resumable = !!savedRun && canResume(savedRun);
  const showGame = isPractice || !runElsewhere || resumable;

  const opponentIds = liveMatch ? liveMatch.players.filter((p) => !p.isCurrentUser).map((p) => p.id) : [];
  const autoStartAt =
    !isPractice && liveMatch?.status === 'in_progress' && liveMatch.startedAt && clockOffset !== null && !liveMatch.myRun
      ? new Date(liveMatch.startedAt).getTime() + SYNC_START_DELAY_MS - clockOffset
      : null;

  const getSeed = async (): Promise<number | null> => {
    if (isPractice || !liveMatch) return randomSeed();
    setLocalRun('starting');
    // Save the attempt BEFORE asking the server, so a lost reply or a reload can pick the same run back up.
    const existing = loadCheckpoint(liveMatch.id, user.id);
    if (existing?.seed !== undefined) {
      progress.current = { cp: existing, savedAt: Date.now() };
      setLocalRun('playing');
      return existing.seed;
    }
    const cp: RunCheckpoint = existing ?? {
      matchId: liveMatch.id,
      userId: user.id,
      gameId: liveMatch.gameId as GameId,
      durationSeconds: liveMatch.durationSeconds,
      token: newRunToken(),
      ticks: 0,
      inputs: [],
    };
    saveCheckpoint(cp);
    const res = await beginRun(liveMatch.id, cp.token);
    if (!res) {
      setLocalRun('idle');
      return null;
    }
    const serverStart = res.startedAt ? new Date(res.startedAt).getTime() - (clockOffset ?? 0) : Date.now();
    const started: RunCheckpoint = { ...cp, seed: res.seed, startedAt: Math.min(serverStart, Date.now()) };
    saveCheckpoint(started);
    progress.current = { cp: started, savedAt: Date.now() };
    setLocalRun('playing');
    return res.seed;
  };

  // Saved on every input, and at most 4x/second while the game just runs.
  const handleProgress = (ticks: number, inputs: InputEvent[], kind: 'tick' | 'input') => {
    const cp = progress.current.cp;
    if (isPractice || !cp) return;
    const next = { ...cp, ticks, inputs };
    progress.current.cp = next;
    const now = Date.now();
    if (kind === 'input' || now - progress.current.savedAt >= 250) {
      progress.current.savedAt = now;
      saveCheckpoint({ ...next, inputs: inputs.slice() });
    }
  };

  const liveProps = isPractice ? {} : { live, opponentIds, autoStartAt, onProgress: handleProgress, resumeFrom: resumable ? resumeFrom : null };

  const handleFinish = async (result: RunResult) => {
    if (isPractice || !liveMatch) return;
    progress.current.cp = null; // submitRun takes over (and clears the checkpoint)
    setLocalRun('submitting');
    await submitRun(liveMatch.id, result.inputs);
    setShowSummary(true);
  };

  const handleExit = () => {
    if (
      (localRun === 'playing' || localRun === 'starting') &&
      !window.confirm(
        "Leave now? The match clock keeps running. You can come back and resume from the lobby while there's time; after that, the moves you made so far are submitted."
      )
    ) {
      return;
    }
    exitArena();
  };

  const accent = GAME_ACCENT[gameId as GameId] ?? GAME_ACCENT.snake;
  const scoreLabel = gameId === 'neondodge' ? (t: number) => `${(t / 60).toFixed(1)}s` : undefined;

  const standings = liveMatch && (
    <div className="space-y-1.5">
      {liveMatch.players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${
            player.isCurrentUser ? 'bg-white/[0.06] border-white/15' : 'bg-white/[0.02] border-white/[0.05]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={player.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            <div className="min-w-0">
              <span className="block text-sm font-bold text-white truncate">
                {player.name} {player.isCurrentUser && <span className="text-zinc-400 font-normal">(you)</span>}
              </span>
              <span className="text-xs text-zinc-500">{player.isHost ? 'Host' : 'Player'}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            {player.score !== undefined ? (
              <>
                <span className="block text-sm font-extrabold text-white tabular-nums">{scoreLabel ? scoreLabel(player.score) : player.score.toLocaleString()}</span>
                {player.payout !== undefined && player.payout > 0 && <span className="text-xs font-bold text-amber-300">+{cr(player.payout)}</span>}
              </>
            ) : (
              <span className="text-xs text-zinc-500">playing...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="play-arena-modal fixed inset-0 z-50 bg-zinc-950 flex flex-col h-[100dvh] w-screen overflow-hidden select-none animate-in">
      {/* The game's color, glowing behind everything */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(900px 520px at 50% 18%, ${accent.glow}26, transparent 65%), radial-gradient(700px 400px at 50% 110%, ${accent.glow}14, transparent 70%)`,
        }}
      />

      {/* Top bar */}
      <div className="relative shrink-0 z-30 h-14 px-2 sm:px-4 flex items-center gap-2 pt-[env(safe-area-inset-top)] box-content">
        <button
          type="button"
          onClick={handleExit}
          aria-label="Leave"
          className="w-10 h-10 shrink-0 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-zinc-200 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-sm font-extrabold text-white truncate">{isPractice ? gameInfo?.title : liveMatch?.title}</div>
          <div className="text-xs text-zinc-400 truncate">
            {isPractice ? 'Practice · nothing at stake' : `${gameInfo?.title} · ${cr(liveMatch?.netPrizePool ?? 0)} prize`}
          </div>
        </div>
        {!isPractice && liveMatch ? (
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            aria-label="Standings"
            className="lg:invisible w-10 h-10 shrink-0 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-zinc-200 flex items-center justify-center"
          >
            <Trophy className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-10 h-10 shrink-0" />
        )}
      </div>

      {/* Game + (large screens) standings */}
      <div className="relative flex-1 w-full overflow-y-auto overflow-x-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center gap-6 lg:gap-10 max-w-6xl mx-auto">
        <div
          className="w-full max-w-sm flex flex-col items-center lg:pt-4"
          // Size the board to the screen height so the controls are always visible without scrolling.
          style={{ maxWidth: `min(24rem, calc((100dvh - ${(gameId === 'neondodge' ? 270 : 330) + (isPractice ? 0 : 76)}px) / ${gameId === 'neondodge' ? 1.36 : 1}))` }}
        >
          {liveMatch && !isPractice && <LiveScoreboard room={liveMatch} live={live} scoreLabel={scoreLabel} />}
          {interrupted && !resumable && (
            <div className="w-full p-5 rounded-2xl bg-zinc-900/80 border border-amber-300/25 text-center">
              {savedRun ? (
                <>
                  <p className="text-sm font-bold text-amber-300 mb-1">Your run was cut off</p>
                  <p className="text-xs text-zinc-400">
                    There isn't enough time left in the match to finish it, so the moves you made are submitted for scoring
                    as soon as the game timer runs out. You don't need to keep this open.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-amber-300 mb-1">Your run is on another device</p>
                  <p className="text-xs text-zinc-400">
                    You started this run in another browser or on another device. Finish it there. Each player gets one
                    run, and if it isn't finished in time it counts as 0.
                  </p>
                </>
              )}
            </div>
          )}
          {showGame && (
            <GameErrorBoundary onReset={exitArena}>
              {gameId === 'snake' && (
                <SnakeGame {...liveProps} timeLimitSeconds={liveMatch?.durationSeconds || 60} onFinish={handleFinish} getSeed={getSeed} isPractice={isPractice} />
              )}
              {gameId === '2048' && (
                <Puzzle2048Game {...liveProps} timeLimitSeconds={liveMatch?.durationSeconds || 90} onFinish={handleFinish} getSeed={getSeed} isPractice={isPractice} />
              )}
              {gameId === 'neondodge' && (
                <NeonDodgeGame {...liveProps} timeLimitSeconds={liveMatch?.durationSeconds || 45} onFinish={handleFinish} getSeed={getSeed} isPractice={isPractice} />
              )}
            </GameErrorBoundary>
          )}
        </div>

        {liveMatch && !isPractice && (
          <aside className="hidden lg:block w-full max-w-sm mt-4 rounded-3xl bg-zinc-900/70 border border-white/[0.07] p-4 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-300" /> Standings
              </h4>
              <span className="text-xs text-zinc-500">{cr(liveMatch.netPrizePool)} prize</span>
            </div>
            {standings}
          </aside>
        )}

        {/* End of Match Summary Overlay */}
        {(showSummary || (runElsewhere && !interrupted)) && liveMatch && (
          <MatchSummaryOverlay
            room={liveMatch}
            onClose={() => {
              setShowSummary(false);
              exitArena();
            }}
          />
        )}
      </div>

      {/* Standings on phones */}
      {liveMatch && !isPractice && (
        <Sheet open={activeTab === 'leaderboard'} onClose={() => setActiveTab('game')} eyebrow={liveMatch.title} title="Standings" size="sm">
          {standings}
        </Sheet>
      )}
    </div>
  );
};

export default PlayArenaModal;

