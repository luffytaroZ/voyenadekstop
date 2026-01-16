import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';

// Types
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

// Context
const AuthContext = createContext<AuthContextValue | null>(null);

// Profile helpers
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}

async function createProfile(user: User): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      full_name: (user.user_metadata?.full_name as string) || '',
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    return null;
  }
  return data;
}

async function getOrCreateProfile(user: User): Promise<Profile | null> {
  const existing = await fetchProfile(user.id);
  if (existing) return existing;
  return createProfile(user);
}

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('signedOut');
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        getOrCreateProfile(session.user).then(setProfile);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const profile = await getOrCreateProfile(session.user);
          setProfile(profile);
          setStatus('signedIn');
        } else {
          setProfile(null);
          setStatus('signedOut');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase not configured' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  // Sign up
  const signUp = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase not configured' };
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setStatus('signedOut');
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase not configured' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      return { error: error.message };
    }

    // Refresh profile
    const updated = await fetchProfile(user.id);
    setProfile(updated);
    return { error: null };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        status,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
