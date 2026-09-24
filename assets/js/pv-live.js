/* Live product data for product_view_*.html — loads by ?pid=<uuid> from Supabase (published products only). */
(function(){
  var params = new URLSearchParams(window.location.search);
  var pid = params.get('pid');
  if(!pid) return;
  if(typeof sbClient === 'undefined' || !sbClient) return;

  var TYPE_BY_CAT = { supplement:'Supplement', gadget:'Gadget', cosmetic:'Cosmetic', clothing:'Clothing', general:'General' };
  var LOW = 10;
  var P = null;

  function $(id){ return document.getElementById(id); }
  function hide(el){ if(el) el.style.display = 'none'; }
  function money(n){ return '৳' + Number(n).toLocaleString('en-US'); }

  /* ── HTML sanitizer for the admin's rich-text description ── */
  var ALLOWED = { P:1, BR:1, B:1, STRONG:1, I:1, EM:1, U:1, UL:1, OL:1, LI:1, H2:1, H3:1, A:1, SPAN:1, DIV:1, FONT:1 };
  function cleanColor(v){
    v = String(v || '').trim();
    return /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i.test(v) ? v : '';
  }
  function sanitizeNode(node, out){
    node.childNodes.forEach(function(ch){
      if(ch.nodeType === 3){ out.appendChild(document.createTextNode(ch.nodeValue)); return; }
      if(ch.nodeType !== 1) return;
      var tag = ch.tagName;
      if(/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|NOSCRIPT|TEMPLATE|SVG|MATH|FORM|INPUT|BUTTON|TEXTAREA|SELECT)$/.test(tag)) return;
      if(!ALLOWED[tag]){ sanitizeNode(ch, out); return; }   // unwrap unknown tags, keep text
      var el = document.createElement(tag === 'FONT' ? 'span' : tag.toLowerCase());
      if(tag === 'A'){
        var href = ch.getAttribute('href') || '';
        if(/^(https?:|mailto:|tel:)/i.test(href)){
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
      var color = tag === 'FONT' ? cleanColor(ch.getAttribute('color')) : '';
      var st = ch.getAttribute('style') || '';
      var m = st.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      if(m) color = cleanColor(m[1]) || color;
      if(color) el.style.color = color;
      var ta = (st.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)/i) || [])[1];
      if(ta) el.style.textAlign = ta.toLowerCase();
      sanitizeNode(ch, el);
      out.appendChild(el);
    });
  }
  function sanitizeHtml(html){
    var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    var box = document.createElement('div');
    sanitizeNode(doc.body, box);
    return box;
  }

  function injectCss(){
    var st = document.createElement('style');
    st.textContent =
      '.pv-gallery-slide img{width:100%;height:100%;object-fit:contain;display:block;-webkit-user-drag:none;user-select:none}' +
      '.pv-desc h2,.pv-desc h3{font-family:var(--font-display);color:var(--text);margin:12px 0 6px;font-size:14px}' +
      '.pv-desc ul,.pv-desc ol{margin:6px 0 10px 20px}.pv-desc p{margin:0 0 8px}' +
      '.pv-desc a{color:var(--accent);text-decoration:underline}' +
      '.pv-gone{padding:60px 20px;text-align:center;color:var(--text2);font-weight:600}' +
      '.pv-gone a{color:var(--accent);font-weight:800}';
    document.head.appendChild(st);
  }

  function buildGallery(images){
    var old = $('pvGallery');
    if(!old || !images.length) return;
    var g = old.cloneNode(false);               // fresh node, no listeners
    g.innerHTML =
      '<div class="pv-gallery-track" id="pvGalleryTrack">' +
        images.map(function(u){ return '<div class="pv-gallery-slide"><img src="' + u.replace(/"/g, '&quot;') + '" alt="" draggable="false"></div>'; }).join('') +
      '</div>' +
      '<div class="pv-dots" id="pvDots">' + (images.length > 1 ? images.map(function(_, i){ return '<div class="pv-dot' + (i === 0 ? ' active' : '') + '"></div>'; }).join('') : '') + '</div>';
    old.parentNode.replaceChild(g, old);
    var track = $('pvGalleryTrack'), dots = g.querySelectorAll('.pv-dot');
    var cur = 0, startX = 0, curX = 0, drag = false, w = g.offsetWidth, n = images.length;
    function go(i, anim){
      cur = Math.max(0, Math.min(n - 1, i));
      track.style.transition = anim === false ? 'none' : '';
      track.style.transform = 'translateX(' + (-cur * w) + 'px)';
      dots.forEach(function(d, k){ d.classList.toggle('active', k === cur); });
    }
    function down(x){ drag = true; startX = curX = x; w = g.offsetWidth; track.classList.add('dragging'); }
    function move(x){ if(!drag) return; curX = x; track.style.transform = 'translateX(' + (-cur * w + (curX - startX)) + 'px)'; }
    function up(){
      if(!drag) return; drag = false; track.classList.remove('dragging');
      var d = curX - startX, th = w * 0.18;
      go(d > th ? cur - 1 : d < -th ? cur + 1 : cur);
    }
    track.addEventListener('touchstart', function(e){ down(e.touches[0].clientX); }, { passive:true });
    track.addEventListener('touchmove', function(e){ move(e.touches[0].clientX); }, { passive:true });
    track.addEventListener('touchend', up);
    track.addEventListener('mousedown', function(e){ down(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', function(e){ if(drag) move(e.clientX); });
    window.addEventListener('mouseup', up);
    window.addEventListener('resize', function(){ go(cur, false); });
    go(0, false);
  }

  function unavailable(){
    var info = document.querySelector('.pv-info');
    if(info) info.innerHTML = '<div class="pv-gone">This product is no longer available.<br><br><a href="store.html">Back to store</a></div>';
    hide($('pvGallery'));
    hide(document.querySelector('.pv-actions'));
  }

  function apply(){
    var title = (P.brand ? P.brand + ' ' : '') + P.name;
    var catLabel = P.subcategory || TYPE_BY_CAT[P.category] || '';
    var qty0 = Number(P.stock_qty) || 0;
    var stock = qty0 <= 0 ? 'out' : qty0 <= LOW ? 'low' : 'in';
    var price = Number(P.price) || 0, old = Number(P.old_price) || 0;
    if(old <= price) old = 0;
    var w = Array.isArray(P.product_web) ? P.product_web[0] : P.product_web;
    var st = (w && w.settings) || {};
    var images = (w && Array.isArray(w.web_images)) ? w.web_images : [];

    if($('pvNameEl')) $('pvNameEl').textContent = title;
    if($('pvCat') && catLabel) $('pvCat').textContent = catLabel;
    if($('pvPriceEl')) $('pvPriceEl').textContent = money(price);
    if($('pvOldEl')){ if(old){ $('pvOldEl').textContent = money(old); $('pvOldEl').style.display = ''; } else hide($('pvOldEl')); }
    if($('pvDiscountEl')){ if(old){ $('pvDiscountEl').textContent = Math.round((old - price) / old * 100) + '% OFF'; $('pvDiscountEl').style.display = ''; } else hide($('pvDiscountEl')); }
    var badge = $('pvStockBadge');
    if(badge){
      badge.classList.remove('in', 'low', 'out'); badge.classList.add(stock);
      badge.textContent = stock === 'in' ? 'In Stock' : stock === 'low' ? 'Only ' + qty0 + ' left' : 'Out of Stock';
    }
    if($('pvBrandText') && P.brand) $('pvBrandText').innerHTML = 'Brand: <b></b>', $('pvBrandText').querySelector('b').textContent = P.brand;

    // demo-only blocks that have no real data yet
    var rating = Number(st.rating) || 0;
    if(!rating) hide(document.querySelector('.pv-rating-row'));
    else if($('pvRatingText')) $('pvRatingText').textContent = rating;
    document.querySelectorAll('.pv-variants, .pv-supplement-info, .pv-review, .pv-write-review, #reviewsSection').forEach(hide);
    document.querySelectorAll('.pv-spec-text').forEach(function(t){
      if(/^\s*Expiry date/i.test(t.textContent)){ var row = t.closest('.pv-spec'); if(row) hide(row); }
    });

    // description
    var desc = document.querySelector('.pv-desc');
    if(desc){
      var clean = w && w.web_description ? sanitizeHtml(w.web_description) : null;
      if(clean && clean.textContent.trim()){
        desc.innerHTML = ''; desc.appendChild(clean);
      } else {
        hide(desc); var dt = desc.previousElementSibling;
        if(dt && dt.classList.contains('pv-section-title')) hide(dt);
      }
    }

    buildGallery(images);

    document.title = ((w && w.seo_title) || title) + ' — SuppVerse BD';
    if(w && w.seo_description){
      var md = document.querySelector('meta[name="description"]');
      if(!md){ md = document.createElement('meta'); md.name = 'description'; document.head.appendChild(md); }
      md.content = w.seo_description;
    }

    // qty cap + out-of-stock
    window.changeQty = function(d){
      var max = Math.max(1, Math.min(10, qty0));
      qty = Math.max(1, Math.min(max, qty + d));
      rollQtyNumber($('qtyVal'), qty);
      if(d > 0 && qty === max && qty0 > 0 && qty0 < 10) showPvToast('Only ' + qty0 + ' in stock');
    };
    if(stock === 'out'){
      var cartBtn = document.querySelector('.pv-btn-cart'), buyBtn = document.querySelector('.pv-btn-buy');
      [cartBtn, buyBtn].forEach(function(b){ if(b){ b.disabled = true; b.style.opacity = '.5'; b.style.pointerEvents = 'none'; } });
      if(cartBtn) cartBtn.lastChild.textContent = ' Out of Stock';
    }
    window.addToCart = function(){
      if(stock === 'out'){ showPvToast('Out of stock'); return; }
      var q = Math.min(qty, Math.max(1, Math.min(10, qty0)));
      var cart = readCart();
      var ex = cart.find(function(c){ return c.id === P.id; });
      if(ex) ex.qty = Math.min(10, ex.qty + q);
      else cart.push({
        id: P.id, productId: P.id, sku: P.sku || '', name: title, variant: '',
        price: price, oldPrice: old || null, qty: q, img: images[0] || null, locked: false,
        type: TYPE_BY_CAT[P.category] || 'General', category: catLabel
      });
      writeCart(cart);
      showPvToast('Added ' + q + ' to cart');
    };
  }

  injectCss();
  sbClient.from('products')
    .select('id,sku,name,brand,category,subcategory,price,old_price,stock_qty,product_web(web_description,web_images,seo_title,seo_description,settings)')
    .eq('id', pid).eq('is_active', true).eq('archived', false).eq('is_web_published', true)
    .maybeSingle()
    .then(function(res){
      if(res.error){ console.error(res.error); return; }
      if(!res.data){ unavailable(); return; }
      P = res.data; apply();
    })
    .catch(function(e){ console.error('pv-live failed', e); });
})();
