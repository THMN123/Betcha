import React, { useState } from 'react';
import { X, ArrowUpRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose }) => {
  const { user, withdrawFunds } = useApp();
  const [amount, setAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleWithdraw = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    setIsProcessing(true);
    setTimeout(() => {
      const success = withdrawFunds(val);
      setIsProcessing(false);
      if (success) onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Withdraw Winnings</h3>
            <p className="text-xs text-zinc-400">Transfer arcade earnings to linked bank/wallet</p>
          </div>
        </div>

        {/* Balance Display */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between mb-5">
          <div>
            <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Available Balance</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">${user.balance.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={() => setAmount(user.balance.toFixed(2))}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
          >
            Withdraw All
          </button>
        </div>

        {/* Input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase">
            Withdrawal Amount ($)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">$</span>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl pl-8 pr-4 py-2.5 text-white font-mono text-sm focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-6">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Instant mock transfer to Bank Account (**** 9102)</span>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={isProcessing || !amount || parseFloat(amount) <= 0}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <span>Processing Transfer...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm Withdrawal</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default WithdrawModal;
