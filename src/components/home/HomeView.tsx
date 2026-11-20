import React, { useState } from 'react';
import { Play, Swords, Timer, Gauge, Users, ChevronRight, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GAMES_LIST } from '../../data/initialData';
import type { GameId } from '../../types';
import GameCover, { GAME_ACCENT } from '../ui/GameCover';
import MatchTile from '../lobbies/MatchTile';
import { cr } from '../../utils/credits';

const SectionHeader: React.FC<{ title: string; action?: { label: string; onClick: () => void } }> = ({ title, action }) => (
  <div className="flex items-end justify-between mb-3">
    <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{title}</h2>
    {action && (
      <button type="button" onClick={action.onClick} className="text-sm font-semibold text-zinc-400 hover:text-white flex items-center gap-0.5">
        {action.label}
        <ChevronRight className="w-4 h-4" />
      </button>
    )}
  </div>
);

/** Console-style home: a spotlight on the selected game, then shelves of games and matches. */
const HomeView: React.FC = () => {
  const { startPractice, rooms, joinMatch, setCurrentTab, setSelectedRoomId, leaderboard, openCreateMatch, user } = useApp();
  const [focused, setFocused] = useState<GameId>('snake');
  const game = GAMES_LIST.find((g) => g.id === focused)!;
  const accent = GAME_ACCENT[focused];

  const myActive = rooms.filter(
    (r) => (r.status === 'waiting' || r.status === 'in_progress' || r.status === 'under_review') && r.players.some((p) => p.isCurrentUser)
  );
  const openRooms = rooms.filter((r) => r.status === 'waiting' && !r.players.some((p) => p.isCurrentUser));

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Spotlight */}
      <section
        key={focused}
        className="relative -mx-4 -mt-4 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden border-y sm:border border-white/[0.07] animate-in"
      >
        <GameCover gameId={focused} className="absolute inset-0 sm:left-[40%] opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-zinc-950 from-30% sm:from-0% via-zinc-950/60 sm:via-zinc-950/85 to-transparent" />
        <div
          className="absolute -left-24 -top-24 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: accent.glow }}
        />
        <div className="relative px-5 sm:px-10 pt-32 sm:pt-14 pb-6 sm:pb-12 max-w-xl">
          <div className={`text-xs font-bold uppercase tracking-[0.18em] ${accent.text}`}>{game.category}</div>
          <h1 className="mt-1 text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.05]">{game.title}</h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-300 leading-relaxed line-clamp-3">{game.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-200">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">
              <Timer className="w-3.5 h-3.5" /> {game.avgDuration}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">
              <Gauge className="w-3.5 h-3.5" /> {game.difficulty}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">
              <Users className="w-3.5 h-3.5" /> 2–8 players
            </span>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => openCreateMatch(focused)}
              className="h-12 px-6 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-extrabold text-sm flex items-center gap-2 shadow-[0_10px_30px_-10px_rgba(255,255,255,0.5)]"
            >
              <Swords className="w-4 h-4" /> Challenge friends
            </button>
            <button
              type="button"
              onClick={() => startPractice(focused)}
              className="h-12 px-5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur text-white font-bold text-sm flex items-center gap-2 border border-white/10"
            >
              <Play className="w-4 h-4 fill-current" /> Practice
            </button>
          </div>
        </div>
      </section>

      {/* Games shelf: selecting one puts it in the spotlight */}
      <section>
        <SectionHeader title="Games" />
        <div className="shelf sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 sm:gap-4">
          {GAMES_LIST.map((g) => {
            const active = g.id === focused;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setFocused(g.id)}
                aria-pressed={active}
                className={`tile-focus w-36 sm:w-auto rounded-2xl overflow-hidden text-left ${active ? 'tile-selected' : ''}`}
              >
                <GameCover gameId={g.id} showTitle className="aspect-[3/4] sm:aspect-[16/10]" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Your matches */}
      {myActive.length > 0 && (
        <section>
          <SectionHeader title="Continue" action={{ label: 'All matches', onClick: () => setCurrentTab('lobbies') }} />
          <div className="shelf md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:gap-4">
            {myActive.map((room) => (
              <MatchTile key={room.id} room={room} userId={user.id} onOpen={() => setSelectedRoomId(room.id)} className="w-[85%] max-w-[340px] md:w-auto md:max-w-none" />
            ))}
          </div>
        </section>
      )}

      {/* Open lobbies */}
      <section>
        <SectionHeader title="Open lobbies" action={openRooms.length ? { label: 'See all', onClick: () => setCurrentTab('lobbies') } : undefined} />
        {openRooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm text-zinc-300 font-semibold">No open lobbies right now</p>
            <p className="text-xs text-zinc-500 mt-1">Start one and send the link to your friends.</p>
            <button
              type="button"
              onClick={() => openCreateMatch(focused)}
              className="mt-4 h-10 px-5 rounded-full bg-white text-zinc-950 font-bold text-sm"
            >
              Create a match
            </button>
          </div>
        ) : (
          <div className="shelf md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:mx-0 md:px-0 md:gap-4">
            {openRooms.slice(0, 6).map((room) => (
              <MatchTile
                key={room.id}
                room={room}
                userId={user.id}
                onOpen={() => setSelectedRoomId(room.id)}
                onJoin={() => joinMatch(room.id)}
                className="w-[85%] max-w-[340px] md:w-auto md:max-w-none"
              />
            ))}
          </div>
        )}
      </section>

      {/* Top earners */}
      <section>
        <SectionHeader title="Top earners" />
        {leaderboard.length === 0 ? (
          <p className="text-sm text-zinc-500">No winners yet. Win a match to claim #1.</p>
        ) : (
          <ol className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] divide-y divide-white/[0.05] overflow-hidden">
            {leaderboard.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`w-7 text-center font-extrabold tabular-nums ${
                    e.rank === 1 ? 'text-amber-300' : e.rank === 2 ? 'text-zinc-200' : e.rank === 3 ? 'text-orange-300' : 'text-zinc-500'
                  }`}
                >
                  {e.rank === 1 ? <Trophy className="w-5 h-5 mx-auto" /> : e.rank}
                </span>
                <img src={e.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{e.handle}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {e.gameTitle} · {e.highScore.toLocaleString()} pts
                  </div>
                </div>
                <div className="text-sm font-extrabold text-emerald-300 tabular-nums">+{cr(e.payoutWon)}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};

export default HomeView;
