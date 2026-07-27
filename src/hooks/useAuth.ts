import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  syncUserProfileToSupabase,
  fetchUserProfileFromSupabase,
} from '../lib/supabaseClient';

export interface SyncedProfile {
  id: string;
  email?: string;
  display_name?: string;
  handle?: string;
  avatar_url?: string;
  updated_at?: string;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SyncedProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const syncUserProfile = async (authUser: User) => {
    try {
      const meta = authUser.user_metadata || {};
      const fullName =
        meta.full_name ||
        meta.name ||
        meta.displayName ||
        authUser.email?.split('@')[0] ||
        'Contender';
      const avatarUrl =
        meta.avatar_url ||
        meta.picture ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authUser.id)}`;

      const synced = await syncUserProfileToSupabase({
        id: authUser.id,
        email: authUser.email,
        full_name: fullName,
        avatar_url: avatarUrl,
      });

      if (synced) {
        setProfile(synced);
      } else {
        const fetched = await fetchUserProfileFromSupabase(authUser.id);
        if (fetched) setProfile(fetched);
      }
    } catch (err: any) {
      console.warn('Failed to sync profile:', err);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Fetch initial session & sync profile
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setError(error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        syncUserProfile(session.user);
      }
      setLoading(false);
    });

    // Listen to Auth State Changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        syncUserProfile(session.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    setError(null);
    if (!supabase) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName || email.split('@')[0],
        },
      },
    });
    if (error) {
      setError(error.message);
      throw error;
    }
    if (data.user) {
      await syncUserProfile(data.user);
    }
    return data;
  };

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    if (!supabase) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      throw error;
    }
    if (data.user) {
      await syncUserProfile(data.user);
    }
    return data;
  };

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) setError(error.message);
    }
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return {
    session,
    user,
    profile,
    loading,
    error,
    isAuthenticated: Boolean(user || session),
    isSupabaseConfigured,
    signUpWithEmail,
    signInWithEmail,
    signOut,
  };
}
