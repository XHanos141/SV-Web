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

  /* ── Reviews (real data — product_reviews table, insert gated server-side by verified purchase) ── */
  var STAR_D = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
  var VERIFIED_SVG = '<svg viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="m21.5609 10.7386-1.36-1.58001c-.26-.3-.47-.86-.47-1.26v-1.7c0-1.06-.87-1.93-1.93-1.93h-1.7c-.39 0-.96-.21-1.26-.47l-1.58-1.36c-.69-.59-1.82-.59-2.52 0l-1.57004 1.37c-.3.25-.87.46-1.26.46h-1.73c-1.06 0-1.93.87-1.93 1.93v1.71c0 .39-.21.95-.46 1.25l-1.35 1.59001c-.58.69-.58 1.81 0 2.5l1.35 1.59c.25.3.46.86.46 1.25v1.71c0 1.06.87 1.93 1.93 1.93h1.73c.39 0 .96.21 1.26.47l1.58004 1.36c.69.59 1.82.59 2.52 0l1.58-1.36c.3-.26.86-.47 1.26-.47h1.7c1.06 0 1.93-.87 1.93-1.93v-1.7c0-.39.21-.96.47-1.26l1.36-1.58c.58-.69.58-1.83-.01-2.52m-5.4-.63-4.83 4.83c-.14.14-.33.22-.53.22s-.39-.08-.53-.22l-2.42004-2.42c-.29-.29-.29-.77 0-1.06s.77-.29 1.06 0l1.89004 1.89 4.3-4.30001c.29-.29.77-.29 1.06 0s.29.77 0 1.06001"/></svg>';

  function starsSvg(n){
    var out = '';
    for(var i = 0; i < 5; i++) out += '<svg viewBox="0 0 24 24" fill="' + (i < n ? 'currentColor' : 'var(--text3)') + '"><path d="' + STAR_D + '"/></svg>';
    return out;
  }
  function escapeHtml(s){
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function initials(name){
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function renderReviews(list){
    var box = $('pvReviewsList'), empty = $('pvReviewsEmpty'), row = document.querySelector('.pv-rating-row');
    if(box) box.innerHTML = list.map(function(r){
      return '<div class="pv-review"><div class="pv-review-head"><div class="pv-review-avatar">' + initials(r.reviewer_name) +
        '</div><div><div class="pv-review-name">' + escapeHtml(r.reviewer_name) +
        '<span class="pv-verified-badge">' + VERIFIED_SVG + 'Verified Purchase</span></div>' +
        '<div class="pv-review-stars">' + starsSvg(r.rating) + '</div></div></div>' +
        '<div class="pv-review-text">' + escapeHtml(r.review_text) + '</div></div>';
    }).join('');
    if(empty) empty.style.display = list.length ? 'none' : '';
    if(!list.length){ hide(row); return; }
    var avg = list.reduce(function(a, r){ return a + r.rating; }, 0) / list.length;
    if(row){
      row.style.display = '';
      var starsWrap = row.querySelector('.pv-stars');
      if(starsWrap) starsWrap.innerHTML = starsSvg(Math.round(avg));
      var countEl = row.querySelector('.pv-rating-count');
      if(countEl) countEl.textContent = '(' + list.length + ' review' + (list.length === 1 ? '' : 's') + ')';
    }
    if($('pvRatingText')) $('pvRatingText').textContent = avg.toFixed(1);
  }

  function loadReviews(){
    sbClient.from('product_reviews')
      .select('reviewer_name,rating,review_text,created_at')
      .eq('product_id', P.id).order('created_at', { ascending: false })
      .then(function(res){ renderReviews((res && res.data) || []); })
      .catch(function(){});
  }

  function setWriteMsg(html){
    hide($('pvWriteReview'));
    var m = $('pvWriteReviewMsg');
    if(m){ m.innerHTML = html; m.style.display = ''; }
  }
  function showWriteForm(){
    var wr = $('pvWriteReview');
    if(wr) wr.style.display = '';
    var m = $('pvWriteReviewMsg');
    if(m) m.style.display = 'none';
  }

  function wireWriteReview(){
    if(!sbClient.auth) return;
    sbClient.auth.getUser().then(function(ures){
      var user = ures && ures.data && ures.data.user;
      if(!user){ setWriteMsg('<a href="login.html">Sign in</a> to write a review.'); return; }
      sbClient.from('customers').select('id,full_name').eq('auth_id', user.id).maybeSingle().then(function(cres){
        var cust = cres && cres.data;
        if(!cust){ setWriteMsg('<a href="login.html">Sign in</a> to write a review.'); return; }
        sbClient.from('product_reviews').select('id').eq('product_id', P.id).eq('customer_id', cust.id).maybeSingle().then(function(rres){
          if(rres && rres.data){ setWriteMsg('You\u2019ve already reviewed this product. Thanks for your feedback!'); return; }
          sbClient.from('order_items').select('id, orders!inner(status)').eq('product_id', P.id).eq('orders.status', 'paid').then(function(ores){
            if(!ores || !Array.isArray(ores.data) || !ores.data.length){ setWriteMsg('Only customers who\u2019ve purchased this product can leave a review.'); return; }
            showWriteForm();
            window.submitReview = function(){
              var textEl = $('reviewText');
              var text = textEl ? textEl.value.trim() : '';
              var filled = document.querySelectorAll('#starInput svg.filled').length;
              if(!filled){ alert('Please select a star rating'); return; }
              if(!text){ alert('Please write a comment'); return; }
              sbClient.from('product_reviews').insert({
                product_id: P.id, customer_id: cust.id,
                reviewer_name: cust.full_name || 'Customer',
                rating: filled, review_text: text
              }).then(function(ires){
                if(ires.error){ alert('Could not submit your review. Please try again.'); console.error(ires.error); return; }
                if(textEl) textEl.value = '';
                setWriteMsg('Thanks! Your review has been posted.');
                loadReviews();
              });
            };
          });
        });
      });
    });
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
    document.querySelectorAll('.pv-supplement-info').forEach(hide);
    hide(document.querySelector('.pv-rating-row')); // re-shown by loadReviews() once real reviews exist
    hide($('pvWriteReview')); // re-shown by wireWriteReview() once eligibility is confirmed

    // Potency / Capsule Count pills — single real value from supplement_details, not a fake multi-option selector
    var sd = Array.isArray(P.supplement_details) ? P.supplement_details[0] : P.supplement_details;
    var potencyPill = $('pvPotencyPill'), countPill = $('pvCountPill');
    if(sd && sd.potency_amount != null && potencyPill){
      potencyPill.textContent = sd.potency_amount + ' ' + (sd.potency_unit || '').toLowerCase();
    } else hide($('potencyBox'));
    if(sd && sd.capsule_count != null && countPill){
      countPill.textContent = sd.capsule_count + ' Caps';
    } else hide($('countBox'));
    if(!sd){ hide($('potencyBox')); hide($('countBox')); }

    // Expiry: show the soonest expiry among in-stock batches (FEFO — first-expired-first-out display rule)
    var expiryEl = $('pvExpiryVal');
    var expiryRow = expiryEl && expiryEl.closest('.pv-spec');
    if(expiryEl && expiryRow){
      hide(expiryRow); // hidden until we confirm a batch exists
      sbClient.rpc('get_earliest_expiry', { p_product_id: P.id }).then(function(res){
        if(res.error || !res.data) return;
        var d = new Date(res.data + 'T00:00:00');
        if(isNaN(d)) return;
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        expiryEl.textContent = mm + '/' + d.getFullYear();
        expiryRow.style.display = '';
      });
    }

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

    loadReviews();
    wireWriteReview();
  }

  injectCss();
  sbClient.from('products')
    .select('id,sku,name,brand,category,subcategory,price,old_price,stock_qty,product_web(web_description,web_images,seo_title,seo_description,settings),supplement_details(potency_amount,potency_unit,capsule_count)')
    .eq('id', pid).eq('is_active', true).eq('archived', false).eq('is_web_published', true)
    .maybeSingle()
    .then(function(res){
      if(res.error){ console.error(res.error); return; }
      if(!res.data){ unavailable(); return; }
      P = res.data; apply();
    })
    .catch(function(e){ console.error('pv-live failed', e); });
})();
