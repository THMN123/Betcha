import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface Puzzle2048Props {
  timeLimitSeconds?: number;
  onGameOver: (finalScore: number) => void;
  isPractice?: boolean;
}

type Board = number[][];

const SIZE = 4;

const Puzzle2048Game: React.FC<Puzzle2048Props> = ({
  timeLimitSeconds = 90,
  onGameOver,
  isPractice = false,
}) => {
  const [board, setBoard] = useState<Board>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitSeconds);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Spawn random tile (2 or 4)
  const addRandomTile = (currentBoard: Board): Board => {
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (currentBoard[r][c] === 0) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length === 0) return currentBoard;

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newBoard = currentBoard.map((row) => [...row]);
    newBoard[randomCell.r][randomCell.c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  };

  const startGame = () => {
    let empty = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    empty = addRandomTile(empty);
    empty = addRandomTile(empty);
    setBoard(empty);
    setScore(0);
    setTimeLeft(timeLimitSeconds);
    setIsGameOver(false);
    setGameStarted(true);
  };

  // Check if any moves possible
  const checkGameOver = (currentBoard: Board): boolean => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (currentBoard[r][c] === 0) return false;
        if (c < SIZE - 1 && currentBoard[r][c] === currentBoard[r][c + 1]) return false;
        if (r < SIZE - 1 && currentBoard[r][c] === currentBoard[r + 1][c]) return false;
      }
    }
    return true;
  };

  const finishGame = useCallback((finalScore: number) => {
    setIsGameOver(true);
    soundFx.playGameOver();
    onGameOver(finalScore);
  }, [onGameOver]);

  // Timer
  useEffect(() => {
    if (!gameStarted || isGameOver) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          finishGame(score);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, isGameOver, score, finishGame]);

  // Move Logic
  const slide = (row: number[]): { newRow: number[]; gainedScore: number } => {
    let arr = row.filter((val) => val !== 0);
    let gainedScore = 0;

    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        gainedScore += arr[i];
        arr[i + 1] = 0;
      }
    }

    arr = arr.filter((val) => val !== 0);
    while (arr.length < SIZE) {
      arr.push(0);
    }
    return { newRow: arr, gainedScore };
  };

  const move = useCallback(
    (direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') => {
      if (!gameStarted || isGameOver) return;

      let newBoard: Board = board.map((r) => [...r]);
      let totalGained = 0;
      let moved = false;

      if (direction === 'LEFT') {
        for (let r = 0; r < SIZE; r++) {
          const { newRow, gainedScore } = slide(newBoard[r]);
          totalGained += gainedScore;
          if (newRow.some((val, c) => val !== newBoard[r][c])) moved = true;
          newBoard[r] = newRow;
        }
      } else if (direction === 'RIGHT') {
        for (let r = 0; r < SIZE; r++) {
          const reversed = [...newBoard[r]].reverse();
          const { newRow, gainedScore } = slide(reversed);
          totalGained += gainedScore;
          const restored = newRow.reverse();
          if (restored.some((val, c) => val !== newBoard[r][c])) moved = true;
          newBoard[r] = restored;
        }
      } else if (direction === 'UP') {
        for (let c = 0; c < SIZE; c++) {
          const col = [newBoard[0][c], newBoard[1][c], newBoard[2][c], newBoard[3][c]];
          const { newRow, gainedScore } = slide(col);
          totalGained += gainedScore;
          for (let r = 0; r < SIZE; r++) {
            if (newBoard[r][c] !== newRow[r]) moved = true;
            newBoard[r][c] = newRow[r];
          }
        }
      } else if (direction === 'DOWN') {
        for (let c = 0; c < SIZE; c++) {
          const col = [newBoard[3][c], newBoard[2][c], newBoard[1][c], newBoard[0][c]];
          const { newRow, gainedScore } = slide(col);
          totalGained += gainedScore;
          const restored = newRow.reverse();
          for (let r = 0; r < SIZE; r++) {
            if (newBoard[r][c] !== restored[r]) moved = true;
            newBoard[r][c] = restored[r];
          }
        }
      }

      if (moved) {
        soundFx.playMerge();
        const boardWithTile = addRandomTile(newBoard);
        const nextScore = score + totalGained;
        setBoard(boardWithTile);
        setScore(nextScore);

        if (checkGameOver(boardWithTile)) {
          finishGame(nextScore);
        }
      }
    },
    [board, gameStarted, isGameOver, score, finishGame]
  );

  // Touch gesture tracking for 2048
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !gameStarted || isGameOver) return;
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
    const dx = touchEnd.x - touchStartRef.current.x;
    const dy = touchEnd.y - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 20) {
      if (absX > absY) {
        move(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        move(dy > 0 ? 'DOWN' : 'UP');
      }
    }
    touchStartRef.current = null;
  };

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted || isGameOver) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'w') move('UP');
      if (e.key === 'ArrowDown' || e.key === 's') move('DOWN');
      if (e.key === 'ArrowLeft' || e.key === 'a') move('LEFT');
      if (e.key === 'ArrowRight' || e.key === 'd') move('RIGHT');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, isGameOver, move]);

  // Tile styles by value
  const getTileStyle = (val: number) => {
    switch (val) {
      case 2: return 'bg-purple-950 text-purple-200 border-purple-800';
      case 4: return 'bg-purple-900 text-purple-100 border-purple-700';
      case 8: return 'bg-indigo-800 text-white border-indigo-500 shadow-indigo-500/20 shadow-lg';
      case 16: return 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/40 shadow-lg';
      case 32: return 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/40 shadow-lg';
      case 64: return 'bg-emerald-500 text-zinc-950 font-black border-emerald-300 shadow-emerald-400/50 shadow-xl';
      case 128: return 'bg-amber-500 text-zinc-950 font-black border-amber-300 shadow-amber-400/60 shadow-xl';
      case 256: return 'bg-amber-400 text-zinc-950 font-black border-amber-200 shadow-amber-400/80 shadow-2xl';
      case 512: return 'bg-rose-500 text-white font-black border-rose-300 shadow-rose-500/80 shadow-2xl';
      case 1024: return 'bg-pink-500 text-white font-black border-pink-300 shadow-pink-500/80 shadow-2xl';
      case 2048: return 'bg-gradient-to-r from-emerald-400 via-purple-500 to-pink-500 text-zinc-950 font-black border-white shadow-emerald-400/90 shadow-2xl animate-pulse';
      default: return 'bg-zinc-900/80 border-zinc-800 text-zinc-600';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto p-3">
      {/* HUD Header */}
      <div className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 mb-3 shadow-md font-mono">
        <div>
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Merge Score</span>
          <span className="text-xl font-black text-purple-400 tracking-wider">
            {score.toLocaleString()}
          </span>
        </div>

        <div className="text-right">
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Time</span>
          <span className={`text-xl font-black font-mono ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Grid Canvas with Touch Swipe */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full aspect-square bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-3 shadow-2xl grid grid-cols-4 gap-2.5 touch-none select-none"
      >
        {board.map((row, r) =>
          row.map((val, c) => (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center rounded-xl border font-mono text-base sm:text-lg font-bold transition-all duration-150 ${getTileStyle(
                val
              )}`}
            >
              {val > 0 ? val : ''}
            </div>
          ))
        )}

        {/* Start Overlay */}
        {!gameStarted && !isGameOver && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1">2048 Neon Rush</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Slide tiles to merge matching values! Maximize high score before time expires.
            </p>
            <button
              type="button"
              onClick={startGame}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Speed Merge</span>
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center rounded-2xl animate-in fade-in">
            <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-xs uppercase rounded-full mb-2">
              Merge Run Completed
            </span>
            <h3 className="text-2xl font-black text-white font-mono mb-1">{score.toLocaleString()} PTS</h3>
            <p className="text-xs text-zinc-400 mb-6">Final score recorded into tournament leaderboard.</p>

            {isPractice ? (
              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice Again</span>
              </button>
            ) : (
              <p className="text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-2 rounded-xl">
                Score Submitted! Check live leaderboard.
              </p>
            )}
          </div>
        )}
      </div>

      {/* On-Screen Touch Controls */}
      <div className="w-full mt-4 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => move('UP')}
          disabled={!gameStarted || isGameOver}
          className="w-14 h-12 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-purple-500 active:text-white flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-40"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move('LEFT')}
            disabled={!gameStarted || isGameOver}
            className="w-14 h-12 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-purple-500 active:text-white flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-40"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={() => move('DOWN')}
            disabled={!gameStarted || isGameOver}
            className="w-14 h-12 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-purple-500 active:text-white flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-40"
          >
            <ArrowDown className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={() => move('RIGHT')}
            disabled={!gameStarted || isGameOver}
            className="w-14 h-12 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-purple-500 active:text-white flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-40"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Puzzle2048Game;
