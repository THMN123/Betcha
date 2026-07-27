import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, Crown, CheckCircle2, ArrowRight, ShieldCheck, Wallet, RefreshCw } from 'lucide-react';
import { MatchRoom } from '../../types';
import { useApp } from '../../context/AppContext';

interface MatchSummaryOverlayProps {
  room: MatchRoom;
  onClose: () => void;
  onReplayPractice?: () => void;
}

export const MatchSummaryOverlay: React.FC<MatchSummaryOverlayProps> = ({
  room,
  onClose,
  onReplayPractice,
}) => {
  const { user, setCurrentTab } = useApp();

  const totalPot = room.buyIn * room.players.length;
  const platformFee = totalPot * 0.05; // 5% fee
  const netPrize = room.netPrizePool || totalPot - platformFee;

  const sortedPlayers = [...room.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const isWinner = sortedPlayers[0]?.id === user.id || room.winnerId === user.id;

  // Fire confetti animation when summary loads
  useEffect(() => {
    if (isWinner) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6'],
        });
      } catch (e) {
        console.warn('Confetti burst note:', e);
      }
    }
  }, [isWinner]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="absolute inset-0 z-40 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl text-center my-auto">
        {/* Top Trophy/Crown Banner */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400 shadow-lg shadow-amber-500/10">
          <Trophy className="w-8 h-8" />
        </div>

        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider inline-block mb-2">
          Match Completed • Results Settled
        </span>

        <h3 className="text-xl font-black text-white mb-1">
          {isWinner ? '🎉 Victory! Tournament Champion' : 'Match Finished'}
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          All participant scores calculated & escrow prize pool transferred
        </p>

        {/* Financial Breakdown (Pot & 5% Platform Fee) */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 mb-4 text-left space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Total Match Pot ({room.players.length} Players x ${room.buyIn}):</span>
            <span className="font-mono font-bold text-white">${totalPot.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>5% Platform Escrow Fee:</span>
            </span>
            <span className="font-mono font-semibold text-rose-400">-${platformFee.toFixed(2)}</span>
          </div>

          <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs sm:text-sm font-bold">
            <span className="text-emerald-400">Net Winner Payout:</span>
            <span className="font-mono text-emerald-400 font-black">${netPrize.toFixed(2)}</span>
          </div>
        </div>

        {/* Final Standings Table */}
        <div className="space-y-1.5 mb-5 text-left max-h-[160px] overflow-y-auto scrollable-content pr-1">
          {sortedPlayers.map((player, idx) => {
            const isFirst = idx === 0;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                  isFirst
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                    : 'bg-zinc-950 border-zinc-850 text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 font-mono text-[10px] font-bold flex items-center justify-center text-zinc-400">
                    #{idx + 1}
                  </span>
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-6 h-6 rounded-full object-cover border border-zinc-700"
                  />
                  <div>
                    <span className="font-bold text-white block leading-none">
                      {player.name} {player.id === user.id && '(You)'}
                    </span>
                    {isFirst && (
                      <span className="text-[9px] text-amber-400 flex items-center gap-0.5 mt-0.5">
                        <Crown className="w-2.5 h-2.5" /> 1st Place Winner
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-white block">
                    {(player.score || 0).toLocaleString()} PTS
                  </span>
                  {isFirst && (
                    <span className="font-mono font-bold text-emerald-400 text-[10px]">
                      +${netPrize.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <span>Return to Lobbies</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              setCurrentTab('wallet');
            }}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
            <span>Check Wallet Balance</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default MatchSummaryOverlay;
