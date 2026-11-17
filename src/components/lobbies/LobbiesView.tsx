import React, { useState } from 'react';
import {
  Swords,
  Plus,
  Copy,
  Check,
  Users,
  ShieldCheck,
  Play,
  Share2,
  DollarSign,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Trophy,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GAMES_LIST } from '../../data/initialData';
import { GameId, MatchRoom } from '../../types';

import MorphingHeading from '../common/MorphingHeading';
import LobbyDetailModal from './LobbyDetailModal';
import { cr, shareInvite } from '../../utils/credits';

const LobbiesView: React.FC = () => {
  const {
    rooms,
    createMatch,
    joinMatch,
    selectedRoomId,
    setSelectedRoomId,
    user,
    showToast,
  } = useApp();

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [selectedGame, setSelectedGame] = useState<GameId>('snake');
  const [matchTitle, setMatchTitle] = useState<string>('');
  const [buyIn, setBuyIn] = useState<number>(5);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [distribution, setDistribution] = useState<'winner_takes_all' | 'top_two'>('winner_takes_all');

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Active room detail modal
  const activeDetailRoom = selectedRoomId
    ? rooms.find((r) => r.id === selectedRoomId) || null
    : null;

  const handleCreateSubmit = async () => {
    if (creating) return;
    setCreating(true);
    const gameInfo = GAMES_LIST.find((g) => g.id === selectedGame);
    const newRoom = await createMatch({
      gameId: selectedGame,
      title: matchTitle || `${gameInfo?.title} Showdown`,
      buyIn,
      maxPlayers,
      distribution,
    });

    setCreating(false);
    if (newRoom) {
      setIsWizardOpen(false);
      setWizardStep(1);
      setMatchTitle('');
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinCode.trim();
    if (!raw || joining) return;
    // Accept a pasted invite link as well as a bare code.
    const fromUrl = raw.match(/[?&]room=([^&]+)/);
    const code = fromUrl ? decodeURIComponent(fromUrl[1]) : /^\d{4}$/.test(raw) ? `BETCHA-${raw}` : raw;
    setJoining(true);
    const ok = await joinMatch(code);
    setJoining(false);
    if (ok) setJoinCode('');
  };

  const myRooms = rooms.filter((r) => r.players.some((p) => p.isCurrentUser));
  const openRooms = rooms.filter((r) => r.status === 'waiting' && !r.players.some((p) => p.isCurrentUser));
  const orderedRooms = [
    ...myRooms.filter((r) => r.status === 'waiting' || r.status === 'in_progress'),
    ...openRooms,
    ...myRooms.filter((r) => r.status === 'completed' || r.status === 'cancelled'),
  ];

  const copyInviteLink = async (code: string, title: string) => {
    const result = await shareInvite(code, title);
    if (result === 'copied') {
      setCopiedCode(code);
      showToast('Invite link copied. Send it to your friends!', 'success');
      setTimeout(() => setCopiedCode(null), 3000);
    } else if (result === 'failed') {
      showToast(`Couldn't copy automatically. Share this code instead: ${code}`, 'warning');
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="w-6 h-6 text-emerald-400" />
            <MorphingHeading as="h1" glowColor="emerald" className="text-2xl font-extrabold text-white tracking-tight">
              Tournament Lobbies
            </MorphingHeading>
          </div>
          <p className="text-xs text-zinc-400">Create a match, send the link, beat your friends</p>
        </div>

        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Create Match</span>
        </button>
      </div>

      {/* Join by code */}
      <form onSubmit={handleJoinByCode} className="flex gap-2">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Got a code? e.g. BETCHA-4821 or paste the link"
          className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none"
        />
        <button
          type="submit"
          disabled={!joinCode.trim() || joining}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50 shrink-0"
        >
          {joining ? 'Joining...' : 'Join'}
        </button>
      </form>

      {/* Lobbies Grid */}
      {orderedRooms.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center my-4">
          <Swords className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-white mb-1">No Active Tournament Lobbies</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
            There are currently no open matches. Create a new wager lobby and share your invite link with your friends!
          </p>
          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20"
          >
            Create Match Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderedRooms.map((room) => {
          const game = GAMES_LIST.find((g) => g.id === room.gameId);
          const isUserInRoom = room.players.some((p) => p.id === user.id);

          return (
            <div
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all cursor-pointer shadow-lg flex flex-col justify-between ${
                selectedRoomId === room.id
                  ? 'bg-zinc-900 border-emerald-500 ring-1 ring-emerald-500/50'
                  : 'bg-zinc-900/80 hover:bg-zinc-850 border-zinc-800'
              }`}
            >
              <div>
                {/* Status Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {cr(room.buyIn)} BUY-IN
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400 font-mono">
                      #{room.id}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                      room.status === 'waiting'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : room.status === 'in_progress'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {room.status === 'waiting'
                      ? 'Lobby Open'
                      : room.status === 'in_progress'
                      ? 'Playing'
                      : room.status === 'cancelled'
                      ? 'Cancelled'
                      : room.winnerId === user.id
                      ? 'You won'
                      : 'Finished'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1">{room.title}</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Game: <span className="text-white font-medium">{game?.title}</span> • Host:{' '}
                  <span className="text-white font-medium">{room.hostName}</span>
                </p>

                {/* Pot Breakdown Card */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 mb-4 flex items-center justify-between font-mono text-xs">
                  <div>
                    <span className="block text-[10px] text-zinc-500 uppercase">Total Pot</span>
                    <span className="font-bold text-white">{cr(room.totalPot)}</span>
                  </div>

                  <div className="text-center">
                    <span className="block text-[10px] text-amber-400 uppercase font-semibold">5% Spread</span>
                    <span className="font-bold text-zinc-400">-{cr(room.platformFee)}</span>
                  </div>

                  <div className="text-right">
                    <span className="block text-[10px] text-emerald-400 uppercase font-bold">Net Prize Pool</span>
                    <span className="font-extrabold text-emerald-400 text-sm">{cr(room.netPrizePool)}</span>
                  </div>
                </div>

                {/* Joined Friends Row */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-zinc-400 font-medium">Participants</span>
                  <span className="text-zinc-300 font-mono font-bold">
                    {room.players.length}/{room.maxPlayers}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-4 overflow-x-auto py-1">
                  {room.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2 py-1 rounded-full text-xs shrink-0"
                    >
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                      <span className="text-zinc-300 font-medium text-[11px]">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-800/80 flex items-center gap-2">
                {room.status === 'waiting' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyInviteLink(room.inviteCode, room.title);
                  }}
                  className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Copy Invite Link"
                >
                  {copiedCode === room.inviteCode ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
                )}

                {isUserInRoom ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRoomId(room.id);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>{room.status === 'in_progress' ? 'Open match' : room.status === 'waiting' ? 'Open lobby' : 'View results'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      joinMatch(room.id);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-bold text-xs shadow-md flex items-center justify-center gap-1 transition-all"
                  >
                    <span>Join ({cr(room.buyIn)})</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {activeDetailRoom && <LobbyDetailModal room={activeDetailRoom} onClose={() => setSelectedRoomId(null)} />}

      {/* Step-by-step Create Match Wizard */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsWizardOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                Step {wizardStep} of 3
              </span>
              <h2 className="text-xl font-black text-white">Create Wager Lobby</h2>
            </div>

            {/* Step 1: Select Game */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-zinc-400 uppercase">Select Arcade Game</label>
                <div className="space-y-2">
                  {GAMES_LIST.map((game) => (
                    <div
                      key={game.id}
                      onClick={() => setSelectedGame(game.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedGame === game.id
                          ? 'bg-emerald-500/10 border-emerald-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">{game.title}</h4>
                        <p className="text-xs text-zinc-400">{game.description}</p>
                      </div>
                      {selectedGame === game.id && <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Room Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Friday Night Showdown"
                    value={matchTitle}
                    onChange={(e) => setMatchTitle(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="w-full py-3 mt-4 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm shadow-md"
                >
                  Next: Set Buy-in & Players
                </button>
              </div>
            )}

            {/* Step 2: Set Buy-in & Players */}
            {wizardStep === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Buy-in (credits each)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 5, 10, 25].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBuyIn(amt)}
                        className={`py-2.5 rounded-xl font-mono font-bold text-sm border transition-all ${
                          buyIn === amt
                            ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md'
                            : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        {cr(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Max Players</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 4, 8].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxPlayers(num)}
                        className={`py-2.5 rounded-xl font-mono font-bold text-sm border transition-all ${
                          maxPlayers === num
                            ? 'bg-indigo-600 text-white border-indigo-400'
                            : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                        }`}
                      >
                        {num} Players
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Prize Distribution</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDistribution('winner_takes_all')}
                      className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                        distribution === 'winner_takes_all'
                          ? 'bg-emerald-500/10 border-emerald-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Winner Takes All (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistribution('top_two')}
                      className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                        distribution === 'top_two'
                          ? 'bg-emerald-500/10 border-emerald-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      Top Two Split (70/30)
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="w-1/3 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="w-2/3 py-3 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm shadow-md"
                  >
                    Review & Lock Escrow
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review Pot & Confirm */}
            {wizardStep === 3 && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3">Escrow Calculation</h4>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-zinc-300">
                      <span>Your buy-in (held until the match ends):</span>
                      <span className="font-bold text-white">{cr(buyIn)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>Pot if {maxPlayers} players join:</span>
                      <span className="font-bold text-white">{cr(buyIn * maxPlayers)}</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>Platform Spread (5% Fee):</span>
                      <span>-{cr(buyIn * maxPlayers * 0.05)}</span>
                    </div>
                    <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm text-emerald-400 font-extrabold">
                      <span>Net Prize Pool:</span>
                      <span>{cr(buyIn * maxPlayers * 0.95)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                  <ShieldCheck className="w-4 h-4 inline mr-1" />
                  Your {cr(buyIn)} buy-in is held until the match ends. Cancel before it starts and you get it back.
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="w-1/3 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSubmit}
                    disabled={creating}
                    className="disabled:opacity-50 w-2/3 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/25"
                  >
                    {creating ? 'Creating...' : 'Create Lobby & Get Invite Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbiesView;
