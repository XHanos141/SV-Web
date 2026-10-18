/* SuppVerse BD — Orders tab badge (mirrors the Cart badge).
   Shows how many orders are still running across the whole account: store orders (anything not delivered
   or cancelled) + Buy For Me requests (not delivered / rejected / cancelled / expired). Hidden at 0 or logged out.
   Data: sbClient.rpc('my_orders'), cached in localStorage so every page paints instantly
   and stays in sync across tabs; refreshed on load, focus, tab-return and every 20s while visible. */
(function(){
  var KEY = 'sv-orders-badge', KEY_S = 'sv-orders-badge-s', KEY_P = 'sv-orders-badge-p';
  var FINAL = { delivered:1, cancelled:1 };
  var POLL_MS = 20000;
  var last = 0, busy = false, timer = null;

  function link(){ return document.querySelector('#svFooterNav .s-nav-item[data-page="orders"]'); }
  function badgeEl(){
    var a = link(); if(!a) return null;
    var b = document.getElementById('svNavOrdersBadge');
    if(!b){
      b = document.createElement('span');
      b.className = 's-nav-badge';
      b.id = 'svNavOrdersBadge';
      b.setAttribute('aria-live','polite');
      a.appendChild(b);
    }
    return b;
  }

  function render(count){
    var badge = badgeEl(); if(!badge) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var num = badge.firstElementChild;
    if(!num || !num.classList.contains('s-nav-badge-num')){
      badge.textContent = '';
      num = document.createElement('b');
      num.className = 's-nav-badge-num';
      badge.appendChild(num);
    }
    if(count > 0){
      var label = count > 99 ? '99+' : String(count);
      var wasShown = badge.classList.contains('show');
      var prev = last;
      badge.__label = label;
      if(num.textContent !== label){
        if(wasShown && !reduce && num.animate){
          var dir = count > prev ? 1 : -1;
          var out = num.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY('+(-7*dir)+'px)',opacity:0}],{duration:110,easing:'ease-in',fill:'forwards'});
          out.onfinish = function(){
            num.textContent = badge.__label;
            var inn = num.animate([{transform:'translateY('+(7*dir)+'px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:170,easing:'cubic-bezier(.2,.9,.3,1.2)'});
            inn.onfinish = function(){ out.cancel(); };
          };
          if(count > prev && badge.animate){
            badge.animate([{transform:'scale(1)'},{transform:'scale(1.28)',offset:.4},{transform:'scale(1)'}],{duration:340,easing:'ease-out'});
          }
        } else { num.textContent = label; }
      }
      if(!wasShown) requestAnimationFrame(function(){ badge.classList.add('show'); });
    } else {
      badge.classList.remove('show');
    }
    last = count;
  }

  function part(k){ var n = parseInt(localStorage.getItem(k), 10); return n > 0 ? n : 0; }
  function cached(){ return part(KEY_S) + part(KEY_P); }
  function put(k, n){ try{ if(n > 0) localStorage.setItem(k, String(n)); else localStorage.removeItem(k); }catch(e){} }
  var PX_CONF = ['paid','purchasing','ordered','shipped_intl','arrived_bd','delivered'];
  function pxRunning(r){
    return !!r && r.status !== 'approved' && (!!r.order_id || PX_CONF.indexOf(r.status) > -1) && !(['delivered','rejected','cancelled','expired'].indexOf(r.status) > -1 || (r.status === 'quoted' && r.expires_at && new Date(r.expires_at) < new Date()));
  }
  var KEY_C = 'sv-cart-proxy-badge';
  function pxCartActive(r){
    if(!r) return false;
    if(r.status === 'approved') return true;
    if(r.order_id) return false;
    if(r.status === 'pending_quote') return true;
    return r.status === 'quoted' && !(r.expires_at && new Date(r.expires_at) < new Date());
  }
  function syncCart(){ if(window.svRefreshCartBadge) try{ window.svRefreshCartBadge(); }catch(e){} }
  function countOf(orders){
    return (orders || []).reduce(function(n,o){ return n + (o && o.state && !FINAL[o.state] ? 1 : 0); }, 0);
  }

  /* Pages that already hold the orders list (orders.html) push it here — no extra request. */
  window.svOrdersBadgeSet = function(orders){ put(KEY_S, countOf(orders)); render(cached()); };
  window.svProxyBadgeSet  = function(rows){ put(KEY_P, (rows || []).filter(pxRunning).length); render(cached()); };
  window.svCartProxySet   = function(n){ put(KEY_C, n); syncCart(); };

  async function refresh(){
    if(busy || document.hidden) return;
    if(typeof sbClient === 'undefined' || !sbClient) return;
    busy = true;
    try{
      var s = await sbClient.auth.getSession();
      if(!(s.data && s.data.session)){ put(KEY_S, 0); put(KEY_P, 0); put(KEY_C, 0); render(0); syncCart(); return; }
      var r = await sbClient.rpc('my_orders');
      if(!(r.error || !r.data || !r.data.ok)) put(KEY_S, countOf(r.data.orders));   // keep last known value on failure
      var px = await sbClient.from('proxy_requests').select('status,expires_at,order_id');
      if(!px.error && px.data){ put(KEY_P, px.data.filter(pxRunning).length); put(KEY_C, px.data.filter(pxCartActive).length); }
      render(cached()); syncCart();
    }catch(e){} finally { busy = false; }
  }
  window.svRefreshOrdersBadge = refresh;

  function start(){
    render(cached());
    refresh();
    clearInterval(timer);
    timer = setInterval(refresh, POLL_MS);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('pageshow', function(){ render(cached()); refresh(); });
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) refresh(); });
  window.addEventListener('storage', function(e){ if(!e.key || e.key === KEY_S || e.key === KEY_P) render(cached()); });
})();
