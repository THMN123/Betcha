import React from 'react';
import { Gamepad2, Swords, Wallet, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NavigationTab } from '../../types';

const BottomNavbar: React.FC = () => {
  const { currentTab, setCurrentTab, user, escrowLedger, activePlayingMatch, practiceGameId } = useApp();

  // Hide bottom navbar completely when user is in active game arena mode to optimize full screen gameplay
  if (activePlayingMatch || practiceGameId) return null;

  const activeEscrowCount = escrowLedger.filter((e) => e.status === 'active_escrow').length;

  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
    {
      id: 'lobbies',
      label: 'Lobbies',
      icon: <Swords className="w-4 h-4 sm:w-5 sm:h-5" />,
      badge: activeEscrowCount > 0 ? activeEscrowCount : undefined,
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />,
      badge: user.escrowLocked > 0 ? `$${user.escrowLocked.toFixed(0)}` : undefined,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />,
    },
  ];

  return (
    <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[calc(100vw-1.5rem)] pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <nav className="pointer-events-auto bg-zinc-900/95 backdrop-blur-2xl border border-zinc-800/90 shadow-2xl shadow-black/90 rounded-full px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-center gap-1 sm:gap-2 transition-all">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentTab(item.id)}
              className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold text-[11px] sm:text-xs transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 font-bold shadow-lg shadow-emerald-500/25 scale-[1.02]'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <span className="relative flex items-center justify-center">
                {item.icon}
                {item.badge !== undefined && !isActive && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.2 text-[8px] sm:text-[9px] font-bold font-mono bg-indigo-500 text-white rounded-full min-w-[13px] text-center border border-zinc-950">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNavbar;

