import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { canResume, clearCheckpoint, listCheckpoints, loadCheckpoint, partialSubmitAt } from '../games/runCheckpoint';
import type { Session } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';
import {
  NavigationTab,
  UserProfile,
  MatchRoom,
  MatchPlayer,
  WalletTransaction,
  EscrowEntry,
  LeaderboardEntry,
  GameId,
} from '../types';
import { GAMES_LIST } from '../data/initialData';
import { soundFx } from '../utils/audio';
import { supabase } from '../lib/supabaseClient';
import type { InputEvent } from '../../supabase/functions/_shared/games/index.ts';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

type Distribution = 'winner_takes_all' | 'top_two';

export type SubmitOutcome =
  | { status: 'verified'; score: number }
  | { status: 'rejected'; reason: string }
  | { status: 'failed'; message: string };

interface AppContextType {
  authReady: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  logout: () => Promise<void>;
  pendingInviteCode: string | null;
  /** True after opening a password-reset link, until a new password is saved. */
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;

  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  user: UserProfile;
  rooms: MatchRoom[];
  transactions: WalletTransaction[];
  escrowLedger: EscrowEntry[];
  leaderboard: LeaderboardEntry[];
  toast: Toast | null;
  showToast: (message: string, type?: Toast['type']) => void;

  activePlayingMatch: MatchRoom | null;
  practiceGameId: GameId | null;
  startPractice: (gameId: GameId) => void;
  enterMatchArena: (match: MatchRoom) => void;
  /** The create-match sheet: open with a game preselected, or null when closed. */
  createSheetGame: GameId | null;
  openCreateMatch: (gameId?: GameId) => void;
  closeCreateMatch: () => void;
  exitArena: () => void;

  createMatch: (config: {
    gameId: GameId;
    title: string;
    buyIn: number;
    maxPlayers: number;
    distribution: Distribution;
  }) => Promise<MatchRoom | null>;
  joinMatch: (roomIdOrCode: string) => Promise<boolean>;
  leaveMatch: (roomId: string) => Promise<void>;
  togglePlayerReady: (roomId: string) => Promise<void>;
  startMatchLobby: (roomId: string) => Promise<void>;
  /** Registers your one run for a match and returns the shared seed, or null if not allowed. */
  beginRun: (roomId: string, token: string) => Promise<{ seed: number; startedAt: string | null } | null>;
  /** Sends a finished run's input log for server verification. Retries automatically if it fails. */
  submitRun: (roomId: string, inputs: InputEvent[]) => Promise<SubmitOutcome>;
  pendingSubmissions: string[];
  requestRefund: (roomId: string, reason: string) => Promise<boolean>;
  ackRefund: (roomId: string) => Promise<void>;

  claimFreeCredits: () => Promise<boolean>;
  canClaimCreditsAt: Date | null;

  soundEnabled: boolean;
  toggleSound: () => void;

  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const PENDING_INVITE_KEY = 'betcha_pending_invite';
const PENDING_RUNS_KEY = 'betcha_pending_runs';
const LEGACY_KEYS = ['betcha_auth', 'betcha_user', 'betcha_rooms', 'betcha_tx', 'betcha_escrow'];

type PendingRuns = Record<string, InputEvent[]>; // matchId -> input log awaiting verification

function loadPendingRuns(): PendingRuns {
  return safeStorage(() => JSON.parse(localStorage.getItem(PENDING_RUNS_KEY) || '{}'), {});
}
function savePendingRuns(runs: PendingRuns) {
  safeStorage(() => localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(runs)), undefined);
}

const EMPTY_USER: UserProfile = {
  id: '',
  handle: '',
  displayName: '',
  avatar: '',
  balance: 0,
  escrowLocked: 0,
  totalEarnings: 0,
  matchesPlayed: 0,
  winsCount: 0,
  winRate: 0,
  favoriteGame: 'Cyber Snake',
  vipTier: 'Rookie',
  isAdmin: false,
  badges: [],
};

function safeStorage<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function vipTierFor(wins: number): UserProfile['vipTier'] {
  if (wins >= 50) return 'Legend';
  if (wins >= 15) return 'High Roller';
  if (wins >= 3) return 'Contender';
  return 'Rookie';
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: string }).message);
  return 'Something went wrong. Please try again.';
}

/** Money arrives from the server in integer cents; the UI shows credits. Display only: never do money math client-side. */
const fromCents = (c: unknown) => Number(c ?? 0) / 100;

function mapProfile(row: any, wallet: any, isGuest: boolean): UserProfile {
  const played = row.matches_played ?? 0;
  const wins = row.wins_count ?? 0;
  return {
    id: row.id,
    handle: row.handle ?? '',
    displayName: row.display_name ?? 'Player',
    avatar: row.avatar_url ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${row.id}`,
    balance: fromCents(wallet?.balance_cents),
    escrowLocked: fromCents(wallet?.escrow_cents),
    totalEarnings: fromCents(wallet?.total_won_cents),
    matchesPlayed: played,
    winsCount: wins,
    winRate: played ? Number(((wins / played) * 100).toFixed(1)) : 0,
    favoriteGame: 'Cyber Snake',
    vipTier: vipTierFor(wins),
    isAdmin: Boolean(row.is_admin),
    badges: [
      isGuest
        ? { id: 'guest', title: 'Guest Player', description: 'Playing without an account', icon: 'User', unlocked: true }
        : { id: 'verified', title: 'Verified Member', description: row.email ? `Signed in as ${row.email}` : 'Signed in', icon: 'ShieldCheck', unlocked: true },
      { id: 'first_win', title: 'First Blood', description: 'Win your first match', icon: 'Trophy', unlocked: wins >= 1 },
    ],
  };
}

function mapRoom(m: any, players: any[], myId: string): MatchRoom {
  const mapped: MatchPlayer[] = players
    .filter((p) => p.match_id === m.id)
    .sort((a, b) => (a.is_host === b.is_host ? a.joined_at.localeCompare(b.joined_at) : a.is_host ? -1 : 1))
    .map((p) => ({
      id: p.player_id,
      name: p.name,
      avatar: p.avatar ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${p.player_id}`,
      isHost: p.is_host,
      isReady: p.is_ready,
      score: p.score ?? undefined,
      completedAt: p.completed_at ?? undefined,
      rank: p.rank ?? undefined,
      payout: p.payout_cents !== null && p.payout_cents !== undefined ? fromCents(p.payout_cents) : undefined,
      isCurrentUser: p.player_id === myId,
    }));

  return {
    id: m.id,
    title: m.title,
    gameId: m.game_id,
    hostId: m.host_id,
    hostName: m.host_name,
    buyIn: fromCents(m.buy_in_cents),
    maxPlayers: m.max_players,
    players: mapped,
    status: m.status,
    createdAt: relativeTime(m.created_at),
    startedAt: m.started_at ?? undefined,
    spreadPercent: 5,
    totalPot: fromCents(m.total_pot_cents),
    platformFee: fromCents(m.platform_fee_cents),
    netPrizePool: fromCents(m.net_prize_cents),
    distribution: m.distribution,
    durationSeconds: m.duration_seconds,
    inviteCode: m.invite_code,
    winnerId: m.winner_id ?? undefined,
    winnerName: m.winner_name ?? undefined,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const [currentTab, setCurrentTabState] = useState<NavigationTab>('home');
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [lastCreditClaim, setLastCreditClaim] = useState<string | null>(null);
  const [rooms, setRooms] = useState<MatchRoom[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [activePlayingMatch, setActivePlayingMatch] = useState<MatchRoom | null>(null);
  const [createSheetGame, setCreateSheetGame] = useState<GameId | null>(null);
  const openCreateMatch = useCallback((gameId: GameId = 'snake') => setCreateSheetGame(gameId), []);
  const closeCreateMatch = useCallback(() => setCreateSheetGame(null), []);
  const [practiceGameId, setPracticeGameId] = useState<GameId | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() =>
    safeStorage(() => localStorage.getItem(PENDING_INVITE_KEY), null)
  );

  const myId = session?.user.id ?? '';
  const isGuest = Boolean(session?.user.is_anonymous);
  const isAuthenticated = Boolean(session) && Boolean(user.id);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, message, type });
    setTimeout(() => setToast((prev) => (prev?.id === id ? null : prev)), 4500);
  }, []);

  const fail = useCallback(
    (err: unknown) => {
      soundFx.playGameOver();
      showToast(errorMessage(err), 'error');
    },
    [showToast]
  );

  // ---- Remove data left behind by the old browser-only version of the app
  useEffect(() => {
    for (const k of LEGACY_KEYS) safeStorage(() => localStorage.removeItem(k), undefined);
  }, []);

  // ---- Invite link: capture ?room=CODE before anything else, survive sign-in redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (!code) return;
    safeStorage(() => localStorage.setItem(PENDING_INVITE_KEY, code), undefined);
    setPendingInviteCode(code);
    params.delete('room');
    const rest = params.toString();
    window.history.replaceState({}, document.title, window.location.pathname + (rest ? `?${rest}` : ''));
  }, []);

  // ---- Auth session
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(next);
      if (!next) {
        setUser(EMPTY_USER);
        setRooms([]);
        setTransactions([]);
        setAuthReady(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- Data loading
  const refresh = useCallback(async () => {
    if (!supabase || !myId) return;

    const [profileRes, walletRes, mineRes, txRes, lbRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', myId).maybeSingle(),
      supabase.from('my_wallet').select('*').maybeSingle(),
      supabase.from('match_players').select('match_id').eq('player_id', myId),
      supabase.from('transactions').select('*').eq('user_id', myId).order('created_at', { ascending: false }).limit(50),
      supabase.from('leaderboard').select('*').order('payout_cents', { ascending: false }).limit(10),
    ]);

    if (profileRes.data) {
      setUser(mapProfile(profileRes.data, walletRes.data, isGuest));
      setLastCreditClaim(profileRes.data.last_credit_claim ?? null);
    }

    const myMatchIds = (mineRes.data ?? []).map((r) => r.match_id);
    const filter = myMatchIds.length
      ? `status.eq.waiting,id.in.(${myMatchIds.map((id) => `"${id}"`).join(',')})`
      : 'status.eq.waiting';
    const { data: matchRows } = await supabase
      .from('matches')
      .select('*')
      .or(filter)
      .order('created_at', { ascending: false })
      .limit(60);

    const ids = (matchRows ?? []).map((m) => m.id);
    const [{ data: playerRows }, { data: runRows }, { data: refundRows }, { data: ackRows }] = ids.length
      ? await Promise.all([
          supabase.from('match_players').select('*').in('match_id', ids),
          supabase.from('runs').select('match_id, status').eq('player_id', myId).in('match_id', ids),
          supabase.from('refund_requests').select('*').in('match_id', ids),
          supabase.from('refund_acks').select('match_id, player_id').in('match_id', ids),
        ])
      : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];
    const myRuns = new Map((runRows ?? []).map((r: any) => [r.match_id, r.status]));
    const refunds = new Map(
      (refundRows ?? []).map((r: any) => [
        r.match_id,
        {
          requestedBy: r.requested_by,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
          adminNote: r.admin_note ?? undefined,
          ackedBy: (ackRows ?? []).filter((a: any) => a.match_id === r.match_id).map((a: any) => a.player_id),
        },
      ])
    );

    setRooms(
      (matchRows ?? [])
        .map((m) => ({ ...mapRoom(m, playerRows ?? [], myId), myRun: myRuns.get(m.id), refund: refunds.get(m.id) }))
        // Hide other people's cancelled lobbies; keep my own history.
        .filter((r) => r.status !== 'cancelled' || r.players.some((p) => p.isCurrentUser))
    );

    setTransactions(
      (txRes.data ?? []).map((t) => ({
        id: t.id,
        timestamp: formatTime(t.created_at),
        type: t.type,
        amount: fromCents(t.amount_cents),
        matchId: t.match_id ?? undefined,
        description: t.description,
        status: t.status,
      }))
    );

    setLeaderboard(
      (lbRes.data ?? []).map((row, idx) => ({
        id: `${row.match_id}_${row.player_id}`,
        rank: idx + 1,
        handle: row.handle,
        avatar: row.avatar_url ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${row.player_id}`,
        gameTitle: GAMES_LIST.find((g) => g.id === row.game_id)?.title ?? 'Arcade',
        highScore: row.score ?? 0,
        payoutWon: fromCents(row.payout_cents),
      }))
    );
  }, [myId, isGuest]);

  // Debounced refresh so a burst of realtime events triggers a single reload.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refresh().catch((e) => console.warn('refresh failed', e));
    }, 150);
  }, [refresh]);

  // ---- On sign-in: make sure a profile exists, then load everything
  useEffect(() => {
    if (!supabase || !session) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase.rpc('ensure_profile');
      if (cancelled) return;
      if (error) {
        console.error(error);
        showToast(
          error.message.includes('ensure_profile')
            ? 'The Betcha database is not set up yet. Run supabase/migrations/001_multiplayer.sql in your Supabase project.'
            : error.message,
          'error'
        );
      }
      await refresh();
      if (!cancelled) setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Realtime: reload whenever lobbies, players, my profile or my transactions change
  useEffect(() => {
    if (!supabase || !myId) return;
    const channel = supabase
      .channel(`betcha-live-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_players' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refund_requests' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refund_acks' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${myId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_balances', filter: `account=eq.user:${myId}` }, scheduleRefresh)
      .subscribe();

    // Safety net in case a realtime event is missed (tab asleep, flaky network).
    const poll = setInterval(scheduleRefresh, 15000);
    const onFocus = () => scheduleRefresh();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      supabase?.removeChannel(channel);
    };
  }, [myId, scheduleRefresh]);

  // ---- Navigation & sound
  const setCurrentTab = useCallback((tab: NavigationTab) => {
    soundFx.playClick();
    setCurrentTabState(tab);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.soundEnabled = next;
    if (next) soundFx.playClick();
  };

  const startPractice = (gameId: GameId) => {
    soundFx.playClick();
    setPracticeGameId(gameId);
    setActivePlayingMatch(null);
  };

  const enterMatchArena = useCallback((match: MatchRoom) => {
    soundFx.playClick();
    setActivePlayingMatch(match);
    setPracticeGameId(null);
  }, []);

  const exitArena = () => {
    soundFx.playClick();
    setActivePlayingMatch(null);
    setPracticeGameId(null);
  };

  const openLobby = useCallback(
    (roomId: string) => {
      setSelectedRoomId(roomId);
      setCurrentTabState('lobbies');
    },
    []
  );

  // ---- Match actions (all validated server-side)
  const createMatch: AppContextType['createMatch'] = async (config) => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('create_match', {
      p_game_id: config.gameId,
      p_title: config.title,
      p_buy_in_cents: Math.round(config.buyIn * 100),
      p_max_players: config.maxPlayers,
      p_distribution: config.distribution,
    });
    if (error) {
      fail(error);
      return null;
    }
    soundFx.playCashChing();
    showToast(`Lobby #${data.id} created. Copy the invite link and send it to your friends!`, 'success');
    await refresh();
    openLobby(data.id);
    return mapRoom(data, [], myId);
  };

  const joinMatch = async (roomIdOrCode: string): Promise<boolean> => {
    if (!supabase) return false;
    const alreadyIn = rooms.find(
      (r) => (r.id === roomIdOrCode || r.inviteCode === roomIdOrCode) && r.players.some((p) => p.isCurrentUser)
    );
    const { data, error } = await supabase.rpc('join_match', { p_code: roomIdOrCode });
    if (error) {
      fail(error);
      return false;
    }
    if (!alreadyIn) {
      soundFx.playCashChing();
      showToast(`Joined ${data.title}! Hit "Ready" so the host can start.`, 'success');
    }
    await refresh();
    openLobby(data.id);
    return true;
  };

  const leaveMatch = async (roomId: string) => {
    if (!supabase) return;
    const room = rooms.find((r) => r.id === roomId);
    const { error } = await supabase.rpc('leave_match', { p_match_id: roomId });
    if (error) return fail(error);
    showToast(room?.hostId === myId ? 'Lobby cancelled. Everyone was refunded.' : 'You left the lobby. Buy-in refunded.', 'info');
    setSelectedRoomId(null);
    await refresh();
  };

  const togglePlayerReady = async (roomId: string) => {
    if (!supabase) return;
    soundFx.playClick();
    const me = rooms.find((r) => r.id === roomId)?.players.find((p) => p.isCurrentUser);
    const { error } = await supabase.rpc('set_ready', { p_match_id: roomId, p_ready: !me?.isReady });
    if (error) return fail(error);
    await refresh();
  };

  const startMatchLobby = async (roomId: string) => {
    if (!supabase) return;
    const { error } = await supabase.rpc('start_match', { p_match_id: roomId });
    if (error) return fail(error);
    soundFx.playClick();
    await refresh();
    // Everyone (host included) is moved into the arena by the auto-enter effect below.
  };

  /**
   * Starts (or, with the same token, re-fetches) this player's run. Network failures are retried:
   * the token makes a retry return the same run instead of "You already started your run".
   */
  const beginRun = async (roomId: string, token: string): Promise<{ seed: number; startedAt: string | null } | null> => {
    if (!supabase) return null;
    let withToken = true;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      const { data, error } = await supabase.rpc(
        'begin_run',
        withToken ? { p_match_id: roomId, p_token: token } : { p_match_id: roomId }
      );
      if (!error) return { seed: Number(data.seed), startedAt: data.started_at ?? null };
      lastError = error;
      // Database not migrated to 006 yet: fall back to the old call (no safe retries there).
      if (withToken && (error.code === 'PGRST202' || /begin_run\(.*p_token/i.test(error.message))) {
        withToken = false;
        attempt--;
        continue;
      }
      // A real answer from the database (not a network problem): don't retry.
      if (error.code) break;
    }
    fail(lastError);
    return null;
  };

  const [pendingRuns, setPendingRuns] = useState<PendingRuns>(loadPendingRuns);

  const submitRun = useCallback(
    async (roomId: string, inputs: InputEvent[]): Promise<SubmitOutcome> => {
      if (!supabase) return { status: 'failed', message: 'Not connected' };
      // Persist first (synchronously), so a crash/refresh/offline moment can't lose a finished run.
      const queued = { ...loadPendingRuns(), [roomId]: inputs };
      savePendingRuns(queued);
      setPendingRuns(queued);
      clearCheckpoint(roomId);

      const { data, error } = await supabase.functions.invoke('verify-run', { body: { match_id: roomId, inputs } });

      let message: string | null = null;
      if (error) {
        // Read the function's own error message when there is one.
        const ctx = (error as { context?: Response }).context;
        message = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error ?? error.message : error.message;
      }
      const permanent = message !== null && /already submitted|not started a run|no longer in progress|not found/i.test(message);

      if (!message || permanent) {
        setPendingRuns((prev) => {
          const next = { ...prev };
          delete next[roomId];
          savePendingRuns(next);
          return next;
        });
      }
      await refresh();

      if (message) {
        if (!permanent) showToast(`Couldn't submit your run yet (${message}). We'll keep retrying.`, 'warning');
        return { status: 'failed', message };
      }
      if (!data.ok) {
        showToast(`Your run was rejected: ${data.reason}. It counts as 0.`, 'error');
        return { status: 'rejected', reason: data.reason };
      }
      soundFx.playPickup();
      showToast(`Run verified: ${Number(data.score).toLocaleString()} points.`, 'success');
      return { status: 'verified', score: Number(data.score) };
    },
    [refresh, showToast]
  );

  // Retry unsent runs when we come back online / regain focus / sign in.
  const retrying = useRef(false);
  useEffect(() => {
    if (!myId) return;
    const retry = async () => {
      if (retrying.current) return;
      const ids = Object.keys(loadPendingRuns());
      if (!ids.length) return;
      retrying.current = true;
      try {
        for (const id of ids) {
          const inputs = loadPendingRuns()[id];
          if (inputs) await submitRun(id, inputs);
        }
      } finally {
        retrying.current = false;
      }
    };
    retry();
    const t = setInterval(retry, 20000);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', retry);
    };
  }, [myId, submitRun]);

  // Runs cut off on this device with no time left to resume: submit the moves that were made,
  // once the game's full time has passed (the server replays them to the end). A real score instead of 0.
  useEffect(() => {
    if (!myId) return;
    const check = () => {
      for (const cp of listCheckpoints(myId)) {
        const room = rooms.find((r) => r.id === cp.matchId);
        if (!room) continue;
        if (room.status !== 'in_progress' || (room.myRun && room.myRun !== 'started')) {
          clearCheckpoint(cp.matchId); // already settled or submitted
          continue;
        }
        if (canResume(cp)) continue; // still playable (or being played) on this device
        const at = partialSubmitAt(cp);
        if (at === null) {
          clearCheckpoint(cp.matchId); // never got the seed and can't be resumed any more
        } else if (Date.now() >= at) {
          submitRun(cp.matchId, cp.inputs);
        }
      }
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [myId, rooms, submitRun]);

  // A match only ends on normal terms. If it can't finish, a player asks for a refund (with a reason);
  // every player acknowledges it, then an admin approves or rejects it.
  const requestRefund = async (roomId: string, reason: string): Promise<boolean> => {
    if (!supabase) return false;
    const { error } = await supabase.rpc('request_refund', { p_match_id: roomId, p_reason: reason });
    if (error) {
      fail(error);
      return false;
    }
    showToast('Refund requested. Every player has to acknowledge it, then an admin reviews it.', 'success');
    await refresh();
    return true;
  };

  const ackRefund = async (roomId: string) => {
    if (!supabase) return;
    const { error } = await supabase.rpc('ack_refund', { p_match_id: roomId });
    if (error) return fail(error);
    showToast('Acknowledged. An admin will review the refund.', 'success');
    await refresh();
  };

  // ---- Credits
  const canClaimCreditsAt = useMemo(() => {
    if (!lastCreditClaim) return null;
    const next = new Date(new Date(lastCreditClaim).getTime() + 20 * 3600 * 1000);
    return next.getTime() > Date.now() ? next : null;
  }, [lastCreditClaim]);

  const claimFreeCredits = async (): Promise<boolean> => {
    if (!supabase) return false;
    const { error } = await supabase.rpc('claim_credits');
    if (error) {
      fail(error);
      return false;
    }
    soundFx.playCashChing();
    showToast('25 free credits added to your wallet!', 'success');
    await refresh();
    return true;
  };

  const logout = async () => {
    soundFx.playClick();
    setActivePlayingMatch(null);
    setPracticeGameId(null);
    setSelectedRoomId(null);
    await supabase?.auth.signOut();
    showToast('Signed out.', 'info');
  };

  // ---- Join the pending invite once signed in
  useEffect(() => {
    if (!isAuthenticated || !authReady || !pendingInviteCode) return;
    const code = pendingInviteCode;
    safeStorage(() => localStorage.removeItem(PENDING_INVITE_KEY), undefined);
    setPendingInviteCode(null);
    joinMatch(code);
  }, [isAuthenticated, authReady, pendingInviteCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- React to match status changes: pull me into the arena when a match starts,
  //      celebrate when one I'm in gets settled.
  const autoEntered = useRef<Set<string>>(new Set());
  const prevStatus = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const room of rooms) {
      const before = prevStatus.current.get(room.id);
      prevStatus.current.set(room.id, room.status);
      const me = room.players.find((p) => p.isCurrentUser);
      if (!me) continue;

      // A run of mine that was cut off on this device (e.g. the page reloaded): reopen it to resume.
      if (room.status === 'in_progress' && room.myRun === 'started' && !autoEntered.current.has(room.id) && !activePlayingMatch) {
        const cp = loadCheckpoint(room.id, myId);
        if (cp && canResume(cp)) {
          autoEntered.current.add(room.id);
          setSelectedRoomId(null);
          showToast(`Picking up your ${room.title} run where it stopped.`, 'info');
          enterMatchArena(room);
        }
      }

      if (room.status === 'in_progress' && me.score === undefined && !room.myRun) {
        const justStarted = before === 'waiting';
        if ((justStarted || selectedRoomId === room.id) && !autoEntered.current.has(room.id) && !activePlayingMatch) {
          autoEntered.current.add(room.id);
          setSelectedRoomId(null);
          showToast(`${room.title} has started. Go!`, 'success');
          enterMatchArena(room);
        }
      }

      if (room.status === 'under_review' && before !== undefined && before !== 'under_review') {
        showToast(`${room.title}: results are being reviewed. Payouts are on hold until that's done.`, 'info');
      }

      // Only celebrate transitions we witnessed, not matches that were already settled on load.
      if (room.status === 'completed' && before !== undefined && before !== 'completed') {
        if (me.rank === 1 && (me.payout ?? 0) > 0) {
          soundFx.playWinFanfare();
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#10b981', '#6366f1', '#f59e0b', '#ec4899'] });
          const tied = room.players.filter((p) => p.rank === 1).length > 1;
          showToast(`${tied ? 'You tied for 1st in' : 'You won'} ${room.title}! +${(me.payout ?? 0).toFixed(2)} credits`, 'success');
        } else if ((me.payout ?? 0) > 0) {
          showToast(`Prize from ${room.title}: +${(me.payout ?? 0).toFixed(2)} credits`, 'success');
        } else {
          showToast(`${room.title} is over. ${room.winnerName} won.`, 'info');
        }
      }
    }
  }, [rooms, selectedRoomId, activePlayingMatch, enterMatchArena, showToast, myId]);

  const escrowLedger: EscrowEntry[] = useMemo(
    () =>
      rooms
        .filter((r) => r.players.some((p) => p.isCurrentUser))
        .map((r) => ({
          id: `esc_${r.id}`,
          matchId: r.id,
          gameTitle: GAMES_LIST.find((g) => g.id === r.gameId)?.title ?? 'Arcade',
          totalLocked: r.totalPot,
          platformFeeHeld: r.platformFee,
          playerCount: r.players.length,
          createdAt: r.createdAt,
          status: r.status === 'completed' ? 'settled' : r.status === 'cancelled' ? 'refunded' : 'active_escrow',
        })),
    [rooms]
  );

  return (
    <AppContext.Provider
      value={{
        authReady,
        isAuthenticated,
        isGuest,
        logout,
        pendingInviteCode,
        passwordRecovery,
        finishPasswordRecovery: () => setPasswordRecovery(false),
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
        createSheetGame,
        openCreateMatch,
        closeCreateMatch,
        exitArena,
        createMatch,
        joinMatch,
        leaveMatch,
        togglePlayerReady,
        startMatchLobby,
        beginRun,
        submitRun,
        pendingSubmissions: Object.keys(pendingRuns),
        requestRefund,
        ackRefund,
        claimFreeCredits,
        canClaimCreditsAt,
        soundEnabled,
        toggleSound,
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
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
