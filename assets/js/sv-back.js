/* SuppVerse BD (website) — one Back press = one step.
   Back closes ONLY the top-most open layer (modal / sheet / popup / dropdown / zoom viewer / login gate) and stays on the page.
   With nothing open, Back behaves normally (previous page) — no hint, no trap.
   v2: layers are detected generically (no hand-kept selector list), each open layer owns exactly one history entry, and entries are
   kept in step with the layers even when they are closed from the UI, out of order, or opened/closed in quick succession. */
(function () {
  'use strict';
  if (window.__svBack2) return; window.__svBack2 = true;

  var CAND = '[class*="overlay" i],[class*="modal" i],[class*="sheet" i],[class*="popup" i],[class*="gate" i],[class*="zoom" i],[class*="drawer" i],' +
             '[class*="dialog" i],[class*="popover" i],[class*="lightbox" i],[class*="viewer" i],[class*="menu" i],[class*="dropdown" i],[class*="picker" i],' +
             '[id$="Overlay"],[id$="Modal"],[id$="Sheet"],[id$="Popup"],[id$="Dialog"],[id$="Menu"],[id$="Gate"]';
  /* never layers: toasts/spinners/result screens/always-there chrome */
  var SKIP = /backdrop|scrim|toast|skeleton|loader|loading|spinner|processing|splash|success|tooltip|sticky|progress|navbar|nav-bar|bottom-nav|header|footer|search-suggest|autocomplete/i;
  var CLOSE_SEL = '[data-close],[data-back-close],[aria-label*="close" i],.pv-zoom-close,.s-sheet-close,.modal-close,.close-btn,.close,' +
                  '[onclick*="close" i],[onclick*="cancel" i],[onclick*="dismiss" i],[onclick*="hide" i],[class*="close"],[class*="cancel"],[class*="dismiss"]';
  var BAD_ACTION = /confirm|save|delete|remove|submit|apply|create|accept|yes|pay|logout|signout|send/i;
  var STATE = /(^|\s)(show|open|active|on|visible|is-open|opened|shown)(\s|$)/;
  /* page-specific closers (kept from v1) */
  var FN = { addrModal: 'closeAddrModal', pwConfirmModal: 'closePasswordConfirm', delModal: 'closeDeleteAccount', logoutConfirmModal: 'closeLogoutConfirm',
             avatarEditor: 'closeEditProfile', cropModal: 'closeCropModal', sBrandSheet: 'closeSheet' };

  var stack = [];          // open layers, oldest first — each owns one history entry
  var stale = 0;           // history entries whose layer was closed out of order
  var entries = 0;         // history entries we currently own above the page's own entry
  var ignore = 0;          // programmatic pops still to arrive
  var permanent = (typeof WeakSet !== 'undefined') ? new WeakSet() : { has: function () { return false; }, add: function () {}, delete: function () {} };
  var dismissed = (typeof WeakSet !== 'undefined') ? new WeakSet() : { has: function () { return false; }, add: function () {}, delete: function () {} };
  var ready = false, timer = 0, scanning = false, pollUntil = 0;

  function cls(el) { return (el.getAttribute && el.getAttribute('class')) || ''; }

  function isShown(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.05 && !STATE.test(cls(el))) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    return r.bottom > 2 && r.right > 2 && r.top < window.innerHeight - 2 && r.left < window.innerWidth - 2;
  }

  function candidates() {
    var out = [], all = document.querySelectorAll(CAND);
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (SKIP.test(cls(el)) || (el.id && SKIP.test(el.id))) continue;
      if (/^(SCRIPT|STYLE|IFRAME|SVG|PATH|IMG|INPUT|BUTTON|A|LABEL|SPAN|I)$/i.test(el.tagName) || el.closest('svg')) continue;
      if (!el.firstElementChild) continue;
      var pos = getComputedStyle(el).position;
      if (pos !== 'fixed') {
        if (pos !== 'absolute') continue;
        var rr = el.getBoundingClientRect();
        var bigPanel = rr.width >= window.innerWidth * 0.6 && rr.height >= window.innerHeight * 0.4;
        if (!bigPanel && !(STATE.test(cls(el)) && rr.width >= 40 && rr.height >= 24)) continue;   // slide-over panel, or a dropdown/menu that is explicitly "open"
      }
      out.push(el);
    }
    return out;
  }

  function openNow() {
    var res = [], c = candidates();
    for (var i = 0; i < c.length; i++) {
      var el = c[i], shown = isShown(el);
      if (!shown) { if (permanent.has(el)) permanent.delete(el); if (dismissed.has(el)) dismissed.delete(el); continue; }    // hidden again -> a later show is a real "open"
      if (permanent.has(el)) continue;                                            // always-visible chrome, not a layer
      if (dismissed.has(el)) { if (STATE.test(cls(el))) dismissed.delete(el); else continue; }   // still fading/sliding out — not a new layer
      res.push(el);
    }
    return res;
  }

  function zChain(el) {
    var ch = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var z = parseInt(getComputedStyle(n).zIndex, 10);
      if (!isNaN(z)) ch.unshift(z);
    }
    return ch;
  }
  function byTop(a, b) {
    var A = zChain(a), B = zChain(b), n = Math.max(A.length, B.length);
    for (var i = 0; i < n; i++) { var x = A[i] === undefined ? -1 : A[i], y = B[i] === undefined ? -1 : B[i]; if (x !== y) return y - x; }
    var p = a.compareDocumentPosition(b);
    if (p & Node.DOCUMENT_POSITION_CONTAINED_BY) return 1;
    if (p & Node.DOCUMENT_POSITION_CONTAINS) return -1;
    return (p & Node.DOCUMENT_POSITION_FOLLOWING) ? 1 : -1;
  }

  function findCloseControl(layer) {
    var c = layer.querySelectorAll(CLOSE_SEL);
    for (var i = 0; i < c.length; i++) {
      var b = c[i], oc = b.getAttribute('onclick') || '';
      if (b.disabled || BAD_ACTION.test(oc) || BAD_ACTION.test(cls(b)) || BAD_ACTION.test(b.getAttribute('aria-label') || '')) continue;
      if (isShown(b)) return b;
    }
    return null;
  }

  function closeLayer(el) {
    try {
      var fn = FN[el.id];
      if (fn && typeof window[fn] === 'function') { window[fn](el); return; }
      if (/(review-overlay|bkash-popup-overlay|login-gate)/.test(cls(el)) && typeof window.closeOverlay === 'function') { window.closeOverlay(el); return; }
      var own = el.getAttribute('onclick') || '';
      if (/close|hide|dismiss|cancel|event\.target\s*===\s*this/i.test(own) && !BAD_ACTION.test(own)) { el.click(); return; }
      var b = findCloseControl(el);
      if (b) { b.click(); return; }
    } catch (e) {}
    ['show', 'open', 'active', 'on', 'visible', 'is-open'].forEach(function (c) { el.classList.remove(c); });   // last resort
  }

  /* keep the number of history entries equal to the number of open layers (+ stale ones we still have to drop) */
  function reconcile() {
    if (ignore > 0) return;                       // a pop is on its way — push after it lands
    while (entries < stack.length + stale) { try { history.pushState({ svLayer: 1 }, ''); } catch (e) { break; } entries++; }
    if (!stack.length && stale > 0) {             // nothing open any more: silently drop stale entries
      var n = stale; stale = 0; entries -= n; ignore++; history.go(-n);
    }
  }

  function scan() {
    if (scanning) return; scanning = true;
    try {
      var now = openNow().sort(byTop).reverse();       // oldest -> top-most for new arrivals
      if (!ready) { now.forEach(function (el) { permanent.add(el); }); ready = true; return; }
      // closed layers
      for (var i = stack.length - 1; i >= 0; i--) {
        if (now.indexOf(stack[i]) < 0) {
          var wasTop = i === stack.length - 1;
          stack.splice(i, 1);
          if (wasTop && entries > stack.length + stale) { entries--; ignore++; history.back(); }
          else stale++;
        }
      }
      // new layers
      now.forEach(function (el) { if (stack.indexOf(el) < 0) stack.push(el); });
      reconcile();
    } finally { scanning = false; }
  }

  function schedule() {
    pollUntil = Date.now() + 1600;                    // keep checking while transitions finish (no event fires when a slide-out ends)
    if (timer) return;
    timer = setTimeout(function () { timer = 0; scan(); }, 40);
  }
  setInterval(function () { if (stack.length || Date.now() < pollUntil) scan(); }, 150);

  window.addEventListener('popstate', function () {
    if (ignore > 0) { ignore--; if (!ignore) { scan(); reconcile(); } return; }
    if (stack.length) {                              // user pressed Back: close only the top layer
      var top = stack.pop(); entries = Math.max(0, entries - 1);
      dismissed.add(top);
      closeLayer(top);
      pollUntil = Date.now() + 1600;
      setTimeout(function () { if (top.isConnected && isShown(top)) { dismissed.delete(top); permanent.add(top); } }, 900);   // refuses to close -> stop treating it as a layer
      setTimeout(scan, 60);
    } else if (stale > 0 || entries > 0) {           // a leftover entry: invisible — carry on to where the user actually wanted to go
      var rest = Math.max(stale, entries) - 1; stale = 0; entries = 0;
      if (rest >= 0) { ignore++; history.go(-(rest + 1)); }
    }
  });

  function start() {
    scan();                                          // first scan records always-visible chrome as permanent
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden'], subtree: true, childList: true });
    ['transitionend', 'animationend'].forEach(function (ev) { document.addEventListener(ev, schedule, true); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) { stack = []; stale = 0; entries = 0; ignore = 0; scan(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); }); else setTimeout(start, 0);

  window.SVBackWeb = { _stack: function () { return stack.slice(); }, _scan: scan };
})();
