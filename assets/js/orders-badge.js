/* SuppVerse BD — Orders tab badge (mirrors the Cart badge).
   Shows how many store orders still need the customer's attention
   (awaiting payment / unpaid / verifying / COD pending). Hidden at 0 or logged out.
   Data: sbClient.rpc('my_orders'), cached in localStorage so every page paints instantly
   and stays in sync across tabs; refreshed on load, focus, tab-return and every 20s while visible. */
(function(){
  var KEY = 'sv-orders-badge';
  var ACTIVE = { awaiting_payment:1, unpaid:1, verifying:1, cod_pending:1 };
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

  function cached(){ var n = parseInt(localStorage.getItem(KEY), 10); return n > 0 ? n : 0; }
  function store(n){ try{ if(n > 0) localStorage.setItem(KEY, String(n)); else localStorage.removeItem(KEY); }catch(e){} }
  function countOf(orders){
    return (orders || []).reduce(function(n,o){ return n + (o && ACTIVE[o.state] ? 1 : 0); }, 0);
  }

  /* Pages that already hold the orders list (orders.html) push it here — no extra request. */
  window.svOrdersBadgeSet = function(orders){ var n = countOf(orders); store(n); render(n); };

  async function refresh(){
    if(busy || document.hidden) return;
    if(typeof sbClient === 'undefined' || !sbClient) return;
    busy = true;
    try{
      var s = await sbClient.auth.getSession();
      if(!(s.data && s.data.session)){ store(0); render(0); return; }
      var r = await sbClient.rpc('my_orders');
      if(r.error || !r.data || !r.data.ok) return;   // keep last known value on failure
      var n = countOf(r.data.orders);
      store(n); render(n);
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
  window.addEventListener('storage', function(e){ if(!e.key || e.key === KEY) render(cached()); });
})();
