import React, { useId } from 'react';
import type { GameId } from '../../types';
import { GAMES_LIST } from '../../data/initialData';

/** Accent colors per game, used for covers, glows and highlights. */
export const GAME_ACCENT: Record<GameId, { from: string; to: string; glow: string; text: string }> = {
  snake: { from: '#064e3b', to: '#0b1220', glow: '#34d399', text: 'text-emerald-300' },
  '2048': { from: '#3b0764', to: '#0b1220', glow: '#a78bfa', text: 'text-violet-300' },
  neondodge: { from: '#881337', to: '#0b1220', glow: '#fb7185', text: 'text-rose-300' },
};

const SnakeArt: React.FC<{ glow: string; id: string }> = ({ glow, id }) => (
  <>
    <defs>
      <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M20 0H0V20" fill="none" stroke="#ffffff" strokeOpacity="0.06" />
      </pattern>
    </defs>
    <rect width="300" height="400" fill={`url(#${id})`} />
    <path
      d="M40 300 H140 V220 H220 V140 H120 V80"
      fill="none"
      stroke={glow}
      strokeWidth="18"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.95"
      style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
    />
    <circle cx="120" cy="80" r="13" fill="#ecfdf5" style={{ filter: `drop-shadow(0 0 8px ${glow})` }} />
    <circle cx="200" cy="60" r="8" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 10px #fbbf24)' }} />
    <circle cx="250" cy="250" r="6" fill={glow} opacity="0.8" />
  </>
);

const Art2048: React.FC<{ glow: string }> = ({ glow }) => {
  const tiles = [
    ['2', '4', '8'],
    ['16', '128', '32'],
    ['256', '2048', '64'],
  ];
  return (
    <g transform="translate(150 200) rotate(-12) translate(-120 -120)">
      {tiles.flatMap((row, r) =>
        row.map((n, c) => {
          const big = n === '2048';
          return (
            <g key={`${r}${c}`} transform={`translate(${c * 82} ${r * 82})`}>
              <rect
                width="74"
                height="74"
                rx="14"
                fill={big ? glow : '#ffffff'}
                fillOpacity={big ? 0.95 : 0.06 + (r + c) * 0.03}
                stroke={glow}
                strokeOpacity={big ? 1 : 0.35}
                style={big ? { filter: `drop-shadow(0 0 14px ${glow})` } : undefined}
              />
              <text
                x="37"
                y="46"
                textAnchor="middle"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontWeight="800"
                fontSize={n.length > 3 ? 20 : 24}
                fill={big ? '#1e1b4b' : '#ede9fe'}
                opacity={big ? 1 : 0.8}
              >
                {n}
              </text>
            </g>
          );
        })
      )}
    </g>
  );
};

const DodgeArt: React.FC<{ glow: string }> = ({ glow }) => (
  <>
    {[0, 1, 2, 3, 4].map((i) => (
      <line key={i} x1={150 + (i - 2) * 22} y1="40" x2={150 + (i - 2) * 90} y2="400" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="2" />
    ))}
    {[
      [70, 120, 70],
      [160, 190, 90],
      [40, 260, 110],
      [190, 300, 100],
    ].map(([x, y, w], i) => (
      <rect key={i} x={x} y={y} width={w} height="16" rx="8" fill={glow} opacity={0.35 + i * 0.15} style={{ filter: `drop-shadow(0 0 10px ${glow})` }} />
    ))}
    <circle cx="150" cy="355" r="16" fill="#fff1f2" style={{ filter: `drop-shadow(0 0 14px ${glow})` }} />
  </>
);

interface GameCoverProps {
  gameId: GameId;
  className?: string;
  /** Show the game's title on the art (cover style). */
  showTitle?: boolean;
  children?: React.ReactNode;
}

/** Generated cover art for a game (no image files needed); fills its container. */
const GameCover: React.FC<GameCoverProps> = ({ gameId, className = '', showTitle = false, children }) => {
  const uid = useId().replace(/:/g, '');
  const a = GAME_ACCENT[gameId] ?? GAME_ACCENT.snake;
  const game = GAMES_LIST.find((g) => g.id === gameId);
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} overflow-hidden ${className}`} style={{ background: `linear-gradient(160deg, ${a.from} 0%, ${a.to} 85%)` }}>
      <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="240" cy="40" r="140" fill={a.glow} opacity="0.12" />
        {gameId === 'snake' && <SnakeArt glow={a.glow} id={`grid${uid}`} />}
        {gameId === '2048' && <Art2048 glow={a.glow} />}
        {gameId === 'neondodge' && <DodgeArt glow={a.glow} />}
      </svg>
      {showTitle && (
        <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
          <div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${a.text}`}>{game?.category}</div>
          <div className="text-sm font-extrabold text-white leading-tight">{game?.title}</div>
        </div>
      )}
      {children}
    </div>
  );
};

export default GameCover;
