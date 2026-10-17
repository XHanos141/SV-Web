/* Server-side vector PDF for the customer invoice.
   Same generator as the app (assets/js/sv-invoice.js) rendered in headless Chromium and printed with page.pdf(),
   so text/shapes stay vector (selectable, sharp at any zoom). Fonts are bundled: Lambda has no Bengali font, so the
   Taka sign and Bangla names are covered by Noto Sans Bengali mapped into each family via unicode-range. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const b64 = f => fs.readFileSync(path.join(ROOT, f)).toString('base64');

let _css, _js;
function fontCss() {
  if (_css) return _css;
  const face = (family, file, extra) =>
    "@font-face{font-family:'" + family + "';src:url(data:font/woff2;base64," + b64(file) + ") format('woff2');" + extra + "font-display:block}";
  const BN = 'unicode-range:U+0964-0965,U+0980-09FF,U+200C-200D,U+25CC;';
  /* Static per-weight instances (not variable fonts): Skia embeds variable fonts as heavy, slow-to-zoom Type 3 outlines,
     static fonts embed as compact subset TrueType. Bengali only covers the Taka sign / Bangla names. */
  const W = [400, 500, 600, 700, 800], BW = [400, 600, 700, 800];
  const fam = (family, file) => W.map(w => face(family, 'assets/fonts/inv/' + file + '-' + w + '.woff2', 'font-weight:' + w + ';font-style:normal;'));
  const bn = family => BW.map(w => face(family, 'assets/fonts/inv/noto-sans-bengali-' + w + '.woff2', BN + 'font-weight:' + w + ';font-style:normal;'));
  _css = [].concat(
    fam('Plus Jakarta Sans', 'plus-jakarta-sans'), bn('Plus Jakarta Sans'),
    fam('DM Sans', 'dm-sans'), bn('DM Sans'),
    [face('BARABARA-FINAL', 'assets/fonts/barabara-final.woff2', 'font-weight:normal;font-style:normal;'),
     face('Courier Prime', 'assets/fonts/inv/courier-prime-400.woff2', 'font-weight:400;font-style:normal;'),
     face('Courier Prime', 'assets/fonts/inv/courier-prime-700.woff2', 'font-weight:700;font-style:normal;')],
    bn('Courier Prime'),
    BW.map(w => face('Noto Sans Bengali', 'assets/fonts/inv/noto-sans-bengali-' + w + '.woff2', 'font-weight:' + w + ';font-style:normal;'))
  ).join('\n');
  return _css;
}
function invoiceJs() { return _js || (_js = fs.readFileSync(path.join(ROOT, 'assets/js/sv-invoice.js'), 'utf8')); }

/* Vector-only guarantee. Skia/PDF turns blur filters, blurred shadows, SVG filters and bitmap images into /Image XObjects.
   Any image object in the output means the page is not purely vector, so the export is refused instead of served. */
class RasterContentError extends Error { constructor() { super('PDF contains raster image content'); this.code = 'RASTER_CONTENT'; } }
function assertVector(pdf) {
  if (/\/Subtype\s*\/Image\b/.test(Buffer.from(pdf).toString('latin1'))) throw new RasterContentError();
  return pdf;
}

async function launch() {
  /* puppeteer-core / @sparticuz/chromium are ESM-only: require() fails on Vercel, so load them with import() */
  const pp = await import('puppeteer-core'); const puppeteer = pp.default || pp;
  if (process.env.CHROME_PATH) {            /* local testing */
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  }
  const cm = await import('@sparticuz/chromium'); const chromium = cm.default || cm;
  return puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    executablePath: await chromium.executablePath(),
    headless: 'shell'
  });
}

async function renderInvoicePdf(order) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"><style>' + fontCss() +
      '@page{size:794px 1123px;margin:0}html,body{margin:0;padding:0;background:#fff}' +
      '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '#root>div>div{break-after:page;page-break-after:always}#root>div>div:last-child{break-after:auto;page-break-after:auto}' +
      '</style></head><body><div id="root"></div></body></html>',
      { waitUntil: 'load' }
    );
    await page.addScriptTag({ content: invoiceJs() });
    /* fonts must be loaded BEFORE the generator measures row heights for pagination */
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load("800 16px 'BARABARA-FINAL'"), document.fonts.load("700 14px 'Plus Jakarta Sans'"),
        document.fonts.load("500 14px 'DM Sans'"), document.fonts.load("700 14px 'DM Sans'"),
        document.fonts.load("600 14px 'DM Sans'", '\u09f3'), document.fonts.load("700 14px 'Plus Jakarta Sans'", '\u09f3')
      ]);
      await document.fonts.ready;
    });
    await page.evaluate(o => { document.getElementById('root').innerHTML = window.svInvoice.html(o); }, order);
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ width: '794px', height: '1123px', printBackground: true, tagged: false, outline: false, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return assertVector(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
}

/* Generic HTML -> vector PDF for the dashboard app (admin-only route). The HTML is untrusted: a CSP forbids every script/
   network/frame inside the page and request interception aborts anything that is not a data: URI, so it can only paint. */
const CSP = "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const A4_SCALE = (210 - 16) / 25.4 * 96 / 794;      /* 8mm margins: fit the 794px layout into the printable width */
async function renderHtmlPdf({ html, size, bleed }) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => { const u = r.url(); (((u.startsWith('data:') && !/^data:image\/(?!svg\+xml)/i.test(u)) || u === 'about:blank') ? r.continue() : r.abort()); });
    const isReceipt = size === 'receipt';
    await page.setViewport({ width: isReceipt ? 302 : 794, height: 1123, deviceScaleFactor: 1 });
    const pageCss = isReceipt ? '@page{size:80mm 240mm;margin:0}' : (bleed ? '@page{size:794px 1123px;margin:0}' : '@page{size:210mm 297mm;margin:0}');
    const pagedCss = bleed && !isReceipt ? '#root>div>div{break-after:page;page-break-after:always}#root>div>div:last-child{break-after:auto;page-break-after:auto}' : '';
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + CSP + '"><style>' + fontCss() +
      pageCss + 'html,body{margin:0;padding:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' + pagedCss +
      '</style></head><body><div id="root">' + html + '</div></body></html>',
      { waitUntil: 'load' }
    );
    await page.evaluate(() => document.fonts.ready);
    let opts;
    if (isReceipt) {
      const h = await page.evaluate(() => Math.ceil(document.getElementById('root').getBoundingClientRect().height));
      opts = { width: '80mm', height: Math.max(h + 2, 300) + 'px', printBackground: true, tagged: false, outline: false, preferCSSPageSize: false, margin: { top: 0, right: 0, bottom: 0, left: 0 } };
      await page.addStyleTag({ content: '@page{size:80mm ' + opts.height + ';margin:0}' });
    } else if (bleed) {
      opts = { width: '794px', height: '1123px', printBackground: true, tagged: false, outline: false, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } };
    } else {
      opts = { format: 'A4', printBackground: true, tagged: false, outline: false, scale: A4_SCALE, margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' } };
    }
    return assertVector(Buffer.from(await page.pdf(opts)));
  } finally {
    await browser.close();
  }
}
module.exports = { renderInvoicePdf, renderHtmlPdf, assertVector, RasterContentError };
