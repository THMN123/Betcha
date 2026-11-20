import React from 'react';
import type { MatchRoom } from '../../types';

/** One consistent label + color for a match's state, everywhere. */
export function matchStatus(room: MatchRoom, userId: string): { label: string; cls: string; live?: boolean } {
  const me = room.players.find((p) => p.id === userId);
  switch (room.status) {
    case 'waiting':
      return { label: 'Lobby open', cls: 'bg-amber-400/15 text-amber-200 border-amber-300/30' };
    case 'in_progress':
      if (room.refund?.status === 'pending') return { label: 'Refund requested', cls: 'bg-indigo-400/15 text-indigo-200 border-indigo-300/30' };
      return me && me.score === undefined
        ? { label: 'Your turn', cls: 'bg-emerald-400 text-zinc-950 border-emerald-300', live: true }
        : { label: 'Live', cls: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30', live: true };
    case 'under_review':
      return { label: 'Under review', cls: 'bg-indigo-400/15 text-indigo-200 border-indigo-300/30' };
    case 'completed':
      return room.winnerId === userId
        ? { label: 'You won', cls: 'bg-amber-300 text-zinc-950 border-amber-200' }
        : { label: 'Finished', cls: 'bg-white/10 text-zinc-300 border-white/10' };
    case 'cancelled':
      return { label: room.refund?.status === 'approved' ? 'Refunded' : 'Cancelled', cls: 'bg-white/10 text-zinc-400 border-white/10' };
    default:
      return { label: room.status, cls: 'bg-white/10 text-zinc-300 border-white/10' };
  }
}

const StatusPill: React.FC<{ room: MatchRoom; userId: string; className?: string }> = ({ room, userId, className = '' }) => {
  const s = matchStatus(room, userId);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wide ${s.cls} ${className}`}>
      {s.live && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {s.label}
    </span>
  );
};

export default StatusPill;
