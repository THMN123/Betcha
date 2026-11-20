import React from 'react';
import { Crown } from 'lucide-react';
import type { MatchRoom } from '../../types';
import type { LiveFeed } from '../../hooks/useLiveMatch';
import { peerColor } from '../../hooks/useLiveMatch';

/** Live race strip above the game: everyone's current score, updating several times a second. */
const LiveScoreboard: React.FC<{ room: MatchRoom; live: LiveFeed; scoreLabel?: (s: number) => string }> = ({ room, live, scoreLabel }) => {
  const opponentIds = room.players.filter((p) => !p.isCurrentUser).map((p) => p.id);
  const fmt = scoreLabel ?? ((s: number) => s.toLocaleString());

  const rows = room.players.map((p) => {
    const lv = live.scores.find((x) => x.id === p.id);
    const verified = p.score !== undefined; // server-verified final score
    const score = verified && (!lv || lv.done) ? p.score! : lv ? lv.score : null;
    const status = verified || lv?.done ? 'finished' : lv ? 'playing' : 'waiting';
    return { id: p.id, name: p.isCurrentUser ? 'You' : p.name, avatar: p.avatar, me: !!p.isCurrentUser, score, status };
  });
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  // Crown only for an actual lead (not a tie, not everyone on 0).
  const leader = rows[0] && (rows[0].score ?? 0) > 0 && (rows[1]?.score ?? -1) < (rows[0].score ?? 0) ? rows[0].id : null;

  return (
    <div className="w-full mb-4">
      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
        <span className={`w-2 h-2 rounded-full ${live.connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
        {live.connected ? 'Live' : 'Connecting...'}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {rows.map((r, i) => {
          const color = r.me ? '#34d399' : peerColor(r.id, opponentIds);
          return (
            <div
              key={r.id}
              className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full shrink-0 border transition-colors duration-300 ${
                r.me ? 'bg-white/[0.08] border-white/20' : 'bg-white/[0.03] border-white/[0.06]'
              } ${r.status === 'waiting' ? 'opacity-60' : ''}`}
            >
              <span className="relative">
                <img src={r.avatar} alt="" className="w-7 h-7 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${color}` }} />
                {leader === r.id && <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-amber-300 fill-amber-300" />}
              </span>
              <span className="text-xs font-semibold text-zinc-400 tabular-nums">{i + 1}</span>
              <span className="text-xs font-bold text-white max-w-[72px] truncate">{r.name}</span>
              <span className="text-sm font-extrabold text-white tabular-nums">{r.score === null ? '–' : fmt(r.score)}</span>
              {r.status === 'finished' && <span className="text-[10px] font-bold uppercase text-zinc-500">done</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveScoreboard;
