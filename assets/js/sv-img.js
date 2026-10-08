/* SuppVerse BD — responsive product image helper
 * New admin uploads are stored as <base>-1200.webp with sibling files
 * <base>-300.webp, -600.webp and -2000.webp. Any URL that does not match
 * that pattern (all legacy uploads) is returned untouched, so nothing breaks.
 *   300  cart, orders, trending, admin thumbs
 *   600  store grid
 *   1200 product detail gallery (the URL stored in product_web.web_images)
 *   2000 zoom viewer
 */
(function(){
  var RE = /-(?:300|600|1200|2000)\.(webp|jpg)((?:\?|#)[\s\S]*)?$/i;
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* svImg(url, 300) -> sized variant URL (or the same URL for legacy files) */
  window.svImg = function(u, w){
    if(typeof u !== 'string' || !u) return u;
    return u.replace(RE, function(_, ext, q){ return '-' + w + '.' + ext + (q || ''); });
  };

  /* onerror handler: fall back to the stored base URL once, then call onFail */
  window.svImgFb = function(el, onFail){
    var f = el.getAttribute('data-fb');
    if(f && el.getAttribute('src') !== f){ el.setAttribute('src', f); return true; }
    if(typeof onFail === 'function') onFail(el);
    return false;
  };

  /* svImgAttrs(url, 300[, 'failFnName']) -> ' src="..." data-fb="..." onerror="..."' for an <img> tag */
  window.svImgAttrs = function(u, w, failFn){
    var v = window.svImg(u, w), hasVariant = v !== u;
    return ' src="' + esc(v) + '"' +
      (hasVariant ? ' data-fb="' + esc(u) + '"' : '') +
      ((hasVariant || failFn) ? ' onerror="svImgFb(this' + (failFn ? ',' + failFn : '') + ')"' : '');
  };

  window.svImgGone = function(el){ if(el && el.remove) el.remove(); };
})();
