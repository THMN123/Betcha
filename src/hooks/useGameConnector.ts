import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';

export interface GameScorePayload {
  matchId?: string;
  gameId: string;
  score: number;
  isPractice: boolean;
  timeSpentSeconds?: number;
}

export type ConnectorStatus = 'idle' | 'playing' | 'submitting' | 'completed' | 'error';

export function useGameConnector() {
  const [status, setStatus] = useState<ConnectorStatus>('idle');
  const [lastSubmittedScore, setLastSubmittedScore] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { submitMatchScore, user, showToast } = useApp();
  const submissionLockRef = useRef<boolean>(false);

  const startGame = useCallback(() => {
    setStatus('playing');
    setLastSubmittedScore(null);
    setErrorMessage(null);
    submissionLockRef.current = false;
  }, []);

  const reportScore = useCallback(
    async (payload: GameScorePayload) => {
      // Prevent duplicate or race condition score reports
      if (submissionLockRef.current) return;
      submissionLockRef.current = true;
      setStatus('submitting');

      try {
        const { matchId, score, isPractice, gameId } = payload;
        setLastSubmittedScore(score);

        if (!isPractice && matchId) {
          // 1. AppContext State update
          submitMatchScore(matchId, score);

          // 2. Persist safely to Supabase `match_players` if table configured
          if (supabase && user?.id) {
            const { error } = await supabase.from('match_players').upsert(
              {
                match_id: matchId,
                player_id: user.id,
                score: score,
                status: 'completed',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'match_id,player_id' }
            );

            if (error) {
              console.warn('Supabase score record note:', error.message);
            }

            // Broadcast score event over Supabase realtime channel
            const channel = supabase.channel(`match:${matchId}`);
            channel.send({
              type: 'broadcast',
              event: 'score_update',
              payload: { playerId: user.id, score, gameId },
            });
          }
        }

        setStatus('completed');
      } catch (err: any) {
        console.error('Failed to submit score safely:', err);
        setErrorMessage(err.message || 'Failed to submit score');
        setStatus('error');
        showToast('Error recording match score. Local score saved.', 'warning');
      }
    },
    [submitMatchScore, user, showToast]
  );

  return {
    status,
    lastSubmittedScore,
    errorMessage,
    startGame,
    reportScore,
  };
}

export default useGameConnector;
