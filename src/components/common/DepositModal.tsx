import React, { useState } from 'react';
import { X, Gift, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Betcha uses play credits only: players top up with a free daily grant instead of a card. */
const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const { claimFreeCredits, canClaimCreditsAt, user } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleClaim = async () => {
    setIsProcessing(true);
    const ok = await claimFreeCredits();
    setIsProcessing(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
          <Gift className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-lg font-black text-white mb-1">Free Credits</h3>
        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
          Betcha runs on play credits, not real money. Grab 25 free credits once a day to keep challenging your friends.
          You have <strong className="text-white">{user.balance.toFixed(2)} cr</strong>.
        </p>

        {canClaimCreditsAt ? (
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Next claim available at {canClaimCreditsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        ) : (
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleClaim}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm disabled:opacity-50"
          >
            {isProcessing ? 'Claiming...' : 'Claim 25 credits'}
          </button>
        )}
      </div>
    </div>
  );
};

export default DepositModal;
