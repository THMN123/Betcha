import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, RotateCcw, Zap } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface SnakeGameProps {
  timeLimitSeconds?: number;
  onGameOver: (finalScore: number) => void;
  isPractice?: boolean;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Position {
  x: number;
  y: number;
}

const GRID_SIZE = 18;
const BASE_TICK_MS = 110;

const SnakeGame: React.FC<SnakeGameProps> = ({
  timeLimitSeconds = 60,
  onGameOver,
  isPractice = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitSeconds);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [multiplier, setMultiplier] = useState<number>(1);

  // Snake state refs for accurate animation loop access
  const snakeRef = useRef<Position[]>([
    { x: 9, y: 10 },
    { x: 9, y: 11 },
    { x: 9, y: 12 },
  ]);
  const dirRef = useRef<Direction>('UP');
  const nextDirRef = useRef<Direction>('UP');
  const foodRef = useRef<Position>({ x: 5, y: 5 });
  const bonusFoodRef = useRef<Position | null>(null);
  const scoreRef = useRef<number>(0);
  const multiplierRef = useRef<number>(1);
  const isGameOverRef = useRef<boolean>(false);
  const gameStartedRef = useRef<boolean>(false);

  // Touch gesture tracking
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const spawnFood = useCallback(() => {
    let newFood: Position;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      if (!snakeRef.current.some((segment) => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    foodRef.current = newFood;
  }, []);

  const spawnBonusFood = useCallback(() => {
    if (Math.random() > 0.45) return;
    let newBonus: Position;
    while (true) {
      newBonus = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      if (
        !snakeRef.current.some((s) => s.x === newBonus.x && s.y === newBonus.y) &&
        (foodRef.current.x !== newBonus.x || foodRef.current.y !== newBonus.y)
      ) {
        break;
      }
    }
    bonusFoodRef.current = newBonus;
    setTimeout(() => {
      bonusFoodRef.current = null;
    }, 5000);
  }, []);

  const changeDirection = useCallback((newDir: Direction) => {
    const current = dirRef.current;
    if (newDir === 'UP' && current !== 'DOWN') nextDirRef.current = 'UP';
    if (newDir === 'DOWN' && current !== 'UP') nextDirRef.current = 'DOWN';
    if (newDir === 'LEFT' && current !== 'RIGHT') nextDirRef.current = 'LEFT';
    if (newDir === 'RIGHT' && current !== 'LEFT') nextDirRef.current = 'RIGHT';
    soundFx.playClick();
  }, []);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !gameStartedRef.current || isGameOverRef.current) return;
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
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }
    touchStartRef.current = null;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStartedRef.current || isGameOverRef.current) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') changeDirection('UP');
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') changeDirection('DOWN');
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') changeDirection('LEFT');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') changeDirection('RIGHT');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection]);

  const handleGameOver = useCallback(() => {
    if (isGameOverRef.current) return;
    isGameOverRef.current = true;
    gameStartedRef.current = false;
    setIsGameOver(true);
    setGameStarted(false);
    soundFx.playGameOver();
    onGameOver(scoreRef.current);
  }, [onGameOver]);

  // Start game function
  const startGame = () => {
    snakeRef.current = [
      { x: 9, y: 10 },
      { x: 9, y: 11 },
      { x: 9, y: 12 },
    ];
    dirRef.current = 'UP';
    nextDirRef.current = 'UP';
    scoreRef.current = 0;
    multiplierRef.current = 1;
    isGameOverRef.current = false;
    gameStartedRef.current = true;
    setScore(0);
    setMultiplier(1);
    setTimeLeft(timeLimitSeconds);
    setIsGameOver(false);
    setGameStarted(true);
    spawnFood();
  };

  // Timer countdown
  useEffect(() => {
    if (!gameStarted || isGameOver) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, isGameOver, handleGameOver]);

  // Main 60 FPS RequestAnimationFrame Loop
  useEffect(() => {
    if (!gameStarted || isGameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let lastTickTime = performance.now();

    const renderGame = () => {
      const cellSize = canvas.width / GRID_SIZE;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Dark Grid Background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
      }

      // Draw Main Food
      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(
        foodRef.current.x * cellSize + cellSize / 2,
        foodRef.current.y * cellSize + cellSize / 2,
        cellSize / 2.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Bonus Food
      if (bonusFoodRef.current) {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(
          bonusFoodRef.current.x * cellSize + cellSize / 2,
          bonusFoodRef.current.y * cellSize + cellSize / 2,
          cellSize / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw Snake Body
      snakeRef.current.forEach((segment, index) => {
        const isHead = index === 0;
        ctx.fillStyle = isHead ? '#34d399' : '#059669';
        ctx.shadowColor = isHead ? '#10b981' : 'transparent';
        ctx.shadowBlur = isHead ? 8 : 0;

        const x = segment.x * cellSize + 1;
        const y = segment.y * cellSize + 1;
        const size = cellSize - 2;

        ctx.beginPath();
        ctx.roundRect(x, y, size, size, isHead ? 6 : 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    };

    const gameLoop = (now: number) => {
      if (isGameOverRef.current || !gameStartedRef.current) return;

      const elapsed = now - lastTickTime;
      if (elapsed >= BASE_TICK_MS) {
        lastTickTime = now;

        // Apply queued direction
        dirRef.current = nextDirRef.current;

        // Calculate head movement
        const head = { ...snakeRef.current[0] };
        if (dirRef.current === 'UP') head.y -= 1;
        if (dirRef.current === 'DOWN') head.y += 1;
        if (dirRef.current === 'LEFT') head.x -= 1;
        if (dirRef.current === 'RIGHT') head.x += 1;

        // Collision Check (Wall)
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          handleGameOver();
          return;
        }

        // Collision Check (Self)
        if (snakeRef.current.some((segment) => segment.x === head.x && segment.y === head.y)) {
          handleGameOver();
          return;
        }

        const newSnake = [head, ...snakeRef.current];

        // Eat food
        let ateFood = false;
        if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
          ateFood = true;
          soundFx.playPickup();
          const pts = 100 * multiplierRef.current;
          scoreRef.current += pts;
          setScore(scoreRef.current);
          spawnFood();
          spawnBonusFood();
        }

        // Eat bonus food
        if (
          bonusFoodRef.current &&
          head.x === bonusFoodRef.current.x &&
          head.y === bonusFoodRef.current.y
        ) {
          soundFx.playCashChing();
          scoreRef.current += 300 * multiplierRef.current;
          multiplierRef.current = Math.min(multiplierRef.current + 1, 4);
          setMultiplier(multiplierRef.current);
          setScore(scoreRef.current);
          bonusFoodRef.current = null;
        }

        if (!ateFood) {
          newSnake.pop();
        }

        snakeRef.current = newSnake;
      }

      renderGame();
      animFrameId = requestAnimationFrame(gameLoop);
    };

    animFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [gameStarted, isGameOver, spawnFood, spawnBonusFood, handleGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto p-2 sm:p-3">
      {/* HUD Header */}
      <div className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 mb-2.5 shadow-md font-mono">
        <div>
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Score</span>
          <span className="text-lg sm:text-xl font-black text-emerald-400 tracking-wider">
            {score.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl text-amber-400 text-xs font-bold">
          <Zap className="w-3.5 h-3.5" />
          <span>{multiplier}x</span>
        </div>

        <div className="text-right">
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Time</span>
          <span className={`text-lg sm:text-xl font-black font-mono ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Canvas Area with Touch Swipe */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full aspect-square bg-zinc-950 border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center touch-none select-none"
      >
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full h-full object-contain touch-none"
        />

        {/* Start Overlay */}
        {!gameStarted && !isGameOver && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
              <Zap className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">Cyber Snake</h3>
            <p className="text-xs text-zinc-400 mb-5 max-w-[240px]">
              Swipe on screen or tap controls to devour orbs! High score wins tournament.
            </p>
            <button
              type="button"
              onClick={startGame}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Match Run</span>
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-xs uppercase rounded-full mb-2">
              Match Run Finished
            </span>
            <h3 className="text-2xl font-black text-white font-mono mb-1">{score.toLocaleString()} PTS</h3>
            <p className="text-xs text-zinc-400 mb-5">Final score recorded into tournament leaderboard.</p>

            {isPractice ? (
              <button
                type="button"
                onClick={startGame}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice Again</span>
              </button>
            ) : (
              <p className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                Score Submitted! Check live leaderboard.
              </p>
            )}
          </div>
        )}
      </div>

      {/* On-Screen Mobile D-Pad */}
      <div className="w-full mt-3 flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => changeDirection('UP')}
          disabled={!gameStarted || isGameOver}
          className="w-12 h-10 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-emerald-500 active:text-zinc-950 flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-30"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => changeDirection('LEFT')}
            disabled={!gameStarted || isGameOver}
            className="w-12 h-10 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-emerald-500 active:text-zinc-950 flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-30"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => changeDirection('DOWN')}
            disabled={!gameStarted || isGameOver}
            className="w-12 h-10 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-emerald-500 active:text-zinc-950 flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-30"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => changeDirection('RIGHT')}
            disabled={!gameStarted || isGameOver}
            className="w-12 h-10 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-emerald-500 active:text-zinc-950 flex items-center justify-center text-zinc-300 font-bold shadow-md transition-colors disabled:opacity-30"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SnakeGame;

