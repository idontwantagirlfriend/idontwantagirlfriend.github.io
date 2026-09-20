import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check your .env file');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Auth options are pinned explicitly: persistSession/autoRefreshToken match
// the defaults (session in localStorage, refreshed while a tab is open) but
// are stated so future default drift can't silently change behavior.
// detectSessionInUrl stays off — the admin logs in via password grant only,
// there are no session-in-URL (magic link / OAuth) flows. Once signed in,
// this shared client attaches the access token to every PostgREST call,
// which is what lets RLS enforce admin writes.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
