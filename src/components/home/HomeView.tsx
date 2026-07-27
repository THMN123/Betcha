import React, { useState, useEffect } from 'react';
import { Gamepad2, Swords, Trophy, Zap, Flame, Users, Sparkles, ArrowRight, Play, ShieldCheck, DollarSign } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GAMES_LIST } from '../../data/initialData';
import { GameId } from '../../types';

import MorphingHeading from '../common/MorphingHeading';
import { HomeSkeleton } from '../common/SkeletonLoader';

const HomeView: React.FC = () => {
  const {
    startPractice,
    rooms,
    joinMatch,
    setCurrentTab,
    setSelectedRoomId,
    leaderboard,
    createMatch,
  } = useApp();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <HomeSkeleton />;
  }

  const waitingRooms = rooms.filter((r) => r.status === 'waiting');

  const handleQuickMatchOfDay = () => {
    // Quick create or join $5 Cyber Snake match
    const existing = waitingRooms.find((r) => r.gameId === 'snake' && r.buyIn === 5);
    if (existing) {
      joinMatch(existing.id);
    } else {
      createMatch({
        gameId: 'snake',
        title: 'Quick Match of the Day ($5 Snake)',
        buyIn: 5,
        maxPlayers: 4,
        distribution: 'winner_takes_all',
      });
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Featured Banner: Quick Match of the Day */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-zinc-900 to-indigo-950 border border-emerald-500/30 p-5 sm:p-6 shadow-2xl">
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Gamepad2 className="w-48 h-48 text-emerald-400" />
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-3">
            <Flame className="w-3.5 h-3.5" />
            <span>FEATURED TOURNAMENT OF THE DAY</span>
          </div>

          <MorphingHeading as="h1" glowColor="emerald" className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            $5 Cyber Snake Showdown
          </MorphingHeading>

          <p className="text-xs sm:text-sm text-zinc-300 mb-5 leading-relaxed">
            Fast 60-second speed runs. 4 players enter, high score takes the <span className="font-bold text-emerald-400">$19.00 net pot</span> after 5% platform spread!
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleQuickMatchOfDay}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Zap className="w-4 h-4 fill-current stroke-none" />
              <span>Enter $5 Tournament</span>
            </button>

            <button
              type="button"
              onClick={() => startPractice('snake')}
              className="px-4 py-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 font-bold text-xs sm:text-sm transition-all"
            >
              Practice Run (Free)
            </button>
          </div>
        </div>
      </section>

      {/* Arcade Mini-Games Grid */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-emerald-400" />
              <MorphingHeading as="h2" glowColor="emerald" className="text-lg font-bold text-white">
                Casual Arcade Games
              </MorphingHeading>
            </div>
            <p className="text-xs text-zinc-400">Select a game to practice or launch a wager lobby</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {GAMES_LIST.map((game) => (
            <div
              key={game.id}
              className={`relative group overflow-hidden rounded-2xl bg-gradient-to-b ${game.bgGradient} border border-zinc-800 hover:border-zinc-700 p-5 transition-all hover:-translate-y-1 shadow-xl flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider font-mono border"
                    style={{
                      backgroundColor: `${game.themeColor}15`,
                      color: game.themeColor,
                      borderColor: `${game.themeColor}30`,
                    }}
                  >
                    {game.category}
                  </span>

                  <span className="text-[11px] font-mono font-semibold text-zinc-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {game.popularityScore}% Popular
                  </span>
                </div>

                <h3 className="text-lg font-black text-white mb-1">{game.title}</h3>
                <p className="text-xs text-zinc-400 mb-4 line-clamp-2">{game.description}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono mb-2">
                  <span>Run Time: {game.avgDuration}</span>
                  <span>Difficulty: {game.difficulty}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startPractice(game.id)}
                    className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Play className="w-3 h-3 text-emerald-400 fill-current" />
                    <span>Practice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      createMatch({
                        gameId: game.id,
                        title: `${game.title} Tournament`,
                        buyIn: 5,
                        maxPlayers: 4,
                        distribution: 'winner_takes_all',
                      });
                    }}
                    className="py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-bold text-xs shadow-md flex items-center justify-center gap-1 transition-all"
                  >
                    <Swords className="w-3 h-3" />
                    <span>Wager $5</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Friend Lobbies Ticker */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <MorphingHeading as="h2" glowColor="indigo" className="text-lg font-bold text-white">
                Active Friend Rooms
              </MorphingHeading>
            </div>
            <p className="text-xs text-zinc-400">Open lobbies waiting for participants</p>
          </div>

          <button
            type="button"
            onClick={() => setCurrentTab('lobbies')}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>View All ({waitingRooms.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {waitingRooms.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <p className="text-xs text-zinc-400 mb-3">No active lobbies right now.</p>
            <button
              type="button"
              onClick={() => setCurrentTab('lobbies')}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs"
            >
              Create New Match
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {waitingRooms.slice(0, 4).map((room) => {
              const game = GAMES_LIST.find((g) => g.id === room.gameId);
              return (
                <div
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    setCurrentTab('lobbies');
                  }}
                  className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 transition-all cursor-pointer shadow-md flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-bold text-emerald-400 font-mono text-sm shrink-0">
                      ${room.buyIn}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white leading-tight">{room.title}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        Host: {room.hostName} • {room.players.length}/{room.maxPlayers} Ready
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      joinMatch(room.id);
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs shrink-0"
                  >
                    Join Room
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Daily Leaderboard Highlights */}
      <section className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Daily Tournament Leaderboard</h3>
              <p className="text-[11px] text-zinc-400">Top earning arcade players today</p>
            </div>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 text-center">
            <p className="text-xs text-zinc-400">No tournament scores recorded yet today.</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Win a tournament match to claim the #1 rank!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.slice(0, 4).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 font-mono font-bold text-zinc-400 flex items-center justify-center text-[10px]">
                    #{entry.rank}
                  </span>

                  <img
                    src={entry.avatar}
                    alt={entry.handle}
                    className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                  />

                  <div>
                    <span className="font-bold text-white block leading-tight">{entry.handle}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{entry.gameTitle}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="block font-mono font-bold text-emerald-400 text-xs">
                    +${entry.payoutWon.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{entry.highScore.toLocaleString()} PTS</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomeView;
