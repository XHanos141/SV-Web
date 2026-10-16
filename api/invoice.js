/* POST /api/invoice  { id }  + Authorization: Bearer <supabase access token>
   Returns the customer's own order invoice as a vector PDF. Ownership is enforced by Supabase itself:
   the order list is fetched with the caller's JWT through the same my_orders RPC the Orders page uses. */
const { SB, KEY } = require('./_site');
const { renderInvoicePdf } = require('./_invoice-pdf');

const OK_STATES = ['paid', 'processing', 'shipped', 'delivered'];

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => { s += c; });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } });
  });
}
function fail(res, code, msg) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: msg }));
}

/* TEMPORARY self-test (removed right after the first live check) */
async function selfTest(res) {
  const t = Date.now();
  try {
    const o = { id: 'x', order_number: 'SV-TEST', state: 'paid', created_at: '2026-10-11T09:57:00Z', customer: { name: '\u09b9\u09be\u09b8\u09be\u09a8 HASAN', phone: '01700000000', address: 'Dhaka' }, items: [{ name: 'Test item', qty: 2, price: 500 }], subtotal: 1000, discount: 0, shipping: 100, total: 1100 };
    const pdf = await renderInvoicePdf(o);
    const txt = pdf.toString('latin1');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, ms: Date.now() - t, bytes: pdf.length, header: txt.slice(0, 5), pages: (txt.match(/\/Type\s*\/Page[^s]/g) || []).length, rasterImages: (txt.match(/\/Subtype\s*\/Image/g) || []).length }));
  } catch (e) {
    res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, ms: Date.now() - t, error: String(e && e.stack || e).slice(0, 1500) }));
  }
}
module.exports = async (req, res) => {
  if (req.method === 'GET' && req.query && req.query.selftest === 'st64c0d07f995fe4d3') return selfTest(res);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'POST only'); }
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return fail(res, 401, 'Not logged in');
  const body = await readBody(req);
  const id = String(body.id || '');
  if (!id) return fail(res, 400, 'Missing order id');

  let order = null;
  try {
    const r = await fetch(SB + '/rest/v1/rpc/my_orders', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (r.status === 401 || r.status === 403) return fail(res, 401, 'Session expired');
    if (!r.ok) return fail(res, 502, 'Could not load your orders');
    const data = await r.json();
    order = (data && data.orders || []).find(o => o.id === id) || null;
  } catch (e) { return fail(res, 502, 'Could not load your orders'); }
  if (!order) return fail(res, 404, 'Order not found');
  if (OK_STATES.indexOf(order.state) < 0) return fail(res, 409, 'Invoice is available once the order is paid');

  try {
    const pdf = await renderInvoicePdf(order);
    const name = 'suppverse-invoice-' + String(order.order_number || 'order').replace(/[^A-Za-z0-9_-]/g, '') + '.pdf';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (e) {
    console.error('invoice pdf error:', e);
    fail(res, 500, 'Could not create the PDF');
  }
};
