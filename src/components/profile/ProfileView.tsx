import React from 'react';
import { Award, LogOut, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cr } from '../../utils/credits';
import AdminReviewPanel from './AdminReviewPanel';
import GameErrorBoundary from '../common/GameErrorBoundary';
import GameCover from '../ui/GameCover';
import StatusPill from '../lobbies/StatusPill';
import { GAMES_LIST } from '../../data/initialData';

/** Player card, stats, trophies and match history. */
const ProfileView: React.FC = () => {
  const { user, rooms, logout, setSelectedRoomId } = useApp();
  const userMatches = rooms.filter((r) => r.players.some((p) => p.id === user.id));

  const stats = [
    { label: 'Matches', value: String(user.matchesPlayed) },
    { label: 'Wins', value: String(user.winsCount) },
    { label: 'Win rate', value: `${user.winRate}%` },
    { label: 'Won', value: cr(user.totalEarnings), accent: true },
  ];

  return (
    <div className="space-y-8">
      {/* Player card */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-900">
        <div className="h-24 sm:h-32 bg-gradient-to-r from-emerald-500/40 via-indigo-500/30 to-fuchsia-500/30" />
        <div className="px-5 pb-5 -mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-4">
          <img src={user.avatar} alt="" className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-zinc-900 bg-zinc-800" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">{user.displayName}</h1>
              <span className="px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-indigo-400/15 text-indigo-200 border border-indigo-300/30">
                {user.vipTier}
              </span>
            </div>
            <div className="text-sm text-zinc-400">{user.handle}</div>
          </div>
        </div>
        <dl className="grid grid-cols-4 border-t border-white/[0.06] divide-x divide-white/[0.06]">
          {stats.map((s) => (
            <div key={s.label} className="px-2 py-3 text-center">
              <dt className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">{s.label}</dt>
              <dd className={`text-base sm:text-xl font-extrabold tabular-nums truncate ${s.accent ? 'text-emerald-300' : 'text-white'}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Trophies */}
      <section>
        <h2 className="text-lg font-extrabold text-white mb-3">Trophies</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {user.badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-2xl p-4 border ${b.unlocked ? 'bg-gradient-to-br from-amber-400/15 to-transparent border-amber-300/25' : 'bg-white/[0.02] border-white/[0.05] opacity-50'}`}
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${b.unlocked ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-zinc-600'}`}>
                <Award className="w-5 h-5" />
              </span>
              <div className="mt-3 text-sm font-bold text-white leading-tight">{b.title}</div>
              <div className="text-xs text-zinc-400 mt-0.5 break-words">{b.unlocked ? b.description : `Locked · ${b.description}`}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Match history */}
      <section>
        <h2 className="text-lg font-extrabold text-white mb-3">Recent matches</h2>
        {userMatches.length === 0 ? (
          <p className="text-sm text-zinc-500">No matches played yet.</p>
        ) : (
          <ul className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] divide-y divide-white/[0.05] overflow-hidden">
            {userMatches.map((m) => {
              const mine = m.players.find((p) => p.isCurrentUser);
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setSelectedRoomId(m.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                    <GameCover gameId={m.gameId} className="w-10 h-10 rounded-lg shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{m.title}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        {GAMES_LIST.find((g) => g.id === m.gameId)?.title} · {cr(m.buyIn)} buy-in
                      </div>
                    </div>
                    {m.status === 'completed' && (mine?.payout ?? 0) > 0 ? (
                      <span className="text-sm font-extrabold text-emerald-300 tabular-nums">+{cr(mine?.payout ?? 0)}</span>
                    ) : (
                      <StatusPill room={m} userId={user.id} />
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {user.isAdmin && (
        <GameErrorBoundary onReset={() => undefined}>
          <AdminReviewPanel />
        </GameErrorBoundary>
      )}

      <section className="pt-2">
        <button
          type="button"
          onClick={logout}
          className="w-full h-12 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-rose-300 font-bold text-sm flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
        <p className="mt-3 text-center text-xs text-zinc-500">
          <a href="/privacy.html" className="underline hover:text-zinc-300">Privacy Policy</a>
          {' · '}
          <a href="/terms.html" className="underline hover:text-zinc-300">Terms of Service</a>
        </p>
      </section>
    </div>
  );
};

export default ProfileView;
