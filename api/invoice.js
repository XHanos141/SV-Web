/* POST /api/invoice  { id }  + Authorization: Bearer <supabase access token>
   Returns the customer's own order invoice as a vector PDF. Ownership is enforced by Supabase itself:
   the order list is fetched with the caller's JWT through the same my_orders RPC the Orders page uses. */
const { SB, KEY } = require('./_site');
const { renderInvoicePdf, RasterContentError } = require('./_invoice-pdf');

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

module.exports = async (req, res) => {
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
  /* COD stays unpaid until delivery: no invoice while in transit (it is issued, as Paid, once delivered) */
  if (order.payment_method === 'cod' && ['paid', 'delivered'].indexOf(order.state) < 0) return fail(res, 409, 'Invoice is available once the order is delivered');

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
    if (e instanceof RasterContentError) return fail(res, 422, 'Export blocked: the invoice contained non-vector content');
    fail(res, 500, 'Could not create the PDF');
  }
};
