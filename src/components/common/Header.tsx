import React, { useState } from 'react';
import { Volume2, VolumeX, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import DepositModal from './DepositModal';
import { cr } from '../../utils/credits';
import { useNavItems } from './BottomNavbar';

/** Top bar: brand, the main menu (larger screens), balance, sound and your avatar. */
const Header: React.FC = () => {
  const { user, soundEnabled, toggleSound, currentTab, setCurrentTab } = useApp();
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const items = useNavItems();

  return (
    <>
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06] pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto h-14 md:h-16 px-4 flex items-center gap-3">
          {/* Brand */}
          <button type="button" onClick={() => setCurrentTab('home')} className="flex items-center gap-2 shrink-0" aria-label="Betcha home">
            <img src="/logo.svg" alt="" className="w-8 h-8 rounded-lg" />
            <span className="font-display font-extrabold text-lg tracking-tight text-white hidden min-[380px]:inline">
              BET<span className="text-emerald-400">CHA</span>
            </span>
          </button>

          {/* Main menu (larger screens) */}
          <nav aria-label="Main" className="hidden md:flex items-center gap-1 ml-6 h-full">
            {items.map(({ id, label, badge }) => {
              const active = currentTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCurrentTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative h-full px-4 text-sm font-bold tracking-wide flex items-center gap-2 transition-colors ${
                    active ? 'text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {label}
                  {badge !== undefined && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-400 text-zinc-950 text-[10px] font-extrabold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                  {active && <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-t-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          {/* Balance: tap for free credits */}
          <div className="flex items-center h-9 rounded-full bg-white/[0.06] border border-white/[0.08] pl-3 pr-1 gap-2 shrink-0">
            <button type="button" onClick={() => setCurrentTab('wallet')} className="font-mono font-bold text-sm text-white tabular-nums whitespace-nowrap">
              {cr(user.balance)}
            </button>
            <button
              type="button"
              onClick={() => setIsDepositOpen(true)}
              aria-label="Get free credits"
              className="w-7 h-7 rounded-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 flex items-center justify-center"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Turn sound on'}
            className="w-9 h-9 shrink-0 rounded-full bg-white/[0.06] hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center"
          >
            {soundEnabled ? <Volume2 className="w-[18px] h-[18px]" /> : <VolumeX className="w-[18px] h-[18px] text-zinc-500" />}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            aria-label="Your profile"
            className={`w-9 h-9 shrink-0 rounded-full overflow-hidden ring-2 ${currentTab === 'profile' ? 'ring-emerald-400' : 'ring-white/10 hover:ring-white/30'}`}
          >
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          </button>
        </div>
      </header>

      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
    </>
  );
};

export default Header;
