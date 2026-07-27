import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  DollarSign,
  Plus,
  Clock,
  CheckCircle2,
  Lock,
  Filter,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import DepositModal from '../common/DepositModal';
import WithdrawModal from '../common/WithdrawModal';
import { TransactionType } from '../../types';
import MorphingHeading from '../common/MorphingHeading';
import { WalletSkeleton } from '../common/SkeletonLoader';

const WalletView: React.FC = () => {
  const { user, transactions, escrowLedger } = useApp();

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'escrow'>('history');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <WalletSkeleton />;
  }

  const filteredTx = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    return tx.type === filterType;
  });

  const activeEscrowItems = escrowLedger.filter((e) => e.status === 'active_escrow');

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/60 border border-emerald-500/30 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Wallet className="w-48 h-48 text-emerald-400" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
              Betcha Escrow Vault
            </span>

            <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>5% Spread Audited</span>
            </div>
          </div>

          <div className="mb-6">
            <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Available Arcade Balance
            </span>
            <div className="flex items-baseline gap-2">
              <MorphingHeading as="span" glowColor="emerald" className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                ${user.balance.toFixed(2)}
              </MorphingHeading>
              <span className="text-xs font-semibold text-emerald-400 font-mono">USD</span>
            </div>
          </div>

          {/* Locked Funds Banner */}
          <div className="grid grid-cols-2 gap-3 mb-6 p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 font-mono">
            <div>
              <span className="block text-[10px] text-amber-400 font-semibold uppercase flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>In-Escrow Locked</span>
              </span>
              <span className="text-base font-bold text-white">${user.escrowLocked.toFixed(2)}</span>
            </div>

            <div>
              <span className="block text-[10px] text-emerald-400 font-semibold uppercase flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Total Lifetime Winnings</span>
              </span>
              <span className="text-base font-bold text-white">${user.totalEarnings.toFixed(2)}</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsDepositOpen(true)}
              className="py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Deposit Funds</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWithdrawOpen(true)}
              className="py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span>Withdraw Winnings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Toggle: Transactions vs Escrow Ledger */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'history'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Transaction History ({transactions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('escrow')}
          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
            activeTab === 'escrow'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Escrow Ledger ({escrowLedger.length})</span>
        </button>
      </div>

      {/* View 1: Transaction History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-zinc-500 font-semibold uppercase text-[10px] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filter:
            </span>

            {[
              { id: 'all', label: 'All' },
              { id: 'buy_in', label: 'Buy-Ins' },
              { id: 'payout_win', label: 'Winnings' },
              { id: 'platform_fee', label: '5% Platform Fees' },
              { id: 'deposit', label: 'Deposits' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id as TransactionType | 'all')}
                className={`px-3 py-1.5 rounded-lg font-mono font-medium whitespace-nowrap transition-all ${
                  filterType === f.id
                    ? 'bg-zinc-800 text-white border border-zinc-700 font-bold'
                    : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-850'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="space-y-2">
            {filteredTx.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/80 shadow-md hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === 'payout_win'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : tx.type === 'deposit'
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          : tx.type === 'platform_fee'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {tx.type === 'payout_win' ? (
                        <Sparkles className="w-4 h-4" />
                      ) : tx.type === 'deposit' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold text-white block leading-tight">
                        {tx.description}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        {tx.timestamp} • Status: {tx.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-mono font-bold text-sm ${
                        isPositive ? 'text-emerald-400' : 'text-zinc-300'
                      }`}
                    >
                      {isPositive ? `+$${tx.amount.toFixed(2)}` : `-$${Math.abs(tx.amount).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View 2: Escrow Ledger */}
      {activeTab === 'escrow' && (
        <div className="space-y-3">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>How Betcha P2P Escrow Works</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When a match is created, player buy-ins are immediately locked in the smart escrow ledger. Once scores are submitted, the platform automatically deducts a 5% spread fee and releases the net pot instantly to the winner!
            </p>
          </div>

          <div className="space-y-2">
            {escrowLedger.map((esc) => (
              <div
                key={esc.id}
                className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2 font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Match #{esc.matchId} ({esc.gameTitle})
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      esc.status === 'active_escrow'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {esc.status === 'active_escrow' ? 'LOCKED IN ESCROW' : 'SETTLED & RELEASED'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400 pt-2 border-t border-zinc-850">
                  <div>
                    <span className="block text-[10px] text-zinc-500 uppercase">Gross Locked</span>
                    <span className="font-bold text-white">${esc.totalLocked.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-amber-400 uppercase">5% Spread Fee</span>
                    <span className="font-bold text-amber-400">${esc.platformFeeHeld.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-emerald-400 uppercase">Net Release Pot</span>
                    <span className="font-bold text-emerald-400">
                      ${(esc.totalLocked - esc.platformFeeHeld).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deposit & Withdraw Modals */}
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
      <WithdrawModal isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} />
    </div>
  );
};

export default WalletView;
