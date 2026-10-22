import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      // Admin sessions remain in memory only; participant sessions use the
      // separate HttpOnly cookie handled by the server API.
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
