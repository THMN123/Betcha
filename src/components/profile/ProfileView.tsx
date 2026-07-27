import React from 'react';
import {
  User,
  Trophy,
  Flame,
  Award,
  ShieldCheck,
  Zap,
  Crown,
  Gamepad2,
  Users,
  CheckCircle2,
  Volume2,
  VolumeX,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import MorphingHeading from '../common/MorphingHeading';

const ProfileView: React.FC = () => {
  const { user, rooms, logout } = useApp();

  const userMatches = rooms.filter((r) => r.players.some((p) => p.id === user.id));

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-indigo-950 border border-zinc-800 p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-xl"
            />
            <span className="absolute bottom-0 right-0 p-1 bg-emerald-500 text-zinc-950 rounded-full shadow-md">
              <Crown className="w-4 h-4 fill-current stroke-none" />
            </span>
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <MorphingHeading as="h1" glowColor="indigo" className="text-2xl font-black text-white">
                {user.displayName}
              </MorphingHeading>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {user.vipTier} VIP
              </span>
            </div>

            <p className="text-xs font-mono text-zinc-400 mb-3">{user.handle}</p>

            <div className="flex flex-wrap justify-center sm:justify-start gap-2 text-xs text-zinc-300">
              <span className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono">
                Fav Game: <strong className="text-emerald-400">{user.favoriteGame}</strong>
              </span>
              <span className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono">
                Win Rate: <strong className="text-emerald-400">{user.winRate}%</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">
            Matches Played
          </span>
          <span className="text-2xl font-black text-white">{user.matchesPlayed}</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">
            Total Wins
          </span>
          <span className="text-2xl font-black text-emerald-400">{user.winsCount}</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">
            Win Percentage
          </span>
          <span className="text-2xl font-black text-indigo-400">{user.winRate}%</span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-md">
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold mb-1">
            Total Winnings
          </span>
          <span className="text-2xl font-black text-emerald-400">${user.totalEarnings.toFixed(2)}</span>
        </div>
      </div>

      {/* Trophy Cabinet & Badges */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Arcade Badges & Trophy Cabinet
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {user.badges.map((badge) => (
            <div
              key={badge.id}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                badge.unlocked
                  ? 'bg-zinc-950 border-amber-500/30 text-white'
                  : 'bg-zinc-950/40 border-zinc-850 text-zinc-600 opacity-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  badge.unlocked ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-800 text-zinc-600'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold leading-tight">{badge.title}</h4>
                <p className="text-[10px] text-zinc-400 leading-tight">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accepted Friends & Invite Connections */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Accepted Friends & Connections</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Only real friends who accepted your tournament invite links or friend requests appear here
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 text-center">
          <UserCheck className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">No accepted friend links yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Share a match invite link from the Lobbies tab to invite your friends!
          </p>
        </div>
      </div>

      {/* Recent Match History */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Recent Tournament History</h3>

        {userMatches.length === 0 ? (
          <p className="text-xs text-zinc-500 font-mono">No matches played yet.</p>
        ) : (
          <div className="space-y-2">
            {userMatches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-white block">{match.title}</span>
                  <span className="text-[10px] text-zinc-400">
                    Buy-In: ${match.buyIn} • Status: {match.status}
                  </span>
                </div>

                <div className="text-right">
                  {match.winnerId === user.id ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      Won +${match.netPrizePool.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-400">Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign Out Section */}
      <div className="pt-2">
        <button
          type="button"
          onClick={logout}
          className="w-full py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-rose-400 hover:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm group"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Sign Out / Return to Auth Screen</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileView;
