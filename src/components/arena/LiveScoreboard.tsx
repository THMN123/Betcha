import React from 'react';
import { Crown, Radio } from 'lucide-react';
import type { MatchRoom } from '../../types';
import type { LiveFeed } from '../../hooks/useLiveMatch';
import { peerColor } from '../../hooks/useLiveMatch';

/** Live race strip shown above the game: everyone's current score, updating several times a second. */
const LiveScoreboard: React.FC<{ room: MatchRoom; live: LiveFeed; scoreLabel?: (s: number) => string }> = ({ room, live, scoreLabel }) => {
  const opponentIds = room.players.filter((p) => !p.isCurrentUser).map((p) => p.id);
  const fmt = scoreLabel ?? ((s: number) => s.toLocaleString());

  const rows = room.players.map((p) => {
    const lv = live.scores.find((x) => x.id === p.id);
    const verified = p.score !== undefined; // server-verified final score
    const score = verified && (!lv || lv.done) ? p.score! : lv ? lv.score : null;
    const status = verified || lv?.done ? 'finished' : lv ? 'playing' : 'waiting';
    return { id: p.id, name: p.isCurrentUser ? 'You' : p.name, me: !!p.isCurrentUser, score, status };
  });
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  // Crown only for an actual lead (not a tie, not everyone on 0).
  const leader = rows[0] && (rows[0].score ?? 0) > 0 && (rows[1]?.score ?? -1) < (rows[0].score ?? 0) ? rows[0].id : null;

  return (
    <div className="w-full max-w-sm mx-auto mb-2">
      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono uppercase text-zinc-500">
        <Radio className={`w-3 h-3 ${live.connected ? 'text-emerald-400' : 'text-zinc-600'}`} />
        {live.connected ? 'Live' : 'Connecting...'}
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shrink-0 transition-colors duration-300 ${
              r.me ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: r.me ? '#34d399' : peerColor(r.id, opponentIds) }} />
            <span className="text-[11px] font-bold text-white max-w-[72px] truncate">{r.name}</span>
            {leader === r.id && <Crown className="w-3 h-3 text-amber-400" />}
            <span className="text-[11px] font-mono font-black text-zinc-200 tabular-nums">
              {r.score === null ? '-' : fmt(r.score)}
            </span>
            {r.status !== 'playing' && (
              <span className="text-[9px] text-zinc-500">{r.status === 'finished' ? 'done' : 'not started'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveScoreboard;
