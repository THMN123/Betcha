import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, RotateCcw, Zap } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface NeonDodgeProps {
  timeLimitSeconds?: number;
  onGameOver: (finalScore: number) => void;
  isPractice?: boolean;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
}

const NeonDodgeGame: React.FC<NeonDodgeProps> = ({
  timeLimitSeconds = 45,
  onGameOver,
  isPractice = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitSeconds);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Game state refs
  const playerLaneRef = useRef<number>(1); // 0 = left, 1 = middle, 2 = right
  const obstaclesRef = useRef<Obstacle[]>([]);
  const scoreRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const switchLane = useCallback((lane: number) => {
    soundFx.playClick();
    playerLaneRef.current = lane;
  }, []);

  // Touch lane tap handler
  const handleCanvasTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!gameStarted || isGameOver) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const third = rect.width / 3;
    if (touchX < third) {
      switchLane(0);
    } else if (touchX < third * 2) {
      switchLane(1);
    } else {
      switchLane(2);
    }
  };

  const startGame = () => {
    playerLaneRef.current = 1;
    obstaclesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(timeLimitSeconds);
    setIsGameOver(false);
    setGameStarted(true);
  };

  const handleGameOver = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsGameOver(true);
    soundFx.playGameOver();
    onGameOver(scoreRef.current);
  }, [onGameOver]);

  // Timer
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

  // Main Animation Loop
  useEffect(() => {
    if (!gameStarted || isGameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastSpawnTime = Date.now();

    const loop = () => {
      const now = Date.now();

      // Spawn obstacle
      if (now - lastSpawnTime > 750) {
        lastSpawnTime = now;
        const lane = Math.floor(Math.random() * 3);
        const colors = ['#f43f5e', '#fb7185', '#ec4899'];
        obstaclesRef.current.push({
          x: lane,
          y: -50,
          width: 1,
          height: 30,
          speed: 4 + Math.min(scoreRef.current / 300, 6),
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw 3 lanes
      const laneWidth = canvas.width / 3;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneWidth, 0);
        ctx.lineTo(i * laneWidth, canvas.height);
        ctx.stroke();
      }

      // Draw Player Orb
      const playerX = playerLaneRef.current * laneWidth + laneWidth / 2;
      const playerY = canvas.height - 40;
      const radius = 14;

      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(playerX, playerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Update & Draw Obstacles
      const nextObstacles: Obstacle[] = [];
      let collision = false;

      for (const obs of obstaclesRef.current) {
        obs.y += obs.speed;

        // Draw Obstacle
        const obsX = obs.x * laneWidth + 10;
        const obsW = laneWidth - 20;

        ctx.fillStyle = obs.color;
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(obsX, obs.y, obsW, obs.height, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Check Collision
        if (
          obs.x === playerLaneRef.current &&
          obs.y + obs.height >= playerY - radius &&
          obs.y <= playerY + radius
        ) {
          collision = true;
        }

        // Passed obstacle score point
        if (obs.y < canvas.height) {
          nextObstacles.push(obs);
        } else {
          scoreRef.current += 50;
          setScore(scoreRef.current);
          soundFx.playPickup();
        }
      }

      obstaclesRef.current = nextObstacles;

      if (collision) {
        handleGameOver();
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameStarted, isGameOver, handleGameOver]);

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted || isGameOver) return;
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft' || e.key === 'a') switchLane(Math.max(0, playerLaneRef.current - 1));
      if (e.key === 'ArrowRight' || e.key === 'd') switchLane(Math.min(2, playerLaneRef.current + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, isGameOver, switchLane]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto p-3">
      {/* HUD Header */}
      <div className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 mb-3 shadow-md font-mono">
        <div>
          <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Reflex Score</span>
          <span className="text-xl font-black text-rose-400 tracking-wider">
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

      {/* Canvas */}
      <div
        onTouchStart={handleCanvasTouch}
        className="relative w-full aspect-[3/4] bg-zinc-950 border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center touch-none select-none"
      >
        <canvas
          ref={canvasRef}
          width={280}
          height={380}
          className="w-full h-full object-contain touch-none"
        />

        {/* Start Overlay */}
        {!gameStarted && !isGameOver && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 animate-bounce">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1">Neon Reflex Dodge</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Tap Left/Middle/Right lanes to dodge incoming laser walls! High reflexes win.
            </p>
            <button
              type="button"
              onClick={startGame}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Dodge Run</span>
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-xs uppercase rounded-full mb-2">
              Dodge Run Finished
            </span>
            <h3 className="text-2xl font-black text-white font-mono mb-1">{score.toLocaleString()} PTS</h3>
            <p className="text-xs text-zinc-400 mb-6">Final score recorded into tournament leaderboard.</p>

            {isPractice ? (
              <button
                type="button"
                onClick={startGame}
                className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Practice Again</span>
              </button>
            ) : (
              <p className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                Score Submitted! Check live leaderboard.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3-Lane Touch Buttons */}
      <div className="w-full mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => switchLane(0)}
          disabled={!gameStarted || isGameOver}
          className={`py-3 rounded-xl border text-xs font-bold font-mono transition-all ${
            playerLaneRef.current === 0
              ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
        >
          LANE 1
        </button>
        <button
          type="button"
          onClick={() => switchLane(1)}
          disabled={!gameStarted || isGameOver}
          className={`py-3 rounded-xl border text-xs font-bold font-mono transition-all ${
            playerLaneRef.current === 1
              ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
        >
          LANE 2
        </button>
        <button
          type="button"
          onClick={() => switchLane(2)}
          disabled={!gameStarted || isGameOver}
          className={`py-3 rounded-xl border text-xs font-bold font-mono transition-all ${
            playerLaneRef.current === 2
              ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}
        >
          LANE 3
        </button>
      </div>
    </div>
  );
};

export default NeonDodgeGame;
