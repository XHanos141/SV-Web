/* POST /api/pdf  { html, size: 'a4'|'receipt', bleed?: boolean }  + Authorization: Bearer <supabase access token>
   Admin-only vector PDF renderer for the SuppVerse dashboard app (invoices, return receipts, ...).
   Callable cross-origin from the app: auth is the bearer token, not cookies, so CORS can be open. */
const { SB, KEY } = require('./_site');
const { renderHtmlPdf, RasterContentError } = require('./_invoice-pdf');

const MAX_HTML = 3.5 * 1024 * 1024;
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}
function fail(res, code, msg) {
  cors(res); res.statusCode = code;
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: msg }));
}
function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => { s += c; });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } });
  });
}
async function isActiveAdmin(token) {
  const h = { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const u = await fetch(SB + '/auth/v1/user', { headers: h });
  if (!u.ok) return false;
  const user = await u.json();
  if (!user || !user.id) return false;
  const r = await fetch(SB + '/rest/v1/rpc/is_active_admin', { method: 'POST', headers: h, body: JSON.stringify({ uid: user.id }) });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return fail(res, 405, 'POST only'); }
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return fail(res, 401, 'Not logged in');
  let ok = false;
  try { ok = await isActiveAdmin(token); } catch (e) { return fail(res, 502, 'Could not verify session'); }
  if (!ok) return fail(res, 403, 'Admin only');

  const body = await readBody(req);
  const html = typeof body.html === 'string' ? body.html : '';
  const size = body.size === 'receipt' ? 'receipt' : 'a4';
  if (!html || html.length > MAX_HTML) return fail(res, 400, 'Missing or oversized html');
  const name = String(body.filename || 'suppverse.pdf').replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.pdf$/i, '') + '.pdf';
  try {
    const pdf = await renderHtmlPdf({ html, size, bleed: !!body.bleed });
    cors(res); res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (e) {
    console.error('pdf error:', e);
    if (e instanceof RasterContentError) return fail(res, 422, 'Export blocked: the document contained non-vector content (blur, shadow or bitmap)');
    fail(res, 500, 'Could not create the PDF');
  }
};
