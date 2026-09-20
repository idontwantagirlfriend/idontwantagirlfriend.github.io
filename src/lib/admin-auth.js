// Admin gate backed by Supabase Auth. The server verifies the password and
// issues a session; RLS enforces admin writes at the database, so this
// module is UI gating only — bypassing it grants nothing.
import { supabase } from "@/integrations/supabase/client";

// Cached so isLoggedIn() stays synchronous; kept current by onAuthStateChange
// (covers INITIAL_SESSION, sign-in/out, token refresh, and cross-tab sync).
let session = null;
const listeners = new Set();

supabase.auth.onAuthStateChange((_event, nextSession) => {
  session = nextSession;
  listeners.forEach((listener) => listener(Boolean(session)));
});

export const adminAuth = {
  // Resolves once the persisted session (if any) has been read from storage.
  ready: supabase.auth.getSession().then(({ data }) => { session = data.session; }),
  isLoggedIn: () => Boolean(session),
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    session = data.session || null;
    return Boolean(!error && session);
  },
  async logout() {
    await supabase.auth.signOut();
    session = null; // SIGNED_OUT via onAuthStateChange also clears this
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
