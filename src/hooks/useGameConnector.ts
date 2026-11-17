import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';

export interface GameScorePayload {
  matchId?: string;
  gameId: string;
  score: number;
  isPractice: boolean;
}

export type ConnectorStatus = 'idle' | 'playing' | 'submitting' | 'completed' | 'error';

/** Bridges a game's final score to the server. Guards against double submission per run. */
export function useGameConnector() {
  const [status, setStatus] = useState<ConnectorStatus>('idle');
  const [lastSubmittedScore, setLastSubmittedScore] = useState<number | null>(null);
  const { submitMatchScore } = useApp();
  const submissionLockRef = useRef<boolean>(false);

  const startGame = useCallback(() => {
    setStatus('playing');
    setLastSubmittedScore(null);
    submissionLockRef.current = false;
  }, []);

  const reportScore = useCallback(
    async ({ matchId, score, isPractice }: GameScorePayload) => {
      setLastSubmittedScore(score);
      if (isPractice || !matchId) {
        setStatus('completed');
        return;
      }
      if (submissionLockRef.current) return;
      submissionLockRef.current = true;
      setStatus('submitting');
      await submitMatchScore(matchId, score);
      setStatus('completed');
    },
    [submitMatchScore]
  );

  return { status, lastSubmittedScore, startGame, reportScore };
}

export default useGameConnector;
