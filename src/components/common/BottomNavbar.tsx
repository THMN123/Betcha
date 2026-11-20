import React from 'react';
import { House, Swords, Wallet, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NavigationTab } from '../../types';

export interface NavItem {
  id: NavigationTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
  badge?: number;
}

/** The app's sections, shared by the top menu (larger screens) and the bottom tab bar (phones). */
export function useNavItems(): NavItem[] {
  const { rooms } = useApp();
  // Matches that need you: lobbies you're in and matches being played.
  const live = rooms.filter(
    (r) => (r.status === 'waiting' || r.status === 'in_progress') && r.players.some((p) => p.isCurrentUser)
  ).length;
  return [
    { id: 'home', label: 'Home', Icon: House },
    { id: 'lobbies', label: 'Matches', Icon: Swords, badge: live || undefined },
    { id: 'wallet', label: 'Wallet', Icon: Wallet },
    { id: 'profile', label: 'Profile', Icon: UserRound },
  ];
}

/** Phone tab bar, docked to the bottom edge (content is padded so nothing hides behind it). */
const BottomNavbar: React.FC = () => {
  const { currentTab, setCurrentTab, activePlayingMatch, practiceGameId } = useApp();
  const items = useNavItems();

  // Full screen while playing.
  if (activePlayingMatch || practiceGameId) return null;

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/92 backdrop-blur-xl border-t border-white/[0.07] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 h-16">
        {items.map(({ id, label, Icon, badge }) => {
          const active = currentTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCurrentTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                active ? 'text-white' : 'text-zinc-500'
              }`}
            >
              {active && <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />}
              <span className="relative">
                <Icon className={`w-[22px] h-[22px] ${active ? 'text-white' : ''}`} />
                {badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-400 text-zinc-950 text-[10px] font-extrabold flex items-center justify-center ring-2 ring-zinc-950">
                    {badge}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavbar;
