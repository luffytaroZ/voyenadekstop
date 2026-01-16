import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Custom storage adapter for Electron
const createElectronStorage = () => ({
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const value = await window.electronAPI.store.get(`supabase:${key}`);
      return value as string | null;
    }
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.store.set(`supabase:${key}`, value);
    } else {
      localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.store.delete(`supabase:${key}`);
    } else {
      localStorage.removeItem(key);
    }
  },
});

// Create Supabase client
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage: createElectronStorage(),
      detectSessionInUrl: false,
    },
  }
);

// Log configuration status
if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Not configured. Running in offline/local mode.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable sync.'
  );
}
