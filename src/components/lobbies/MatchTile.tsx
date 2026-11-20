import React from 'react';
import { ChevronRight, Share2, Check } from 'lucide-react';
import type { MatchRoom } from '../../types';
import { GAMES_LIST } from '../../data/initialData';
import GameCover from '../ui/GameCover';
import StatusPill from './StatusPill';
import { cr } from '../../utils/credits';

interface MatchTileProps {
  room: MatchRoom;
  userId: string;
  onOpen: () => void;
  onJoin?: () => void;
  onShare?: () => void;
  shared?: boolean;
  /** Fixed width for shelves; grids leave it fluid. */
  className?: string;
}

/** A match as a console-style tile: cover art, state, prize, players, and the one action that matters. */
const MatchTile: React.FC<MatchTileProps> = ({ room, userId, onOpen, onJoin, onShare, shared, className = '' }) => {
  const game = GAMES_LIST.find((g) => g.id === room.gameId);
  const mine = room.players.some((p) => p.id === userId);
  const me = room.players.find((p) => p.id === userId);
  const prize = room.status === 'completed' && me?.payout ? me.payout : room.netPrizePool;

  const cta = !mine
    ? { label: `Join · ${cr(room.buyIn)}`, primary: true, act: onJoin ?? onOpen }
    : room.status === 'in_progress' && me?.score === undefined && !room.myRun
      ? { label: 'Play now', primary: true, act: onOpen }
      : room.status === 'waiting'
        ? { label: 'Open lobby', primary: false, act: onOpen }
        : room.status === 'in_progress'
          ? { label: 'View match', primary: false, act: onOpen }
          : { label: 'Results', primary: false, act: onOpen };

  return (
    <article
      onClick={onOpen}
      className={`tile-focus group cursor-pointer rounded-2xl bg-zinc-900/80 hover:bg-zinc-900 border border-white/[0.07] hover:border-white/15 overflow-hidden flex flex-col ${className}`}
    >
      <div className="flex gap-3 p-3">
        <GameCover gameId={room.gameId} className="w-[72px] shrink-0 aspect-[3/4] rounded-xl" />
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-2">
            <StatusPill room={room} userId={userId} />
          </div>
          <h3 className="mt-1.5 text-[15px] font-extrabold text-white leading-snug line-clamp-1">{room.title}</h3>
          <p className="text-xs text-zinc-400 truncate">
            {game?.title} · {room.hostId === userId ? 'You host' : `by ${room.hostName}`}
          </p>
          <div className="mt-auto pt-2 flex items-end justify-between gap-2">
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {room.players.slice(0, 4).map((p) => (
                  <img key={p.id} src={p.avatar} alt={p.name} title={p.name} className="w-6 h-6 rounded-full ring-2 ring-zinc-900 object-cover" />
                ))}
              </div>
              <span className="ml-2 text-xs font-semibold text-zinc-400 tabular-nums">
                {room.players.length}/{room.maxPlayers}
              </span>
            </div>
            <div className="text-right leading-none">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                {room.status === 'completed' && me?.payout ? 'You won' : 'Prize'}
              </div>
              <div className="text-base font-extrabold text-emerald-300 tabular-nums">{cr(prize)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-3 pb-3 mt-auto">
        {onShare && room.status === 'waiting' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            aria-label="Share invite link"
            className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.06] hover:bg-white/10 text-zinc-300 flex items-center justify-center"
          >
            {shared ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cta.act();
          }}
          className={`flex-1 h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-1 ${
            cta.primary ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-white/[0.06] text-white hover:bg-white/10'
          }`}
        >
          {cta.label}
          {!cta.primary && <ChevronRight className="w-4 h-4 opacity-60" />}
        </button>
      </div>
    </article>
  );
};

export default MatchTile;
