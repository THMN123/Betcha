import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  NavigationTab,
  UserProfile,
  MatchRoom,
  WalletTransaction,
  EscrowEntry,
  LeaderboardEntry,
  GameId,
} from '../types';
import {
  INITIAL_USER,
  INITIAL_ROOMS,
  INITIAL_TRANSACTIONS,
  INITIAL_ESCROW,
  TOP_LEADERBOARD,
  GAMES_LIST,
  MOCK_FRIENDS,
} from '../data/initialData';
import { soundFx } from '../utils/audio';
import { supabase, syncUserProfileToSupabase } from '../lib/supabaseClient';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface AppContextType {
  isAuthenticated: boolean;
  loginWithEmail: (email: string, displayName?: string) => void;
  loginWithOAuth: (provider: 'google' | 'guest') => void;
  logout: () => void;
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  user: UserProfile;
  rooms: MatchRoom[];
  transactions: WalletTransaction[];
  escrowLedger: EscrowEntry[];
  leaderboard: LeaderboardEntry[];
  toast: Toast | null;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  
  // Active playing match / practice
  activePlayingMatch: MatchRoom | null;
  practiceGameId: GameId | null;
  startPractice: (gameId: GameId) => void;
  enterMatchArena: (match: MatchRoom) => void;
  exitArena: () => void;
  
  // Actions
  createMatch: (config: {
    gameId: GameId;
    title: string;
    buyIn: number;
    maxPlayers: number;
    distribution: 'winner_takes_all' | 'top_two';
  }) => MatchRoom | null;
  
  joinMatch: (roomId: string) => boolean;
  togglePlayerReady: (roomId: string) => void;
  startMatchLobby: (roomId: string) => void;
  submitMatchScore: (roomId: string, score: number) => void;
  simulateFriendRuns: (roomId: string) => void;
  
  // Wallet
  depositFunds: (amount: number) => void;
  withdrawFunds: (amount: number) => boolean;
  
  // Sound & Switcher
  soundEnabled: boolean;
  toggleSound: () => void;
  switchUserAccount: (handle: string) => void;
  
  // Selected Room detail modal/view
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('betcha_auth') === 'true';
  });

  const [currentTab, setCurrentTabState] = useState<NavigationTab>('home');
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('betcha_user');
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });
  
  const [rooms, setRooms] = useState<MatchRoom[]>(() => {
    const saved = localStorage.getItem('betcha_rooms');
    return saved ? JSON.parse(saved) : INITIAL_ROOMS;
  });

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    const saved = localStorage.getItem('betcha_tx');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [escrowLedger, setEscrowLedger] = useState<EscrowEntry[]>(() => {
    const saved = localStorage.getItem('betcha_escrow');
    return saved ? JSON.parse(saved) : INITIAL_ESCROW;
  });

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(TOP_LEADERBOARD);

  const [activePlayingMatch, setActivePlayingMatch] = useState<MatchRoom | null>(null);
  const [practiceGameId, setPracticeGameId] = useState<GameId | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Sync state to localstorage
  useEffect(() => {
    localStorage.setItem('betcha_auth', String(isAuthenticated));
  }, [isAuthenticated]);

  // Handle URL invite parameter (?room=BETCHA-XXXX)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (!roomParam) return;

    let targetRoom = rooms.find(
      (r) => r.inviteCode.toUpperCase() === roomParam.toUpperCase() || r.id.toUpperCase() === roomParam.toUpperCase()
    );

    if (!targetRoom) {
      const roomNumStr = roomParam.replace(/[^0-9]/g, '') || Math.floor(1000 + Math.random() * 9000).toString();
      const roomNum = parseInt(roomNumStr) || 1234;
      const game = GAMES_LIST[roomNum % GAMES_LIST.length];

      targetRoom = {
        id: `BTC-${roomNum}`,
        title: `${game.title} Challenge #${roomNum}`,
        gameId: game.id,
        hostId: 'usr_host',
        hostName: 'CyberHost',
        buyIn: 5,
        maxPlayers: 2,
        status: 'waiting',
        createdAt: 'Just now',
        spreadPercent: 5,
        totalPot: 5,
        platformFee: 0.25,
        netPrizePool: 4.75,
        distribution: 'winner_takes_all',
        durationSeconds: game.id === 'snake' ? 60 : game.id === '2048' ? 90 : 45,
        inviteCode: `BETCHA-${roomNum}`,
        players: [
          {
            id: 'usr_host',
            name: 'CyberHost',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=Host_${roomNum}`,
            isHost: true,
            isReady: true,
            isCurrentUser: false,
          }
        ]
      };

      setRooms((prev) => [targetRoom!, ...prev]);
      return;
    }

    // Auto-join the match room
    joinMatch(targetRoom.id);

    // Clean up query param so it doesn't trigger again
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }, [isAuthenticated, rooms]);

  useEffect(() => {
    localStorage.setItem('betcha_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('betcha_rooms', JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem('betcha_tx', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('betcha_escrow', JSON.stringify(escrowLedger));
  }, [escrowLedger]);

  const setCurrentTab = (tab: NavigationTab) => {
    soundFx.playClick();
    setCurrentTabState(tab);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4000);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.soundEnabled = next;
    if (next) soundFx.playClick();
  };

  // Practice & Arena Handlers
  const startPractice = (gameId: GameId) => {
    soundFx.playClick();
    setPracticeGameId(gameId);
    setActivePlayingMatch(null);
  };

  const enterMatchArena = (match: MatchRoom) => {
    soundFx.playClick();
    setActivePlayingMatch(match);
    setPracticeGameId(null);
  };

  const exitArena = () => {
    soundFx.playClick();
    setActivePlayingMatch(null);
    setPracticeGameId(null);
  };

  // Create Match
  const createMatch = (config: {
    gameId: GameId;
    title: string;
    buyIn: number;
    maxPlayers: number;
    distribution: 'winner_takes_all' | 'top_two';
  }): MatchRoom | null => {
    if (user.balance < config.buyIn) {
      showToast(`Insufficient funds ($${user.balance.toFixed(2)}) for $${config.buyIn} buy-in. Deposit funds first!`, 'error');
      return null;
    }

    const game = GAMES_LIST.find((g) => g.id === config.gameId);
    const roomNum = Math.floor(1000 + Math.random() * 9000);
    const roomId = `BTC-${roomNum}`;
    const inviteCode = `BETCHA-${roomNum}`;

    const totalPot = config.buyIn * 1; // initial host buy in
    const platformFee = config.buyIn * 0.05;
    const netPrizePool = totalPot - platformFee;

    const newRoom: MatchRoom = {
      id: roomId,
      title: config.title || `${game?.title || 'Arcade'} Challenge #${roomNum}`,
      gameId: config.gameId,
      hostId: user.id,
      hostName: user.displayName,
      buyIn: config.buyIn,
      maxPlayers: config.maxPlayers,
      status: 'waiting',
      createdAt: 'Just now',
      spreadPercent: 5,
      totalPot: config.buyIn, // current pot with 1 player
      platformFee: config.buyIn * 0.05,
      netPrizePool: config.buyIn * 0.95,
      distribution: config.distribution,
      durationSeconds: config.gameId === 'snake' ? 60 : config.gameId === '2048' ? 90 : 45,
      inviteCode,
      players: [
        {
          id: user.id,
          name: user.displayName,
          avatar: user.avatar,
          isHost: true,
          isReady: true,
          isCurrentUser: true,
        },
      ],
    };

    // Deduct buy-in and place into escrow
    setUser((prev) => ({
      ...prev,
      balance: prev.balance - config.buyIn,
      escrowLocked: prev.escrowLocked + config.buyIn,
    }));

    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'buy_in',
      amount: -config.buyIn,
      matchId: roomId,
      description: `Escrow Lock: ${game?.title} (#${roomId})`,
      status: 'escrowed',
    };

    const newEscrow: EscrowEntry = {
      id: `esc_${roomNum}`,
      matchId: roomId,
      gameTitle: game?.title || 'Arcade',
      totalLocked: config.buyIn,
      platformFeeHeld: config.buyIn * 0.05,
      playerCount: 1,
      createdAt: 'Just now',
      status: 'active_escrow',
    };

    setRooms((prev) => [newRoom, ...prev]);
    setTransactions((prev) => [newTx, ...prev]);
    setEscrowLedger((prev) => [newEscrow, ...prev]);

    soundFx.playCashChing();
    showToast(`Created Lobby #${roomId}! $${config.buyIn.toFixed(2)} buy-in locked in Escrow.`, 'success');
    setSelectedRoomId(roomId);
    setCurrentTab('lobbies');

    return newRoom;
  };

  // Join Match
  const joinMatch = (roomId: string): boolean => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      showToast('Match room not found', 'error');
      return false;
    }

    if (room.players.some((p) => p.id === user.id)) {
      showToast('You are already in this match lobby', 'info');
      setSelectedRoomId(roomId);
      setCurrentTab('lobbies');
      return true;
    }

    if (room.players.length >= room.maxPlayers) {
      showToast('Lobby is already full!', 'warning');
      return false;
    }

    if (user.balance < room.buyIn) {
      showToast(`Insufficient funds ($${user.balance.toFixed(2)}) for $${room.buyIn} buy-in.`, 'error');
      return false;
    }

    // Deduct user funds
    setUser((prev) => ({
      ...prev,
      balance: prev.balance - room.buyIn,
      escrowLocked: prev.escrowLocked + room.buyIn,
    }));

    // Update room pot calculation
    const updatedPlayers = [
      ...room.players,
      {
        id: user.id,
        name: user.displayName,
        avatar: user.avatar,
        isHost: false,
        isReady: true,
        isCurrentUser: true,
      },
    ];

    const newTotalPot = room.buyIn * updatedPlayers.length;
    const newPlatformFee = newTotalPot * 0.05;
    const newNetPrize = newTotalPot - newPlatformFee;

    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              players: updatedPlayers,
              totalPot: newTotalPot,
              platformFee: newPlatformFee,
              netPrizePool: newNetPrize,
            }
          : r
      )
    );

    // Add TX & Escrow update
    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'buy_in',
      amount: -room.buyIn,
      matchId: roomId,
      description: `Buy-In Joined: #${roomId}`,
      status: 'escrowed',
    };

    setTransactions((prev) => [newTx, ...prev]);

    setEscrowLedger((prev) =>
      prev.map((e) =>
        e.matchId === roomId
          ? {
              ...e,
              totalLocked: e.totalLocked + room.buyIn,
              platformFeeHeld: (e.totalLocked + room.buyIn) * 0.05,
              playerCount: e.playerCount + 1,
            }
          : e
      )
    );

    soundFx.playCashChing();
    showToast(`Joined Match #${roomId}! $${room.buyIn.toFixed(2)} buy-in locked in Escrow.`, 'success');
    setSelectedRoomId(roomId);
    setCurrentTab('lobbies');
    return true;
  };

  const togglePlayerReady = (roomId: string) => {
    soundFx.playClick();
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const players = r.players.map((p) =>
          p.id === user.id ? { ...p, isReady: !p.isReady } : p
        );
        return { ...r, players };
      })
    );
  };

  const startMatchLobby = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    if (room.players.length < 2) {
      showToast('Cannot start match until both players have joined!', 'warning');
      return;
    }

    soundFx.playClick();
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, status: 'in_progress' } : r))
    );

    enterMatchArena(room);
    showToast(`Match Started! High score wins $${room.netPrizePool.toFixed(2)} pot!`, 'success');
  };

  // Submit Match Score
  const submitMatchScore = (roomId: string, score: number) => {
    soundFx.playPickup();

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const players = r.players.map((p) =>
          p.id === user.id ? { ...p, score } : p
        );
        return { ...r, players };
      })
    );

    showToast(`Score of ${score.toLocaleString()} points submitted!`, 'info');
  };

  // Settle Escrow Payout for Match
  const simulateFriendRuns = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    soundFx.playClick();

    // Work strictly with actual joined players
    let currentPlayers = [...room.players];
    if (currentPlayers.length === 0) {
      showToast('No participants in room to settle', 'warning');
      return;
    }

    const totalPot = room.buyIn * currentPlayers.length;
    const platformFee = totalPot * 0.05;
    const netPrizePool = totalPot - platformFee;

    const userPlayer = currentPlayers.find((p) => p.id === user.id);
    const userScore = userPlayer?.score || 0;

    const scoredPlayers = currentPlayers.map((p) => {
      const finalScore = p.score !== undefined ? p.score : (p.id === user.id ? userScore : 0);
      return { ...p, score: finalScore, isReady: true };
    });

    // Rank players high to low score
    scoredPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Determine payouts
    let winnerId = scoredPlayers[0].id;
    let winnerName = scoredPlayers[0].name;

    const rankedPlayers = scoredPlayers.map((p, idx) => {
      const rank = idx + 1;
      let payout = 0;
      if (room.distribution === 'winner_takes_all') {
        if (rank === 1) payout = netPrizePool;
      } else {
        // top two 70% / 30%
        if (rank === 1) payout = netPrizePool * 0.7;
        if (rank === 2) payout = netPrizePool * 0.3;
      }
      return { ...p, rank, payout };
    });

    // Check if current user won or placed
    const currentUserResult = rankedPlayers.find((p) => p.id === user.id);
    const userPayout = currentUserResult?.payout || 0;
    const isUserWinner = currentUserResult?.rank === 1;

    // 4. Update state: Room Completed, User Wallet, Transactions, Escrow Ledger, User Stats
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              status: 'completed',
              players: rankedPlayers,
              totalPot,
              platformFee,
              netPrizePool,
              winnerId,
              winnerName,
            }
          : r
      )
    );

    // Update User Wallet & Stats
    setUser((prev) => {
      const newMatchesPlayed = prev.matchesPlayed + 1;
      const newWinsCount = isUserWinner ? prev.winsCount + 1 : prev.winsCount;
      const newWinRate = Number(((newWinsCount / newMatchesPlayed) * 100).toFixed(1));
      const newBalance = prev.balance + userPayout;
      const newEscrow = Math.max(0, prev.escrowLocked - room.buyIn);

      return {
        ...prev,
        balance: newBalance,
        escrowLocked: newEscrow,
        totalEarnings: prev.totalEarnings + userPayout,
        matchesPlayed: newMatchesPlayed,
        winsCount: newWinsCount,
        winRate: newWinRate,
      };
    });

    // Update Escrow status
    setEscrowLedger((prev) =>
      prev.map((e) =>
        e.matchId === roomId ? { ...e, status: 'settled' } : e
      )
    );

    // Add Payout Transaction if user earned money
    const newTxList: WalletTransaction[] = [];
    if (userPayout > 0) {
      newTxList.push({
        id: `tx_${Date.now()}_win`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'payout_win',
        amount: userPayout,
        matchId: roomId,
        description: `Tournament Prize Payout (#${roomId})`,
        status: 'completed',
      });
    }

    newTxList.push({
      id: `tx_${Date.now()}_fee`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'platform_fee',
      amount: -platformFee,
      matchId: roomId,
      description: `5% Platform Spread Collected (#${roomId})`,
      status: 'completed',
    });

    setTransactions((prev) => [...newTxList, ...prev]);

    // Leaderboard update
    if (isUserWinner && userPlayer) {
      const gameTitle = GAMES_LIST.find((g) => g.id === room.gameId)?.title || 'Arcade';
      setLeaderboard((prev) => [
        {
          id: `lb_${Date.now()}`,
          rank: 1,
          handle: user.handle,
          avatar: user.avatar,
          gameTitle,
          highScore: userScore,
          payoutWon: userPayout,
        },
        ...prev.map((l) => ({ ...l, rank: l.rank + 1 })),
      ]);
    }

    // Sound & Confetti
    if (isUserWinner) {
      soundFx.playWinFanfare();
      soundFx.playCashChing();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#6366f1', '#f59e0b', '#ec4899'],
      });
      showToast(`VICTORY! You won 1st Place & $${userPayout.toFixed(2)} net payout!`, 'success');
    } else {
      soundFx.playGameOver();
      showToast(`Match Completed! Winner: ${winnerName} ($${netPrizePool.toFixed(2)} Pot)`, 'info');
    }
  };

  // Deposit & Withdraw
  const depositFunds = (amount: number) => {
    setUser((prev) => ({ ...prev, balance: prev.balance + amount }));
    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'deposit',
      amount: amount,
      description: 'Instant Card Deposit (Mock Visa **** 4892)',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
    soundFx.playCashChing();
    showToast(`Successfully deposited $${amount.toFixed(2)} to Wallet!`, 'success');
  };

  const withdrawFunds = (amount: number): boolean => {
    if (user.balance < amount) {
      showToast(`Insufficient balance ($${user.balance.toFixed(2)}) for withdrawal`, 'error');
      return false;
    }

    setUser((prev) => ({ ...prev, balance: prev.balance - amount }));
    const newTx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'withdrawal',
      amount: -amount,
      description: 'Payout Transfer to Bank Account (**** 9102)',
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
    soundFx.playCashChing();
    showToast(`Withdrawal of $${amount.toFixed(2)} initiated!`, 'success');
    return true;
  };

  // Switch User Account
  const switchUserAccount = (handle: string) => {
    soundFx.playClick();
    if (handle === INITIAL_USER.handle) {
      setUser(INITIAL_USER);
      showToast(`Switched account to ${INITIAL_USER.displayName}`, 'info');
    }
  };

  // Supabase auth state listener when Supabase is configured
  useEffect(() => {
    if (!supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        const authUser = session.user;
        const meta = authUser.user_metadata || {};
        const fullName = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'Contender';
        const avatarUrl = meta.avatar_url || meta.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authUser.id)}`;

        // Sync to Supabase profiles database table
        const profile = await syncUserProfileToSupabase({
          id: authUser.id,
          email: authUser.email,
          full_name: fullName,
          avatar_url: avatarUrl,
        });

        const displayName = profile?.display_name || fullName;
        const handle = profile?.handle || ('@' + displayName.toLowerCase().replace(/[^a-z0-9_]/g, '') + '_' + authUser.id.slice(0, 4));
        const finalAvatar = profile?.avatar_url || avatarUrl;

        setUser((prev) => ({
          ...prev,
          id: authUser.id,
          handle,
          displayName,
          avatar: finalAvatar,
          badges: [
            { id: 'b1', title: 'Verified Member', description: `Authenticated as ${authUser.email}`, icon: 'ShieldCheck', unlocked: true },
          ],
        }));
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loginWithEmail = (email: string, displayName?: string) => {
    soundFx.playCashChing();
    setIsAuthenticated(true);
    const prefix = email.split('@')[0] || 'Player';
    const cleanName = displayName || (prefix.charAt(0).toUpperCase() + prefix.slice(1));
    const timeId = Math.floor(1000 + Math.random() * 9000).toString();

    setUser({
      id: `usr_${prefix}_${Date.now()}`,
      handle: `@${prefix.toLowerCase()}_${timeId}`,
      displayName: cleanName,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(prefix)}`,
      balance: 25.00,
      escrowLocked: 0.00,
      totalEarnings: 0.00,
      matchesPlayed: 0,
      winsCount: 0,
      winRate: 0,
      favoriteGame: 'Cyber Snake',
      vipTier: 'Contender',
      badges: [
        { id: 'b1', title: 'Verified Email', description: `Authenticated as ${email}`, icon: 'ShieldCheck', unlocked: true },
      ],
    });
    setTransactions([
      {
        id: `tx_${Date.now()}`,
        timestamp: 'Just now',
        type: 'deposit',
        amount: 25.00,
        description: `Welcome Bonus Deposit (${email})`,
        status: 'completed',
      },
    ]);
    showToast(`Welcome ${cleanName}! $25.00 Welcome balance loaded.`, 'success');
  };

  const loginWithOAuth = (provider: 'google' | 'guest') => {
    if (provider === 'google') {
      loginWithEmail('google.player@betcha.io', 'Google Player');
    } else {
      loginWithEmail('arcade.pass@betcha.io', 'Arcade Contender');
    }
  };

  const logout = () => {
    soundFx.playClick();
    setIsAuthenticated(false);
    showToast('Signed out of Betcha Cyber Arcade.', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        loginWithEmail,
        loginWithOAuth,
        logout,
        currentTab,
        setCurrentTab,
        user,
        rooms,
        transactions,
        escrowLedger,
        leaderboard,
        toast,
        showToast,
        activePlayingMatch,
        practiceGameId,
        startPractice,
        enterMatchArena,
        exitArena,
        createMatch,
        joinMatch,
        togglePlayerReady,
        startMatchLobby,
        submitMatchScore,
        simulateFriendRuns,
        depositFunds,
        withdrawFunds,
        soundEnabled,
        toggleSound,
        switchUserAccount,
        selectedRoomId,
        setSelectedRoomId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
