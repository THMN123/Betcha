import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ShieldCheck,
  Gamepad2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Swords,
  Trophy,
  CheckCircle2,
  Mail,
  User,
  Zap,
  AlertCircle,
} from 'lucide-react';
import MorphingHeading from '../common/MorphingHeading';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../context/AppContext';

export const AuthLanding: React.FC = () => {
  const { loginWithEmail, showToast } = useApp();
  const { signInWithEmail, signUpWithEmail, isSupabaseConfigured } = useAuth();
  const [step, setStep] = useState<'welcome' | 'auth'>('welcome');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessInfo(null);

    if (!email || !email.includes('@')) {
      setAuthError('Please enter a valid email address');
      return;
    }

    if (!password || password.length < 6) {
      setAuthError('Password is required and must be at least 6 characters long');
      return;
    }

    if (authMode === 'signup' && !displayName.trim()) {
      setAuthError('Player handle / display name is required for registration');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        if (authMode === 'signup') {
          // 1. Create user account in Supabase
          await signUpWithEmail(email, password, displayName);
          
          // 2. Instantly redirect to Sign In tab
          setAuthMode('signin');

          // 3. Set the prominent notification message requested by user
          setSuccessInfo('Check your email inbox for the Supabase confirmation link.');

          // 4. Attempt immediate sign in (if Supabase email confirmation is disabled, user logs in right away)
          try {
            await signInWithEmail(email, password);
            showToast('Account created and signed in successfully!', 'success');
          } catch (signInErr: any) {
            const msg = signInErr?.message || '';
            if (msg.toLowerCase().includes('email not confirmed')) {
              setAuthError('Email not confirmed yet. Check your email inbox for the Supabase confirmation link.');
              showToast('Check your email inbox for the Supabase confirmation link.', 'info');
            } else {
              showToast('Account created! Please sign in with your credentials.', 'success');
            }
          }
        } else {
          // Sign In
          await signInWithEmail(email, password);
          showToast('Signed in successfully via Supabase!', 'success');
        }
      } else {
        setAuthError('Supabase is not connected. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to environment variables to store users in Supabase.');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setAuthError('Email not confirmed yet. Check your email inbox for the Supabase confirmation link.');
      } else {
        setAuthError(msg || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden relative select-none font-sans antialiased">
      {/* Dynamic Cyber Neon Glow Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.25, 0.4, 0.25],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.35, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-1/2 -right-32 w-[550px] h-[550px] bg-indigo-600/20 rounded-full blur-[160px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.3, 0.15],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-32 left-1/3 w-[450px] h-[450px] bg-teal-500/15 rounded-full blur-[130px]"
        />

        {/* Floating Background Graphics */}
        <motion.div
          animate={{
            y: [-12, 12, -12],
            rotate: [-6, 6, -6],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-16 left-6 sm:left-20 opacity-15 sm:opacity-25"
        >
          <div className="p-6 rounded-3xl bg-zinc-900/60 border border-emerald-500/30 backdrop-blur-md shadow-2xl">
            <Gamepad2 className="w-16 h-16 sm:w-24 sm:h-24 text-emerald-400" />
          </div>
        </motion.div>

        <motion.div
          animate={{
            y: [14, -14, 14],
            rotate: [8, -8, 8],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="absolute bottom-20 right-6 sm:right-20 opacity-15 sm:opacity-25"
        >
          <div className="p-6 rounded-3xl bg-zinc-900/60 border border-indigo-500/30 backdrop-blur-md shadow-2xl">
            <Trophy className="w-16 h-16 sm:w-24 sm:h-24 text-indigo-400" />
          </div>
        </motion.div>

        <motion.div
          animate={{
            scale: [0.95, 1.05, 0.95],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 right-1/4 opacity-10"
        >
          <Swords className="w-32 h-32 text-amber-400" />
        </motion.div>

        <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b0f_1px,transparent_1px),linear-gradient(to_bottom,#18181b0f_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Header Bar */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setStep('welcome')}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-600 p-0.5 shadow-lg shadow-emerald-500/25">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <span className="font-display font-black text-2xl tracking-wider text-white">
            BET<span className="text-emerald-400">CHA</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {step === 'auth' ? (
            <button
              type="button"
              onClick={() => setStep('welcome')}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center gap-2 transition-all shadow-md backdrop-blur-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shadow-sm backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>5% Escrow Vault</span>
            </span>
          )}
        </div>
      </header>

      {/* Single Screen Center Content */}
      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 flex flex-col justify-center items-center my-auto">
        <AnimatePresence mode="wait">
          {step === 'welcome' ? (
            /* STEP 1: Single Screen Showcase */
            <motion.div
              key="welcome-step"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35 }}
              className="text-center space-y-6 max-w-2xl w-full"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-emerald-500/30 text-xs font-mono text-emerald-400 shadow-xl backdrop-blur-md"
              >
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Play Games • Wager Skill • Win Cash</span>
              </motion.div>

              <div className="space-y-2">
                <MorphingHeading as="h1" glowColor="emerald" className="text-5xl sm:text-7xl font-black text-white tracking-tight block">
                  BETCHA
                </MorphingHeading>

                <p className="text-xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 tracking-tight leading-tight">
                  Play Arcade Games. Wager Skill. Win Real Cash.
                </p>
              </div>

              <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                Experience 60-second speed runs in Cyber Snake, 2048 & Neon Dodge. Wagers are secured in automated 5% escrow vaults and paid instantly to highest scorers.
              </p>

              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="pt-2"
              >
                <button
                  type="button"
                  onClick={() => setStep('auth')}
                  className="inline-flex items-center gap-3 px-10 py-4 sm:py-4.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-base sm:text-lg shadow-2xl shadow-emerald-500/40 transition-all group"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform stroke-[3]" />
                </button>
              </motion.div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-4 font-mono text-[11px] text-zinc-400">
                <span className="px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Instant Wallet Payouts
                </span>
                <span className="px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  100% Skill • No RNG
                </span>
                <span className="px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  Audited 5% Platform Spread
                </span>
              </div>
            </motion.div>
          ) : (
            /* STEP 2: Email Sign In & Registration Screen */
            <motion.div
              key="auth-step"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.3 }}
              className="max-w-md mx-auto w-full"
            >
              <div className="relative overflow-hidden rounded-3xl bg-zinc-900/95 border border-zinc-800 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-500" />

                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 p-0.5 shadow-xl shadow-emerald-500/25 mx-auto mb-3">
                    <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                      <Lock className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-white font-display tracking-tight">
                    {authMode === 'signup' ? 'Create Supabase Account' : 'Sign In to Betcha'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {authMode === 'signup'
                      ? 'Register your profile and wallet directly in Supabase database.'
                      : 'Enter your credentials to log into your Supabase account.'}
                  </p>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthError(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-all ${
                      authMode === 'signup'
                        ? 'bg-emerald-500 text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setAuthError(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-all ${
                      authMode === 'signin'
                        ? 'bg-emerald-500 text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                </div>

                {/* Supabase Connection Warning Badge if not configured */}
                {!isSupabaseConfigured && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-300 font-bold">Supabase Config Needed</strong>
                      Add <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-200">VITE_SUPABASE_URL</code> and <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-200">VITE_SUPABASE_ANON_KEY</code> to environment variables to write directly into Supabase.
                    </div>
                  </div>
                )}

                {/* Success Banner */}
                {successInfo && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{successInfo}</span>
                  </div>
                )}

                {/* Error Banner */}
                {authError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* Email & Password Form */}
                <form onSubmit={handleEmailAuth} className="space-y-3.5">
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-mono text-zinc-400 mb-1">
                        Player Handle / Display Name <span className="text-emerald-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="CyberSnakePro"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1">
                      Email Address <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="player@example.com"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1">
                      Password (Minimum 6 Characters) <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 fill-zinc-950" />
                    <span>
                      {isSubmitting
                        ? 'Processing...'
                        : authMode === 'signup'
                        ? 'Register Account'
                        : 'Sign In'}
                    </span>
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-[11px] text-zinc-500 text-center font-mono">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Direct Supabase Auth & PostgreSQL Row Security</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Bar */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 border-t border-zinc-900/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono shrink-0">
        <div>© 2026 BETCHA Cyber Arcade</div>
        <div className="flex items-center gap-3">
          <span>5% Escrow Spread</span>
          <span>•</span>
          <span>Instant Wallet Payouts</span>
        </div>
      </footer>
    </div>
  );
};

export default AuthLanding;
