// SuppVerse BD — Supabase client config
// Shared across all SV-Web pages. Load via CDN script tag before this file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
// <script src="assets/js/supabase-config.js"></script>

const SUPABASE_URL = 'https://tlkoxltugvfwxmnrthvr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0dItRk9UZ40ZpwPqJRoOBw_6MyRFU6z';

// Guard against the Supabase CDN script failing to load (offline preview,
// blocked network, etc). Without this, window.supabase being undefined
// would throw here and abort the rest of this file — including the
// svInitHeaderAuth definition every page depends on.
let sbClient = null;
try {
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Supabase client failed to initialize:', e);
}

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
  if (!sbClient) return;
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
  if (!sbClient) return null;
  const { data: { user } } = await sbClient.auth.getUser();
  return user;
}

// Returns the customers row linked to the current auth user, or null.
// Hits the network every time — use svGetCurrentCustomerCached for anything
// UI-facing (header avatar, etc) to avoid a visible load delay.
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

// ---- Customer cache (instant header avatar, no per-page network wait) ----
// sessionStorage survives page navigations within the same tab session but
// clears on full browser close, matching the "Remember Me" trust boundary
// already used above. Cache is per-browser-tab, never shared cross-device.
const SV_CUSTOMER_CACHE_KEY = 'sv-customer-cache';

function svGetCachedCustomer() {
  try {
    const raw = sessionStorage.getItem(SV_CUSTOMER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function svSetCachedCustomer(customer) {
  try {
    if (customer) {
      sessionStorage.setItem(SV_CUSTOMER_CACHE_KEY, JSON.stringify(customer));
    } else {
      sessionStorage.removeItem(SV_CUSTOMER_CACHE_KEY);
    }
  } catch (e) {
    // sessionStorage unavailable (private browsing etc) — fail silently,
    // callers fall back to the network fetch every time.
  }
}

// Cache-first customer lookup: returns the cached row instantly if present
// (synchronously fast, avoids header flicker), while always kicking off a
// fresh network fetch in the background to keep the cache correct. Pass a
// callback to get notified if the fresh data differs from the cached copy.
async function svGetCurrentCustomerCached(onRefresh) {
  const cached = svGetCachedCustomer();

  const refresh = svGetCurrentCustomer().then(fresh => {
    svSetCachedCustomer(fresh);
    if (onRefresh && JSON.stringify(fresh) !== JSON.stringify(cached)) {
      onRefresh(fresh);
    }
    return fresh;
  });

  if (cached) return cached;
  return refresh;
}

// Signs the user out and redirects to login.
async function svSignOut(redirectTo = 'login.html') {
  svSetCachedCustomer(null);
  if (sbClient) await sbClient.auth.signOut();
  window.location.href = redirectTo;
}

// Call on page load for any page with a header account/profile button.
// Pass the button's element id. If logged in: shows initials avatar, clicking
// goes to profile.html. If logged out: shows the default person icon, clicking
// goes to login.html (unchanged from current behavior).
const SV_DEFAULT_ACCOUNT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

function svRenderHeaderAuth(btn, customer) {
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
    btn.innerHTML = SV_DEFAULT_ACCOUNT_ICON;
    btn.onclick = () => { window.location.href = 'login.html'; };
  }
}

async function svInitHeaderAuth(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  // Cache-first: renders instantly from sessionStorage if we have a cached
  // customer from an earlier page this session, no network wait/flicker.
  // A background fetch always runs and silently re-renders if stale.
  const customer = await svGetCurrentCustomerCached(fresh => svRenderHeaderAuth(btn, fresh));
  svRenderHeaderAuth(btn, customer);
}


// ---- Stock availability (stock minus units held by unpaid orders for 20 min) ----
// Overlays product rows' stock_qty with the server-computed available quantity.
// On any failure the rows are returned untouched (raw stock), and create_store_order still enforces the real check.
async function svApplyAvailability(rows) {
  try {
    if (!sbClient || !Array.isArray(rows) || !rows.length) return rows;
    const ids = rows.map(r => r && r.id).filter(Boolean);
    const map = new Map();
    for (let i = 0; i < ids.length; i += 200) {
      const res = await sbClient.rpc('store_availability', { p_ids: ids.slice(i, i + 200) });
      if (res.error || !Array.isArray(res.data)) return rows;
      res.data.forEach(x => map.set(String(x.id), Number(x.available) || 0));
    }
    rows.forEach(r => { if (r && map.has(String(r.id))) r.stock_qty = map.get(String(r.id)); });
  } catch (e) {}
  return rows;
}


// ---- Action gate: browsing is public, any action needs a signed-in customer ----
// Sync check (works inside plain onclick handlers): supabase-js keeps the session in
// localStorage under sb-<project-ref>-auth-token. If it is absent the visitor is signed out.
function svIsSignedIn() {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    const raw = localStorage.getItem('sb-' + ref + '-auth-token');
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!(s && (s.access_token || s.refresh_token));
  } catch (e) { return false; }
}
// Call at the top of any action handler: `if(!svRequireAuth()) return;`
// Signed out -> opens a "Log in to continue" sheet (no page change). Tapping Log in / Sign up
// remembers the current page and returns here after. Pass {redirect:true} on pages that make
// no sense signed out (checkout) to skip the sheet and go straight to login.
function svGoLogin(tab) {
  try {
    const page = location.pathname.split('/').pop() || 'store.html';
    sessionStorage.setItem('sv-login-return', page + location.search);
  } catch (e) {}
  window.location.href = 'login.html' + (tab === 'signup' ? '?tab=signup' : '');
}
function svRequireAuth(opts) {
  if (svIsSignedIn()) return true;
  if (opts && opts.redirect) { svGoLogin(); return false; }
  svShowLoginSheet();
  return false;
}
function svShowLoginSheet() {
  if (document.getElementById('svAuthSheet')) return;
  if (!document.getElementById('svAuthSheetCss')) {
    const st = document.createElement('style');
    st.id = 'svAuthSheetCss';
    st.textContent = `
#svAuthSheet{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;
  background:rgba(8,14,28,0);transition:background .25s ease;font-family:var(--font,'DM Sans',sans-serif)}
#svAuthSheet.on{background:rgba(8,14,28,.55)}
#svAuthSheet .svas-card{width:100%;max-width:360px;background:var(--surface,#fff);color:var(--text,#0B1220);
  border-radius:24px;padding:26px 22px 18px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);
  opacity:0;transform:translateY(16px) scale(.95);transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .2s ease}
#svAuthSheet.on .svas-card{opacity:1;transform:none}
#svAuthSheet .svas-grab{display:none}
#svAuthSheet .svas-ico{width:56px;height:56px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;
  background:var(--accent-soft,rgba(10,155,220,.1))}
#svAuthSheet .svas-ico svg{width:26px;height:26px;fill:none;stroke:var(--accent,var(--cyan,#0A9BDC));stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#svAuthSheet h3{font-family:var(--fd,'Plus Jakarta Sans',sans-serif);font-size:18px;font-weight:800;margin:0 0 6px}
#svAuthSheet p{font-size:13.5px;line-height:1.5;margin:0 0 18px;color:var(--text2,var(--t2,#5E6B7D))}
#svAuthSheet button{font-family:inherit;cursor:pointer;width:100%;border-radius:14px;font-size:15px;font-weight:700;padding:14px;border:none;transition:transform .12s ease}
#svAuthSheet button:active{transform:scale(.97)}
#svAuthSheet .svas-primary{background:var(--accent,var(--cyan,#0A9BDC));color:#fff;box-shadow:0 6px 18px var(--accent-glow,rgba(10,155,220,.25))}
#svAuthSheet .svas-secondary{margin-top:10px;background:var(--accent-soft,rgba(10,155,220,.1));color:var(--accent,var(--cyan,#0A9BDC))}
#svAuthSheet .svas-later{margin-top:6px;background:none;color:var(--text2,var(--t2,#5E6B7D));font-weight:600;font-size:13.5px;padding:10px}
#svAuthSheet button:focus-visible{outline:2px solid var(--accent,var(--cyan,#0A9BDC));outline-offset:2px}
@media(prefers-reduced-motion:reduce){#svAuthSheet,#svAuthSheet .svas-card{transition:none}}`;
    document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.id = 'svAuthSheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'svasTitle');
  el.innerHTML = '<div class="svas-card"><div class="svas-grab"></div>' +
    '<div class="svas-ico"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></div>' +
    '<h3 id="svasTitle">Log in to continue</h3>' +
    '<p>Sign in or create a free account to add items, save favourites and place orders.</p>' +
    '<button type="button" class="svas-primary" data-a="login">Log In</button>' +
    '<button type="button" class="svas-secondary" data-a="signup">Create Account</button>' +
    '<button type="button" class="svas-later" data-a="close">Not now</button></div>';
  document.body.appendChild(el);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  function close() {
    el.classList.remove('on');
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = prevOverflow;
    setTimeout(() => el.remove(), 300);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', e => {
    if (e.target === el) return close();
    const a = e.target.closest('button') && e.target.closest('button').dataset.a;
    if (a === 'close') close();
    else if (a === 'login' || a === 'signup') svGoLogin(a);
  });
  requestAnimationFrame(() => { el.classList.add('on'); const b = el.querySelector('.svas-primary'); if (b) b.focus(); });
}
