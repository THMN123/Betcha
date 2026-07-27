import React, { useEffect, useState } from 'react';
import { Radio, Wifi, WifiOff, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../context/AppContext';

interface MatchSocketProps {
  matchId?: string;
  onRealtimeScoreUpdate?: (playerId: string, score: number) => void;
  onParticipantStateChange?: (players: any[]) => void;
  className?: string;
}

export const MatchSocket: React.FC<MatchSocketProps> = ({
  matchId,
  onRealtimeScoreUpdate,
  onParticipantStateChange,
  className = '',
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activePeersCount, setActivePeersCount] = useState<number>(1);
  const { user } = useApp();

  useEffect(() => {
    if (!matchId) return;

    // Supabase Realtime Channel
    let channel: any = null;

    if (supabase) {
      channel = supabase.channel(`match:${matchId}`, {
        config: {
          presence: { key: user.id },
          broadcast: { self: false },
        },
      });

      channel
        .on('broadcast', { event: 'score_update' }, (payload: any) => {
          if (payload?.payload?.playerId && payload?.payload?.score !== undefined) {
            onRealtimeScoreUpdate?.(payload.payload.playerId, payload.payload.score);
          }
        })
        .on('broadcast', { event: 'ready_state' }, (payload: any) => {
          if (payload?.payload?.players) {
            onParticipantStateChange?.(payload.payload.players);
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const peerCount = Object.keys(presenceState).length;
          setActivePeersCount(Math.max(1, peerCount));
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            channel.track({
              user_id: user.id,
              name: user.displayName,
              avatar: user.avatar,
              joined_at: new Date().toISOString(),
            });
          } else {
            setIsConnected(false);
          }
        });
    } else {
      // Local fallback active state
      setIsConnected(true);
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [matchId, user, onRealtimeScoreUpdate, onParticipantStateChange]);

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border ${
        isConnected
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
      } ${className}`}
    >
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span>Realtime Sync</span>
          {activePeersCount > 1 && (
            <span className="flex items-center gap-1 pl-1 border-l border-emerald-500/30 text-zinc-300">
              <Users className="w-2.5 h-2.5 text-indigo-400" />
              {activePeersCount} Live
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3 text-zinc-500" />
          <span>Sync Offline</span>
        </>
      )}
    </div>
  );
};

export default MatchSocket;
