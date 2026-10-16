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
  const BN = 'unicode-range:U+0964-0965,U+0980-09FF,U+200C-200D,U+25CC;font-weight:100 900;';
  const LT = 'font-weight:100 900;';
  _css = [
    face('Plus Jakarta Sans', 'assets/fonts/inv/plus-jakarta-sans.woff2', LT),
    face('Plus Jakarta Sans', 'assets/fonts/inv/noto-sans-bengali.woff2', BN),
    face('DM Sans', 'assets/fonts/inv/dm-sans.woff2', LT),
    face('DM Sans', 'assets/fonts/inv/noto-sans-bengali.woff2', BN),
    face('BARABARA-FINAL', 'assets/fonts/barabara-final.woff2', 'font-weight:normal;font-style:normal;'),
    face('Noto Sans Bengali', 'assets/fonts/inv/noto-sans-bengali.woff2', 'font-weight:100 900;')
  ].join('\n');
  return _css;
}
function invoiceJs() { return _js || (_js = fs.readFileSync(path.join(ROOT, 'assets/js/sv-invoice.js'), 'utf8')); }

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
    const pdf = await page.pdf({ width: '794px', height: '1123px', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
module.exports = { renderInvoicePdf };
