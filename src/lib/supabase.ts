export { supabase, isSupabaseConfigured } from './supabaseClient';
import { supabase } from './supabaseClient';

/** Starts the Google OAuth redirect. Requires the Google provider to be enabled in Supabase. */
export async function signInWithProvider(provider: 'google' = 'google') {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
  });
  if (error) throw error;
  return data;
}

/** Signs in without an account. Requires "Anonymous sign-ins" to be enabled in Supabase. */
export async function signInAsGuest() {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    if (/anonymous/i.test(error.message)) {
      throw new Error('Guest play is turned off. Enable "Anonymous sign-ins" in Supabase (Authentication > Sign In / Providers), or sign up with email.');
    }
    throw error;
  }
  return data;
}
