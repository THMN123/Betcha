import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, RefreshCw, Ban } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../context/AppContext';
import { GAMES_LIST } from '../../data/initialData';
import { cr } from '../../utils/credits';

interface QueueItem {
  match: { id: string; title: string; game_id: string; total_pot_cents: number; started_at: string };
  players: {
    player_id: string;
    name: string;
    score: number;
    rank: number;
    payout_cents: number;
    review_status: string;
    flags: string[];
    metrics: Record<string, number>;
    matches_played: number;
    account_created: string;
  }[];
}

const FLAG_TEXT: Record<string, string> = {
  near_perfect_play: 'Within 10% of the best possible run for this seed',
  superhuman_input_rate: 'More inputs per second than a person can make',
  superhuman_reaction: 'Reaction times faster than human',
  score_above_review_threshold: 'Score above the review threshold set in settings',
};

/** Admin-only: matches held because a winning run was flagged, plus a ledger integrity check. */
const AdminReviewPanel: React.FC = () => {
  const { showToast } = useApp();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [checks, setChecks] = useState<{ check_name: string; ok: boolean; detail: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [q, c] = await Promise.all([supabase.rpc('admin_review_queue'), supabase.rpc('admin_ledger_check')]);
    if (q.error) showToast(q.error.message, 'error');
    if (c.error) showToast(c.error.message, 'error');
    setQueue(Array.isArray(q.data) ? (q.data as QueueItem[]) : []);
    setChecks(Array.isArray(c.data) ? c.data : c.data ? [c.data] : []);
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (matchId: string, decision: 'release' | 'void' | 'disqualify', players?: string[]) => {
    if (!supabase) return;
    const label = decision === 'release' ? 'pay out as scored' : decision === 'void' ? 'void and refund everyone' : 'disqualify the flagged player(s)';
    const note = window.prompt(`Confirm: ${label} for ${matchId}. Add a note for the record:`);
    if (note === null) return;
    setBusy(matchId);
    const { error } = await supabase.rpc('resolve_review', {
      p_match_id: matchId,
      p_decision: decision,
      p_players: players ?? null,
      p_note: note || null,
    });
    setBusy(null);
    if (error) showToast(error.message, 'error');
    else showToast(`Match ${matchId}: ${decision} done.`, 'success');
    load();
  };

  return (
    <div className="rounded-2xl bg-zinc-900 border border-amber-500/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Admin: fair-play review
        </h3>
        <button onClick={load} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
        {checks.map((c) => (
          <div key={c.check_name} className={`p-2 rounded-lg border ${c.ok ? 'border-emerald-500/30 text-emerald-300' : 'border-rose-500/50 text-rose-300'}`}>
            {c.ok ? '✓' : '✗'} {c.check_name}
            {!c.ok && <span className="block">{c.detail}</span>}
          </div>
        ))}
      </div>

      {queue === null ? (
        <p className="text-xs text-zinc-500">Loading...</p>
      ) : queue.length === 0 ? (
        <p className="text-xs text-zinc-400">No matches waiting for review.</p>
      ) : (
        queue.map(({ match, players }) => {
          const flagged = players.filter((p) => p.review_status === 'flagged').map((p) => p.player_id);
          return (
            <div key={match.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-white">
                  {match.title} <span className="text-zinc-500 font-mono">#{match.id}</span>
                </span>
                <span className="text-zinc-400">
                  {GAMES_LIST.find((g) => g.id === match.game_id)?.title} · pot {cr(match.total_pot_cents / 100)}
                </span>
              </div>
              {players.map((p) => (
                <div key={p.player_id} className={`p-2 rounded-lg text-[11px] ${p.review_status === 'flagged' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-zinc-900'}`}>
                  <div className="flex justify-between">
                    <span className="text-white font-bold">
                      #{p.rank} {p.name}{' '}
                      <span className="text-zinc-500 font-normal">
                        ({p.matches_played} matches, joined {new Date(p.account_created).toLocaleDateString()})
                      </span>
                    </span>
                    <span className="font-mono text-zinc-300">
                      {p.score} pts · {cr((p.payout_cents ?? 0) / 100)}
                    </span>
                  </div>
                  {p.flags?.length > 0 && (
                    <ul className="mt-1 text-amber-200 list-disc list-inside">
                      {p.flags.map((f) => (
                        <li key={f}>{FLAG_TEXT[f] ?? f}</li>
                      ))}
                    </ul>
                  )}
                  {p.metrics && Object.keys(p.metrics).length > 0 && (
                    <p className="mt-1 font-mono text-[10px] text-zinc-500 break-all">
                      {Object.entries(p.metrics).map(([k, v]) => `${k}=${v}`).join('  ')}
                    </p>
                  )}
                </div>
              ))}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button disabled={busy === match.id} onClick={() => resolve(match.id, 'release')}
                  className="py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Release
                </button>
                <button disabled={busy === match.id || flagged.length === 0} onClick={() => resolve(match.id, 'disqualify', flagged)}
                  className="py-2 rounded-lg bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                  <Ban className="w-3.5 h-3.5" /> Disqualify
                </button>
                <button disabled={busy === match.id} onClick={() => resolve(match.id, 'void')}
                  className="py-2 rounded-lg bg-zinc-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> Void
                </button>
              </div>
            </div>
          );
        })
      )}
      <p className="text-[10px] text-zinc-500">
        Release pays out as scored. Disqualify sets the flagged players' scores to 0 and pays the rest. Void refunds every buy-in in full.
      </p>
    </div>
  );
};

export default AdminReviewPanel;
