import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Plus, Lock, Sparkles, TrendingUp, Percent } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import DepositModal from '../common/DepositModal';
import WithdrawModal from '../common/WithdrawModal';
import { TransactionType } from '../../types';
import { cr } from '../../utils/credits';

const FILTERS: { id: TransactionType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'buy_in', label: 'Buy-ins' },
  { id: 'payout_win', label: 'Winnings' },
  { id: 'platform_fee', label: 'Fees' },
  { id: 'deposit', label: 'Credits' },
];

const TX_STYLE: Record<string, { cls: string; Icon: React.FC<{ className?: string }> }> = {
  payout_win: { cls: 'bg-emerald-400/15 text-emerald-300', Icon: Sparkles },
  deposit: { cls: 'bg-indigo-400/15 text-indigo-300', Icon: ArrowDownLeft },
  platform_fee: { cls: 'bg-amber-400/15 text-amber-300', Icon: Percent },
};

/** Wallet: balance up top, then activity and money held in matches. */
const WalletView: React.FC = () => {
  const { user, transactions, escrowLedger } = useApp();
  const [tab, setTab] = useState<'history' | 'escrow'>('history');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  const filteredTx = transactions.filter((tx) => filterType === 'all' || tx.type === filterType);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-white tracking-tight">Wallet</h1>

      {/* Balance */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/20 via-zinc-900 to-indigo-500/15 p-5 sm:p-7">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-sm font-semibold text-zinc-300">Available balance</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-extrabold text-white tracking-tight tabular-nums">{user.balance.toFixed(2)}</span>
            <span className="text-lg font-bold text-emerald-300">cr</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1">Play credits · no cash value</div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/25 border border-white/[0.06] p-3">
              <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-300" /> Held in matches
              </div>
              <div className="text-lg font-extrabold text-white tabular-nums mt-0.5">{cr(user.escrowLocked)}</div>
            </div>
            <div className="rounded-2xl bg-black/25 border border-white/[0.06] p-3">
              <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> Won all-time
              </div>
              <div className="text-lg font-extrabold text-white tabular-nums mt-0.5">{cr(user.totalEarnings)}</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsDepositOpen(true)}
              className="h-12 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Free credits
            </button>
            <button
              type="button"
              onClick={() => setIsWithdrawOpen(true)}
              className="h-12 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" /> Cash out
            </button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 border-b border-white/[0.07]">
        {[
          { id: 'history' as const, label: 'Activity', count: transactions.length },
          { id: 'escrow' as const, label: 'Held in matches', count: escrowLedger.filter((e) => e.status === 'active_escrow').length },
        ].map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-3 sm:px-4 h-11 text-sm font-bold flex items-center gap-2 ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              {t.label}
              <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center ${active ? 'bg-white text-zinc-950' : 'bg-white/10 text-zinc-400'}`}>
                {t.count}
              </span>
              {active && <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                aria-pressed={filterType === f.id}
                className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap border ${
                  filterType === f.id ? 'bg-white text-zinc-950 border-white' : 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTx.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Nothing here yet.</p>
          ) : (
            <ul className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] divide-y divide-white/[0.05] overflow-hidden">
              {filteredTx.map((tx) => {
                const positive = tx.amount > 0;
                const style = TX_STYLE[tx.type] ?? { cls: 'bg-rose-400/15 text-rose-300', Icon: ArrowUpRight };
                return (
                  <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.cls}`}>
                      <style.Icon className="w-[18px] h-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{tx.description}</div>
                      <div className="text-xs text-zinc-500">
                        {tx.timestamp}
                        {tx.status !== 'completed' && ` · ${tx.status}`}
                      </div>
                    </div>
                    <div className={`text-sm font-extrabold tabular-nums ${positive ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      {positive ? `+${cr(tx.amount)}` : `−${cr(Math.abs(tx.amount))}`}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'escrow' && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400 flex gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            Buy-ins are held safely until a match ends. Then 5% goes to the platform and the rest goes to the winner.
          </p>
          {escrowLedger.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">No credits held right now.</p>
          ) : (
            <ul className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] divide-y divide-white/[0.05] overflow-hidden">
              {escrowLedger.map((esc) => {
                const held = esc.status === 'active_escrow';
                return (
                  <li key={esc.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{esc.gameTitle}</div>
                        <div className="text-xs text-zinc-500">Match #{esc.matchId}</div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${
                          held ? 'bg-amber-400/15 text-amber-200 border-amber-300/30' : 'bg-white/10 text-zinc-300 border-white/10'
                        }`}
                      >
                        {held ? 'Held' : 'Released'}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-zinc-400 tabular-nums">
                      <span>Pot {cr(esc.totalLocked)}</span>
                      <span>Fee {cr(esc.platformFeeHeld)}</span>
                      <span className="text-emerald-300 font-bold">Prize {cr(esc.totalLocked - esc.platformFeeHeld)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
      <WithdrawModal isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} />
    </div>
  );
};

export default WalletView;
