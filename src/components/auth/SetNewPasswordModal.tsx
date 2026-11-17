import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../context/AppContext';

/** Shown after a player opens a password-reset email link (Supabase signs them in for this one purpose). */
const SetNewPasswordModal: React.FC = () => {
  const { passwordRecovery, finishPasswordRecovery, showToast } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!passwordRecovery) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("The passwords don't match.");
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    showToast('Password updated. You are signed in.', 'success');
    finishPasswordRecovery();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <form onSubmit={save} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-white font-black text-lg">
          <Lock className="w-5 h-5 text-emerald-400" /> Set a new password
        </div>
        <input
          type="password"
          autoFocus
          placeholder="New password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <input
          type="password"
          placeholder="Repeat new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm disabled:opacity-50">
          {busy ? 'Saving...' : 'Save new password'}
        </button>
      </form>
    </div>
  );
};

export default SetNewPasswordModal;
