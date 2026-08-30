// SuppVerse BD — Supabase client config
// Shared across all SV-Web pages. Load via CDN script tag before this file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
// <script src="assets/js/supabase-config.js"></script>

const SUPABASE_URL = 'https://tlkoxltugvfwxmnrthvr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0dItRk9UZ40ZpwPqJRoOBw_6MyRFU6z';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Shared auth helpers used across pages ----

// Returns the current logged-in session's Supabase auth user, or null.
async function svGetCurrentUser() {
  const { data: { user } } = await sbClient.auth.getUser();
  return user;
}

// Returns the customers row linked to the current auth user, or null.
async function svGetCurrentCustomer() {
  const user = await svGetCurrentUser();
  if (!user) return null;
  const { data, error } = await sbClient
    .from('customers')
    .select('*')
    .eq('auth_id', user.id)
    .single();
  if (error) {
    console.error('svGetCurrentCustomer error:', error.message);
    return null;
  }
  return data;
}

// Signs the user out and redirects to login.
async function svSignOut(redirectTo = 'login.html') {
  await sbClient.auth.signOut();
  window.location.href = redirectTo;
}
