import React, { useState } from 'react';
import { Wallet, Volume2, VolumeX, Sparkles, Plus, Flame } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import DepositModal from './DepositModal';

const Header: React.FC = () => {
  const { user, soundEnabled, toggleSound, setCurrentTab } = useApp();
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 transition-all">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div 
            onClick={() => setCurrentTab('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-emerald-950/40 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-xl text-white font-display">
                  BET<span className="text-emerald-400">CHA</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                  P2P Arcade
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-medium">5% Spread • Escrow Wagers</p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2">
            {/* Wallet Balance Pill */}
            <div 
              onClick={() => setCurrentTab('wallet')}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-emerald-500/40 px-3 py-1.5 rounded-full cursor-pointer transition-all shadow-sm group"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Balance</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  ${user.balance.toFixed(2)}
                </span>
              </div>
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDepositOpen(true);
                }}
                className="ml-1 p-1 rounded-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors shadow-sm"
                title="Quick Deposit"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-full hover:border-zinc-700 transition-all"
              title={soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Deposit Modal */}
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </>
  );
};

export default Header;
