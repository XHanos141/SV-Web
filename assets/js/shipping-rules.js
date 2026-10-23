/* Live shipping rules: one source of truth = Supabase site_content (page 'store', section 'shipping'),
   the same row the server's _store_ship_fee() prices checkout from and the admin dashboard publishes.
   Exposes window.SVShipping { flat, freeThreshold, onChange(fn) }. Falls back to the last cached value, then to the
   server defaults (120 / 6800), so the UI never disagrees with what checkout charges. Needs supabase-config.js first. */
(function(){
  var KEY = 'sv-ship-live', DEF = { flat: 120, freeThreshold: 6800, full: false }, subs = [];
  function num(v){ v = Number(v); return isFinite(v) && v >= 0 ? v : null; }
  function cached(){
    try{ var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if(s && num(s.flat) !== null && num(s.freeThreshold) !== null) return s; }catch(e){}
    return null;
  }
  var hasCache = !!cached(), c = cached() || DEF;
  var S = window.SVShipping = {
    flat: c.flat, freeThreshold: c.freeThreshold, full: !!c.full, ready: hasCache,   /* ready = real admin values known (cache or live); UI hides rule-based hints until then */
    /* full = admin 'Shipping Discount: Full' -> shipping is free on every order */
    onChange: function(fn){ if(typeof fn === 'function') subs.push(fn); }
  };
  function load(){
    if(typeof sbClient === 'undefined' || !sbClient) return;
    sbClient.from('site_content').select('content').eq('page', 'store').eq('section', 'shipping').maybeSingle()
      .then(function(r){
        var d = r && r.data && r.data.content; if(!d) return;
        var flat = num(d.flat), thr = num(d.free_threshold);
        if(flat === null || thr === null) return;
        flat = Math.max(0, flat - (num(d.flat_discount) || 0));   /* admin 'Flat' shipping discount: fee customers actually pay */
        var full = d.shipping_discount === 'full';
        var changed = !S.ready || flat !== S.flat || thr !== S.freeThreshold || full !== S.full;
        S.flat = flat; S.freeThreshold = thr; S.full = full; S.ready = true;
        try{ localStorage.setItem(KEY, JSON.stringify({ flat: flat, freeThreshold: thr, full: full })); }catch(e){}
        if(changed) subs.forEach(function(fn){ try{ fn(S); }catch(e){} });
      }, function(){});
  }
  load();
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) load(); });
  window.addEventListener('pageshow', function(e){ if(e.persisted) load(); });
  setInterval(function(){ if(!document.hidden) load(); }, 60000);   /* pick up admin changes while the cart stays open */
})();
