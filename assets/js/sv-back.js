/* Back button = close only the top open layer (modal / sheet / popup / zoom), then stay on the page. */
(function(){
  if(window.__svBack) return; window.__svBack = true;
  var SEL = '.review-overlay.show,.bkash-popup-overlay.show,#loginGate.show,.sv-modal.show,.pv-zoom-overlay.open,.modal-overlay.open,.s-sheet.show';
  var FN = {addrModal:'closeAddrModal',pwConfirmModal:'closePasswordConfirm',delModal:'closeDeleteAccount',logoutConfirmModal:'closeLogoutConfirm',avatarEditor:'closeEditProfile',cropModal:'closeCropModal',sBrandSheet:'closeSheet'};
  var CLOSE_BTN = '.pv-zoom-close,.s-sheet-close,[data-close],.modal-close,.close-btn,[aria-label="Close"],[aria-label="Close dialog"]';
  var stack = [], ignore = 0;

  function closeLayer(el){
    var fn = FN[el.id];
    try{
      if(fn && typeof window[fn] === 'function'){ window[fn](el); return; }
      if(/(review-overlay|bkash-popup-overlay|login-gate)/.test(el.className) && typeof window.closeOverlay === 'function'){ window.closeOverlay(el); return; }
      var b = el.querySelector(CLOSE_BTN);
      if(b){ b.click(); return; }
    }catch(e){}
    el.classList.remove('show','open');
  }

  function sync(el){
    var open = el.matches && el.matches(SEL), i = stack.indexOf(el);
    if(open && i < 0){
      stack.push(el);
      history.pushState({svLayer: stack.length}, '');
    }else if(!open && i >= 0){
      var wasTop = i === stack.length - 1;
      stack.splice(i, 1);
      if(wasTop){ ignore++; history.back(); }
    }
  }

  new MutationObserver(function(list){
    list.forEach(function(m){ if(m.type === 'attributes') sync(m.target); });
  }).observe(document.documentElement, {attributes:true, attributeFilter:['class'], subtree:true});

  window.addEventListener('popstate', function(){
    if(ignore > 0){ ignore--; return; }
    if(stack.length){ closeLayer(stack.pop()); }
  });
})();
