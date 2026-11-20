import React from 'react';
import { Info } from 'lucide-react';
import Sheet from '../ui/Sheet';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Play credits have no cash value, so there is nothing to withdraw. */
const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose }) => (
  <Sheet
    open={isOpen}
    onClose={onClose}
    size="sm"
    eyebrow="Wallet"
    title="Credits stay in the arcade"
    footer={
      <button type="button" onClick={onClose} className="w-full h-12 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm">
        Got it
      </button>
    }
  >
    <div className="flex gap-3 items-start">
      <Info className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
      <p className="text-sm text-zinc-300 leading-relaxed">
        Betcha uses play credits with no cash value, so they can't be withdrawn. Use your winnings to buy into bigger matches.
      </p>
    </div>
  </Sheet>
);

export default WithdrawModal;
