import React, { useEffect, useState } from 'react';
import { Plus, Ticket } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import MatchTile from './MatchTile';
import { shareInvite } from '../../utils/credits';

type Tab = 'mine' | 'open' | 'history';

/** Matches: yours, open lobbies to join, and finished ones. */
const LobbiesView: React.FC = () => {
  const { rooms, joinMatch, setSelectedRoomId, user, showToast, openCreateMatch } = useApp();

  const mine = rooms.filter(
    (r) => (r.status === 'waiting' || r.status === 'in_progress' || r.status === 'under_review') && r.players.some((p) => p.isCurrentUser)
  );
  const open = rooms.filter((r) => r.status === 'waiting' && !r.players.some((p) => p.isCurrentUser));
  const history = rooms.filter((r) => (r.status === 'completed' || r.status === 'cancelled') && r.players.some((p) => p.isCurrentUser));

  const [tab, setTab] = useState<Tab>(mine.length ? 'mine' : 'open');
  // Land on what's relevant once data arrives.
  useEffect(() => {
    if (tab === 'open' && mine.length && !open.length) setTab('mine');
  }, [mine.length, open.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const share = async (code: string, title: string) => {
    const result = await shareInvite(code, title);
    if (result === 'copied') {
      setCopiedCode(code);
      showToast('Invite link copied. Send it to your friends!', 'success');
      setTimeout(() => setCopiedCode(null), 3000);
    } else if (result === 'failed') {
      showToast(`Couldn't copy automatically. Share this code instead: ${code}`, 'warning');
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'mine', label: 'Your matches', count: mine.length },
    { id: 'open', label: 'Open lobbies', count: open.length },
    { id: 'history', label: 'History', count: history.length },
  ];
  const list = tab === 'mine' ? mine : tab === 'open' ? open : history;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Matches</h1>
        <button
          type="button"
          onClick={() => openCreateMatch()}
          className="h-11 px-5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-extrabold text-sm flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Create
        </button>
      </div>

      {/* Join by code */}
      <form onSubmit={handleJoinByCode} className="flex items-center gap-2 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-emerald-400 pl-4 pr-1.5">
        <Ticket className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Invite code or link"
          aria-label="Invite code or link"
          className="flex-1 min-w-0 bg-transparent text-white text-sm placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!joinCode.trim() || joining}
          className="h-9 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-sm disabled:opacity-40 shrink-0"
        >
          {joining ? 'Joining...' : 'Join'}
        </button>
      </form>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 border-b border-white/[0.07] overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-3 sm:px-4 h-11 text-sm font-bold whitespace-nowrap flex items-center gap-2 ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              {t.label}
              <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center ${active ? 'bg-white text-zinc-950' : 'bg-white/10 text-zinc-400'}`}>
                {t.count}
              </span>
              {active && <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-base font-bold text-white">
            {tab === 'mine' ? "You're not in any match" : tab === 'open' ? 'No open lobbies' : 'No finished matches yet'}
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            {tab === 'history' ? 'Your results will show up here.' : 'Create a match and send the invite link to your friends.'}
          </p>
          {tab !== 'history' && (
            <button type="button" onClick={() => openCreateMatch()} className="mt-5 h-11 px-6 rounded-full bg-white text-zinc-950 font-extrabold text-sm">
              Create a match
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {list.map((room) => (
            <MatchTile
              key={room.id}
              room={room}
              userId={user.id}
              onOpen={() => setSelectedRoomId(room.id)}
              onJoin={() => joinMatch(room.id)}
              onShare={() => share(room.inviteCode, room.title)}
              shared={copiedCode === room.inviteCode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LobbiesView;
