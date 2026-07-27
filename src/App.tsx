import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/common/Header';
import BottomNavbar from './components/common/BottomNavbar';
import Toast from './components/common/Toast';
import HomeView from './components/home/HomeView';
import LobbiesView from './components/lobbies/LobbiesView';
import WalletView from './components/wallet/WalletView';
import ProfileView from './components/profile/ProfileView';
import PlayArenaModal from './components/arena/PlayArenaModal';
import AuthLanding from './components/auth/AuthLanding';

const AppContent: React.FC = () => {
  const { currentTab, isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return (
      <>
        <Toast />
        <AuthLanding />
      </>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-zinc-950 text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950 flex flex-col font-sans antialiased">
      <Header />
      <Toast />

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-4 pt-3 sm:pt-6 overflow-x-hidden">
        {currentTab === 'home' && <HomeView />}
        {currentTab === 'lobbies' && <LobbiesView />}
        {currentTab === 'wallet' && <WalletView />}
        {currentTab === 'profile' && <ProfileView />}
      </main>

      <BottomNavbar />
      <PlayArenaModal />
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
