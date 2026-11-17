import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

/**
 * Live view of the other players in a match, over a Supabase Realtime broadcast channel.
 *
 * DISPLAY ONLY: these messages come straight from other browsers and are not verified. Official
 * scores and payouts come solely from the server's replay of each run (verify-run).
 */

export interface LiveMsg {
  id: string; // player id
  n: string; // display name
  s: number; // score
  t: number; // tick
  st: 'p' | 'd'; // playing / done
  g?: unknown; // game-specific: snake = flat [x,y,...] cells, dodge = orb x
}

export interface LivePeer extends LiveMsg {
  at: number; // performance.now() when received
  prevG?: unknown; // previous game data, for smooth interpolation
  prevAt?: number;
}

const UI_REFRESH_MS = 250;

export function useLiveMatch(matchId: string | null, me: { id: string; name: string }, allowedIds: string[]) {
  const peersRef = useRef<Map<string, LivePeer>>(new Map());
  const selfRef = useRef<LiveMsg | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [peers, setPeers] = useState<LivePeer[]>([]);
  const [self, setSelf] = useState<LiveMsg | null>(null);
  const [connected, setConnected] = useState(false);
  const allowed = useRef(new Set<string>());
  allowed.current = new Set(allowedIds);

  useEffect(() => {
    peersRef.current = new Map();
    selfRef.current = null;
    setPeers([]);
    setSelf(null);
    if (!supabase || !matchId) return;

    const ch = supabase.channel(`live:${matchId}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on('broadcast', { event: 's' }, ({ payload }) => {
      const m = payload as LiveMsg;
      if (!m || typeof m.id !== 'string' || m.id === me.id || !allowed.current.has(m.id)) return;
      if (typeof m.s !== 'number' || typeof m.t !== 'number') return;
      const prev = peersRef.current.get(m.id);
      if (prev && m.t < prev.t) return; // out of order
      peersRef.current.set(m.id, { ...m, n: String(m.n).slice(0, 32), at: performance.now(), prevG: prev?.g, prevAt: prev?.at });
    }).subscribe((status) => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = ch;

    // React only needs a few updates per second for the scoreboard; canvases read peersRef directly.
    const iv = setInterval(() => {
      setPeers(Array.from(peersRef.current.values()));
      setSelf(selfRef.current ? { ...selfRef.current } : null);
    }, UI_REFRESH_MS);

    return () => {
      clearInterval(iv);
      channelRef.current = null;
      supabase?.removeChannel(ch);
    };
  }, [matchId, me.id]);

  const send = useCallback(
    (msg: Omit<LiveMsg, 'id' | 'n'>) => {
      const full: LiveMsg = { ...msg, id: me.id, n: me.name };
      selfRef.current = full;
      channelRef.current?.send({ type: 'broadcast', event: 's', payload: full });
    },
    [me.id, me.name]
  );

  return { peersRef, peers, self, send, connected };
}

export type LiveFeed = ReturnType<typeof useLiveMatch>;

/** Stable colors for opponents' ghosts and scoreboard chips. */
export const PEER_COLORS = ['#818cf8', '#f472b6', '#fbbf24', '#22d3ee', '#a3e635', '#fb923c', '#c084fc'];
export function peerColor(id: string, ids: string[]): string {
  const i = Math.max(0, ids.indexOf(id));
  return PEER_COLORS[i % PEER_COLORS.length];
}
