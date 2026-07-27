import { GameInfo, MatchRoom, UserProfile, WalletTransaction, EscrowEntry, LeaderboardEntry } from '../types';

export const GAMES_LIST: GameInfo[] = [
  {
    id: 'snake',
    title: 'Cyber Snake',
    category: 'Arcade Classic',
    description: 'Guide the glowing neon cyber-snake, devour data orbs, speed up, and out-maneuver the grid!',
    iconName: 'Gamepad2',
    themeColor: '#10b981', // emerald
    bgGradient: 'from-emerald-900/40 via-zinc-900 to-zinc-950',
    difficulty: 'Easy',
    avgDuration: '60s',
    popularityScore: 98,
  },
  {
    id: '2048',
    title: '2048 Neon Rush',
    category: 'Speed Puzzle',
    description: 'Slide, merge matching numbers, and stack huge multiplier combos before the speed timer runs out!',
    iconName: 'Grid2X2',
    themeColor: '#8b5cf6', // purple
    bgGradient: 'from-purple-900/40 via-zinc-900 to-zinc-950',
    difficulty: 'Medium',
    avgDuration: '90s',
    popularityScore: 94,
  },
  {
    id: 'neondodge',
    title: 'Neon Reflex Dodge',
    category: 'Reflex Action',
    description: 'Tap & hold to weave through laser barriers, matching color shields to survive high-frequency pulses.',
    iconName: 'Zap',
    themeColor: '#f43f5e', // rose
    bgGradient: 'from-rose-900/40 via-zinc-900 to-zinc-950',
    difficulty: 'Hard',
    avgDuration: '45s',
    popularityScore: 91,
  },
];

export const INITIAL_USER: UserProfile = {
  id: 'usr_me',
  handle: '@contender',
  displayName: 'Contender',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  balance: 25.00,
  escrowLocked: 0.00,
  totalEarnings: 0.00,
  matchesPlayed: 0,
  winsCount: 0,
  winRate: 0,
  favoriteGame: 'Cyber Snake',
  vipTier: 'Contender',
  badges: [
    { id: 'b1', title: 'Verified Contender', description: 'Registered Arcade Member', icon: 'ShieldCheck', unlocked: true },
  ],
};

export const MOCK_FRIENDS: Array<{ id: string; name: string; handle: string; avatar: string }> = [];

export const INITIAL_ROOMS: MatchRoom[] = [];

export const INITIAL_TRANSACTIONS: WalletTransaction[] = [];

export const INITIAL_ESCROW: EscrowEntry[] = [];

export const TOP_LEADERBOARD: LeaderboardEntry[] = [];
