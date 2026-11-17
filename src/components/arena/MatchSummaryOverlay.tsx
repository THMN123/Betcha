import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, ArrowRight, Wallet, Hourglass } from 'lucide-react';
import { MatchRoom } from '../../types';
import { useApp } from '../../context/AppContext';
import { cr } from '../../utils/credits';

interface MatchSummaryOverlayProps {
  room: MatchRoom;
  onClose: () => void;
}

/** Shown after you submit your score: waits live for the other players, then shows the settled results. */
export const MatchSummaryOverlay: React.FC<MatchSummaryOverlayProps> = ({ room, onClose }) => {
  const { user, setCurrentTab, setSelectedRoomId } = useApp();

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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="absolute inset-0 z-40 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl text-center my-auto">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
          {settled ? <Trophy className="w-8 h-8" /> : <Hourglass className="w-8 h-8 animate-pulse" />}
        </div>

        <h3 className="text-xl font-black text-white mb-1">
          {underReview ? 'Results under review' : !settled && me?.score === undefined ? 'Submitting your run...' : !settled ? 'Score verified!' : isWinner ? (tiedFirst ? 'Tied for 1st!' : 'You won!') : tiedFirst ? `Tie: ${room.winnerName}` : `${room.winnerName} wins`}
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          {underReview
            ? 'A winning run was flagged by our fair-play checks, so payouts are on hold until it has been reviewed.'
            : !settled && me?.score === undefined
            ? "We're verifying your run on the server. If you're offline it will be retried automatically."
            : !settled
            ? `You scored ${(me?.score ?? 0).toLocaleString()}. Waiting for ${pending} more player${pending === 1 ? '' : 's'} to finish. This updates live.`
            : isWinner
            ? `${cr(me?.payout ?? 0)} has been added to your wallet.`
            : (me?.payout ?? 0) > 0
            ? `Your prize: ${cr(me?.payout ?? 0)} added to your wallet.`
            : 'Better luck next round.'}
        </p>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 mb-4 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-400">Pot ({room.players.length} × {cr(room.buyIn)})</span>
            <span className="font-mono font-bold text-white">{cr(room.totalPot)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">5% platform fee</span>
            <span className="font-mono text-rose-400">-{cr(room.platformFee)}</span>
          </div>
          <div className="pt-2 border-t border-zinc-800 flex justify-between font-bold">
            <span className="text-emerald-400">{room.distribution === 'top_two' ? 'Prize pool (70/30 split)' : 'Winner takes'}</span>
            <span className="font-mono text-emerald-400">{cr(room.netPrizePool)}</span>
          </div>
        </div>

        <div className="space-y-1.5 mb-5 text-left max-h-[200px] overflow-y-auto scrollable-content pr-1">
          {players.map((p, idx) => {
            const first = settled && p.rank === 1;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                  first ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 text-center font-mono text-[10px] font-bold text-zinc-400">{settled ? `#${p.rank}` : `${idx + 1}`}</span>
                  <img src={p.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-zinc-700" />
                  <span className="font-bold text-white truncate flex items-center gap-1">
                    {p.name} {p.id === user.id && <span className="text-zinc-400 font-normal">(you)</span>}
                    {first && <Crown className="w-3 h-3 text-amber-400" />}
                  </span>
                </div>
                <div className="text-right font-mono shrink-0">
                  {p.score === undefined ? (
                    <span className="text-zinc-500 italic">playing...</span>
                  ) : (
                    <span className="font-bold text-white block">{p.score.toLocaleString()} pts</span>
                  )}
                  {(p.payout ?? 0) > 0 && <span className="font-bold text-emerald-400 text-[10px]">+{cr(p.payout ?? 0)}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              setCurrentTab('lobbies');
              if (!settled) setSelectedRoomId(room.id);
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <span>{settled ? 'Back to lobbies' : 'Wait in the lobby'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          {settled && (
            <button
              type="button"
              onClick={() => {
                onClose();
                setCurrentTab('wallet');
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2"
            >
              <Wallet className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open wallet</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MatchSummaryOverlay;
