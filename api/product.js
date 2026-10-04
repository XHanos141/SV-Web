const SB = 'https://tlkoxltugvfwxmnrthvr.supabase.co';
const SITE_URL = 'https://sv-web-sigma.vercel.app'; // change to custom domain later
const SITE_NAME = 'SuppVerse BD';
const KEY = 'sb_publishable_0dItRk9UZ40ZpwPqJRoOBw_6MyRFU6z';
const PAGES = {
  supplement: 'product_view_supplement.html',
  gadget: 'product_view_gadget.html',
  cosmetic: 'product_view_cosmetic.html',
  clothing: 'product_view_clothing.html',
  general: 'product_view_general.html'
};

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function one(x) { return Array.isArray(x) ? x[0] : x; }
function specOf(sd) {
  if (!sd) return '';
  const pot = (sd.potency_amount != null && String(sd.potency_amount).trim() !== '')
    ? Number(sd.potency_amount) + ' ' + String(sd.potency_unit || '').toLowerCase() : '';
  const cnt = sd.capsule_count != null ? sd.capsule_count + ' Capsules' : '';
  return [pot.trim(), cnt].filter(Boolean).join(' ');
}
function absUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return SITE_URL + (u.charAt(0) === '/' ? '' : '/') + u;
}
function metaTags(row, prod, slug) {
  const w = row;
  const spec = specOf(one(prod.supplement_details));
  const autoTitle = [prod.brand, prod.name, spec].filter(Boolean).join(' ');
  const title = (w.seo_title && String(w.seo_title).trim()) || autoTitle;
  const plain = String(w.web_description || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const desc = (w.seo_description && String(w.seo_description).trim())
    || (plain ? plain.slice(0, 155) : 'Buy ' + autoTitle + ' in Bangladesh from ' + SITE_NAME + '.');
  const price = Number(prod.price) || 0;
  const imgs = Array.isArray(w.web_images) ? w.web_images : [];
  const img = absUrl(imgs[0]);
  const url = SITE_URL + '/p/' + slug;
  const shareDesc = price ? desc + ' \u2014 \u09F3' + price.toLocaleString('en-US') : desc;
  const out = [
    '<title>' + esc(title) + ' \u2014 ' + SITE_NAME + '</title>',
    '<meta name="description" content="' + esc(desc) + '">',
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta property="og:type" content="product">',
    '<meta property="og:site_name" content="' + SITE_NAME + '">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(shareDesc) + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta name="twitter:card" content="' + (img ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(shareDesc) + '">'
  ];
  if (img) {
    out.push('<meta property="og:image" content="' + esc(img) + '">');
    out.push('<meta name="twitter:image" content="' + esc(img) + '">');
  }
  if (price) {
    out.push('<meta property="product:price:amount" content="' + price + '">');
    out.push('<meta property="product:price:currency" content="BDT">');
  }
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: desc,
    sku: prod.sku || undefined,
    brand: prod.brand ? { '@type': 'Brand', name: prod.brand } : undefined,
    image: imgs.length ? imgs.map(absUrl) : undefined,
    url: url,
    offers: price ? {
      '@type': 'Offer',
      url: url,
      priceCurrency: 'BDT',
      price: String(price),
      itemCondition: 'https://schema.org/NewCondition',
      availability: (Number(prod.stock_qty) > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: SITE_NAME }
    } : undefined
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Store', item: SITE_URL + '/store.html' },
      { '@type': 'ListItem', position: 2, name: title, item: url }
    ]
  };
  [product, crumbs].forEach(function (o) {
    out.push('<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>');
  });
  return out.join('');
}

function notFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product not found — SuppVerse BD</title><body style="font-family:sans-serif;text-align:center;padding:60px 20px"><h2>Product not found</h2><p>It may no longer be available.</p><a href="/store.html">Back to store</a></body>');
}

module.exports = async (req, res) => {
  try {
    const slug = String((req.query && req.query.slug) || '').toLowerCase();
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) return notFound(res);

    const r = await fetch(
      SB + '/rest/v1/product_web?select=product_id,seo_title,seo_description,web_description,web_images,products!inner(id,category,name,brand,sku,price,stock_qty,supplement_details(potency_amount,potency_unit,capsule_count))&slug=eq.' + encodeURIComponent(slug) + '&limit=1',
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
    );
    if (!r.ok) return notFound(res);
    const rows = await r.json();
    const row = Array.isArray(rows) && rows[0];
    if (!row) return notFound(res);
    const prod = Array.isArray(row.products) ? row.products[0] : row.products;
    const pid = row.product_id;
    if (!prod || !/^[0-9a-f-]{36}$/i.test(pid)) return notFound(res);

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const page = PAGES[prod.category] || PAGES.general;
    const pr = await fetch('https://' + host + '/' + page);
    if (!pr.ok) return notFound(res);
    let html = await pr.text();

    const inject = '<base href="/">' + metaTags(row, prod, slug) + '<script>window.__SV_PID="' + pid + '";document.write(\'<style id="pvPre">body .pv-info,body .pv-actions{visibility:hidden}</style>\');setTimeout(function(){var s=document.getElementById("pvPre");if(s&&s.parentNode)s.parentNode.removeChild(s)},12000)</script>';
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+name=["']description["'][^>]*>/i, '');
    html = html.replace(/<head[^>]*>/i, function (m) { return m + inject; });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(html);
  } catch (e) {
    notFound(res);
  }
};
