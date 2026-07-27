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

const LobbiesView: React.FC = () => {
  const {
    rooms,
    createMatch,
    joinMatch,
    togglePlayerReady,
    startMatchLobby,
    simulateFriendRuns,
    enterMatchArena,
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

  // Active room detail modal
  const activeDetailRoom = selectedRoomId
    ? rooms.find((r) => r.id === selectedRoomId) || null
    : null;

  const handleCreateSubmit = () => {
    const gameInfo = GAMES_LIST.find((g) => g.id === selectedGame);
    const newRoom = createMatch({
      gameId: selectedGame,
      title: matchTitle || `${gameInfo?.title} Showdown`,
      buyIn,
      maxPlayers,
      distribution,
    });

    if (newRoom) {
      setIsWizardOpen(false);
      setWizardStep(1);
    }
  };

  const copyInviteLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const url = `${origin}${pathname}?room=${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedCode(code);
    showToast(`Invite link copied: ${url}`, 'success');
    setTimeout(() => setCopiedCode(null), 3000);
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
          <p className="text-xs text-zinc-400">Create or join wager matches with friends</p>
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

      {/* Lobbies Grid */}
      {rooms.length === 0 ? (
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
          {rooms.map((room) => {
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
                      ${room.buyIn} BUY-IN
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
                    {room.status === 'waiting' ? 'Lobby Open' : room.status === 'in_progress' ? 'Playing' : 'Completed'}
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
                    <span className="font-bold text-white">${room.totalPot.toFixed(2)}</span>
                  </div>

                  <div className="text-center">
                    <span className="block text-[10px] text-amber-400 uppercase font-semibold">5% Spread</span>
                    <span className="font-bold text-zinc-400">-${room.platformFee.toFixed(2)}</span>
                  </div>

                  <div className="text-right">
                    <span className="block text-[10px] text-emerald-400 uppercase font-bold">Net Prize Pool</span>
                    <span className="font-extrabold text-emerald-400 text-sm">${room.netPrizePool.toFixed(2)}</span>
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyInviteLink(room.inviteCode);
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

                {isUserInRoom ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRoomId(room.id);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>View Lobby Room</span>
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
                    <span>Join Lobby (${room.buyIn})</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Selected Room Detail Modal / Drawer */}
      {activeDetailRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedRoomId(null)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono font-black text-lg">
                ${activeDetailRoom.buyIn}
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  Match Lobby #{activeDetailRoom.id}
                </span>
                <h2 className="text-xl font-extrabold text-white">{activeDetailRoom.title}</h2>
              </div>
            </div>

            {/* Invite Banner */}
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between mb-5">
              <div className="min-w-0 pr-2">
                <span className="block text-[10px] text-zinc-400 font-mono uppercase">Invite Link</span>
                <span className="text-[11px] font-bold text-emerald-400 font-mono truncate block">
                  {typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${activeDetailRoom.inviteCode}` : `?room=${activeDetailRoom.inviteCode}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyInviteLink(activeDetailRoom.inviteCode)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shrink-0 transition-colors"
              >
                {copiedCode === activeDetailRoom.inviteCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy</span>
              </button>
            </div>

            {/* Escrow Pot Breakdown */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 mb-5">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Escrow Pot & 5% Platform Spread Breakdown
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800">
                  <span className="block text-[10px] text-zinc-400 uppercase">Gross Pot</span>
                  <span className="text-sm font-bold text-white">${activeDetailRoom.totalPot.toFixed(2)}</span>
                </div>
                <div className="p-2 bg-zinc-950 rounded-xl border border-amber-500/20">
                  <span className="block text-[10px] text-amber-400 uppercase">5% Spread</span>
                  <span className="text-sm font-bold text-amber-400">-${activeDetailRoom.platformFee.toFixed(2)}</span>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                  <span className="block text-[10px] text-emerald-400 uppercase">Net Prize Pool</span>
                  <span className="text-sm font-extrabold text-emerald-400">${activeDetailRoom.netPrizePool.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3 flex items-center justify-between">
                <span>Joined Friends ({activeDetailRoom.players.length}/{activeDetailRoom.maxPlayers})</span>
                <span className="text-[10px] font-normal text-zinc-500">Buy-ins locked in Escrow</span>
              </h4>

              <div className="space-y-2">
                {activeDetailRoom.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={player.avatar}
                        alt={player.name}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                      />
                      <div>
                        <span className="block text-xs font-bold text-white">
                          {player.name} {player.isCurrentUser && '(You)'}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {player.isHost ? 'Lobby Host' : 'Participant'}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase font-mono">
                      $ Locked in Escrow
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (activeDetailRoom.status === 'waiting') {
                    startMatchLobby(activeDetailRoom.id);
                  } else {
                    enterMatchArena(activeDetailRoom);
                  }
                  setSelectedRoomId(null);
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Enter Arcade Arena</span>
              </button>

              <button
                type="button"
                onClick={() => simulateFriendRuns(activeDetailRoom.id)}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Settle Match & Finalize Pot</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Buy-in Amount ($)</label>
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
                        ${amt}
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
                      <span>Host Buy-In (Locked in Escrow):</span>
                      <span className="font-bold text-white">${buyIn.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>Total Expected Pot ({maxPlayers} players):</span>
                      <span className="font-bold text-white">${(buyIn * maxPlayers).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>Platform Spread (5% Fee):</span>
                      <span>-${(buyIn * maxPlayers * 0.05).toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm text-emerald-400 font-extrabold">
                      <span>Net Prize Pool:</span>
                      <span>${(buyIn * maxPlayers * 0.95).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                  <ShieldCheck className="w-4 h-4 inline mr-1" />
                  Your $ {buyIn.toFixed(2)} buy-in will be held securely in Escrow until match completion.
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
                    className="w-2/3 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/25"
                  >
                    Create Lobby & Generate Link
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
