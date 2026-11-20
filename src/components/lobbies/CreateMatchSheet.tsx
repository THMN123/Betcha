import React, { useEffect, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GAMES_LIST } from '../../data/initialData';
import type { GameId } from '../../types';
import Sheet from '../ui/Sheet';
import GameCover from '../ui/GameCover';
import { cr } from '../../utils/credits';

const BUY_INS = [1, 5, 10, 25];
const PLAYERS = [2, 4, 8];

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`h-11 rounded-xl text-sm font-bold border transition-colors ${
      active ? 'bg-white text-zinc-950 border-white' : 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08]'
    }`}
  >
    {children}
  </button>
);

/** Create a match in one screen: game, stakes, prize. Opened from Home or Matches. */
const CreateMatchSheet: React.FC = () => {
  const { createSheetGame, closeCreateMatch, createMatch, user } = useApp();
  const [game, setGame] = useState<GameId>('snake');
  const [title, setTitle] = useState('');
  const [buyIn, setBuyIn] = useState(5);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [distribution, setDistribution] = useState<'winner_takes_all' | 'top_two'>('winner_takes_all');
  const [creating, setCreating] = useState(false);

  // Each time it opens, start from the game it was opened for.
  useEffect(() => {
    if (createSheetGame) {
      setGame(createSheetGame);
      setTitle('');
    }
  }, [createSheetGame]);

  const info = GAMES_LIST.find((g) => g.id === game)!;
  const pot = buyIn * maxPlayers;
  const prize = pot * 0.95;
  const short = user.balance < buyIn;

  const submit = async () => {
    if (creating || short) return;
    setCreating(true);
    const room = await createMatch({ gameId: game, title: title.trim() || `${info.title} Showdown`, buyIn, maxPlayers, distribution });
    setCreating(false);
    if (room) closeCreateMatch();
  };

  return (
    <Sheet
      open={!!createSheetGame}
      onClose={closeCreateMatch}
      size="lg"
      eyebrow="New match"
      title="Challenge your friends"
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={creating || short}
          className="w-full h-12 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {creating ? 'Creating...' : short ? `You need ${cr(buyIn)} to create this` : `Create lobby · ${cr(buyIn)} buy-in`}
        </button>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 mb-2">Game</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {GAMES_LIST.map((g) => {
              const active = g.id === game;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGame(g.id)}
                  aria-pressed={active}
                  className={`tile-focus rounded-2xl overflow-hidden text-left ${active ? 'tile-selected' : 'opacity-70 hover:opacity-100'}`}
                >
                  <GameCover gameId={g.id} showTitle className="aspect-[3/4]">
                    {active && (
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-zinc-950 flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    )}
                  </GameCover>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            {info.description} <span className="text-zinc-500">· {info.avgDuration} · {info.difficulty}</span>
          </p>
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 mb-2">Buy-in per player</h3>
          <div className="grid grid-cols-4 gap-2">
            {BUY_INS.map((a) => (
              <Chip key={a} active={buyIn === a} onClick={() => setBuyIn(a)}>
                {cr(a)}
              </Chip>
            ))}
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 mb-2">Players</h3>
            <div className="grid grid-cols-3 gap-2">
              {PLAYERS.map((n) => (
                <Chip key={n} active={maxPlayers === n} onClick={() => setMaxPlayers(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 mb-2">Prize</h3>
            <div className="grid grid-cols-2 gap-2">
              <Chip active={distribution === 'winner_takes_all'} onClick={() => setDistribution('winner_takes_all')}>
                Winner takes all
              </Chip>
              <Chip active={distribution === 'top_two'} onClick={() => setDistribution('top_two')}>
                Top 2 · 70/30
              </Chip>
            </div>
          </div>
        </section>

        <section>
          <label htmlFor="match-title" className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 mb-2 block">
            Name <span className="normal-case tracking-normal font-medium text-zinc-500">(optional)</span>
          </label>
          <input
            id="match-title"
            type="text"
            maxLength={60}
            placeholder={`${info.title} Showdown`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-12 bg-white/[0.04] border border-white/[0.08] focus:border-emerald-400 rounded-xl px-4 text-white text-sm placeholder:text-zinc-500 focus:outline-none"
          />
        </section>

        <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-zinc-400">If {maxPlayers} players join, the winner gets</div>
              <div className="text-3xl font-extrabold text-emerald-300 tabular-nums">{cr(distribution === 'top_two' ? prize * 0.7 : prize)}</div>
            </div>
            <div className="text-right text-xs text-zinc-500 font-mono">
              pot {cr(pot)}
              <br />
              5% fee −{cr(pot * 0.05)}
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-400 flex gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
            Your buy-in is held until the match ends. Cancel before it starts and you get it back.
          </p>
        </section>
      </div>
    </Sheet>
  );
};

export default CreateMatchSheet;
