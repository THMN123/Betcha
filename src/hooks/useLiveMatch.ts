import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { InputEvent } from '../../supabase/functions/_shared/games/index.ts';

/**
 * Live view of the other players in a match, over a Supabase Realtime broadcast channel.
 *
 * Protocol (v2, input forwarding): everyone in a match plays the same seed, so a player only
 * broadcasts their *inputs* (batched every ~100-300ms while they're moving) plus a heartbeat with
 * their current tick every 2s, and a final "done". Receivers rebuild each opponent's game locally
 * with GhostRunner. That's ~1-4 messages/s per player instead of ~10.
 *
 * DISPLAY ONLY: messages come straight from other browsers and are not verified. Official scores
 * and payouts come solely from the server's replay of each run (verify-run).
 */

export interface LiveMsg {
  id: string; // player id
  n: string; // display name
  t: number; // ticks played so far
  i?: InputEvent[]; // inputs since the last message
  d?: 1; // run finished
}

export interface LivePeer {
  id: string;
  name: string;
  /** Every message received so far, in arrival order (GhostRunners consume these). */
  log: { msg: LiveMsg; at: number }[];
}

export interface LiveScore {
  id: string;
  score: number;
  done: boolean;
}

const HEARTBEAT_MS = 2000;
const UI_REFRESH_MS = 250;

export function useLiveMatch(matchId: string | null, me: { id: string; name: string }, allowedIds: string[], batchMs = 200) {
  const peersRef = useRef<Map<string, LivePeer>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  /** Scores written by the game (it owns the ghost simulations) and read by the scoreboard. */
  const scoresRef = useRef<Map<string, LiveScore>>(new Map());
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [connected, setConnected] = useState(false);
  const allowed = useRef(new Set<string>());
  allowed.current = new Set(allowedIds);

  // Outgoing batching state
  const pending = useRef<InputEvent[]>([]);
  const lastSentAt = useRef(0);
  const sentCount = useRef(0);

  useEffect(() => {
    peersRef.current = new Map();
    scoresRef.current = new Map();
    pending.current = [];
    setScores([]);
    if (!supabase || !matchId) return;

    const ch = supabase.channel(`live:${matchId}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on('broadcast', { event: 'r' }, ({ payload }) => {
      const m = payload as LiveMsg;
      if (!m || typeof m.id !== 'string' || m.id === me.id || !allowed.current.has(m.id)) return;
      if (!Number.isInteger(m.t) || (m.i !== undefined && !Array.isArray(m.i))) return;
      let peer = peersRef.current.get(m.id);
      if (!peer) {
        peer = { id: m.id, name: String(m.n ?? '').slice(0, 32), log: [] };
        peersRef.current.set(m.id, peer);
      }
      peer.log.push({ msg: m, at: performance.now() });
    }).subscribe((status) => setConnected(status === 'SUBSCRIBED'));
    channelRef.current = ch;

    const iv = setInterval(() => setScores(Array.from(scoresRef.current.values())), UI_REFRESH_MS);
    return () => {
      clearInterval(iv);
      channelRef.current = null;
      supabase?.removeChannel(ch);
    };
  }, [matchId, me.id]);

  const transmit = useCallback(
    (tick: number, done: boolean) => {
      const msg: LiveMsg = { id: me.id, n: me.name, t: tick };
      if (pending.current.length) msg.i = pending.current;
      if (done) msg.d = 1;
      pending.current = [];
      lastSentAt.current = performance.now();
      sentCount.current++;
      channelRef.current?.send({ type: 'broadcast', event: 'r', payload: msg });
    },
    [me.id, me.name]
  );

  /** Call when the local player makes an input (same [tick, code] that is recorded for the server). */
  const input = useCallback((ev: InputEvent) => {
    pending.current.push(ev);
  }, []);

  /** Call after every local tick: sends batched inputs, or a heartbeat when idle. */
  const tick = useCallback(
    (t: number) => {
      const since = performance.now() - lastSentAt.current;
      if ((pending.current.length && since >= batchMs) || since >= HEARTBEAT_MS) transmit(t, false);
    },
    [transmit, batchMs]
  );

  /** Call once when the local run ends. */
  const finish = useCallback((t: number) => transmit(t, true), [transmit]);

  /** The local player's own score, for the scoreboard. */
  const setMyScore = useCallback(
    (score: number, done: boolean) => scoresRef.current.set(me.id, { id: me.id, score, done }),
    [me.id]
  );

  return { peersRef, scoresRef, scores, connected, input, tick, finish, setMyScore, sentCount };
}

export type LiveFeed = ReturnType<typeof useLiveMatch>;

/** Stable colors for opponents' ghosts and scoreboard chips. */
export const PEER_COLORS = ['#818cf8', '#f472b6', '#fbbf24', '#22d3ee', '#a3e635', '#fb923c', '#c084fc'];
export function peerColor(id: string, ids: string[]): string {
  const i = Math.max(0, ids.indexOf(id));
  return PEER_COLORS[i % PEER_COLORS.length];
}
