import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/common/Header';
import BottomNavbar from './components/common/BottomNavbar';
import Toast from './components/common/Toast';
import HomeView from './components/home/HomeView';
import LobbiesView from './components/lobbies/LobbiesView';
import WalletView from './components/wallet/WalletView';
import ProfileView from './components/profile/ProfileView';
// Loaded on demand: the games/arena and the sign-in screen (with its animation library).
const PlayArenaModal = lazy(() => import('./components/arena/PlayArenaModal'));
const AuthLanding = lazy(() => import('./components/auth/AuthLanding'));
import SetNewPasswordModal from './components/auth/SetNewPasswordModal';
import CreateMatchSheet from './components/lobbies/CreateMatchSheet';
import LobbyDetailModal from './components/lobbies/LobbyDetailModal';

/** The open lobby card, available from every screen (Home, Matches, notifications). */
const LobbySheetHost: React.FC = () => {
  const { selectedRoomId, setSelectedRoomId, rooms } = useApp();
  const room = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : null;
  return room ? <LobbyDetailModal room={room} onClose={() => setSelectedRoomId(null)} /> : null;
};

const AppContent: React.FC = () => {
  const { currentTab, isAuthenticated, authReady } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toast />
        <Suspense fallback={<div className="min-h-[100dvh] bg-zinc-950" />}>
          <AuthLanding />
        </Suspense>
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-zinc-950 text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950 flex flex-col font-sans antialiased">
      <Header />
      <Toast />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pt-4 sm:pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12">
        <div key={currentTab} className="tab-enter">
          {currentTab === 'home' && <HomeView />}
          {currentTab === 'lobbies' && <LobbiesView />}
          {currentTab === 'wallet' && <WalletView />}
          {currentTab === 'profile' && <ProfileView />}
        </div>
      </main>

      <BottomNavbar />
      <Suspense fallback={null}>
        <PlayArenaModal />
      </Suspense>
      <SetNewPasswordModal />
      <LobbySheetHost />
      <CreateMatchSheet />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
