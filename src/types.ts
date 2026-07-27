export type NavigationTab = 'home' | 'lobbies' | 'wallet' | 'profile';

export type GameId = 'snake' | '2048' | 'neondodge';

export interface GameInfo {
  id: GameId;
  title: string;
  category: string;
  description: string;
  iconName: string;
  themeColor: string;
  bgGradient: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  avgDuration: string;
  popularityScore: number;
}

export type MatchStatus = 'draft' | 'waiting' | 'in_progress' | 'completed' | 'cancelled';

export interface MatchPlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  score?: number;
  completedAt?: string;
  rank?: number;
  payout?: number;
  isCurrentUser?: boolean;
}

export interface MatchRoom {
  id: string; // e.g., 'BTC-8921'
  title: string;
  gameId: GameId;
  hostId: string;
  hostName: string;
  buyIn: number; // e.g. 1, 5, 10, 25
  maxPlayers: number; // 2, 4, 8
  players: MatchPlayer[];
  status: MatchStatus;
  createdAt: string;
  spreadPercent: number; // 5%
  totalPot: number; // buyIn * players.length
  platformFee: number; // totalPot * 0.05
  netPrizePool: number; // totalPot - platformFee
  distribution: 'winner_takes_all' | 'top_two'; // 100% or 70/30
  durationSeconds: number; // game time limit e.g. 60s or 120s
  inviteCode: string;
  winnerId?: string;
  winnerName?: string;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'buy_in' | 'payout_win' | 'platform_fee' | 'refund';

export interface WalletTransaction {
  id: string;
  timestamp: string;
  type: TransactionType;
  amount: number; // positive for income, negative for expense
  matchId?: string;
  description: string;
  status: 'completed' | 'pending' | 'escrowed';
}

export interface EscrowEntry {
  id: string;
  matchId: string;
  gameTitle: string;
  totalLocked: number;
  platformFeeHeld: number;
  playerCount: number;
  createdAt: string;
  status: 'active_escrow' | 'settled' | 'refunded';
}

export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
  balance: number;
  escrowLocked: number;
  totalEarnings: number;
  matchesPlayed: number;
  winsCount: number;
  winRate: number;
  favoriteGame: string;
  vipTier: 'Rookie' | 'Contender' | 'High Roller' | 'Legend';
  badges: {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
  }[];
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  handle: string;
  avatar: string;
  gameTitle: string;
  highScore: number;
  payoutWon: number;
}
