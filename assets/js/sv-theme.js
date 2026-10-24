/* SuppVerse BD — day/night theme wipe (View Transitions API)
   Wraps the existing #themeToggle handlers: the page's own logic still runs
   (state, localStorage 'sv-theme', .dark-mode, icon), but inside a view
   transition so the new theme wipes in left→right. Falls back to instant. */
(function(){
  'use strict';
  var DURATION = 650, EASING = 'cubic-bezier(.65,0,.35,1)';
  var replay = false, busy = false;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  var st = document.createElement('style');
  st.textContent =
    '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}' +
    '::view-transition-old(root){z-index:1}::view-transition-new(root){z-index:2}' +
    'html.sv-theme-switching *,html.sv-theme-switching *::before,html.sv-theme-switching *::after{transition:none!important}';
  document.head.appendChild(st);

  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#themeToggle');
    if(!btn || replay) return;
    if(!document.startViewTransition || (reduce && reduce.matches)) return; // native handler, instant
    e.stopImmediatePropagation();
    e.preventDefault();
    if(busy) return;
    busy = true;
    var root = document.documentElement;
    root.classList.add('sv-theme-switching');
    var vt;
    try{
      vt = document.startViewTransition(function(){
        replay = true;
        try{ btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); }
        finally{ replay = false; }
      });
    }catch(_){ busy = false; root.classList.remove('sv-theme-switching'); return; }
    vt.ready.then(function(){
      root.animate(
        { clipPath: ['inset(0 100% 0 0)','inset(0 0 0 0)'] },
        { duration: DURATION, easing: EASING, pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function(){});
    vt.finished.finally(function(){
      busy = false;
      root.classList.remove('sv-theme-switching');
    });
  }, true);
})();
