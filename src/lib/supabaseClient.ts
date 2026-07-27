import { createClient } from '@supabase/supabase-js';

declare global {
  interface ImportMetaEnv {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://krhtlurqdfkzbxwrdowt.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_KhKwagFYjzyzh8fSg7mlEA_4ze5wKUw';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to sync user metadata to Supabase 'profiles' table
export async function syncUserProfileToSupabase(user: {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
}) {
  if (!supabase) return null;

  const cleanName = user.full_name || user.email?.split('@')[0] || 'Contender';
  const handle = '@' + cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '') + '_' + user.id.slice(0, 4);

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        display_name: cleanName,
        avatar_url: user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.id)}`,
        handle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    console.warn('Profile sync note:', error.message);
  }

  return data;
}

export async function fetchUserProfileFromSupabase(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Profile fetch note:', error.message);
  }
  return data;
}
