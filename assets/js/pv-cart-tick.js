(function(){
  var btn = document.querySelector('.pv-btn-cart');
  if(!btn) return;
  var svg0 = null;
  var TICK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var st = document.createElement('style');
  st.textContent = '.pv-btn-cart.added{background:linear-gradient(145deg,var(--green),#088a5e);box-shadow:0 3px 10px rgba(10,155,114,.28)}';
  document.head.appendChild(st);
  function setAdded(on){
    var cur = btn.querySelector('svg');
    if(on){
      if(btn.classList.contains('added')) return;
      if(cur){ svg0 = cur.outerHTML; cur.outerHTML = TICK; }
      btn.classList.add('added');
    } else {
      if(!btn.classList.contains('added')) return;
      cur = btn.querySelector('svg');
      if(cur && svg0) cur.outerHTML = svg0;
      btn.classList.remove('added');
    }
  }
  btn.addEventListener('click', function(){
    if(btn.disabled || btn.style.pointerEvents === 'none') return;
    setAdded(true);
  });
  document.addEventListener('click', function(e){
    if(e.target.closest && e.target.closest('.pv-variant-pill, .pv-qty-minus, .pv-qty-plus')) setAdded(false);
  });
})();
