// SuppVerse BD — Supabase client config
// Shared across all SV-Web pages. Load via CDN script tag before this file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
// <script src="assets/js/supabase-config.js"></script>

const SUPABASE_URL = 'https://tlkoxltugvfwxmnrthvr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0dItRk9UZ40ZpwPqJRoOBw_6MyRFU6z';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Remember Me handling ----
// Supabase always persists the session in localStorage so the client works
// consistently across pages. When the user unchecks "Remember me" at login,
// we flag the session as non-persistent; any other page load checks this flag
// and signs the user out if the browser was fully closed and reopened
// (sessionStorage does not survive a real browser close, localStorage does).
const SV_REMEMBER_FLAG = 'sv-remember-session';

function svSetRememberChoice(remember) {
  if (remember) {
    localStorage.removeItem(SV_REMEMBER_FLAG);
    sessionStorage.removeItem(SV_REMEMBER_FLAG);
  } else {
    // mark this login as session-only: sessionStorage flag proves the tab
    // is still the same browser session; localStorage flag survives to be
    // checked next time the site loads (even after the browser fully closes)
    localStorage.setItem(SV_REMEMBER_FLAG, 'pending-check');
    sessionStorage.setItem(SV_REMEMBER_FLAG, '1');
  }
}

// Call once per page load (done automatically below). If the login was
// marked session-only and this is a fresh browser session (no sessionStorage
// flag survived), the previous login should not persist — sign out.
async function svEnforceRememberChoice() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) return;

  // If there's a Supabase session in localStorage but no matching
  // sessionStorage flag AND the user previously chose "don't remember me",
  // localStorage still won't have anything to check against post-close —
  // so we use a lightweight localStorage marker instead, checked against
  // sessionStorage's survival.
  const wasSessionOnly = localStorage.getItem(SV_REMEMBER_FLAG) === 'pending-check';
  if (wasSessionOnly && !sessionStorage.getItem(SV_REMEMBER_FLAG)) {
    // browser was closed and reopened after a "don't remember" login — sign out
    await sbClient.auth.signOut();
    localStorage.removeItem(SV_REMEMBER_FLAG);
  }
}
svEnforceRememberChoice();

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
    if (customer.avatar_url) {
      btn.innerHTML = '<img src="' + customer.avatar_url + '" class="hcart-avatar-img" alt="">';
    } else {
      const initial = (customer.full_name || customer.email || '?').trim().charAt(0).toUpperCase();
      btn.innerHTML = '<span class="hcart-initial">' + initial + '</span>';
    }
    btn.classList.add('is-logged-in');
    btn.onclick = () => { window.location.href = 'profile.html'; };
  } else {
    btn.classList.remove('is-logged-in');
    btn.onclick = () => { window.location.href = 'login.html'; };
  }
}
