import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Trophy, Users, ShieldCheck, Flame, RefreshCw, Sparkles, CheckCircle2, Gamepad2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import SnakeGame from '../games/SnakeGame';
import Puzzle2048Game from '../games/Puzzle2048Game';
import NeonDodgeGame from '../games/NeonDodgeGame';
import { GAMES_LIST } from '../../data/initialData';
import MorphingHeading from '../common/MorphingHeading';
import { randomSeed } from '../games/GameShell';
import type { RunResult } from '../../hooks/useGameRun';
import GameErrorBoundary from '../common/GameErrorBoundary';
import MatchSummaryOverlay from './MatchSummaryOverlay';
import { cr } from '../../utils/credits';
import { supabase } from '../../lib/supabaseClient';
import { useLiveMatch } from '../../hooks/useLiveMatch';
import LiveScoreboard from './LiveScoreboard';
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

  return (
    <div className="play-arena-modal fixed inset-0 z-50 bg-zinc-950 flex flex-col h-[100dvh] w-screen overflow-hidden select-none animate-in fade-in">
      {/* Top Arena Navbar Header */}
      <div className="shrink-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-3 sm:px-4 py-2.5 flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 p-0.5 shadow-md shrink-0">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <MorphingHeading as="h2" glowColor="emerald" className="text-xs sm:text-base font-bold text-white">
                {gameInfo?.title}
              </MorphingHeading>
              {isPractice ? (
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md">
                  Practice
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                  Match #{liveMatch?.id}
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400">
              {isPractice ? 'Free practice run • Unlimited tries' : `${cr(liveMatch?.buyIn ?? 0)} buy-in • ${cr(liveMatch?.netPrizePool ?? 0)} prize`}
            </p>
          </div>
        </div>

        {/* Realtime Socket Indicator & View Controls */}
        <div className="flex items-center gap-2">

          {/* Mobile View Toggle Tabs (if match with leaderboard) */}
          {!isPractice && liveMatch && (
            <div className="flex items-center bg-zinc-950 border border-zinc-800 p-1 rounded-xl text-xs sm:hidden">
              <button
                type="button"
                onClick={() => setActiveTab('game')}
                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all ${
                  activeTab === 'game' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400'
                }`}
              >
                Game
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('leaderboard')}
                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all ${
                  activeTab === 'leaderboard' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                }`}
              >
                Scores
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleExit}
            className="p-1.5 sm:p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/80 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Responsive Gameplay Canvas & Score Layout */}
      <div className="flex-1 w-full overflow-y-auto sm:overflow-hidden p-2 sm:p-4 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 max-w-6xl mx-auto relative">
        {/* Game Canvas Container with Error Boundary */}
        <div
          className={`w-full max-w-sm flex-1 flex flex-col items-center justify-center ${
            activeTab === 'leaderboard' && !isPractice ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {liveMatch && !isPractice && (
            <LiveScoreboard room={liveMatch} live={live} scoreLabel={gameId === 'neondodge' ? (t) => `${(t / 60).toFixed(1)}s` : undefined} />
          )}
          {interrupted && !resumable && (
            <div className="w-full p-5 rounded-2xl bg-zinc-900 border border-amber-500/30 text-center">
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
              <SnakeGame
                {...liveProps}
                timeLimitSeconds={liveMatch?.durationSeconds || 60}
                onFinish={handleFinish}
                getSeed={getSeed}
                isPractice={isPractice}
              />
            )}
            {gameId === '2048' && (
              <Puzzle2048Game
                {...liveProps}
                timeLimitSeconds={liveMatch?.durationSeconds || 90}
                onFinish={handleFinish}
                getSeed={getSeed}
                isPractice={isPractice}
              />
            )}
            {gameId === 'neondodge' && (
              <NeonDodgeGame
                {...liveProps}
                timeLimitSeconds={liveMatch?.durationSeconds || 45}
                onFinish={handleFinish}
                getSeed={getSeed}
                isPractice={isPractice}
              />
            )}
          </GameErrorBoundary>
          )}
        </div>

        {/* Live Tournament Leaderboard Side Panel */}
        {liveMatch && (
          <div
            className={`w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl ${
              activeTab === 'game' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Match Leaderboard
                </h4>
              </div>

              <span className="text-[10px] font-mono font-semibold text-zinc-400">
                {liveMatch.status === 'completed' ? 'SETTLED' : liveMatch.status === 'under_review' ? 'UNDER REVIEW' : 'IN PROGRESS'}
              </span>
            </div>

            {/* Players Scores List */}
            <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto scrollable-content overscroll-contain">
              {liveMatch.players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    player.isCurrentUser
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={player.avatar}
                      alt={player.name}
                      className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                    />
                    <div>
                      <span className="block text-xs font-bold leading-tight">
                        {player.name} {player.isCurrentUser && '(You)'}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {player.isHost ? 'Host' : 'Participant'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    {player.score !== undefined ? (
                      <div>
                        <span className="block font-mono font-black text-xs sm:text-sm text-emerald-400">
                          {player.score.toLocaleString()} PTS
                        </span>
                        {player.payout !== undefined && player.payout > 0 && (
                          <span className="text-[10px] font-bold text-amber-400">
                            Won +{cr(player.payout)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-500 font-mono italic">
                        Playing run...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {liveMatch.status === 'completed' && (
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className="w-full p-3 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-center transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-emerald-300">
                  Match over! Winner: {liveMatch.winnerName}
                </p>
                <p className="text-[10px] text-zinc-400 underline mt-0.5">Tap to see results & payouts</p>
              </button>
            )}
          </div>
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
    </div>
  );
};

export default PlayArenaModal;

