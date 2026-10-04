const { SITE_URL } = require('./_site');

module.exports = (req, res) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart.html',
    'Disallow: /orders.html',
    'Disallow: /payment.html',
    'Disallow: /profile.html',
    'Disallow: /login.html',
    'Disallow: /verify.html',
    'Disallow: /product_view_',
    'Disallow: /api/',
    '',
    'Sitemap: ' + SITE_URL + '/sitemap.xml',
    ''
  ].join('\n');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.end(body);
};
