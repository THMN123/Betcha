import React, { useState } from 'react';
import { X, CreditCard, DollarSign, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const { depositFunds } = useApp();
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleDeposit = () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);
    setTimeout(() => {
      depositFunds(amount);
      setIsProcessing(false);
      onClose();
    }, 600);
  };

  const presetAmounts = [10, 25, 50, 100];

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
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Deposit Arcade Funds</h3>
            <p className="text-xs text-zinc-400">Instant mock payment deposit for match buy-ins</p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase">
            Select Amount
          </label>
          <div className="grid grid-cols-4 gap-2">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setSelectedAmount(amt);
                  setCustomAmount('');
                }}
                className={`py-2.5 rounded-xl text-sm font-bold font-mono transition-all border ${
                  selectedAmount === amt && !customAmount
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:border-zinc-500'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase">
            Or Custom Amount ($)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">$</span>
            <input
              type="number"
              placeholder="e.g. 15.00"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl pl-8 pr-4 py-2.5 text-white font-mono text-sm focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Payment Method Badge */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 mb-6">
          <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Mock Payment Method</span>
          </div>
          <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
            Visa **** 4892
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Instant escrow deposit • No real money charged in sandbox demo</span>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleDeposit}
          disabled={isProcessing}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <span>Processing Deposit...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm Deposit ${customAmount || selectedAmount}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DepositModal;
