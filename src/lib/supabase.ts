export {
  supabase,
  isSupabaseConfigured,
  syncUserProfileToSupabase,
} from './supabaseClient';

export async function signInWithProvider(provider: 'google' = 'google') {
  const { supabase } = await import('./supabaseClient');
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
    return data;
  }
  return null;
}

