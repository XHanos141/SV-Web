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

// Call on page load for any page with a header account/profile button.
// Pass the button's element id. If logged in: shows initials avatar, clicking
// goes to profile.html. If logged out: shows the default person icon, clicking
// goes to login.html (unchanged from current behavior).
async function svInitHeaderAuth(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  const customer = await svGetCurrentCustomer();

  if (customer) {
    const initial = (customer.full_name || customer.email || '?').trim().charAt(0).toUpperCase();
    btn.innerHTML = '<span class="hcart-initial">' + initial + '</span>';
    btn.classList.add('is-logged-in');
    btn.onclick = () => { window.location.href = 'profile.html'; };
  } else {
    btn.classList.remove('is-logged-in');
    btn.onclick = () => { window.location.href = 'login.html'; };
  }
}
