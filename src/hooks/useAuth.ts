import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

/**
 * Email/password auth helpers. Session state and profile creation live in AppContext
 * (profiles are created server-side by the ensure_profile() database function).
 */
export function useAuth() {
  const requireClient = () => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    return supabase;
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await requireClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName || email.split('@')[0] },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await requireClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    if (error) throw error;
  };

  return { isSupabaseConfigured, signUpWithEmail, signInWithEmail, requestPasswordReset };
}
