import React from 'react';
import { X, Info } from 'lucide-react';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Play credits have no cash value, so there is nothing to withdraw. */
const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
          <X className="w-5 h-5" />
        </button>
        <Info className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
        <h3 className="text-lg font-black text-white mb-1">Credits stay in the arcade</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Betcha uses play credits with no cash value, so they can't be withdrawn. Use your winnings to buy into bigger matches.
        </p>
        <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs">
          Got it
        </button>
      </div>
    </div>
  );
};

export default WithdrawModal;
