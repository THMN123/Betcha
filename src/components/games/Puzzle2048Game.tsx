import React, { useEffect, useRef, useState } from 'react';
import { soundFx } from '../../utils/audio';
import { useGameRun } from '../../hooks/useGameRun';
import { g2048Sim, Move2048 } from '../../../supabase/functions/_shared/games/g2048.ts';
import { maxTicksFor } from '../../../supabase/functions/_shared/games/index.ts';
import { useGhosts } from '../../games/useGhosts';
import { nextTiles, tilesFromBoard, type Tile } from '../../games/tiles2048';
import { GameHud, GameOverlays, DPad, Board, haptic, type GameProps, type Dir } from './GameShell';

// Cool to hot as tiles grow: easy to read at a glance.
const TILE: Record<number, string> = {
  2: 'bg-violet-950/80 text-violet-200',
  4: 'bg-violet-900 text-violet-100',
  8: 'bg-indigo-700 text-white',
  16: 'bg-indigo-500 text-white',
  32: 'bg-sky-500 text-white',
  64: 'bg-emerald-400 text-zinc-950',
  128: 'bg-lime-300 text-zinc-950',
  256: 'bg-amber-300 text-zinc-950',
  512: 'bg-orange-400 text-zinc-950',
  1024: 'bg-rose-500 text-white',
  2048: 'bg-gradient-to-br from-fuchsia-400 via-rose-400 to-amber-300 text-zinc-950',
};
const GLOW: Record<number, string> = { 64: '#34d399', 128: '#bef264', 256: '#fcd34d', 512: '#fb923c', 1024: '#f43f5e', 2048: '#f0abfc' };

const Puzzle2048Game: React.FC<GameProps> = ({ timeLimitSeconds, isPractice, getSeed, onFinish, live, autoStartAt, onProgress, resumeFrom }) => {
  // Tiles on screen (with identities, so they can slide and merge) - display only.
  const [tiles, setTiles] = useState<Tile[]>([]);
  const tilesRef = useRef<Tile[]>([]);
  const showTiles = (t: Tile[]) => {
    tilesRef.current = t;
    setTiles(t);
  };
  const [gains, setGains] = useState<{ id: number; n: number }[]>([]);
  const gainId = useRef(0);

  // Opponents' boards are rebuilt from their moves; we only show their score.
  const ghosts = useGhosts(g2048Sim, live, maxTicksFor(g2048Sim, timeLimitSeconds), 0);
  const { stateRef, hud, start, resume, sendInput } = useGameRun(
    g2048Sim,
    timeLimitSeconds,
    (r) => {
      soundFx.playGameOver();
      live?.finish(r.ticks);
      live?.setMyScore(r.score, true);
      onFinish(r);
    },
    {
      afterStep: (_s, tick) => live?.tick(tick),
      onStart: (seed) => {
        ghosts.setSeed(seed);
        // New or resumed run: show its board, tiles growing in.
        if (stateRef.current) showTiles(tilesFromBoard(stateRef.current.board, true));
      },
      onInput: (ev) => live?.input(ev),
      onProgress,
    }
  );

  const move = (code: number) => {
    const s = stateRef.current;
    if (!s || !hud.running) return;
    const beforeScore = s.score;
    const beforeBoard = JSON.stringify(s.board);
    sendInput(code);
    const after = stateRef.current;
    if (!after || JSON.stringify(after.board) === beforeBoard) return; // nothing moved
    haptic();
    showTiles(nextTiles(tilesRef.current, code, after.board).tiles);
    const gained = after.score - beforeScore;
    if (gained > 0) {
      soundFx.playMerge();
      const id = ++gainId.current;
      setGains((g) => [...g.slice(-3), { id, n: gained }]);
      setTimeout(() => setGains((g) => g.filter((x) => x.id !== id)), 700);
    }
    live?.setMyScore(after.score, false);
  };

  useEffect(() => {
    const keys: Record<string, number> = {
      ArrowUp: Move2048.UP, w: Move2048.UP,
      ArrowDown: Move2048.DOWN, s: Move2048.DOWN,
      ArrowLeft: Move2048.LEFT, a: Move2048.LEFT,
      ArrowRight: Move2048.RIGHT, d: Move2048.RIGHT,
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.key in keys) || !hud.running) return;
      e.preventDefault();
      if (!e.repeat) move(keys[e.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Swipe (touch or mouse drag): fires as soon as the finger has travelled far enough,
  // without waiting for it to lift, so moves feel instant. One move per gesture.
  const gesture = useRef<{ x: number; y: number; fired: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!hud.running) return;
    gesture.current = { x: e.clientX, y: e.clientY, fired: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.fired) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    g.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? Move2048.RIGHT : Move2048.LEFT);
    else move(dy > 0 ? Move2048.DOWN : Move2048.UP);
  };
  const endGesture = () => (gesture.current = null);

  const DIRS: Record<Dir, number> = { up: Move2048.UP, down: Move2048.DOWN, left: Move2048.LEFT, right: Move2048.RIGHT };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      <div className="relative w-full">
        <GameHud hud={hud} gameId="2048" label="Score" timeLimitSeconds={timeLimitSeconds} />
        {/* "+points" floating up from the score */}
        <div className="absolute left-[38%] top-5 pointer-events-none">
          {gains.map((g) => (
            <span key={g.id} className="score-float absolute left-0 top-0 text-xl font-extrabold text-violet-200 whitespace-nowrap">
              +{g.n}
            </span>
          ))}
        </div>
      </div>
      <Board
        gameId="2048"
        className="aspect-square bg-[#120e1f] p-[3%]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        <div className="g2048 relative w-full h-full">
          {/* empty cells */}
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="g2048-cell" style={{ ['--r' as string]: Math.floor(i / 4), ['--c' as string]: i % 4 }} />
          ))}
          {tiles.map((t) => (
            <div
              key={t.id}
              className="g2048-tile"
              style={{ ['--r' as string]: t.r, ['--c' as string]: t.c, zIndex: t.merged ? 3 : t.consumed ? 1 : 2 }}
            >
              <div
                className={`g2048-face ${t.isNew ? 'g2048-new' : ''} ${t.merged ? 'g2048-merged' : ''} ${TILE[t.value] ?? TILE[2048]}`}
                style={{
                  fontSize: `${t.value >= 10000 ? 5.5 : t.value >= 1000 ? 7 : t.value >= 100 ? 9 : 11}cqw`,
                  boxShadow: GLOW[t.value] || t.value > 2048 ? `0 0 26px -6px ${GLOW[t.value] ?? GLOW[2048]}` : undefined,
                }}
              >
                {t.value}
              </div>
            </div>
          ))}
        </div>
        <GameOverlays
          hud={hud}
          gameId="2048"
          howTo="Slide the tiles to merge matching numbers. Bigger merges score more. Score as much as you can before time runs out."
          controls={['Swipe the board', 'Arrow pad', 'Arrow keys / WASD']}
          isPractice={isPractice}
          timeLimitSeconds={timeLimitSeconds}
          getSeed={getSeed}
          start={start}
          autoStartAt={autoStartAt}
          resumeFrom={resumeFrom}
          resume={resume}
        />
      </Board>
      <div className="mt-5">
        <DPad disabled={!hud.running} onDir={(d) => move(DIRS[d])} />
      </div>
    </div>
  );
};

export default Puzzle2048Game;
