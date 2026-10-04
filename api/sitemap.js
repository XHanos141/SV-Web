const { SITE_URL, SB, KEY } = require('./_site');

const STATIC_PAGES = ['/', '/store.html', '/buy_for_me.html', '/about-us.html', '/privacy-policy.html', '/terms-conditions.html'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

module.exports = async (req, res) => {
  let rows = [];
  try {
    const r = await fetch(
      SB + '/rest/v1/product_web?select=slug,updated_at,products!inner(is_web_published)&products.is_web_published=eq.true&slug=not.is.null&order=updated_at.desc&limit=5000',
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
    );
    if (r.ok) rows = await r.json();
  } catch (e) {}

  const urls = STATIC_PAGES.map(function (p) {
    return '<url><loc>' + esc(SITE_URL + p) + '</loc></url>';
  });
  (Array.isArray(rows) ? rows : []).forEach(function (w) {
    if (!w.slug || !/^[a-z0-9-]+$/.test(w.slug)) return;
    const d = w.updated_at ? new Date(w.updated_at) : null;
    const last = d && !isNaN(d) ? '<lastmod>' + d.toISOString() + '</lastmod>' : '';
    urls.push('<url><loc>' + esc(SITE_URL + '/p/' + w.slug) + '</loc>' + last + '</url>');
  });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.join('') + '</urlset>');
};
