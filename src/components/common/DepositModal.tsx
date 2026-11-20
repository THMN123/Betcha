import React, { useState } from 'react';
import { Gift, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Sheet from '../ui/Sheet';
import { cr } from '../../utils/credits';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Betcha uses play credits only: players top up with a free daily grant instead of a card. */
const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const { claimFreeCredits, canClaimCreditsAt, user } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClaim = async () => {
    setIsProcessing(true);
    const ok = await claimFreeCredits();
    setIsProcessing(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="sm"
      eyebrow="Daily reward"
      title="Free credits"
      footer={
        canClaimCreditsAt ? (
          <div className="h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-zinc-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Next claim at {canClaimCreditsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        ) : (
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleClaim}
            className="w-full h-12 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm disabled:opacity-50"
          >
            {isProcessing ? 'Claiming...' : 'Claim 25 credits'}
          </button>
        )
      }
    >
      <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent border border-emerald-400/20 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-400/15 flex items-center justify-center shrink-0">
          <Gift className="w-7 h-7 text-emerald-300" />
        </div>
        <div>
          <div className="text-2xl font-extrabold text-white">+25 cr</div>
          <div className="text-xs text-zinc-400">once a day · you have {cr(user.balance)}</div>
        </div>
      </div>
      <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
        Betcha runs on play credits, not real money. Grab your free credits every day to keep challenging your friends.
      </p>
    </Sheet>
  );
};

export default DepositModal;
