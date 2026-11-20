import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, Crown, LogOut, Play, ShieldCheck, Trophy, Users, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GAMES_LIST } from '../../data/initialData';
import { MatchRoom } from '../../types';
import { cr, inviteUrl, shareInvite } from '../../utils/credits';
import { canResume, loadCheckpoint } from '../../games/runCheckpoint';
import Sheet from '../ui/Sheet';
import GameCover from '../ui/GameCover';
import StatusPill from './StatusPill';

// Last moment a run can still come in (begin window + game time + submit grace, see 002/006).
// After that, if the match still can't finish, players can ask for a refund.
const BEGIN_WINDOW_SECONDS = 120;
const SUBMIT_GRACE_SECONDS = 60;

const LobbyDetailModal: React.FC<{ room: MatchRoom; onClose: () => void }> = ({ room, onClose }) => {
  const { user, joinMatch, leaveMatch, togglePlayerReady, startMatchLobby, enterMatchArena, requestRefund, ackRefund, showToast } = useApp();
  const [reason, setReason] = useState('');
  const [askingRefund, setAskingRefund] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const game = GAMES_LIST.find((g) => g.id === room.gameId);
  const me = room.players.find((p) => p.isCurrentUser);
  const isHost = room.hostId === user.id;
  const notReady = room.players.filter((p) => !p.isReady).length;
  const canStart = isHost && room.status === 'waiting' && room.players.length >= 2 && notReady === 0;
  const pending = room.players.filter((p) => p.score === undefined).length;

  const settleAt = room.startedAt ? new Date(room.startedAt).getTime() + (BEGIN_WINDOW_SECONDS + room.durationSeconds + SUBMIT_GRACE_SECONDS) * 1000 : null;
  const secondsToSettle = settleAt ? Math.max(0, Math.ceil((settleAt - now) / 1000)) : null;

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    const result = await shareInvite(room.inviteCode, room.title);
    if (result === 'copied') {
      setCopied(true);
      showToast('Invite link copied. Send it to your friends!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } else if (result === 'failed') {
      showToast(`Couldn't copy automatically. Share this code instead: ${room.inviteCode}`, 'warning');
    }
  };

  const ranked = [...room.players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const playersToShow = room.status === 'completed' || room.status === 'under_review' ? ranked : room.players;

  return (
    <Sheet
      open
      onClose={onClose}
      banner={
        <GameCover gameId={room.gameId} className="h-36 sm:h-44">
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/30 to-transparent" />
          <div className="absolute left-5 bottom-3 flex items-center gap-2">
            <StatusPill room={room} userId={user.id} />
            <span className="px-2 py-1 rounded-md bg-black/50 backdrop-blur text-[11px] font-bold text-white">{cr(room.buyIn)} buy-in</span>
          </div>
        </GameCover>
      }
      eyebrow={`${game?.title} · #${room.id}`}
      title={room.title}
    >
      <div className="pt-1">

        {/* Invite */}
        {room.status === 'waiting' && (
          <div className="p-3 pl-4 rounded-2xl bg-gradient-to-r from-emerald-400/15 to-emerald-400/5 border border-emerald-300/20 flex items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-emerald-200">Invite friends · code {room.inviteCode}</span>
              <span className="text-xs text-zinc-400 truncate block">{inviteUrl(room.inviteCode)}</span>
            </div>
            <button
              type="button"
              onClick={onShare}
              className="h-10 px-4 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-sm font-bold flex items-center gap-1.5 shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        )}

        {/* Pot */}
        <div className="flex items-end justify-between rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 mb-5">
          <div>
            <span className="block text-xs text-zinc-400">{room.distribution === 'top_two' ? 'Prize · split 70/30' : 'Winner gets'}</span>
            <span className="text-3xl font-extrabold text-emerald-300 tabular-nums">{cr(room.netPrizePool)}</span>
          </div>
          <div className="text-right text-xs text-zinc-500 tabular-nums leading-relaxed">
            pot {cr(room.totalPot)}
            <br />
            5% fee −{cr(room.platformFee)}
          </div>
        </div>

        {/* Players */}
        <div className="mb-6">
          <h4 className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Players {room.players.length}/{room.maxPlayers}</span>
            {room.status === 'waiting' && <span className="text-xs text-zinc-500">Buy-ins held until it ends</span>}
          </h4>

          <div className="space-y-2">
            {playersToShow.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${
                  p.isCurrentUser ? 'bg-emerald-400/[0.07] border-emerald-300/25' : 'bg-white/[0.03] border-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {room.status === 'completed' && (
                    <span className={`w-5 text-center font-extrabold text-sm ${p.rank === 1 ? 'text-amber-300' : 'text-zinc-500'}`}>{p.rank}</span>
                  )}
                  <img src={p.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-bold text-white truncate">
                      {p.name} {p.isCurrentUser && <span className="text-zinc-400 font-normal">(you)</span>}
                      {p.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                    </span>
                    <span className="text-xs text-zinc-500">{p.isHost ? 'Host' : 'Player'}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 text-sm font-bold tabular-nums">
                  {room.status === 'waiting' &&
                    (p.isReady ? (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Ready</span>
                    ) : (
                      <span className="text-zinc-500">Not ready</span>
                    ))}
                  {(room.status === 'in_progress' || room.status === 'under_review') &&
                    (p.score !== undefined ? (
                      <span className="text-emerald-400">{p.score.toLocaleString()} pts</span>
                    ) : (
                      <span className="text-zinc-500 italic font-normal">playing...</span>
                    ))}
                  {room.status === 'completed' && (
                    <div>
                      <span className="block text-white">{(p.score ?? 0).toLocaleString()} pts</span>
                      {(p.payout ?? 0) > 0 && <span className="text-amber-400">+{cr(p.payout ?? 0)}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {room.status === 'waiting' && !me && (
            <button
              type="button"
              disabled={busy || room.players.length >= room.maxPlayers}
              onClick={() => run(() => joinMatch(room.id))}
              className="w-full h-12 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm disabled:opacity-50"
            >
              {room.players.length >= room.maxPlayers ? 'Lobby full' : `Join for ${cr(room.buyIn)}`}
            </button>
          )}

          {room.status === 'waiting' && me && (
            <>
              {isHost ? (
                <button
                  type="button"
                  disabled={busy || !canStart}
                  onClick={() => run(() => startMatchLobby(room.id))}
                  className="w-full h-12 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2 disabled:bg-white/[0.06] disabled:text-zinc-400"
                >
                  {room.players.length < 2 ? (
                    <><Users className="w-4 h-4" /> Waiting for a friend to join</>
                  ) : notReady > 0 ? (
                    <><Clock className="w-4 h-4" /> Waiting for {notReady} to ready up</>
                  ) : (
                    <><Play className="w-5 h-5 fill-current" /> Start match</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => togglePlayerReady(room.id))}
                  className={`w-full h-12 rounded-xl font-extrabold text-sm transition-colors disabled:opacity-50 ${
                    me.isReady ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                  }`}
                >
                  {me.isReady ? "Ready! Waiting for host to start (tap to undo)" : "I'm ready"}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!isHost || window.confirm('Cancel this lobby? Everyone gets their buy-in back.')) run(() => leaveMatch(room.id));
                }}
                className="w-full h-11 rounded-xl bg-white/[0.06] hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isHost ? 'Cancel lobby & refund everyone' : 'Leave lobby & get refund'}
              </button>
            </>
          )}

          {room.status === 'in_progress' && me && me.score === undefined && !room.myRun && (
            <button
              type="button"
              onClick={() => {
                onClose();
                enterMatchArena(room);
              }}
              className="w-full h-12 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" /> Play your run now
            </button>
          )}

          {room.status === 'in_progress' && me && me.score === undefined && room.myRun === 'started' && (() => {
            const cp = loadCheckpoint(room.id, user.id);
            if (cp && canResume(cp)) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    enterMatchArena(room);
                  }}
                  className="w-full h-12 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-sm flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" /> Resume my run
                </button>
              );
            }
            return (
              <div className="p-3 rounded-xl bg-amber-400/[0.06] border border-amber-300/25 text-center text-xs text-amber-200">
                {cp
                  ? "Your run was cut off and there's no time left to finish it. The moves you made are submitted for scoring when the game timer runs out."
                  : "Your run was started on another device or browser. Finish it there; if it isn't finished in time it counts as 0."}
              </div>
            );
          })()}

          {room.status === 'in_progress' && me && me.score !== undefined && (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center text-xs text-zinc-300 space-y-1">
              <p>
                Your score is in. Waiting for {pending} more player{pending === 1 ? '' : 's'}.
              </p>
              <p className="text-[11px] text-zinc-500">The match ends when everyone has finished: win, lose or draw.</p>
            </div>
          )}

          {/* A match that can't finish: refund only with a reason, every player's OK and an admin's approval. */}
          {room.status === 'in_progress' && me && (() => {
            const refund = room.refund;
            const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? 'A player';
            if (refund?.status === 'pending') {
              const waitingFor = room.players.filter((p) => !refund.ackedBy.includes(p.id));
              const iAcked = refund.ackedBy.includes(user.id);
              return (
                <div className="p-3 rounded-xl bg-indigo-400/[0.06] border border-indigo-300/25 text-xs space-y-2">
                  <p className="font-bold text-indigo-300">Refund requested by {refund.requestedBy === user.id ? 'you' : name(refund.requestedBy)}</p>
                  <p className="text-zinc-300 italic break-words">"{refund.reason}"</p>
                  <ul className="text-[11px] space-y-0.5">
                    {room.players.map((p) => (
                      <li key={p.id} className={refund.ackedBy.includes(p.id) ? 'text-emerald-300' : 'text-zinc-500'}>
                        {refund.ackedBy.includes(p.id) ? '✓' : '…'} {p.isCurrentUser ? 'You' : p.name}
                        {refund.ackedBy.includes(p.id) ? ' acknowledged' : ' hasn\'t acknowledged yet'}
                      </li>
                    ))}
                  </ul>
                  {!iAcked ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => ackRefund(room.id))}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50"
                    >
                      I acknowledge: refund everyone
                    </button>
                  ) : (
                    <p className="text-[11px] text-zinc-400">
                      {waitingFor.length
                        ? `Waiting for ${waitingFor.map((p) => p.name).join(', ')} to acknowledge. Then an admin reviews it.`
                        : 'Everyone acknowledged. Waiting for an admin to approve the refund.'}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-500">If approved, every player gets their buy-in back in full and nobody wins.</p>
                </div>
              );
            }
            // Refunds can be asked for once the time to play has run out and the match still can't finish.
            if (secondsToSettle === null || secondsToSettle > 0) return null;
            return (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs space-y-2">
                {refund?.status === 'rejected' && (
                  <p className="text-amber-200">
                    An admin turned down the last refund request{refund.adminNote ? `: "${refund.adminNote}"` : '.'}
                  </p>
                )}
                <p className="text-zinc-300">
                  Time to play is up but not everyone finished, so this match can't end on its own. If something went wrong,
                  you can ask for a refund: every player has to acknowledge it, then an admin approves it.
                </p>
                {!askingRefund ? (
                  <button
                    type="button"
                    onClick={() => setAskingRefund(true)}
                    className="w-full h-11 rounded-xl bg-white/[0.06] hover:bg-white/10 text-zinc-200 font-bold text-xs"
                  >
                    Ask for a refund
                  </button>
                ) : (
                  <>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value.slice(0, 500))}
                      rows={3}
                      placeholder="What went wrong? (e.g. my game showed an error and never started)"
                      className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAskingRefund(false)}
                        className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy || reason.trim().length < 10}
                        onClick={() =>
                          run(async () => {
                            if (await requestRefund(room.id, reason.trim())) {
                              setAskingRefund(false);
                              setReason('');
                            }
                          })
                        }
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50"
                      >
                        Send request
                      </button>
                    </div>
                    {reason.trim().length < 10 && <p className="text-[10px] text-zinc-500">Give a reason of at least 10 characters.</p>}
                  </>
                )}
              </div>
            );
          })()}

          {room.status === 'completed' && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
              <Trophy className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-xs font-bold text-emerald-300">
                {me && me.rank === 1 && (me.payout ?? 0) > 0
                  ? room.players.filter((p) => p.rank === 1).length > 1
                    ? 'You tied for first and split the prize!'
                    : 'You won this match!'
                  : `${room.winnerName} won this match`}
              </p>
            </div>
          )}

          {room.status === 'under_review' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center text-xs text-amber-200">
              <ShieldCheck className="w-4 h-4 inline mr-1" />
              A winning run was flagged by our fair-play checks. Payouts are on hold until it's reviewed; if the
              match is voided, every buy-in is refunded in full.
            </div>
          )}

          {room.status === 'cancelled' && (
            <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-center text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 inline mr-1" />
              {room.refund?.status === 'approved' ? (
                <>
                  Refund approved by an admin. Everyone got their buy-in back.
                  <span className="block mt-1 italic text-zinc-500 break-words">Reason: "{room.refund.reason}"</span>
                  {room.refund.adminNote && <span className="block italic text-zinc-500 break-words">Admin: "{room.refund.adminNote}"</span>}
                </>
              ) : (
                'This match was cancelled and everyone was refunded.'
              )}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default LobbyDetailModal;
