const SB = 'https://tlkoxltugvfwxmnrthvr.supabase.co';
const KEY = 'sb_publishable_0dItRk9UZ40ZpwPqJRoOBw_6MyRFU6z';
const PAGES = {
  supplement: 'product_view_supplement.html',
  gadget: 'product_view_gadget.html',
  cosmetic: 'product_view_cosmetic.html',
  clothing: 'product_view_clothing.html',
  general: 'product_view_general.html'
};

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
      SB + '/rest/v1/product_web?select=product_id,products!inner(id,category)&slug=eq.' + encodeURIComponent(slug) + '&limit=1',
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

    const inject = '<base href="/"><script>window.__SV_PID="' + pid + '";document.write(\'<style id="pvPre">body .pv-info,body .pv-actions{visibility:hidden}</style>\');setTimeout(function(){var s=document.getElementById("pvPre");if(s&&s.parentNode)s.parentNode.removeChild(s)},12000)</script>';
    html = html.replace(/<head[^>]*>/i, function (m) { return m + inject; });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(html);
  } catch (e) {
    notFound(res);
  }
};
