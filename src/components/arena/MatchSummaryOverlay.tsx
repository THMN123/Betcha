import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, ArrowRight, Wallet, Hourglass, ShieldAlert } from 'lucide-react';
import { MatchRoom } from '../../types';
import { useApp } from '../../context/AppContext';
import { cr } from '../../utils/credits';
import { GAME_ACCENT } from '../ui/GameCover';

interface MatchSummaryOverlayProps {
  room: MatchRoom;
  onClose: () => void;
}

/** Shown after you submit your run: waits live for the other players, then shows the settled results. */
export const MatchSummaryOverlay: React.FC<MatchSummaryOverlayProps> = ({ room, onClose }) => {
  const { user, setCurrentTab, setSelectedRoomId } = useApp();
  const accent = GAME_ACCENT[room.gameId] ?? GAME_ACCENT.snake;
  const fmt = room.gameId === 'neondodge' ? (n: number) => `${(n / 60).toFixed(1)}s` : (n: number) => `${n.toLocaleString()} pts`;

  const settled = room.status === 'completed';
  const underReview = room.status === 'under_review';
  const me = room.players.find((p) => p.id === user.id);
  const pending = room.players.filter((p) => p.score === undefined).length;
  const players = settled
    ? [...room.players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    : [...room.players].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const firstPlace = room.players.filter((p) => p.rank === 1);
  const isWinner = settled && me?.rank === 1 && (me?.payout ?? 0) > 0;
  const tiedFirst = settled && firstPlace.length > 1;
  const submitting = !settled && !underReview && me?.score === undefined;

  const headline = underReview
    ? 'Results under review'
    : submitting
      ? 'Verifying your run'
      : !settled
        ? 'Score locked in'
        : isWinner
          ? tiedFirst
            ? 'Tied for 1st!'
            : 'Victory!'
          : tiedFirst
            ? `Tie: ${room.winnerName}`
            : `${room.winnerName} wins`;

  const sub = underReview
    ? 'A winning run was flagged by our fair-play checks, so payouts are on hold until it has been reviewed.'
    : submitting
      ? "Checking your run on the server. If you're offline it will be retried automatically."
      : !settled
        ? `Waiting for ${pending} more player${pending === 1 ? '' : 's'} to finish. This updates live.`
        : isWinner
          ? `${cr(me?.payout ?? 0)} added to your wallet.`
          : (me?.payout ?? 0) > 0
            ? `Your prize: ${cr(me?.payout ?? 0)} added to your wallet.`
            : 'Better luck next round.';

  const Icon = underReview ? ShieldAlert : settled ? Trophy : Hourglass;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed inset-0 z-[55] bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 overflow-y-auto"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(600px 400px at 50% 15%, ${isWinner ? '#fcd34d' : accent.glow}33, transparent 70%)` }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }}
        className="relative w-full max-w-md text-center my-auto"
      >
        <div
          className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center ${isWinner ? 'bg-amber-300 text-zinc-950' : 'bg-white/[0.07] text-white'}`}
          style={isWinner ? { boxShadow: '0 0 60px -10px #fcd34d' } : undefined}
        >
          <Icon className={`w-10 h-10 ${!settled && !underReview ? 'animate-pulse' : ''}`} />
        </div>
        <h3 className="mt-5 text-4xl font-extrabold text-white tracking-tight">{headline}</h3>
        <p className="mt-2 text-sm text-zinc-400 max-w-xs mx-auto">{sub}</p>

        {me?.score !== undefined && (
          <div className="mt-5 inline-flex items-baseline gap-2 px-5 py-2 rounded-2xl bg-white/[0.05] border border-white/[0.08]">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">You</span>
            <span className="text-2xl font-extrabold text-white tabular-nums">{fmt(me.score)}</span>
          </div>
        )}

        <ol className="mt-6 text-left rounded-2xl bg-zinc-900/80 border border-white/[0.07] divide-y divide-white/[0.05] overflow-hidden max-h-[260px] overflow-y-auto scrollable-content">
          {players.map((p, idx) => {
            const first = settled && p.rank === 1;
            return (
              <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.id === user.id ? 'bg-white/[0.04]' : ''}`}>
                <span className={`w-5 text-center text-sm font-extrabold tabular-nums ${first ? 'text-amber-300' : 'text-zinc-500'}`}>
                  {settled ? p.rank : idx + 1}
                </span>
                <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                <span className="flex-1 min-w-0 text-sm font-bold text-white truncate flex items-center gap-1">
                  {p.name} {p.id === user.id && <span className="text-zinc-400 font-normal">(you)</span>}
                  {first && <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0" />}
                </span>
                <span className="text-right shrink-0">
                  {p.score === undefined ? (
                    <span className="text-xs text-zinc-500">playing...</span>
                  ) : (
                    <span className="block text-sm font-extrabold text-white tabular-nums">{fmt(p.score)}</span>
                  )}
                  {(p.payout ?? 0) > 0 && <span className="text-xs font-bold text-emerald-300">+{cr(p.payout ?? 0)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-zinc-500">
          Pot {cr(room.totalPot)} · 5% fee −{cr(room.platformFee)} · {room.distribution === 'top_two' ? 'top two split' : 'winner takes'} {cr(room.netPrizePool)}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              setCurrentTab('lobbies');
              if (!settled) setSelectedRoomId(room.id);
            }}
            className="w-full h-13 min-h-[52px] rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 font-extrabold text-base flex items-center justify-center gap-2"
          >
            {settled ? 'Back to matches' : 'Wait in the lobby'} <ArrowRight className="w-5 h-5" />
          </button>
          {settled && (
            <button
              type="button"
              onClick={() => {
                onClose();
                setCurrentTab('wallet');
              }}
              className="w-full h-12 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" /> Open wallet
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MatchSummaryOverlay;
