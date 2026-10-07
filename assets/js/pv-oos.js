/* SuppVerse BD — product view out-of-stock treatment.
   Mirrors store.html .p-card-out: muted image + name + price, red OUT OF STOCK bar.
   Driven by the existing .pv-stock badge (static, URL param, pv-live.js or variant picker). */
(function(){
  var css =
    '.pv-gallery-track,.pv-name,.pv-price,.pv-old,.pv-discount{transition:filter .25s ease,opacity .25s ease}' +
    'body.pv-oos .pv-gallery-track{filter:grayscale(.85) brightness(.92);opacity:.5}' +
    'body.pv-oos .pv-name,body.pv-oos .pv-price,body.pv-oos .pv-old,body.pv-oos .pv-discount{filter:grayscale(.65) brightness(.92);opacity:.55}' +
    '.pv-out-bar{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3;pointer-events:none;' +
    'background:rgba(225,67,67,.92);color:#fff;font-family:"Plus Jakarta Sans","DM Sans",sans-serif;font-size:13px;font-weight:800;' +
    'letter-spacing:.12em;text-transform:uppercase;padding:8px 20px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 10px rgba(225,67,67,.35)}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function sync(){
    var badge = document.querySelector('.pv-stock');
    var out = !!(badge && badge.classList.contains('out'));
    document.body.classList.toggle('pv-oos', out);
    var g = document.getElementById('pvGallery');
    if(!g) return;
    var bar = g.querySelector('.pv-out-bar');
    if(out && !bar){
      bar = document.createElement('div'); bar.className = 'pv-out-bar'; bar.textContent = 'Out of Stock';
      g.appendChild(bar);
    } else if(!out && bar){ bar.remove(); }
  }
  var observed = null;
  function hook(){
    var badge = document.querySelector('.pv-stock');
    if(badge && badge !== observed){
      observed = badge;
      new MutationObserver(sync).observe(badge, {attributes:true, attributeFilter:['class'], childList:true, characterData:true, subtree:true});
    }
    sync();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  window.addEventListener('load', hook);
  setTimeout(hook, 800); setTimeout(hook, 2000);
})();
